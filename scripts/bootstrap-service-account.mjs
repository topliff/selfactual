// =============================================================================
// Bootstrap Service Account on CSS
//
// Creates a persistent service account on the Community Solid Server that the
// provisioning service (and future Pod Write Service) uses to write to user pods.
//
// This is a ONE-TIME setup script. Run it once, save the credentials, done.
//
// Uses the same CSS Account API flow validated in the provisioning service:
//   1. Create account (empty body → get authorization token)
//   2. Get account controls (discover endpoints)
//   3. Register password login (so we can re-login later if needed)
//   4. Create pod named "service"
//   5. Register client credentials tied to the service WebID
//
// Usage:
//   node bootstrap-service-account.mjs
//
// Output:
//   SERVICE_CLIENT_ID and SERVICE_CLIENT_SECRET for the provisioning .env
// =============================================================================

import crypto from "crypto";

const CSS_BASE_URL = process.env.CSS_BASE_URL || "https://vaults.selfactual.ai";
const SERVICE_EMAIL = "service@vaults.selfactual.ai";
const SERVICE_PASSWORD = crypto.randomBytes(32).toString("hex");

const pass = (msg) => console.log(`\x1b[32m✓ ${msg}\x1b[0m`);
const fail = (msg) => console.log(`\x1b[31m✗ ${msg}\x1b[0m`);
const info = (msg) => console.log(`\x1b[33m→ ${msg}\x1b[0m`);

async function main() {
  console.log("\n============================================");
  console.log("  SelfActual: Bootstrap Service Account");
  console.log("============================================\n");
  console.log(`CSS Base URL: ${CSS_BASE_URL}\n`);

  // Step 1: Create account
  info("Creating CSS account...");
  const createRes = await fetch(`${CSS_BASE_URL}/.account/account/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!createRes.ok) {
    fail(`Account creation failed: ${createRes.status} ${await createRes.text()}`);
    process.exit(1);
  }

  const { authorization } = await createRes.json();
  pass("Account created");

  // Step 2: Get controls
  info("Getting account controls...");
  const controlsRes = await fetch(`${CSS_BASE_URL}/.account/`, {
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      Accept: "application/json",
    },
  });

  const { controls } = await controlsRes.json();
  pass("Controls retrieved");

  // Step 3: Register password login
  info("Registering password login...");
  const passwordEndpoint = controls?.password?.create;
  if (!passwordEndpoint) {
    fail("No password registration endpoint found");
    process.exit(1);
  }

  const pwRes = await fetch(passwordEndpoint, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: SERVICE_EMAIL, password: SERVICE_PASSWORD }),
  });

  if (!pwRes.ok) {
    const errText = await pwRes.text();
    // 409 or 400 with "already" means email already registered — OK if re-running
    if (pwRes.status === 409 || (pwRes.status === 400 && errText.includes("already"))) {
      info("Password login already registered — continuing");
    } else {
      fail(`Password registration failed: ${pwRes.status} — ${errText}`);
      process.exit(1);
    }
  } else {
    pass("Password login registered");
  }

  // Step 4: Create pod named "service"
  info('Creating "service" pod...');
  const podEndpoint = controls?.account?.pod;
  if (!podEndpoint) {
    fail("No pod creation endpoint found");
    process.exit(1);
  }

  const podRes = await fetch(podEndpoint, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "service" }),
  });

  if (!podRes.ok) {
    const errText = await podRes.text();
    if (podRes.status === 409) {
      info('Pod "service" already exists (409) — continuing');
    } else {
      fail(`Pod creation failed: ${podRes.status} — ${errText}`);
      process.exit(1);
    }
  } else {
    const podData = await podRes.json();
    pass(`Pod created: ${JSON.stringify(podData)}`);
  }

  // Step 5: Register client credentials
  info("Registering client credentials...");
  const credEndpoint = controls?.account?.clientCredentials;
  if (!credEndpoint) {
    fail("No client credentials endpoint found");
    process.exit(1);
  }

  const serviceWebId = `${CSS_BASE_URL}/service/profile/card#me`;

  const credRes = await fetch(credEndpoint, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "SelfActual Service Account",
      webId: serviceWebId,
    }),
  });

  if (!credRes.ok) {
    const errText = await credRes.text();
    fail(`Credential registration failed: ${credRes.status} — ${errText}`);
    process.exit(1);
  }

  const credentials = await credRes.json();
  pass("Client credentials created");

  // Output
  console.log("\n============================================");
  console.log("  SERVICE ACCOUNT READY");
  console.log("============================================\n");
  console.log(`  WebID:  ${serviceWebId}`);
  console.log(`  Email:  ${SERVICE_EMAIL}`);
  console.log("");
  console.log("  Add these to the provisioning service .env:");
  console.log("  ─────────────────────────────────────────");
  console.log(`  SERVICE_CLIENT_ID=${credentials.id}`);
  console.log(`  SERVICE_CLIENT_SECRET=${credentials.secret}`);
  console.log("");
  console.log("  SAVE THE PASSWORD (for manual re-login if ever needed):");
  console.log("  ─────────────────────────────────────────");
  console.log(`  SERVICE_PASSWORD=${SERVICE_PASSWORD}`);
  console.log("");
  console.log("  Next steps:");
  console.log("  1. SSH into EC2 and update ~/provisioning/.env with the values above");
  console.log("  2. pm2 restart provisioning");
  console.log("  3. Re-run smoke test with SERVICE_CLIENT_ID/SECRET to verify step 5");
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
