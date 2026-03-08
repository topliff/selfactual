// =============================================================================
// Step 0: Validate Programmatic Pod Creation
//
// Tests the untested assumption: can we create a CSS account AND pod entirely
// via the API (no web UI)?
//
// CSS v0.5 Account API flow:
//   1. GET /.account/ (unauthed) → discover registration endpoints
//   2. POST /.account/account/ → create account, get CSS-Account-Token
//   3. GET /.account/ (authed) → discover pod/credential endpoints
//   4. Register password login via controls
//   5. Create pod via controls
//   6. Register client credentials
//   7. Authenticate via Solid-OIDC and create test containers
//
// Usage:
//   node tests/test-programmatic-pod.mjs
// =============================================================================

import { createContainerAt } from "@inrupt/solid-client";
import { Session } from "@inrupt/solid-client-authn-node";

const BASE_URL = "https://vaults.selfactual.ai";

// Generate unique test credentials
const timestamp = Date.now();
const testEmail = `test-provision-${timestamp}@vaults.selfactual.ai`;
const testPassword = `test-pass-${timestamp}-${Math.random().toString(36).slice(2)}`;
const testPodName = `testpod${timestamp}`;

// Helpers
const pass = (msg) => console.log(`\x1b[32m✓ ${msg}\x1b[0m`);
const fail = (msg) => console.log(`\x1b[31m✗ ${msg}\x1b[0m`);
const info = (msg) => console.log(`\x1b[33m→ ${msg}\x1b[0m`);

let results = { passed: 0, failed: 0 };

function check(condition, passMsg, failMsg) {
  if (condition) {
    pass(passMsg);
    results.passed++;
    return true;
  } else {
    fail(failMsg || passMsg);
    results.failed++;
    return false;
  }
}

async function main() {
  console.log("\n============================================");
  console.log("  Step 0: Validate Programmatic Pod Creation");
  console.log("============================================\n");
  console.log(`  CSS:       ${BASE_URL}`);
  console.log(`  Email:     ${testEmail}`);
  console.log(`  Pod name:  ${testPodName}`);
  console.log("");

  // =========================================================================
  // Step 1: Discover unauthenticated controls
  // =========================================================================
  info("Step 1: Discovering CSS account API endpoints...");

  let unauthControls;
  try {
    const res = await fetch(`${BASE_URL}/.account/`, {
      headers: { Accept: "application/json" },
    });
    const data = await res.json();
    unauthControls = data.controls;
    console.log("  API version:", data.version);
    console.log("  Available endpoints:", JSON.stringify(unauthControls, null, 2));
    check(!!unauthControls, "Unauthenticated controls discovered");
  } catch (err) {
    fail(`Discovery error: ${err.message}`);
    results.failed++;
    process.exit(1);
  }

  // =========================================================================
  // Step 2: Create account
  // =========================================================================
  info("Step 2: Creating CSS account...");

  let authorization;
  const accountCreateUrl = unauthControls?.account?.create;

  if (!accountCreateUrl) {
    fail("No account creation endpoint found");
    results.failed++;
    process.exit(1);
  }

  try {
    info(`  POST ${accountCreateUrl}`);
    const createRes = await fetch(accountCreateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const createData = await createRes.json();
    console.log("  Response:", JSON.stringify(createData, null, 2));
    authorization = createData.authorization;
    check(!!authorization, "Account created — got CSS-Account-Token", `Account creation failed: HTTP ${createRes.status}`);
  } catch (err) {
    fail(`Account creation error: ${err.message}`);
    results.failed++;
    process.exit(1);
  }

  // =========================================================================
  // Step 3: Get authenticated controls
  // =========================================================================
  info("Step 3: Fetching authenticated controls...");

  let authControls;
  try {
    const res = await fetch(`${BASE_URL}/.account/`, {
      headers: {
        Authorization: `CSS-Account-Token ${authorization}`,
        Accept: "application/json",
      },
    });
    const data = await res.json();
    authControls = data.controls;
    console.log("  Authenticated controls:", JSON.stringify(authControls, null, 2));
    check(!!authControls, "Authenticated controls retrieved");
  } catch (err) {
    fail(`Controls fetch error: ${err.message}`);
    results.failed++;
    process.exit(1);
  }

  // =========================================================================
  // Step 4: Register password login
  // =========================================================================
  info("Step 4: Registering password login...");

  // Look for password registration endpoint in authenticated controls
  const passwordCreateUrl = authControls?.password?.create;
  if (passwordCreateUrl) {
    try {
      info(`  POST ${passwordCreateUrl}`);
      const pwRes = await fetch(passwordCreateUrl, {
        method: "POST",
        headers: {
          Authorization: `CSS-Account-Token ${authorization}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });

      if (pwRes.ok) {
        const pwData = await pwRes.json();
        console.log("  Response:", JSON.stringify(pwData, null, 2));
        check(true, "Password login registered");
      } else {
        const errText = await pwRes.text();
        fail(`Password registration failed: HTTP ${pwRes.status} — ${errText}`);
        results.failed++;
      }
    } catch (err) {
      fail(`Password registration error: ${err.message}`);
      results.failed++;
    }
  } else {
    info("  No password create endpoint in authenticated controls — may not be needed");
    // Try the unauthenticated password registration endpoint
    const htmlPwRegister = unauthControls?.html?.password?.register;
    if (htmlPwRegister) {
      info(`  Trying HTML registration endpoint: ${htmlPwRegister}`);
    }
  }

  // =========================================================================
  // Step 5: Create a pod
  // =========================================================================
  console.log("");
  info("Step 5: Creating pod...");

  let podUrl;
  let webId;

  const podCreateUrl = authControls?.account?.pod;
  if (!podCreateUrl) {
    fail("No pod creation endpoint found in authenticated controls");
    console.log("  Available account controls:", Object.keys(authControls?.account || {}));
    results.failed++;
    printSummary();
    process.exit(1);
  }

  try {
    info(`  POST ${podCreateUrl}`);
    const podRes = await fetch(podCreateUrl, {
      method: "POST",
      headers: {
        Authorization: `CSS-Account-Token ${authorization}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: testPodName }),
    });

    const podData = await podRes.json();
    console.log("  Response:", JSON.stringify(podData, null, 2));

    if (podRes.ok) {
      // Extract pod URL — CSS may return different field names
      podUrl = podData.podBaseUrl || podData.pod || `${BASE_URL}/${testPodName}/`;

      // Normalize: ensure trailing slash
      if (!podUrl.endsWith("/")) podUrl += "/";

      // Extract or find WebID
      webId = podData.webId || podData.webID;

      if (!webId) {
        // Check WebID links
        const webIdEndpoint = authControls?.account?.webId;
        if (webIdEndpoint) {
          const webIdRes = await fetch(webIdEndpoint, {
            headers: { Authorization: `CSS-Account-Token ${authorization}` },
          });
          const webIdData = await webIdRes.json();
          console.log("  WebID links:", JSON.stringify(webIdData, null, 2));
          const links = webIdData.webIdLinks || {};
          webId = Object.keys(links)[0];
        }
      }

      if (!webId) {
        webId = `${BASE_URL}/${testPodName}/profile/card#me`;
        info(`  Using constructed WebID: ${webId}`);
      }

      pass(`Pod created at ${podUrl}`);
      pass(`WebID: ${webId}`);
    } else {
      fail(`Pod creation failed: HTTP ${podRes.status}`);
      results.failed++;
    }
  } catch (err) {
    fail(`Pod creation error: ${err.message}`);
    results.failed++;
  }

  if (!podUrl) {
    console.log("\n✗ Cannot continue without a pod. Aborting.\n");
    printSummary();
    process.exit(1);
  }

  // =========================================================================
  // Step 6: Register client credentials
  // =========================================================================
  console.log("");
  info("Step 6: Registering client credentials...");

  let clientId, clientSecret;
  const credEndpoint = authControls?.account?.clientCredentials;

  if (!credEndpoint) {
    fail("No client credentials endpoint in controls");
    results.failed++;
    printSummary();
    process.exit(1);
  }

  try {
    info(`  POST ${credEndpoint}`);
    const credRes = await fetch(credEndpoint, {
      method: "POST",
      headers: {
        Authorization: `CSS-Account-Token ${authorization}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Test Provisioning ${timestamp}`,
        webId: webId,
      }),
    });

    if (credRes.ok) {
      const credData = await credRes.json();
      clientId = credData.id;
      clientSecret = credData.secret;
      check(!!clientId && !!clientSecret, `Credentials created (id: ${clientId?.slice(0, 20)}...)`, "Missing id or secret in response");
    } else {
      const errText = await credRes.text();
      fail(`Credential creation failed: HTTP ${credRes.status} — ${errText}`);
      results.failed++;
    }
  } catch (err) {
    fail(`Credential creation error: ${err.message}`);
    results.failed++;
  }

  if (!clientId || !clientSecret) {
    console.log("\n✗ Cannot continue without credentials. Aborting.\n");
    printSummary();
    process.exit(1);
  }

  // =========================================================================
  // Step 7: Authenticate via Solid-OIDC and create test containers
  // =========================================================================
  console.log("");
  info("Step 7: Authenticating via Solid-OIDC...");

  const session = new Session();
  try {
    await session.login({
      clientId,
      clientSecret,
      oidcIssuer: BASE_URL,
    });

    check(session.info.isLoggedIn, `Authenticated as ${session.info.webId}`, "Solid-OIDC authentication failed");
  } catch (err) {
    fail(`Solid-OIDC auth error: ${err.message}`);
    results.failed++;
    printSummary();
    process.exit(1);
  }

  // Create the dual-pod container structure
  console.log("");
  info("Creating container structure...");

  const testContainers = [
    `${podUrl}master/`,
    `${podUrl}sub/`,
    `${podUrl}master/assessments/`,
    `${podUrl}master/reflections/`,
    `${podUrl}master/reflections/strength-reflections/`,
    `${podUrl}master/context/`,
    `${podUrl}master/provenance/`,
    `${podUrl}sub/assessments/`,
    `${podUrl}sub/context/`,
  ];

  let containersPassed = 0;
  for (const url of testContainers) {
    try {
      await createContainerAt(url, { fetch: session.fetch });
      pass(`Created ${url.replace(podUrl, "/")}`);
      containersPassed++;
    } catch (err) {
      if (err.statusCode === 409 || err.message?.includes("409")) {
        pass(`${url.replace(podUrl, "/")} already exists`);
        containersPassed++;
      } else {
        fail(`${url.replace(podUrl, "/")} — ${err.message}`);
        results.failed++;
      }
    }
  }

  check(
    containersPassed === testContainers.length,
    `All ${testContainers.length} containers created`,
    `Only ${containersPassed}/${testContainers.length} containers created`
  );

  // =========================================================================
  // Bonus: Test ACL write via Solid-OIDC
  // =========================================================================
  console.log("");
  info("Bonus: Testing ACL write to master container...");

  try {
    const serviceWebId = "https://vaults.selfactual.ai/service/profile/card#me";
    const aclTurtle = `@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner>
    a acl:Authorization ;
    acl:agent           <${webId}> ;
    acl:accessTo        <${podUrl}master/> ;
    acl:default         <${podUrl}master/> ;
    acl:mode            acl:Read, acl:Write, acl:Control .

<#serviceWrite>
    a acl:Authorization ;
    acl:agent           <${serviceWebId}> ;
    acl:accessTo        <${podUrl}master/> ;
    acl:default         <${podUrl}master/> ;
    acl:mode            acl:Write .
`;

    const aclRes = await session.fetch(`${podUrl}master/.acl`, {
      method: "PUT",
      headers: { "Content-Type": "text/turtle" },
      body: aclTurtle,
    });

    if (aclRes.ok) {
      check(true, `ACL written to master/.acl (HTTP ${aclRes.status})`);
    } else {
      const errText = await aclRes.text();
      fail(`ACL write failed: HTTP ${aclRes.status} — ${errText}`);
      results.failed++;
    }
  } catch (err) {
    fail(`ACL write error: ${err.message}`);
    results.failed++;
  }

  // Clean up session
  await session.logout();

  // =========================================================================
  // Summary
  // =========================================================================
  printSummary();

  console.log("Pod details (saved for inspection):");
  console.log(`  Pod URL:    ${podUrl}`);
  console.log(`  WebID:      ${webId}`);
  console.log(`  Email:      ${testEmail}`);
  console.log(`  Password:   ${testPassword}`);
  console.log(`  Client ID:  ${clientId}`);
  console.log("");

  if (results.failed > 0) {
    process.exit(1);
  }
}

function printSummary() {
  console.log("\n============================================");
  console.log("  Results");
  console.log("============================================");
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Status: ${results.failed === 0 ? "✅ ALL PASSED" : "❌ SOME FAILED"}`);
  console.log("============================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
