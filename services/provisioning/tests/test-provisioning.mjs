// =============================================================================
// End-to-end smoke test for the Provisioning Service
//
// Prerequisites:
//   1. Provisioning service running on PORT (default 3001)
//   2. Postgres running with schema.sql applied
//   3. .env configured with CSS credentials and PROVISIONING_API_TOKEN
//   4. Service account exists on CSS with SERVICE_CLIENT_ID/SECRET
//
// Usage:
//   node tests/test-provisioning.mjs
//
// Environment:
//   PROVISIONING_URL  — base URL (default http://localhost:3001)
//   PROVISIONING_TOKEN — API token matching PROVISIONING_API_TOKEN in .env
//   SERVICE_CLIENT_ID  — for verifying pod contents via Solid-OIDC
//   SERVICE_CLIENT_SECRET
// =============================================================================

import { Session } from "@inrupt/solid-client-authn-node";
import { getSolidDataset, getThing, getStringNoLocale, getUrl } from "@inrupt/solid-client";

const BASE = process.env.PROVISIONING_URL || "http://localhost:3001";
const TOKEN = process.env.PROVISIONING_TOKEN;
const CSS_BASE_URL = process.env.CSS_BASE_URL || "https://vaults.selfactual.ai";
const SERVICE_CLIENT_ID = process.env.SERVICE_CLIENT_ID;
const SERVICE_CLIENT_SECRET = process.env.SERVICE_CLIENT_SECRET;

if (!TOKEN) {
  console.error("Set PROVISIONING_TOKEN env var");
  process.exit(1);
}

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

const timestamp = Date.now();
const testAuth0Sub = `auth0|test-${timestamp}`;
const testUserId = `${timestamp}`;
const testDisplayName = `Test User ${timestamp}`;

async function main() {
  console.log("\n============================================");
  console.log("  Provisioning Service — Smoke Test");
  console.log("============================================\n");

  // =========================================================================
  // 1. Health check
  // =========================================================================
  info("1. Health check...");
  try {
    const healthRes = await fetch(`${BASE}/health`);
    const healthData = await healthRes.json();
    check(healthRes.ok && healthData.status === "ok", "Health check passed");
  } catch (err) {
    fail(`Health check failed: ${err.message}`);
    results.failed++;
    console.log("\nIs the service running? Start it with: npm run dev\n");
    process.exit(1);
  }

  // =========================================================================
  // 2. Provision a test user
  // =========================================================================
  info("2. Provisioning test user...");
  let provisionResult;
  try {
    const res = await fetch(`${BASE}/provision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        auth0Sub: testAuth0Sub,
        userId: testUserId,
        displayName: testDisplayName,
      }),
    });

    provisionResult = await res.json();
    console.log("  Response:", JSON.stringify(provisionResult, null, 2));

    check(res.ok, `Provisioning returned HTTP ${res.status}`);
    check(provisionResult.status === "complete", "Status is 'complete'");
    check(!!provisionResult.masterPodUrl, `Master pod: ${provisionResult.masterPodUrl}`);
    check(!!provisionResult.subPodUrl, `Sub pod: ${provisionResult.subPodUrl}`);
    check(!!provisionResult.webId, `WebID: ${provisionResult.webId}`);
    check(!!provisionResult.username, `Username: ${provisionResult.username}`);
  } catch (err) {
    fail(`Provisioning failed: ${err.message}`);
    results.failed++;
    printSummary();
    process.exit(1);
  }

  // =========================================================================
  // 3. Check idempotency (duplicate should 409)
  // =========================================================================
  info("3. Testing duplicate provisioning (should 409)...");
  try {
    const dupRes = await fetch(`${BASE}/provision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        auth0Sub: testAuth0Sub,
        userId: testUserId,
        displayName: testDisplayName,
      }),
    });

    check(dupRes.status === 409, `Duplicate returns 409 (got ${dupRes.status})`);
  } catch (err) {
    fail(`Duplicate test failed: ${err.message}`);
    results.failed++;
  }

  // =========================================================================
  // 4. Check status endpoint
  // =========================================================================
  info("4. Checking status endpoint...");
  try {
    const statusRes = await fetch(`${BASE}/status/${encodeURIComponent(testAuth0Sub)}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    const statusData = await statusRes.json();
    check(statusRes.ok, "Status endpoint returned 200");
    check(statusData.status === "complete", `Status is '${statusData.status}'`);
    check(statusData.username === provisionResult.username, `Username matches: ${statusData.username}`);
  } catch (err) {
    fail(`Status check failed: ${err.message}`);
    results.failed++;
  }

  // =========================================================================
  // 5. Verify pod contents via Solid-OIDC (if service credentials provided)
  // =========================================================================
  if (SERVICE_CLIENT_ID && SERVICE_CLIENT_SECRET) {
    console.log("");
    info("5. Verifying pod contents via Solid-OIDC...");

    const session = new Session();
    try {
      await session.login({
        clientId: SERVICE_CLIENT_ID,
        clientSecret: SERVICE_CLIENT_SECRET,
        oidcIssuer: CSS_BASE_URL,
      });

      check(session.info.isLoggedIn, "Service account authenticated");

      // Check profile card
      const profileUrl = `${provisionResult.masterPodUrl}profile/card`;
      try {
        const profileDs = await getSolidDataset(profileUrl, { fetch: session.fetch });
        const meThing = getThing(profileDs, `${profileUrl}#me`);
        if (meThing) {
          const name = getStringNoLocale(meThing, "http://xmlns.com/foaf/0.1/name");
          check(name === testDisplayName, `Profile name: "${name}"`);
          const masterLink = getUrl(meThing, "https://vocab.selfactual.ai/masterPod");
          check(!!masterLink, `Profile has masterPod link: ${masterLink}`);
        } else {
          fail("Profile card #me thing not found");
          results.failed++;
        }
      } catch (err) {
        fail(`Profile card read failed: ${err.message}`);
        results.failed++;
      }

      // Check AST framework context in master
      try {
        const fwRes = await session.fetch(`${provisionResult.masterPodUrl}context/ast-framework`, {
          headers: { Accept: "text/turtle" },
        });
        check(fwRes.ok, `Master AST framework context readable (HTTP ${fwRes.status})`);
      } catch (err) {
        fail(`Master framework context read failed: ${err.message}`);
        results.failed++;
      }

      // Check AST framework context in sub
      try {
        const fwRes = await session.fetch(`${provisionResult.subPodUrl}context/ast-framework`, {
          headers: { Accept: "text/turtle" },
        });
        check(fwRes.ok, `Sub AST framework context readable (HTTP ${fwRes.status})`);
      } catch (err) {
        fail(`Sub framework context read failed: ${err.message}`);
        results.failed++;
      }

      // Check master ACL exists
      try {
        const aclRes = await session.fetch(`${provisionResult.masterPodUrl}.acl`, {
          headers: { Accept: "text/turtle" },
        });
        check(aclRes.ok, `Master ACL exists (HTTP ${aclRes.status})`);
      } catch (err) {
        fail(`Master ACL check failed: ${err.message}`);
        results.failed++;
      }

      await session.logout();
    } catch (err) {
      fail(`Service account auth failed: ${err.message}`);
      results.failed++;
    }
  } else {
    info("5. Skipping pod verification (no SERVICE_CLIENT_ID/SECRET provided)");
  }

  // =========================================================================
  // 6. Auth check (missing token should 401)
  // =========================================================================
  console.log("");
  info("6. Testing auth enforcement...");
  try {
    const noAuthRes = await fetch(`${BASE}/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth0Sub: "test", userId: "1", displayName: "Test" }),
    });
    check(noAuthRes.status === 401, `No-auth request returns 401 (got ${noAuthRes.status})`);
  } catch (err) {
    fail(`Auth test failed: ${err.message}`);
    results.failed++;
  }

  printSummary();

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
