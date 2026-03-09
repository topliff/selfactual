# Writing Pods

Partner applications that contribute data back to user pods (with appropriate authorization) use HTTP PUT or PATCH to create and update resources.

> **Note:** Write access for partner apps is in early development. The patterns below reflect the current design. Discuss your write requirements with the SelfActual team before implementing.

## Write Model

Partner writes follow a specific model:

1. **You write to the sub pod only** — Partner apps never write to the master pod. SelfActual's internal services handle master pod synchronization.
2. **You write to a designated namespace** — Your app's data goes into a container namespaced to your application (e.g., `/sub/assessments/yourapp-assessment`).
3. **Every write must include provenance** — Metadata identifying your app, version, and timestamp.
4. **The user must have granted write access** — Your WebID must be in the sub pod's ACL with `acl:Write` permission.

## Creating a New Resource

Use HTTP PUT to create a resource at a specific URL:

```
PUT /sandbox-alice/sub/assessments/yourapp-assessment HTTP/1.1
Host: vaults.selfactual.ai
Authorization: DPoP <access-token>
DPoP: <proof-jwt>
Content-Type: text/turtle

@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix yourapp: <https://vocab.yourapp.com/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<>
    a sa:Assessment, yourapp:YourAssessmentType ;
    dcterms:created     "2026-03-09T10:00:00Z"^^xsd:dateTime ;
    sa:framework        <https://vocab.selfactual.ai/frameworks/ast> ;
    sa:sourceApp        "YourAppName" ;
    sa:sourceVersion    "1.0.0" ;
    yourapp:someScore   42 ;
    yourapp:someLabel   "Result description" .
```

Response: `201 Created` (new resource) or `205 Reset Content` (updated existing).

### Using @inrupt/solid-client

```javascript
import {
  createSolidDataset,
  createThing,
  setThing,
  setInteger,
  setStringNoLocale,
  setDatetime,
  setUrl,
  saveSolidDatasetAt,
} from "@inrupt/solid-client";

const SA = "https://vocab.selfactual.ai/";
const DCTERMS = "http://purl.org/dc/terms/";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

const resourceUrl = "https://vaults.selfactual.ai/sandbox-alice/sub/assessments/yourapp-assessment";

// Build the resource
let thing = createThing({ url: resourceUrl });
thing = setUrl(thing, RDF + "type", SA + "Assessment");
thing = setDatetime(thing, DCTERMS + "created", new Date());
thing = setStringNoLocale(thing, SA + "sourceApp", "YourAppName");
thing = setStringNoLocale(thing, SA + "sourceVersion", "1.0.0");
thing = setInteger(thing, "https://vocab.yourapp.com/someScore", 42);

let dataset = createSolidDataset();
dataset = setThing(dataset, thing);

// Write to the pod
await saveSolidDatasetAt(resourceUrl, dataset, { fetch: session.fetch });
```

## Updating an Existing Resource

To update a resource, fetch it first, modify it, and save it back:

```javascript
import { getSolidDataset, getThing, setThing, setInteger, saveSolidDatasetAt } from "@inrupt/solid-client";

// Fetch current state
let dataset = await getSolidDataset(resourceUrl, { fetch: session.fetch });
let thing = getThing(dataset, resourceUrl);

// Modify
thing = setInteger(thing, "https://vocab.yourapp.com/someScore", 55);

// Save back
dataset = setThing(dataset, thing);
await saveSolidDatasetAt(resourceUrl, dataset, { fetch: session.fetch });
```

## Creating Containers

If your app needs a sub-container (e.g., `/sub/assessments/yourapp/`), create it by writing a resource inside it — CSS auto-creates intermediate containers:

```javascript
// This creates the /yourapp/ container automatically
const resourceUrl = "https://vaults.selfactual.ai/sandbox-alice/sub/assessments/yourapp/result-001";
await saveSolidDatasetAt(resourceUrl, dataset, { fetch: session.fetch });
```

Alternatively, create an empty container explicitly:

```bash
curl -X PUT https://vaults.selfactual.ai/sandbox-alice/sub/assessments/yourapp/ \
  -H "Authorization: DPoP <token>" \
  -H "DPoP: <proof>" \
  -H "Content-Type: text/turtle" \
  -H "Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel=\"type\""
```

## Required Provenance

Every resource your app writes must include these predicates:

| Predicate | Required | Description |
|---|---|---|
| `dcterms:created` | Yes | ISO 8601 datetime of creation |
| `dcterms:modified` | On updates | ISO 8601 datetime of last modification |
| `sa:sourceApp` | Yes | Your application name (string) |
| `sa:sourceVersion` | Yes | Your application version (string) |
| `rdf:type` | Yes | Must include `sa:Assessment` or another `sa:` type |
| `sa:framework` | If applicable | Link to the framework this data relates to |

## Vocabulary for Partner Data

Partner-contributed data should use:

- `sa:` predicates for concepts defined in the SelfActual vocabulary (assessments, scores, profiles)
- Your own namespace for app-specific predicates (e.g., `https://vocab.yourapp.com/`)

See [Extending the Schema](../vocabulary/extending-schema.md) for how to propose additions to the `sa:` vocabulary.

## Write Constraints

- **Maximum resource size:** 1 MB (enforced by CSS)
- **Rate limiting:** Keep writes under 10/minute per user pod
- **Atomic writes:** Each PUT replaces the entire resource. There is no partial update via PUT. Use SPARQL PATCH for partial updates (advanced — see CSS documentation).
- **No deletes:** Partner apps cannot delete resources from user pods. If you need to retract data, mark it as superseded with `sa:status "retracted"` and write a new version.

## Error Handling

| Status | Meaning | Action |
|---|---|---|
| `201 Created` | New resource created | Success |
| `205 Reset Content` | Existing resource replaced | Success |
| `400 Bad Request` | Invalid RDF or malformed request | Check your Turtle syntax |
| `401 Unauthorized` | Auth failure | Re-authenticate |
| `403 Forbidden` | WebID doesn't have write access | Check ACL grants |
| `409 Conflict` | Container/resource type mismatch | Check you're not overwriting a container with a resource |
| `413 Payload Too Large` | Resource exceeds size limit | Split into multiple resources |

---

Next: [Access Control →](access-control.md)
