// Pod scaffolding: creates container structure and initial RDF documents.
// Mirrors patterns from scripts/validate-pod.mjs.

import {
  createContainerAt,
  createSolidDataset,
  saveSolidDatasetAt,
  createThing,
  setThing,
  setUrl,
  setStringNoLocale,
} from "@inrupt/solid-client";

const CSS_BASE_URL = process.env.CSS_BASE_URL || "https://vaults.selfactual.ai";
const SA = "https://vocab.selfactual.ai/";
const DCTERMS = "http://purl.org/dc/terms/";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

/**
 * Create the full dual-pod container structure.
 *
 * Master:  profile/, assessments/, reflections/, reflections/strength-reflections/,
 *          context/, provenance/
 * Sub:     assessments/, context/
 */
export async function createContainerStructure(session, podUrl) {
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

  const results = [];
  for (const url of containers) {
    try {
      await createContainerAt(url, { fetch: session.fetch });
      results.push({ url, status: "created" });
    } catch (err) {
      if (err.statusCode === 409 || err.message?.includes("409")) {
        results.push({ url, status: "exists" });
      } else {
        results.push({ url, status: "error", error: err.message });
        throw new Error(`Failed to create container ${url}: ${err.message}`);
      }
    }
  }

  return results;
}

/**
 * Write ACLs to the master and sub containers via Solid-OIDC authenticated fetch.
 */
export async function writeAcls(session, podUrl, masterAclTurtle, subAclTurtle) {
  // Write master ACL
  const masterAclRes = await session.fetch(`${podUrl}master/.acl`, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: masterAclTurtle,
  });

  if (!masterAclRes.ok) {
    const errText = await masterAclRes.text();
    throw new Error(`Master ACL write failed: HTTP ${masterAclRes.status} — ${errText}`);
  }

  // Write sub ACL
  const subAclRes = await session.fetch(`${podUrl}sub/.acl`, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: subAclTurtle,
  });

  if (!subAclRes.ok) {
    const errText = await subAclRes.text();
    throw new Error(`Sub ACL write failed: HTTP ${subAclRes.status} — ${errText}`);
  }
}

/**
 * Write initial RDF documents: WebID profile card and AST framework context.
 */
export async function writeInitialDocuments(session, podUrl, username, displayName) {
  // 1. WebID Profile Card → /master/profile/card
  await writeProfileCard(session, podUrl, username, displayName);

  // 2. AST Framework Context → /master/context/ast-framework AND /sub/context/ast-framework
  await writeAstFrameworkContext(session, `${podUrl}master/context/ast-framework`);
  await writeAstFrameworkContext(session, `${podUrl}sub/context/ast-framework`);
}

async function writeProfileCard(session, podUrl, username, displayName) {
  const cardUrl = `${podUrl}master/profile/card`;
  const meUrl = `${cardUrl}#me`;

  let me = createThing({ url: meUrl });
  me = setUrl(me, RDF_TYPE, "http://xmlns.com/foaf/0.1/Person");
  me = setUrl(me, RDF_TYPE, `${SA}VaultOwner`);
  me = setStringNoLocale(me, "http://xmlns.com/foaf/0.1/name", displayName);
  me = setUrl(me, `${SA}masterPod`, `${CSS_BASE_URL}/${username}/master/`);
  me = setUrl(me, `${SA}subPod`, `${CSS_BASE_URL}/${username}/sub/`);

  let ds = createSolidDataset();
  ds = setThing(ds, me);

  await saveSolidDatasetAt(cardUrl, ds, { fetch: session.fetch });
}

async function writeAstFrameworkContext(session, resourceUrl) {
  // Write as raw Turtle since the framework context uses blank nodes
  // which are easier to express in Turtle than with the solid-client API.
  const turtle = `@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .

<>
    a sa:Framework ;
    dcterms:title       "AllStarTeams Assessment Framework" ;
    dcterms:publisher   "Heliotrope Imaginal" ;
    sa:version          "2.1.7" ;

    sa:hasDimension [
        sa:dimensionId      "thinking" ;
        rdfs:label          "Thinking" ;
        sa:description      "Analytical and strategic reasoning — how you process information, solve problems, and make decisions." ;
        sa:scoreRange       "0-100"
    ] ;
    sa:hasDimension [
        sa:dimensionId      "acting" ;
        rdfs:label          "Acting" ;
        sa:description      "Execution and initiative — how you take action, drive results, and maintain momentum." ;
        sa:scoreRange       "0-100"
    ] ;
    sa:hasDimension [
        sa:dimensionId      "feeling" ;
        rdfs:label          "Feeling" ;
        sa:description      "Emotional intelligence and connection — how you relate to others, read the room, and build trust." ;
        sa:scoreRange       "0-100"
    ] ;
    sa:hasDimension [
        sa:dimensionId      "planning" ;
        rdfs:label          "Planning" ;
        sa:description      "Organization and foresight — how you structure work, anticipate needs, and manage complexity." ;
        sa:scoreRange       "0-100"
    ] ;

    sa:profileShapes    "Connector, Strategist, Executor, Architect, Catalyst, Integrator" ;
    sa:methodology      "Star Card assessment using four-quadrant self-evaluation with guided reflection." .
`;

  const res = await session.fetch(resourceUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: turtle,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AST framework context write failed at ${resourceUrl}: HTTP ${res.status} — ${errText}`);
  }
}
