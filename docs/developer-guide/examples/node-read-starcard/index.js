/**
 * SelfActual Developer Guide — Example: Read a Star Card
 *
 * Demonstrates:
 *  1. Authenticating as a service account via Solid-OIDC
 *  2. Reading a Star Card assessment from a user's sub pod
 *  3. Parsing RDF data with @inrupt/solid-client
 *  4. Reading the AST framework context for dimension definitions
 */

import "dotenv/config";
import { Session } from "@inrupt/solid-client-authn-node";
import {
  getSolidDataset,
  getThing,
  getThingAll,
  getInteger,
  getStringNoLocale,
  getUrl,
  getUrlAll,
} from "@inrupt/solid-client";

// SelfActual vocabulary namespace
const SA = "https://vocab.selfactual.ai/";
const DCTERMS = "http://purl.org/dc/terms/";
const FOAF = "http://xmlns.com/foaf/0.1/";

const BASE_URL = "https://vaults.selfactual.ai";
const USERNAME = process.env.TARGET_USERNAME || "sandbox-alice";

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
    console.error("Authentication failed. Check your credentials.");
    process.exit(1);
  }

  console.log(`Authenticated as: ${session.info.webId}\n`);

  // --- 2. Read the profile summary to discover assessments ---
  const profileUrl = `${BASE_URL}/${USERNAME}/sub/profile-summary`;
  console.log(`Reading profile: ${profileUrl}`);

  try {
    const profileDataset = await getSolidDataset(profileUrl, {
      fetch: session.fetch,
    });
    const profile = getThing(profileDataset, profileUrl);

    if (profile) {
      const name = getStringNoLocale(profile, FOAF + "name");
      const assessmentUrls = getUrlAll(profile, SA + "hasAssessment");
      console.log(`  Name: ${name}`);
      console.log(`  Assessments: ${assessmentUrls.length} found`);
      for (const url of assessmentUrls) {
        console.log(`    → ${url}`);
      }
    }
  } catch (err) {
    console.log(`  Could not read profile: ${err.statusCode || err.message}`);
  }

  // --- 3. Read the Star Card assessment ---
  const starcardUrl = `${BASE_URL}/${USERNAME}/sub/assessments/starcard`;
  console.log(`\nReading Star Card: ${starcardUrl}`);

  try {
    const dataset = await getSolidDataset(starcardUrl, {
      fetch: session.fetch,
    });
    const starCard = getThing(dataset, starcardUrl);

    if (!starCard) {
      console.error("  Resource exists but contains no data for this URL.");
      process.exit(1);
    }

    const thinking = getInteger(starCard, SA + "thinking");
    const acting = getInteger(starCard, SA + "acting");
    const feeling = getInteger(starCard, SA + "feeling");
    const planning = getInteger(starCard, SA + "planning");
    const shape = getStringNoLocale(starCard, SA + "profileShape");
    const dominant = getStringNoLocale(starCard, SA + "dominantQuadrant");
    const source = getStringNoLocale(starCard, SA + "sourceApp");
    const version = getStringNoLocale(starCard, SA + "sourceVersion");

    console.log("\n  ┌─────────────────────────────┐");
    console.log("  │       STAR CARD RESULTS      │");
    console.log("  ├─────────────────────────────┤");
    console.log(`  │  Thinking:  ${String(thinking).padStart(3)}             │`);
    console.log(`  │  Acting:    ${String(acting).padStart(3)}             │`);
    console.log(`  │  Feeling:   ${String(feeling).padStart(3)}             │`);
    console.log(`  │  Planning:  ${String(planning).padStart(3)}             │`);
    console.log("  ├─────────────────────────────┤");
    console.log(`  │  Shape:     ${(shape || "—").padEnd(15)} │`);
    console.log(`  │  Dominant:  ${(dominant || "—").padEnd(15)} │`);
    console.log(`  │  Source:    ${(source || "—").padEnd(15)} │`);
    console.log(`  │  Version:   ${(version || "—").padEnd(15)} │`);
    console.log("  └─────────────────────────────┘");
  } catch (err) {
    if (err.statusCode === 404) {
      console.log("  This user hasn't completed a Star Card assessment yet.");
    } else if (err.statusCode === 403) {
      console.log("  Not authorized to read this resource.");
    } else {
      throw err;
    }
  }

  // --- 4. Read the framework context ---
  const frameworkUrl = `${BASE_URL}/${USERNAME}/sub/context/ast-framework`;
  console.log(`\nReading framework: ${frameworkUrl}`);

  try {
    const fwDataset = await getSolidDataset(frameworkUrl, {
      fetch: session.fetch,
    });

    // The framework resource itself
    const framework = getThing(fwDataset, frameworkUrl);
    if (framework) {
      const title = getStringNoLocale(framework, DCTERMS + "title");
      const fwVersion = getStringNoLocale(framework, SA + "version");
      const methodology = getStringNoLocale(framework, SA + "methodology");
      console.log(`  Title:       ${title}`);
      console.log(`  Version:     ${fwVersion}`);
      console.log(`  Methodology: ${methodology}`);
    }

    // Dimension definitions are blank nodes — iterate all things
    const allThings = getThingAll(fwDataset);
    const dimensions = allThings.filter((t) => {
      const dimId = getStringNoLocale(t, SA + "dimensionId");
      return dimId !== null;
    });

    if (dimensions.length > 0) {
      console.log("\n  Dimensions:");
      for (const dim of dimensions) {
        const id = getStringNoLocale(dim, SA + "dimensionId");
        const label =
          getStringNoLocale(
            dim,
            "http://www.w3.org/2000/01/rdf-schema#label"
          ) || id;
        const desc = getStringNoLocale(dim, SA + "description");
        const range = getStringNoLocale(dim, SA + "scoreRange");
        console.log(`    ${label} (${id}): ${desc} [${range}]`);
      }
    }
  } catch (err) {
    console.log(`  Could not read framework: ${err.statusCode || err.message}`);
  }

  // --- 5. Clean up ---
  await session.logout();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
