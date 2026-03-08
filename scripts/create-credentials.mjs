// =============================================================================
// Step 1: Create Client Credentials
//
// Uses the CSS Account API to register a client credential (client_id + secret)
// tied to your WebID. Run this ONCE, then save the output for validate-pod.mjs.
//
// Usage:
//   node create-credentials.mjs
//
// You'll be prompted for email and password, or set env vars:
//   CSS_EMAIL=brad@selfactual.ai CSS_PASSWORD=xxx node create-credentials.mjs
// =============================================================================

const BASE_URL = "https://vaults.selfactual.ai";
const email = process.env.CSS_EMAIL;
const password = process.env.CSS_PASSWORD;

if (!email || !password) {
  console.error("Set CSS_EMAIL and CSS_PASSWORD environment variables first.");
  process.exit(1);
}

async function main() {
  console.log("\n=== SelfActual: Create Client Credentials ===\n");

  // Step 1: Login to account API
  console.log("→ Logging in to CSS account API...");
  const loginRes = await fetch(`${BASE_URL}/.account/login/password/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    console.error(`✗ Login failed: ${loginRes.status} ${await loginRes.text()}`);
    process.exit(1);
  }

  const { authorization } = await loginRes.json();
  console.log("✓ Login successful\n");

  // Step 2: Get account info (discover available controls)
  console.log("→ Fetching account controls...");
  const accountRes = await fetch(`${BASE_URL}/.account/`, {
    headers: { Authorization: `CSS-Account-Token ${authorization}` },
  });

  const accountInfo = await accountRes.json();
  console.log("✓ Account controls retrieved");
  
  // Show available controls for debugging
  console.log("  Controls:", JSON.stringify(accountInfo.controls, null, 2));
  console.log("");

  // Step 3: Find the WebID
  const webIdResource = accountInfo.controls?.account?.webId;
  if (webIdResource) {
    console.log("→ Fetching linked WebIDs...");
    const webIdRes = await fetch(webIdResource, {
      headers: { Authorization: `CSS-Account-Token ${authorization}` },
    });
    const webIdInfo = await webIdRes.json();
    console.log("  WebIDs:", JSON.stringify(webIdInfo.webIdLinks, null, 2));
    console.log("");
  }

  // Step 4: Create client credentials
  const clientCredentialsUrl = accountInfo.controls?.account?.clientCredentials;
  if (!clientCredentialsUrl) {
    console.error("✗ No client credentials endpoint found in account controls.");
    console.error("  Your CSS version may not support this flow.");
    console.error("  Available controls:", Object.keys(accountInfo.controls?.account || {}));
    process.exit(1);
  }

  console.log("→ Creating client credentials...");
  console.log(`  Endpoint: ${clientCredentialsUrl}`);

  const credRes = await fetch(clientCredentialsUrl, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "SelfActual Validation Script",
      // The WebID these credentials are for
      webId: `${BASE_URL}/test_pod/profile/card#me`,
    }),
  });

  if (!credRes.ok) {
    const errText = await credRes.text();
    console.error(`✗ Failed to create credentials: ${credRes.status}`);
    console.error(`  Response: ${errText}`);
    process.exit(1);
  }

  const credentials = await credRes.json();
  console.log("✓ Client credentials created!\n");
  console.log("============================================");
  console.log("  SAVE THESE — you'll need them for pod operations");
  console.log("============================================");
  console.log(`  Client ID:     ${credentials.id}`);
  console.log(`  Client Secret: ${credentials.secret}`);
  console.log(`  WebID:         ${BASE_URL}/test_pod/profile/card#me`);
  console.log("");
  console.log("  Export them:");
  console.log(`  export CSS_CLIENT_ID="${credentials.id}"`);
  console.log(`  export CSS_CLIENT_SECRET="${credentials.secret}"`);
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
