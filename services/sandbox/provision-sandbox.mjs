#!/usr/bin/env node

// Sandbox provisioning script for SelfActual partner testing.
// Creates sandbox user accounts, provisions dual pods, seeds sample data.
//
// Usage:
//   node provision-sandbox.mjs                      # Provision sandbox users + org
//   node provision-sandbox.mjs --create-partner-account  # Also create partner service account

import "dotenv/config";
import { Session } from "@inrupt/solid-client-authn-node";
import { createContainerAt } from "@inrupt/solid-client";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Configuration ───────────────────────────────────────────────────────────

const CSS_BASE_URL = process.env.CSS_BASE_URL || "https://vaults.selfactual.ai";
const SERVICE_CLIENT_ID = process.env.SERVICE_CLIENT_ID;
const SERVICE_CLIENT_SECRET = process.env.SERVICE_CLIENT_SECRET;
const SERVICE_WEBID = process.env.SERVICE_WEBID || "https://vaults.selfactual.ai/service/profile/card#me";

const CREATE_PARTNER = process.argv.includes("--create-partner-account");

const SANDBOX_USERS = [
  {
    username: "sandbox-alice",
    displayName: "Alice Torres",
    email: "sandbox-alice@selfactual.dev",
    data: [
      { file: "alice-starcard.ttl",        target: "sub/assessments/starcard" },
      { file: "alice-flow-attributes.ttl", target: "sub/assessments/flow-attributes" },
      { file: "alice-profile-summary.ttl", target: "sub/profile-summary" },
    ],
  },
  {
    username: "sandbox-bob",
    displayName: "Bob Nakamura",
    email: "sandbox-bob@selfactual.dev",
    data: [
      { file: "bob-starcard.ttl",          target: "sub/assessments/starcard" },
      { file: "bob-profile-summary.ttl",   target: "sub/profile-summary" },
    ],
  },
  {
    username: "sandbox-cara",
    displayName: "Cara Osei",
    email: "sandbox-cara@selfactual.dev",
    data: [
      { file: "cara-starcard.ttl",          target: "sub/assessments/starcard" },
      { file: "cara-flow-attributes.ttl",   target: "sub/assessments/flow-attributes" },
      { file: "cara-profile-summary.ttl",   target: "sub/profile-summary" },
    ],
  },
];

const ORG_POD = {
  username: "org-sandbox-acme",
  displayName: "Acme Corp (Sandbox)",
  email: "org-sandbox-acme@selfactual.dev",
};

// ─── CSS Account API (replicated from services/provisioning/src/css-client.mjs) ─

async function createCssAccount() {
  const res = await fetch(`${CSS_BASE_URL}/.account/account/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CSS account creation failed: ${res.status} — ${text}`);
  }
  const data = await res.json();
  if (!data.authorization) throw new Error("No authorization token returned");
  return { authorization: data.authorization };
}

async function getAccountControls(authorization) {
  const res = await fetch(`${CSS_BASE_URL}/.account/`, {
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Failed to get account controls: ${res.status}`);
  const data = await res.json();
  return data.controls;
}

async function registerPasswordLogin(authorization, controls, email, password) {
  const endpoint = controls?.password?.create;
  if (!endpoint) throw new Error("No password registration endpoint in controls");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Password registration failed: ${res.status} — ${text}`);
  }
  return res.json();
}

async function createPod(authorization, controls, podName) {
  const endpoint = controls?.account?.pod;
  if (!endpoint) throw new Error("No pod creation endpoint in controls");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: podName }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pod creation failed: ${res.status} — ${text}`);
  }
  return res.json();
}

async function registerCredentials(authorization, controls, name, webId) {
  const endpoint = controls?.account?.clientCredentials;
  if (!endpoint) throw new Error("No client credentials endpoint in controls");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, webId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Credential registration failed: ${res.status} — ${text}`);
  }
  return res.json();
}

// ─── ACL generators (replicated from services/provisioning/src/acl-generator.mjs) ─

function generateMasterAcl(username, webId) {
  const masterUrl = `${CSS_BASE_URL}/${username}/master/`;
  return `@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner>
    a acl:Authorization ;
    acl:agent           <${webId}> ;
    acl:accessTo        <${masterUrl}> ;
    acl:default         <${masterUrl}> ;
    acl:mode            acl:Read, acl:Write, acl:Control .

<#serviceWrite>
    a acl:Authorization ;
    acl:agent           <${SERVICE_WEBID}> ;
    acl:accessTo        <${masterUrl}> ;
    acl:default         <${masterUrl}> ;
    acl:mode            acl:Read, acl:Write .
`;
}

function generateSubAcl(username, webId, extraAgents = []) {
  const subUrl = `${CSS_BASE_URL}/${username}/sub/`;
  let acl = `@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner>
    a acl:Authorization ;
    acl:agent           <${webId}> ;
    acl:accessTo        <${subUrl}> ;
    acl:default         <${subUrl}> ;
    acl:mode            acl:Read, acl:Write, acl:Control .

<#firstPartyAppRead>
    a acl:Authorization ;
    acl:origin          <https://app.selfactual.ai> ;
    acl:accessTo        <${subUrl}> ;
    acl:default         <${subUrl}> ;
    acl:mode            acl:Read .

<#serviceWrite>
    a acl:Authorization ;
    acl:agent           <${SERVICE_WEBID}> ;
    acl:accessTo        <${subUrl}> ;
    acl:default         <${subUrl}> ;
    acl:mode            acl:Read, acl:Write .
`;

  // Add extra read agents (e.g. partner service account)
  for (const agent of extraAgents) {
    acl += `
<#partnerRead_${agent.name}>
    a acl:Authorization ;
    acl:agent           <${agent.webId}> ;
    acl:accessTo        <${subUrl}> ;
    acl:default         <${subUrl}> ;
    acl:mode            acl:Read .
`;
  }

  return acl;
}

// ─── Container scaffolding (replicated from services/provisioning/src/scaffolding.mjs) ─

async function createContainerStructure(session, podUrl) {
  const containers = [
    `${podUrl}master/`,
    `${podUrl}sub/`,
    `${podUrl}master/profile/`,
    `${podUrl}master/assessments/`,
    `${podUrl}master/reflections/`,
    `${podUrl}master/reflections/strength-reflections/`,
    `${podUrl}master/context/`,
    `${podUrl}master/provenance/`,
    `${podUrl}sub/assessments/`,
    `${podUrl}sub/context/`,
  ];

  for (const url of containers) {
    try {
      await createContainerAt(url, { fetch: session.fetch });
      log(`  Created container: ${url}`);
    } catch (err) {
      if (err.statusCode === 409 || err.message?.includes("409")) {
        log(`  Container exists: ${url}`);
      } else {
        throw new Error(`Failed to create container ${url}: ${err.message}`);
      }
    }
  }
}

async function writeAcls(session, podUrl, masterAclTurtle, subAclTurtle) {
  const masterRes = await session.fetch(`${podUrl}master/.acl`, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: masterAclTurtle,
  });
  if (!masterRes.ok) {
    throw new Error(`Master ACL write failed: ${masterRes.status}`);
  }

  const subRes = await session.fetch(`${podUrl}sub/.acl`, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: subAclTurtle,
  });
  if (!subRes.ok) {
    throw new Error(`Sub ACL write failed: ${subRes.status}`);
  }
}

async function writeProfileCard(session, podUrl, username, displayName) {
  const cardUrl = `${podUrl}master/profile/card`;
  const meUrl = `${cardUrl}#me`;
  const turtle = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix sa:   <https://vocab.selfactual.ai/> .

<${meUrl}>
    a foaf:Person, sa:VaultOwner ;
    foaf:name       "${displayName}" ;
    sa:masterPod    <${CSS_BASE_URL}/${username}/master/> ;
    sa:subPod       <${CSS_BASE_URL}/${username}/sub/> .
`;

  const res = await session.fetch(cardUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: turtle,
  });
  if (!res.ok) {
    throw new Error(`Profile card write failed: ${res.status}`);
  }
}

async function writeAstFramework(session, resourceUrl) {
  const turtle = fs.readFileSync(path.join(__dirname, "data", "ast-framework.ttl"), "utf-8");
  const res = await session.fetch(resourceUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: turtle,
  });
  if (!res.ok) {
    throw new Error(`AST framework write failed at ${resourceUrl}: ${res.status}`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(msg);
}

function generatePassword() {
  return crypto.randomBytes(24).toString("base64url");
}

async function podExists(username) {
  try {
    const res = await fetch(`${CSS_BASE_URL}/${username}/`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Provisioning Flow ──────────────────────────────────────────────────────

async function provisionAccount(username, displayName, email) {
  const exists = await podExists(username);
  if (exists) {
    log(`  Pod ${username}/ already exists — skipping account creation`);
    return { existed: true, webId: `${CSS_BASE_URL}/${username}/profile/card#me` };
  }

  log(`  Creating CSS account for ${username}...`);
  const { authorization } = await createCssAccount();
  const controls = await getAccountControls(authorization);

  const password = generatePassword();
  await registerPasswordLogin(authorization, controls, email, password);
  log(`  Registered password login: ${email}`);

  const podResult = await createPod(authorization, controls, username);
  log(`  Created pod: ${podResult.pod || podResult.podUrl}`);

  const webId = podResult.webId || `${CSS_BASE_URL}/${username}/profile/card#me`;
  const creds = await registerCredentials(authorization, controls, `${username}-sandbox`, webId);
  log(`  Registered client credentials: ${creds.id}`);

  return { existed: false, webId, clientId: creds.id, clientSecret: creds.secret, authorization };
}

async function authenticateAs(clientId, clientSecret) {
  const session = new Session();
  await session.login({
    clientId,
    clientSecret,
    oidcIssuer: `${CSS_BASE_URL}/`,
  });
  if (!session.info.isLoggedIn) {
    throw new Error("Session login failed");
  }
  return session;
}

async function seedUserData(session, username, dataEntries) {
  const podUrl = `${CSS_BASE_URL}/${username}/`;

  for (const entry of dataEntries) {
    const filePath = path.join(__dirname, "data", entry.file);
    const turtle = fs.readFileSync(filePath, "utf-8");
    const targetUrl = `${podUrl}${entry.target}`;

    const res = await session.fetch(targetUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/turtle" },
      body: turtle,
    });

    if (res.ok) {
      log(`  Seeded: ${entry.target}`);
    } else {
      log(`  ⚠ Failed to seed ${entry.target}: ${res.status}`);
    }
  }
}

async function provisionUser(userConfig, serviceSession) {
  const { username, displayName, email, data } = userConfig;
  log(`\n── Provisioning ${username} (${displayName}) ──`);

  const account = await provisionAccount(username, displayName, email);
  const podUrl = `${CSS_BASE_URL}/${username}/`;

  // Use user's own session if freshly created, otherwise service account
  let session;
  let ownSession = false;
  if (!account.existed && account.clientId) {
    session = await authenticateAs(account.clientId, account.clientSecret);
    ownSession = true;
  } else {
    session = serviceSession;
  }

  // Scaffold containers (idempotent — tolerates 409)
  await createContainerStructure(session, podUrl);

  // Write ACLs (idempotent — PUT overwrites)
  const masterAcl = generateMasterAcl(username, account.webId);
  const subAcl = generateSubAcl(username, account.webId);
  await writeAcls(session, podUrl, masterAcl, subAcl);
  log(`  ACLs written`);

  // Write profile card + AST framework
  await writeProfileCard(session, podUrl, username, displayName);
  await writeAstFramework(session, `${podUrl}master/context/ast-framework`);
  await writeAstFramework(session, `${podUrl}sub/context/ast-framework`);
  log(`  Profile card + AST framework written`);

  // Seed sandbox data into sub pod
  await seedUserData(session, username, data);

  if (ownSession) {
    await session.logout();
  }

  return account;
}

async function provisionOrgPod(serviceSession) {
  const { username, displayName, email } = ORG_POD;
  log(`\n── Provisioning org pod: ${username} ──`);

  const account = await provisionAccount(username, displayName, email);
  const podUrl = `${CSS_BASE_URL}/${username}/`;

  let session;
  let ownSession = false;
  if (!account.existed && account.clientId) {
    session = await authenticateAs(account.clientId, account.clientSecret);
    ownSession = true;
  } else {
    session = serviceSession;
  }

  // Create minimal container structure for org pod
  const containers = [`${podUrl}teams/`, `${podUrl}context/`];
  for (const url of containers) {
    try {
      await createContainerAt(url, { fetch: session.fetch });
      log(`  Created container: ${url}`);
    } catch (err) {
      if (err.statusCode === 409 || err.message?.includes("409")) {
        log(`  Container exists: ${url}`);
      } else {
        throw err;
      }
    }
  }

  // Write org profile
  const orgProfileTurtle = `@prefix schema: <http://schema.org/> .
@prefix sa:     <https://vocab.selfactual.ai/> .

<>
    a schema:Organization, sa:OrgPod ;
    schema:name "${displayName}" .
`;
  const profileRes = await session.fetch(`${podUrl}profile`, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: orgProfileTurtle,
  });
  if (!profileRes.ok) log(`  ⚠ Org profile write failed: ${profileRes.status}`);
  else log(`  Org profile written`);

  // Write team roster
  const rosterTurtle = fs.readFileSync(
    path.join(__dirname, "data", "org-acme-team-engineering.ttl"),
    "utf-8"
  );
  const rosterRes = await session.fetch(`${podUrl}teams/engineering`, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: rosterTurtle,
  });
  if (!rosterRes.ok) log(`  ⚠ Team roster write failed: ${rosterRes.status}`);
  else log(`  Team roster written`);

  // Write AST framework
  await writeAstFramework(session, `${podUrl}context/ast-framework`);
  log(`  AST framework written`);

  if (ownSession) {
    await session.logout();
  }
}

async function provisionPartnerAccount(serviceSession) {
  log(`\n── Creating partner test service account ──`);

  const username = "partner-test-service";
  const account = await provisionAccount(username, "Partner Test Service", "partner-test@selfactual.dev");

  if (account.existed) {
    log(`  Partner account already exists`);
    return null;
  }

  // Update each sandbox user's sub pod ACL to include partner read access
  for (const user of SANDBOX_USERS) {
    const webId = `${CSS_BASE_URL}/${user.username}/profile/card#me`;
    const subAcl = generateSubAcl(user.username, webId, [
      { name: "partner-test", webId: account.webId },
    ]);
    const podUrl = `${CSS_BASE_URL}/${user.username}/`;
    const res = await serviceSession.fetch(`${podUrl}sub/.acl`, {
      method: "PUT",
      headers: { "Content-Type": "text/turtle" },
      body: subAcl,
    });
    if (res.ok) log(`  Updated ${user.username}/sub/.acl with partner read`);
    else log(`  ⚠ Failed to update ${user.username}/sub/.acl: ${res.status}`);
  }

  return {
    webId: account.webId,
    clientId: account.clientId,
    clientSecret: account.clientSecret,
  };
}

// ─── Verification ────────────────────────────────────────────────────────────

async function verify(serviceSession) {
  log(`\n── Verification ──`);

  const results = [];

  for (const user of SANDBOX_USERS) {
    const checks = [
      `${user.username}/master/profile/card`,
      `${user.username}/master/context/ast-framework`,
      `${user.username}/sub/context/ast-framework`,
      ...user.data.map((d) => `${user.username}/${d.target}`),
    ];

    let allOk = true;
    for (const resource of checks) {
      const url = `${CSS_BASE_URL}/${resource}`;
      const res = await serviceSession.fetch(url, { method: "GET" });
      if (!res.ok) {
        log(`  ✗ ${resource} — ${res.status}`);
        allOk = false;
      }
      // Consume body to avoid connection issues
      await res.text();
    }
    const status = allOk ? "✅" : "⚠️";
    const dataList = user.data.map((d) => d.target.split("/").pop()).join(", ");
    results.push(`${status} ${user.username}: master + sub pods, ${dataList}`);
  }

  // Verify org pod
  const orgChecks = [
    `${ORG_POD.username}/profile`,
    `${ORG_POD.username}/teams/engineering`,
    `${ORG_POD.username}/context/ast-framework`,
  ];
  let orgOk = true;
  for (const resource of orgChecks) {
    const url = `${CSS_BASE_URL}/${resource}`;
    const res = await serviceSession.fetch(url, { method: "GET" });
    if (!res.ok) {
      log(`  ✗ ${resource} — ${res.status}`);
      orgOk = false;
    }
    await res.text();
  }
  results.push(`${orgOk ? "✅" : "⚠️"} ${ORG_POD.username}: profile, teams/engineering`);

  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Validate required env vars
  if (!SERVICE_CLIENT_ID || !SERVICE_CLIENT_SECRET) {
    console.error("Missing required env vars: SERVICE_CLIENT_ID, SERVICE_CLIENT_SECRET");
    console.error("Copy .env.example to .env and fill in the values.");
    process.exit(1);
  }

  log("SelfActual Sandbox Provisioning");
  log("================================");
  log(`CSS Base URL: ${CSS_BASE_URL}`);
  log(`Service WebID: ${SERVICE_WEBID}`);
  log(`Partner account: ${CREATE_PARTNER ? "will create" : "skipped"}`);

  // Authenticate as service account (for verification + re-run scaffolding)
  log(`\nAuthenticating as service account...`);
  const serviceSession = await authenticateAs(SERVICE_CLIENT_ID, SERVICE_CLIENT_SECRET);
  log(`Authenticated as: ${serviceSession.info.webId}`);

  // Provision sandbox users
  for (const user of SANDBOX_USERS) {
    await provisionUser(user, serviceSession);
  }

  // Provision org pod
  await provisionOrgPod(serviceSession);

  // Optional: partner account
  let partnerResult = null;
  if (CREATE_PARTNER) {
    partnerResult = await provisionPartnerAccount(serviceSession);
  }

  // Verify
  const results = await verify(serviceSession);

  // Summary
  log(`\nSandbox Provisioning Complete`);
  log(`=============================`);
  for (const r of results) log(r);
  log(`✅ Framework context seeded in all pods`);
  log(`\nPartner test account: ${partnerResult ? "created" : "skipped"}`);

  if (partnerResult) {
    log(`\nPartner credentials:`);
    log(`  WebID:         ${partnerResult.webId}`);
    log(`  Client ID:     ${partnerResult.clientId}`);
    log(`  Client Secret: ${partnerResult.clientSecret}`);
  }

  await serviceSession.logout();
}

main().catch((err) => {
  console.error("\nProvisioning failed:", err.message);
  process.exit(1);
});
