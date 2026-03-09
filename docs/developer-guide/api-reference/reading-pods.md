# Reading Pods

This document covers how to read data from SelfActual pods: HTTP methods, content negotiation, container traversal, and common patterns.

## HTTP Basics

Solid pods are standard web resources. Reading a pod resource is an HTTP GET:

```
GET /sandbox-alice/sub/assessments/starcard HTTP/1.1
Host: vaults.selfactual.ai
Authorization: DPoP <access-token>
DPoP: <proof-jwt>
Accept: text/turtle
```

Response:

```
HTTP/1.1 200 OK
Content-Type: text/turtle
Link: <http://www.w3.org/ns/ldp#Resource>; rel="type"

@prefix sa: <https://vocab.selfactual.ai/> .
...
```

If you're using `@inrupt/solid-client`, the library handles authentication headers, content negotiation, and RDF parsing for you.

## Content Negotiation

CSS supports multiple RDF serializations. Use the `Accept` header:

| Accept Header | Format | Use Case |
|---|---|---|
| `text/turtle` | Turtle | Most readable, recommended for development |
| `application/ld+json` | JSON-LD | Easier to parse in JavaScript without RDF libraries |
| `application/n-triples` | N-Triples | Simplest format, one triple per line |

Example requesting JSON-LD:

```bash
curl -H "Accept: application/ld+json" \
     -H "Authorization: DPoP <token>" \
     -H "DPoP: <proof>" \
     https://vaults.selfactual.ai/sandbox-alice/sub/assessments/starcard
```

When using `@inrupt/solid-client`, content negotiation is handled automatically — the library requests Turtle and parses it internally.

## Container Listing

Containers (directories) in Solid are themselves resources. GET a container URL to see its contents:

```
GET /sandbox-alice/sub/assessments/ HTTP/1.1
```

The response is an RDF resource of type `ldp:Container` with `ldp:contains` triples listing the child resources:

```turtle
@prefix ldp: <http://www.w3.org/ns/ldp#> .

<>
    a ldp:Container, ldp:BasicContainer ;
    ldp:contains <starcard>, <flow-attributes> .
```

In code:

```javascript
import { getSolidDataset, getContainedResourceUrlAll } from "@inrupt/solid-client";

const containerUrl = "https://vaults.selfactual.ai/sandbox-alice/sub/assessments/";
const dataset = await getSolidDataset(containerUrl, { fetch: session.fetch });
const children = getContainedResourceUrlAll(dataset);
// ["https://vaults.selfactual.ai/sandbox-alice/sub/assessments/starcard",
//  "https://vaults.selfactual.ai/sandbox-alice/sub/assessments/flow-attributes"]
```

## Sub Pod Structure

As a partner app, you'll read from sub pods. The structure is:

```
/{username}/sub/
├── profile-summary          → sa:SharedProfile
├── assessments/
│   ├── starcard             → sa:Assessment, sa:StarCard
│   └── flow-attributes      → sa:Assessment, sa:FlowProfile
└── context/
    └── ast-framework        → sa:Framework
```

### Recommended Read Order

1. **`profile-summary`** — Get the user's name and links to their assessments
2. **Follow `sa:hasAssessment` links** — Read each assessment the user has completed
3. **`context/ast-framework`** — Read once and cache; it defines what the scores mean

The framework context is the same across all users. You can read it once and reuse it.

## Reading Org Pods

Org pods follow a similar pattern:

```
/org-{slug}/
├── profile               → schema:Organization
├── teams/
│   └── {team-slug}       → sa:Team (contains links to member sub pods)
├── values/
│   └── mission           → sa:OrgValues
└── context/
    └── ast-framework     → sa:Framework
```

To discover team members and then read their assessments:

```javascript
// 1. Read the team roster
const teamUrl = "https://vaults.selfactual.ai/org-sandbox-acme/teams/engineering";
const teamDataset = await getSolidDataset(teamUrl, { fetch: session.fetch });

// 2. Extract member sub pod URLs (these are in blank nodes)
// See vocabulary reference for sa:hasMember structure

// 3. For each member, read their sub pod assessments
for (const memberSubPod of memberSubPods) {
  const starcardUrl = `${memberSubPod}assessments/starcard`;
  // ...read assessment
}
```

## Batch Reading

There's no bulk API — each resource is a separate HTTP request. For reasonable user counts (< 50 team members), sequential reads work fine. For larger batches, parallelize with `Promise.all`:

```javascript
const assessmentPromises = memberSubPods.map(pod =>
  getSolidDataset(`${pod}assessments/starcard`, { fetch: session.fetch })
    .catch(err => {
      if (err.statusCode === 404) return null; // User hasn't completed this
      throw err;
    })
);

const assessments = await Promise.all(assessmentPromises);
```

Be mindful of rate limits on the CSS instance. Keep concurrent requests under 10.

## Caching

CSS returns standard HTTP cache headers. Respect `ETag` and `Last-Modified` headers for conditional requests:

```javascript
// Store ETag from first request
const response = await session.fetch(resourceUrl);
const etag = response.headers.get("ETag");

// Later, check if it changed
const conditionalResponse = await session.fetch(resourceUrl, {
  headers: { "If-None-Match": etag }
});

if (conditionalResponse.status === 304) {
  // Data hasn't changed, use cached copy
}
```

## Error Handling

| Status | Meaning | Action |
|---|---|---|
| `200 OK` | Resource found, data returned | Parse the RDF |
| `304 Not Modified` | Data unchanged since your last read | Use cached data |
| `401 Unauthorized` | No valid auth token | Re-authenticate |
| `403 Forbidden` | Your WebID not in this resource's ACL | Check your access grants |
| `404 Not Found` | Resource doesn't exist | User may not have completed this assessment |
| `406 Not Acceptable` | Server can't produce the requested format | Check your `Accept` header |

---

Next: [Writing Pods →](writing-pods.md)
