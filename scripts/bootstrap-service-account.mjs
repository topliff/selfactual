// =============================================================================
// Bootstrap Service Account on CSS
//
// Creates a dedicated service account with its own pod at /service/.
// The resulting client credentials allow the Pod Write Service to
// authenticate via Solid-OIDC and write to any user pod (once ACLs grant it).
//
// Usage:
//   node bootstrap-service-account.mjs
//
// This script should only be run ONCE.
// =============================================================================

import crypto from "crypto";

const BASE_URL = "https://vaults.selfactual.ai";
const SERVICE_EMAIL = "service@vaults.selfactual.ai";
const SERVICE_PASSWORD = crypto.randomBytes(32).toString("hex");
const SERVICE_POD_NAME = "service";
const SERVICE_WEBID = `${BASE_URL}/${SERVICE_POD_NAME}/profile/card#me`;

async function main() {
  console.log("\n=== SelfActual: Bootstrap Service Account ===\n");
  console.log(`  CSS:      ${BASE_URL}`);
  console.log(`  Email:    ${SERVICE_EMAIL}`);
  console.log(`  Pod:      /${SERVICE_POD_NAME}/`);
  console.log(`  WebID:    ${SERVICE_WEBID}`);
  console.log("");

  // Step 1: Discover unauthenticated controls
  console.log("→ Step 1: Discovering CSS account API endpoints...");
  const discoverRes = await fetch(`${BASE_URL}/.account/`, {
    headers: { Accept: "application/json" },
  });
  const { controls: unauthControls } = await discoverRes.json();

  const accountCreateUrl = unauthControls?.account?.create;
  if (!accountCreateUrl) {
    console.error("✗ No account creation endpoint found");
    process.exit(1);
  }
  console.log("✓ Controls discovered\n");

  // Step 2: Create account
  console.log("→ Step 2: Creating CSS account...");
  const createRes = await fetch(accountCreateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!createRes.ok) {
    console.error(`✗ Account creation failed: ${createRes.status} ${await createRes.text()}`);
    process.exit(1);
  }

  const { authorization } = await createRes.json();
  console.log("✓ Account created\n");

  // Step 3: Get authenticated controls
  console.log("→ Step 3: Fetching authenticated controls...");
  const authRes = await fetch(`${BASE_URL}/.account/`, {
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      Accept: "application/json",
    },
  });
  const { controls: authControls } = await authRes.json();
  console.log("✓ Authenticated controls retrieved\n");

  // Step 4: Register password login
  console.log("→ Step 4: Registering password login...");
  const passwordCreateUrl = authControls?.password?.create;
  if (!passwordCreateUrl) {
    console.error("✗ No password create endpoint found");
    process.exit(1);
  }

  const pwRes = await fetch(passwordCreateUrl, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: SERVICE_EMAIL, password: SERVICE_PASSWORD }),
  });

  if (!pwRes.ok) {
    console.error(`✗ Password registration failed: ${pwRes.status} ${await pwRes.text()}`);
    process.exit(1);
  }
  console.log("✓ Password login registered\n");

  // Step 5: Create pod
  console.log("→ Step 5: Creating service pod...");
  const podCreateUrl = authControls?.account?.pod;
  if (!podCreateUrl) {
    console.error("✗ No pod creation endpoint found");
    process.exit(1);
  }

  const podRes = await fetch(podCreateUrl, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: SERVICE_POD_NAME }),
  });

  if (!podRes.ok) {
    const errText = await podRes.text();
    console.error(`✗ Pod creation failed: ${podRes.status} — ${errText}`);
    process.exit(1);
  }

  const podData = await podRes.json();
  const podUrl = podData.podBaseUrl || podData.pod || `${BASE_URL}/${SERVICE_POD_NAME}/`;
  console.log(`✓ Pod created at ${podUrl}\n`);

  // Step 6: Create client credentials
  console.log("→ Step 6: Creating client credentials...");
  const credEndpoint = authControls?.account?.clientCredentials;
  if (!credEndpoint) {
    console.error("✗ No client credentials endpoint found");
    process.exit(1);
  }

  const credRes = await fetch(credEndpoint, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "SelfActual Service Account",
      webId: SERVICE_WEBID,
    }),
  });

  if (!credRes.ok) {
    const errText = await credRes.text();
    console.error(`✗ Credential creation failed: ${credRes.status} — ${errText}`);
    process.exit(1);
  }

  const credentials = await credRes.json();
  console.log("✓ Client credentials created\n");

  // Output
  console.log("============================================");
  console.log("  SERVICE ACCOUNT CREDENTIALS");
  console.log("============================================");
  console.log(`  WebID:          ${SERVICE_WEBID}`);
  console.log(`  Email:          ${SERVICE_EMAIL}`);
  console.log(`  Password:       ${SERVICE_PASSWORD}`);
  console.log(`  Client ID:      ${credentials.id}`);
  console.log(`  Client Secret:  ${credentials.secret}`);
  console.log("");
  console.log("  Add these lines to ~/provisioning/.env on EC2:");
  console.log("");
  console.log(`SERVICE_CLIENT_ID=${credentials.id}`);
  console.log(`SERVICE_CLIENT_SECRET=${credentials.secret}`);
  console.log("============================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
