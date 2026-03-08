import express from "express";
import { Session } from "@inrupt/solid-client-authn-node";

import {
  createCssAccount,
  getAccountControls,
  extractAccountId,
  registerPasswordLogin,
  createPod,
  registerCredentials,
} from "./css-client.mjs";
import { generateMasterAcl, generateSubAcl } from "./acl-generator.mjs";
import { createContainerStructure, writeAcls, writeInitialDocuments } from "./scaffolding.mjs";
import { resolveUsername } from "./username.mjs";
import { createVaultAccount, getByAuth0Sub, updateStatus, usernameExists } from "./database.mjs";

const router = express.Router();

const CSS_BASE_URL = process.env.CSS_BASE_URL || "https://vaults.selfactual.ai";
const SERVICE_CLIENT_ID = process.env.SERVICE_CLIENT_ID;
const SERVICE_CLIENT_SECRET = process.env.SERVICE_CLIENT_SECRET;
const SERVICE_WEBID = process.env.SERVICE_WEBID || "https://vaults.selfactual.ai/service/profile/card#me";
const PROVISIONING_API_TOKEN = process.env.PROVISIONING_API_TOKEN;

// Auth middleware: Bearer token check
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7);
  if (token !== PROVISIONING_API_TOKEN) {
    return res.status(403).json({ error: "Invalid API token" });
  }

  next();
}

// POST /provision
router.post("/provision", requireAuth, async (req, res) => {
  const { auth0Sub, userId, displayName } = req.body;

  if (!auth0Sub || !userId || !displayName) {
    return res.status(400).json({ error: "Missing required fields: auth0Sub, userId, displayName" });
  }

  // Check if already provisioned
  const existing = await getByAuth0Sub(auth0Sub);
  if (existing) {
    if (existing.provisioning_status === "complete") {
      return res.status(409).json({
        error: "User already provisioned",
        status: existing.provisioning_status,
        masterPodUrl: existing.master_pod_url,
        subPodUrl: existing.sub_pod_url,
        webId: existing.web_id,
        username: existing.username,
      });
    }
    // If previously failed, allow retry via this endpoint
    if (existing.provisioning_status === "failed") {
      // Fall through to re-provision
    } else {
      return res.status(409).json({
        error: "Provisioning already in progress",
        status: existing.provisioning_status,
      });
    }
  }

  try {
    // 1. Resolve unique username
    const username = await resolveUsername(displayName, usernameExists);

    // 2. Create CSS account
    const { authorization } = await createCssAccount();
    const controls = await getAccountControls(authorization);
    const cssAccountId = extractAccountId(controls);

    // 3. Register password login (generated credentials — not user-facing)
    const generatedEmail = `${username}-${Date.now()}@vaults.selfactual.ai`;
    const generatedPassword = `vault-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await registerPasswordLogin(authorization, controls, generatedEmail, generatedPassword);

    // 4. Create pod
    const podData = await createPod(authorization, controls, username);
    const podUrl = podData.pod;
    const webId = podData.webId;
    const masterPodUrl = `${CSS_BASE_URL}/${username}/master/`;
    const subPodUrl = `${CSS_BASE_URL}/${username}/sub/`;

    // 5. Register client credentials for the new user account
    //    (needed to authenticate as this user for container/ACL operations)
    const creds = await registerCredentials(authorization, controls, `Vault ${username}`, webId);

    // 6. Insert DB record (or update if retrying)
    let dbRecord;
    if (existing) {
      dbRecord = await updateStatus(auth0Sub, "pending");
    } else {
      dbRecord = await createVaultAccount({
        userId,
        auth0Sub,
        cssAccountId,
        username,
        webId,
        masterPodUrl,
        subPodUrl,
        provisioningStatus: "pending",
      });
    }

    // 7. Authenticate as the new user via Solid-OIDC
    const session = new Session();
    await session.login({
      clientId: creds.id,
      clientSecret: creds.secret,
      oidcIssuer: CSS_BASE_URL,
    });

    if (!session.info.isLoggedIn) {
      throw new Error("Solid-OIDC authentication failed for new user");
    }

    try {
      // 8. Create container structure
      await createContainerStructure(session, podUrl);

      // 9. Write ACLs
      const masterAcl = generateMasterAcl(username, webId, SERVICE_WEBID);
      const subAcl = generateSubAcl(username, webId, SERVICE_WEBID);
      await writeAcls(session, podUrl, masterAcl, subAcl);

      // 10. Write initial documents (profile card, framework context)
      await writeInitialDocuments(session, podUrl, username, displayName);

      // 11. Mark as complete
      await updateStatus(auth0Sub, "complete");
      await session.logout();

      res.json({
        status: "complete",
        masterPodUrl,
        subPodUrl,
        webId,
        username,
      });
    } catch (scaffoldErr) {
      await session.logout();
      throw scaffoldErr;
    }
  } catch (err) {
    console.error(`Provisioning failed for ${auth0Sub}:`, err);

    // Update status to failed
    try {
      await updateStatus(auth0Sub, "failed", err.message);
    } catch (dbErr) {
      console.error("Failed to update status:", dbErr);
    }

    // Determine error type for status code
    const statusCode = err.message?.includes("CSS") || err.message?.includes("Pod") ? 502 : 500;
    res.status(statusCode).json({
      error: "Provisioning failed",
      message: err.message,
    });
  }
});

// GET /status/:auth0Sub
router.get("/status/:auth0Sub", requireAuth, async (req, res) => {
  try {
    const record = await getByAuth0Sub(req.params.auth0Sub);
    if (!record) {
      return res.status(404).json({ error: "No provisioning record found" });
    }

    res.json({
      status: record.provisioning_status,
      masterPodUrl: record.master_pod_url,
      subPodUrl: record.sub_pod_url,
      webId: record.web_id,
      username: record.username,
      lastError: record.last_error,
      provisionedAt: record.provisioned_at,
    });
  } catch (err) {
    console.error("Status check failed:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /retry/:auth0Sub
router.post("/retry/:auth0Sub", requireAuth, async (req, res) => {
  try {
    const record = await getByAuth0Sub(req.params.auth0Sub);
    if (!record) {
      return res.status(404).json({ error: "No provisioning record found" });
    }

    if (record.provisioning_status === "complete") {
      return res.status(409).json({ error: "Already provisioned", status: "complete" });
    }

    // Re-trigger provisioning by forwarding to the provision endpoint
    req.body = {
      auth0Sub: record.auth0_sub,
      userId: record.user_id,
      displayName: "Retry", // displayName isn't used on retry since username already exists
    };

    // Delegate to the provision handler
    // For simplicity, just return instructions
    res.json({
      message: "Use POST /provision with the original auth0Sub, userId, and displayName to retry",
      currentStatus: record.provisioning_status,
      lastError: record.last_error,
    });
  } catch (err) {
    console.error("Retry check failed:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
