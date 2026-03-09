/**
 * SelfActual Developer Guide — Example: Write an Assessment
 *
 * Demonstrates:
 *  1. Authenticating as a service account
 *  2. Building an RDF resource with @inrupt/solid-client
 *  3. Writing it to a user's sub pod via HTTP PUT
 *  4. Including required provenance metadata
 *
 * IMPORTANT: Your service account must have acl:Write on the target sub pod.
 */

import "dotenv/config";
import { Session } from "@inrupt/solid-client-authn-node";
import {
  createSolidDataset,
  createThing,
  setThing,
  setUrl,
  setInteger,
  setStringNoLocale,
  setDatetime,
  saveSolidDatasetAt,
  getSolidDataset,
  getThing,
  getInteger,
} from "@inrupt/solid-client";

const SA = "https://vocab.selfactual.ai/";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const DCTERMS = "http://purl.org/dc/terms/";

const BASE_URL = "https://vaults.selfactual.ai";
const USERNAME = process.env.TARGET_USERNAME || "sandbox-alice";

// Your app's namespace for app-specific predicates
const MYAPP = "https://vocab.example-partner.com/";

async function main() {
  // --- 1. Authenticate ---
  const session = new Session();

  console.log("Authenticating...");
  await session.login({
    clientId: process.env.SERVICE_CLIENT_ID,
    clientSecret: process.env.SERVICE_CLIENT_SECRET,
    oidcIssuer: process.env.SELFACTUAL_OIDC_ISSUER,
  });

  if (!session.info.isLoggedIn) {
    console.error("Authentication failed.");
    process.exit(1);
  }
  console.log(`Authenticated as: ${session.info.webId}\n`);

  // --- 2. Build the assessment resource ---
  const resourceUrl = `${BASE_URL}/${USERNAME}/sub/assessments/example-partner-assessment`;
  const now = new Date();

  let assessment = createThing({ url: resourceUrl });

  // Required: RDF types
  assessment = setUrl(assessment, RDF + "type", SA + "Assessment");
  assessment = setUrl(assessment, RDF + "type", MYAPP + "PartnerAssessment");

  // Required: provenance
  assessment = setDatetime(assessment, DCTERMS + "created", now);
  assessment = setDatetime(assessment, DCTERMS + "modified", now);
  assessment = setStringNoLocale(assessment, SA + "sourceApp", "ExamplePartnerApp");
  assessment = setStringNoLocale(assessment, SA + "sourceVersion", "1.0.0");

  // Optional: link to the AST framework (if your assessment relates to it)
  assessment = setUrl(
    assessment,
    SA + "framework",
    "https://vocab.selfactual.ai/frameworks/ast"
  );

  // Your app-specific data (using your namespace)
  assessment = setInteger(assessment, MYAPP + "engagementScore", 85);
  assessment = setInteger(assessment, MYAPP + "resilienceScore", 72);
  assessment = setStringNoLocale(assessment, MYAPP + "assessmentType", "quarterly-review");

  // Cross-reference to existing Star Card (if relevant)
  assessment = setUrl(
    assessment,
    SA + "relatedAssessment",
    `${BASE_URL}/${USERNAME}/sub/assessments/starcard`
  );

  let dataset = createSolidDataset();
  dataset = setThing(dataset, assessment);

  // --- 3. Write to the pod ---
  console.log(`Writing to: ${resourceUrl}`);

  try {
    await saveSolidDatasetAt(resourceUrl, dataset, { fetch: session.fetch });
    console.log("Write successful.\n");
  } catch (err) {
    if (err.statusCode === 403) {
      console.error("Not authorized to write. Check your ACL grants.");
      process.exit(1);
    }
    throw err;
  }

  // --- 4. Verify by reading it back ---
  console.log("Verifying — reading back...");
  const readDataset = await getSolidDataset(resourceUrl, { fetch: session.fetch });
  const readThing = getThing(readDataset, resourceUrl);

  if (readThing) {
    const engagement = getInteger(readThing, MYAPP + "engagementScore");
    const resilience = getInteger(readThing, MYAPP + "resilienceScore");
    const source = getStringNoLocale(readThing, SA + "sourceApp");
    console.log(`  Engagement: ${engagement}`);
    console.log(`  Resilience: ${resilience}`);
    console.log(`  Source:     ${source}`);
    console.log("\nRound-trip verified.");
  }

  await session.logout();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
