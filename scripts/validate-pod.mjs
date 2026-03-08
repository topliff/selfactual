// =============================================================================
// SelfActual Pod Validation Script (Node.js)
//
// Uses @inrupt/solid-client with proper Solid-OIDC authentication to:
//   1. Authenticate using client credentials
//   2. Create master/ and sub/ container structure
//   3. Write a Star Card assessment to both pods
//   4. Write a reflection to master only
//   5. Read everything back and verify
//   6. Test unauthenticated access (should fail on master)
//
// Prerequisites:
//   1. Run `npm install` in this directory
//   2. Run `node create-credentials.mjs` to get client credentials
//   3. Export the credentials:
//      export CSS_CLIENT_ID="your-client-id"
//      export CSS_CLIENT_SECRET="your-client-secret"
//
// Usage:
//   node validate-pod.mjs
// =============================================================================

import {
  getSolidDataset,
  createSolidDataset,
  saveSolidDatasetAt,
  createContainerAt,
  getSourceUrl,
  createThing,
  setThing,
  setUrl,
  setStringNoLocale,
  setInteger,
  setBoolean,
  setDatetime,
  getThing,
  getInteger,
  getStringNoLocale,
  getUrl,
} from "@inrupt/solid-client";

import { Session } from "@inrupt/solid-client-authn-node";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = "https://vaults.selfactual.ai";
const POD_URL = `${BASE_URL}/test_pod`;
const WEBID = `${POD_URL}/profile/card#me`;

const CLIENT_ID = process.env.CSS_CLIENT_ID;
const CLIENT_SECRET = process.env.CSS_CLIENT_SECRET;

// Custom vocabulary namespace
const SA = "https://vocab.selfactual.ai/";
const DCTERMS = "http://purl.org/dc/terms/";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const pass = (msg) => console.log(`\x1b[32m✓ ${msg}\x1b[0m`);
const fail = (msg) => console.log(`\x1b[31m✗ ${msg}\x1b[0m`);
const info = (msg) => console.log(`\x1b[33m→ ${msg}\x1b[0m`);

async function tryCreateContainer(url, session) {
  try {
    await createContainerAt(url, { fetch: session.fetch });
    pass(`Created ${url.replace(POD_URL, "")}`);
    return true;
  } catch (err) {
    if (err.statusCode === 409 || err.message?.includes("409")) {
      pass(`${url.replace(POD_URL, "")} already exists`);
      return true;
    }
    fail(`${url.replace(POD_URL, "")} — ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n============================================");
  console.log("  SelfActual Pod Validation");
  console.log("============================================\n");

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("Missing credentials. Run create-credentials.mjs first, then:");
    console.error('  export CSS_CLIENT_ID="your-client-id"');
    console.error('  export CSS_CLIENT_SECRET="your-client-secret"');
    process.exit(1);
  }

  // =========================================================================
  // Step 1: Authenticate
  // =========================================================================
  info("Authenticating via Solid-OIDC...");

  const session = new Session();
  await session.login({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    oidcIssuer: BASE_URL,
  });

  if (session.info.isLoggedIn) {
    pass(`Authenticated as ${session.info.webId}`);
  } else {
    fail("Authentication failed");
    process.exit(1);
  }

  console.log("");

  // =========================================================================
  // Step 2: Read existing profile
  // =========================================================================
  info("Reading existing profile...");
  try {
    const profileDs = await getSolidDataset(`${POD_URL}/profile/card`, {
      fetch: session.fetch,
    });
    const profileThing = getThing(profileDs, WEBID);
    if (profileThing) {
      pass("Profile readable");
    } else {
      info("Profile dataset loaded but WebID thing not found");
    }
  } catch (err) {
    fail(`Could not read profile: ${err.message}`);
  }

  console.log("");

  // =========================================================================
  // Step 3: Create container structure
  // =========================================================================
  info("Creating container structure...");

  const containers = [
    `${POD_URL}/master/`,
    `${POD_URL}/sub/`,
    `${POD_URL}/master/assessments/`,
    `${POD_URL}/master/reflections/`,
    `${POD_URL}/master/reflections/strength-reflections/`,
    `${POD_URL}/master/context/`,
    `${POD_URL}/master/provenance/`,
    `${POD_URL}/sub/assessments/`,
    `${POD_URL}/sub/context/`,
  ];

  for (const containerUrl of containers) {
    await tryCreateContainer(containerUrl, session);
  }

  console.log("");

  // =========================================================================
  // Step 4: Write Star Card to MASTER (with reflection link)
  // =========================================================================
  info("Writing Star Card to master pod...");

  try {
    let masterStarcard = createThing({ url: `${POD_URL}/master/assessments/starcard#it` });

    // Types
    masterStarcard = setUrl(masterStarcard, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", `${SA}Assessment`);
    masterStarcard = setUrl(masterStarcard, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", `${SA}StarCard`);

    // Metadata
    masterStarcard = setDatetime(masterStarcard, `${DCTERMS}created`, new Date("2026-02-27T12:00:00Z"));
    masterStarcard = setDatetime(masterStarcard, `${DCTERMS}modified`, new Date("2026-02-27T12:00:00Z"));
    masterStarcard = setUrl(masterStarcard, `${SA}framework`, `${SA}frameworks/ast`);
    masterStarcard = setStringNoLocale(masterStarcard, `${SA}sourceApp`, "AllStarTeams");
    masterStarcard = setStringNoLocale(masterStarcard, `${SA}sourceVersion`, "2.1.7");

    // Quadrant scores
    masterStarcard = setInteger(masterStarcard, `${SA}thinking`, 78);
    masterStarcard = setInteger(masterStarcard, `${SA}acting`, 65);
    masterStarcard = setInteger(masterStarcard, `${SA}feeling`, 82);
    masterStarcard = setInteger(masterStarcard, `${SA}planning`, 71);

    // Derived
    masterStarcard = setStringNoLocale(masterStarcard, `${SA}dominantQuadrant`, "feeling");
    masterStarcard = setStringNoLocale(masterStarcard, `${SA}profileShape`, "Connector");

    // MASTER ONLY: link to reflections
    masterStarcard = setUrl(
      masterStarcard,
      `${SA}hasReflections`,
      `${POD_URL}/master/reflections/strength-reflections/`
    );

    let masterDs = createSolidDataset();
    masterDs = setThing(masterDs, masterStarcard);

    await saveSolidDatasetAt(`${POD_URL}/master/assessments/starcard`, masterDs, {
      fetch: session.fetch,
    });

    pass("Star Card → master (with reflection link)");
  } catch (err) {
    fail(`Star Card → master failed: ${err.message}`);
  }

  // =========================================================================
  // Step 5: Write Star Card to SUB (NO reflection link)
  // =========================================================================
  info("Writing Star Card to sub pod (no reflection link)...");

  try {
    let subStarcard = createThing({ url: `${POD_URL}/sub/assessments/starcard#it` });

    subStarcard = setUrl(subStarcard, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", `${SA}Assessment`);
    subStarcard = setUrl(subStarcard, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", `${SA}StarCard`);
    subStarcard = setDatetime(subStarcard, `${DCTERMS}created`, new Date("2026-02-27T12:00:00Z"));
    subStarcard = setDatetime(subStarcard, `${DCTERMS}modified`, new Date("2026-02-27T12:00:00Z"));
    subStarcard = setUrl(subStarcard, `${SA}framework`, `${SA}frameworks/ast`);
    subStarcard = setStringNoLocale(subStarcard, `${SA}sourceApp`, "AllStarTeams");
    subStarcard = setStringNoLocale(subStarcard, `${SA}sourceVersion`, "2.1.7");
    subStarcard = setInteger(subStarcard, `${SA}thinking`, 78);
    subStarcard = setInteger(subStarcard, `${SA}acting`, 65);
    subStarcard = setInteger(subStarcard, `${SA}feeling`, 82);
    subStarcard = setInteger(subStarcard, `${SA}planning`, 71);
    subStarcard = setStringNoLocale(subStarcard, `${SA}dominantQuadrant`, "feeling");
    subStarcard = setStringNoLocale(subStarcard, `${SA}profileShape`, "Connector");

    // NO hasReflections link in sub pod

    let subDs = createSolidDataset();
    subDs = setThing(subDs, subStarcard);

    await saveSolidDatasetAt(`${POD_URL}/sub/assessments/starcard`, subDs, {
      fetch: session.fetch,
    });

    pass("Star Card → sub (no reflection link)");
  } catch (err) {
    fail(`Star Card → sub failed: ${err.message}`);
  }

  console.log("");

  // =========================================================================
  // Step 6: Write reflection to MASTER only
  // =========================================================================
  info("Writing test reflection to master (private)...");

  try {
    let reflection = createThing({
      url: `${POD_URL}/master/reflections/strength-reflections/thinking#it`,
    });

    reflection = setUrl(reflection, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", `${SA}Reflection`);
    reflection = setDatetime(reflection, `${DCTERMS}created`, new Date("2026-02-27T12:30:00Z"));
    reflection = setUrl(reflection, `${SA}framework`, `${SA}frameworks/ast`);
    reflection = setStringNoLocale(reflection, `${SA}sourceApp`, "AllStarTeams");
    reflection = setStringNoLocale(reflection, `${SA}reflectionSet`, "strength-reflections");
    reflection = setStringNoLocale(reflection, `${SA}reflectionDimension`, "thinking");
    reflection = setUrl(
      reflection,
      `${SA}aboutAssessment`,
      `${POD_URL}/master/assessments/starcard#it`
    );
    reflection = setInteger(reflection, `${SA}aboutScore`, 78);
    reflection = setStringNoLocale(reflection, `${SA}dimensionLabel`, "Thinking");
    reflection = setStringNoLocale(
      reflection,
      `${SA}dimensionDescription`,
      "Analytical and strategic reasoning — how you process information, solve problems, and make decisions."
    );
    reflection = setStringNoLocale(
      reflection,
      `${SA}prompt`,
      "Reflect on how your Thinking strength shows up in your daily work."
    );
    reflection = setStringNoLocale(
      reflection,
      `${SA}response`,
      "I notice my analytical side comes out most in planning sessions. I tend to map dependencies before anyone else sees them, which helps the team avoid surprises."
    );
    reflection = setBoolean(reflection, `${SA}completed`, true);

    let reflectionDs = createSolidDataset();
    reflectionDs = setThing(reflectionDs, reflection);

    await saveSolidDatasetAt(
      `${POD_URL}/master/reflections/strength-reflections/thinking`,
      reflectionDs,
      { fetch: session.fetch }
    );

    pass("Reflection → master");
  } catch (err) {
    fail(`Reflection → master failed: ${err.message}`);
  }

  console.log("");

  // =========================================================================
  // Step 7: Read back and verify
  // =========================================================================
  info("Reading Star Card from master...");

  try {
    const masterDs = await getSolidDataset(`${POD_URL}/master/assessments/starcard`, {
      fetch: session.fetch,
    });
    const masterThing = getThing(masterDs, `${POD_URL}/master/assessments/starcard#it`);

    if (masterThing) {
      pass("Master Star Card readable");

      const feeling = getInteger(masterThing, `${SA}feeling`);
      if (feeling === 82) {
        pass(`Feeling score round-tripped: ${feeling}`);
      } else {
        fail(`Feeling score: expected 82, got ${feeling}`);
      }

      const reflLink = getUrl(masterThing, `${SA}hasReflections`);
      if (reflLink) {
        pass(`Master has reflection link: ${reflLink}`);
      } else {
        fail("Master missing reflection link");
      }

      const shape = getStringNoLocale(masterThing, `${SA}profileShape`);
      pass(`Profile shape: ${shape}`);
    } else {
      fail("Could not find Star Card thing in master dataset");
    }
  } catch (err) {
    fail(`Read master failed: ${err.message}`);
  }

  console.log("");
  info("Reading Star Card from sub...");

  try {
    const subDs = await getSolidDataset(`${POD_URL}/sub/assessments/starcard`, {
      fetch: session.fetch,
    });
    const subThing = getThing(subDs, `${POD_URL}/sub/assessments/starcard#it`);

    if (subThing) {
      pass("Sub Star Card readable");

      const reflLink = getUrl(subThing, `${SA}hasReflections`);
      if (reflLink) {
        fail(`Sub has reflection link (SHOULD NOT): ${reflLink}`);
      } else {
        pass("Sub has NO reflection link ✓");
      }

      const feeling = getInteger(subThing, `${SA}feeling`);
      pass(`Sub feeling score: ${feeling}`);
    } else {
      fail("Could not find Star Card thing in sub dataset");
    }
  } catch (err) {
    fail(`Read sub failed: ${err.message}`);
  }

  console.log("");
  info("Reading reflection from master...");

  try {
    const reflDs = await getSolidDataset(
      `${POD_URL}/master/reflections/strength-reflections/thinking`,
      { fetch: session.fetch }
    );
    const reflThing = getThing(
      reflDs,
      `${POD_URL}/master/reflections/strength-reflections/thinking#it`
    );

    if (reflThing) {
      pass("Reflection readable from master");

      const assessLink = getUrl(reflThing, `${SA}aboutAssessment`);
      if (assessLink) {
        pass(`Reflection links to assessment: ${assessLink}`);
      } else {
        fail("Reflection missing assessment link");
      }

      const response = getStringNoLocale(reflThing, `${SA}response`);
      if (response && response.includes("analytical")) {
        pass("Reflection text round-tripped");
      } else {
        fail("Reflection text issue");
      }

      const score = getInteger(reflThing, `${SA}aboutScore`);
      pass(`Linked score: ${score}`);
    } else {
      fail("Could not find reflection thing");
    }
  } catch (err) {
    fail(`Read reflection failed: ${err.message}`);
  }

  console.log("");

  // =========================================================================
  // Step 8: Test unauthenticated access
  // =========================================================================
  info("Testing unauthenticated access to master...");

  try {
    // Use plain fetch (no session) — should be denied
    const unauthRes = await fetch(`${POD_URL}/master/assessments/starcard`, {
      headers: { Accept: "text/turtle" },
    });

    if (unauthRes.status === 401 || unauthRes.status === 403) {
      pass(`Master DENIED without auth (HTTP ${unauthRes.status})`);
    } else {
      info(`Master returned HTTP ${unauthRes.status} without auth (check default ACLs)`);
    }
  } catch (err) {
    fail(`Unauth test error: ${err.message}`);
  }

  info("Testing unauthenticated access to sub...");

  try {
    const unauthSubRes = await fetch(`${POD_URL}/sub/assessments/starcard`, {
      headers: { Accept: "text/turtle" },
    });
    info(`Sub returned HTTP ${unauthSubRes.status} without auth (default ACL behavior)`);
  } catch (err) {
    fail(`Unauth sub test error: ${err.message}`);
  }

  console.log("");

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("============================================");
  console.log("  Validation Complete");
  console.log("============================================\n");
  console.log(`Pod:    ${POD_URL}/`);
  console.log(`WebID:  ${WEBID}\n`);
  console.log("Resources:");
  console.log(`  ${POD_URL}/master/assessments/starcard       (Star Card + reflection link)`);
  console.log(`  ${POD_URL}/sub/assessments/starcard           (Star Card, no reflection link)`);
  console.log(`  ${POD_URL}/master/reflections/strength-reflections/thinking  (private reflection)`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Set WAC ACLs (master=owner-only, sub=app-readable)");
  console.log("  2. Create a second account to test cross-pod access");
  console.log("  3. Build the AST pod-write service");
  console.log("");

  // Clean up session
  await session.logout();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
