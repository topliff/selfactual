# Your First Read: Star Card Assessment

This walkthrough takes you from zero to reading a Star Card assessment from a sandbox user's sub pod. By the end, you'll have parsed real RDF data from a Solid Pod.

## Prerequisites

- Node.js 18+
- Your service account credentials (see [Authentication](authentication.md))
- Sandbox pods provisioned (see [Sandbox Setup](sandbox-setup.md))

## What We're Reading

A Star Card is a four-quadrant personal assessment with scores for Thinking, Acting, Feeling, and Planning. It lives at:

```
https://vaults.selfactual.ai/sandbox-alice/sub/assessments/starcard
```

The raw Turtle looks like this:

```turtle
<>
    a sa:Assessment, sa:StarCard ;
    dcterms:created     "2026-02-15T11:00:00Z"^^xsd:dateTime ;
    sa:framework        <https://vocab.selfactual.ai/frameworks/ast> ;
    sa:sourceApp        "AllStarTeams" ;
    sa:thinking         78 ;
    sa:acting           65 ;
    sa:feeling          82 ;
    sa:planning         71 ;
    sa:dominantQuadrant "feeling" ;
    sa:profileShape     "Connector" .
```

## Step by Step

### 1. Set Up the Project

```bash
mkdir my-first-read && cd my-first-read
npm init -y
npm install @inrupt/solid-client @inrupt/solid-client-authn-node \
            @inrupt/vocab-common-rdf dotenv
```

Add `"type": "module"` to your `package.json`.

### 2. Create Your .env

```env
SELFACTUAL_OIDC_ISSUER=https://vaults.selfactual.ai/
SERVICE_CLIENT_ID=your-client-id-here
SERVICE_CLIENT_SECRET=your-client-secret-here
```

### 3. Write the Code

Create `index.js`:

```javascript
import "dotenv/config";
import { Session } from "@inrupt/solid-client-authn-node";
import { getSolidDataset, getThing, getInteger, getStringNoLocale, getUrl } from "@inrupt/solid-client";

// SelfActual vocabulary namespace
const SA = "https://vocab.selfactual.ai/";

async function main() {
  // 1. Authenticate
  const session = new Session();
  await session.login({
    clientId: process.env.SERVICE_CLIENT_ID,
    clientSecret: process.env.SERVICE_CLIENT_SECRET,
    oidcIssuer: process.env.SELFACTUAL_OIDC_ISSUER,
  });

  console.log(`Authenticated as: ${session.info.webId}`);

  // 2. Fetch the Star Card resource
  const resourceUrl = "https://vaults.selfactual.ai/sandbox-alice/sub/assessments/starcard";
  console.log(`Reading: ${resourceUrl}\n`);

  const dataset = await getSolidDataset(resourceUrl, { fetch: session.fetch });

  // 3. Parse the Star Card data
  // In Solid, the "subject" of a resource is the resource URL itself
  const starCard = getThing(dataset, resourceUrl);

  if (!starCard) {
    console.error("Could not find Star Card data at this URL");
    process.exit(1);
  }

  // 4. Extract the quadrant scores
  const thinking = getInteger(starCard, SA + "thinking");
  const acting   = getInteger(starCard, SA + "acting");
  const feeling  = getInteger(starCard, SA + "feeling");
  const planning = getInteger(starCard, SA + "planning");

  // 5. Extract derived attributes
  const shape    = getStringNoLocale(starCard, SA + "profileShape");
  const dominant = getStringNoLocale(starCard, SA + "dominantQuadrant");
  const source   = getStringNoLocale(starCard, SA + "sourceApp");

  console.log("Star Card Assessment");
  console.log("====================");
  console.log(`  Thinking:  ${thinking}`);
  console.log(`  Acting:    ${acting}`);
  console.log(`  Feeling:   ${feeling}`);
  console.log(`  Planning:  ${planning}`);
  console.log(`  Shape:     ${shape}`);
  console.log(`  Dominant:  ${dominant}`);
  console.log(`  Source:    ${source}`);

  // 6. Clean up
  await session.logout();
}

main().catch(console.error);
```

### 4. Run It

```bash
node index.js
```

### What Just Happened

1. `Session.login()` exchanged your client credentials for a DPoP-bound access token via Solid-OIDC
2. `getSolidDataset()` made an authenticated HTTP GET to the pod resource URL with `Accept: text/turtle`
3. `@inrupt/solid-client` parsed the Turtle RDF into an in-memory dataset
4. `getThing()` extracted the triples where the subject is the resource URL
5. `getInteger()` and `getStringNoLocale()` read specific predicate values

### Reading the Framework Context

To understand what the scores mean, read the framework context resource:

```javascript
const frameworkUrl = "https://vaults.selfactual.ai/sandbox-alice/sub/context/ast-framework";
const fwDataset = await getSolidDataset(frameworkUrl, { fetch: session.fetch });

// The framework contains blank nodes for each dimension
// Use getThingAll() to iterate through them
```

See the [full code example](../examples/node-read-starcard/) for framework parsing.

## Common Patterns

### Discovering What a User Has

Start from the profile summary to find links to available assessments:

```javascript
const profileUrl = "https://vaults.selfactual.ai/sandbox-alice/sub/profile-summary";
const profileDataset = await getSolidDataset(profileUrl, { fetch: session.fetch });
const profile = getThing(profileDataset, profileUrl);

// sa:hasAssessment links to available assessments
const assessmentUrls = getUrlAll(profile, SA + "hasAssessment");
// Returns: [".../sub/assessments/starcard", ".../sub/assessments/flow-attributes"]
```

### Handling Missing Data

Not all users have completed all assessments. Always handle 404s:

```javascript
try {
  const dataset = await getSolidDataset(resourceUrl, { fetch: session.fetch });
} catch (err) {
  if (err.statusCode === 404) {
    console.log("This user hasn't completed this assessment yet");
  } else if (err.statusCode === 403) {
    console.log("Not authorized to read this resource");
  } else {
    throw err;
  }
}
```

## Next Steps

- Read the [full vocabulary reference](../vocabulary/sa-vocab.md) to understand all available predicates
- See [Reading Pods](../api-reference/reading-pods.md) for content negotiation, container listing, and batch reads
- If you need to write data, see [Writing Pods](../api-reference/writing-pods.md)
