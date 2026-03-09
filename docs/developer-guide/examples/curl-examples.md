# curl Examples

These examples show raw HTTP requests against SelfActual pods. They're useful for understanding the protocol but require manually managing authentication tokens. For production use, the `@inrupt/solid-client` library is strongly recommended.

> **Note:** The DPoP token flow is complex to replicate in curl. These examples assume you've already obtained a valid access token and DPoP proof. In practice, use the Node.js examples for authenticated requests.

## Reading a Resource (Turtle)

```bash
curl -s \
  -H "Accept: text/turtle" \
  -H "Authorization: DPoP <access-token>" \
  -H "DPoP: <dpop-proof>" \
  https://vaults.selfactual.ai/sandbox-alice/sub/assessments/starcard
```

## Reading a Resource (JSON-LD)

```bash
curl -s \
  -H "Accept: application/ld+json" \
  -H "Authorization: DPoP <access-token>" \
  -H "DPoP: <dpop-proof>" \
  https://vaults.selfactual.ai/sandbox-alice/sub/assessments/starcard
```

## Listing a Container

```bash
curl -s \
  -H "Accept: text/turtle" \
  -H "Authorization: DPoP <access-token>" \
  -H "DPoP: <dpop-proof>" \
  https://vaults.selfactual.ai/sandbox-alice/sub/assessments/
```

Returns an `ldp:Container` with `ldp:contains` triples listing child resources.

## Writing a Resource

```bash
curl -X PUT \
  -H "Content-Type: text/turtle" \
  -H "Authorization: DPoP <access-token>" \
  -H "DPoP: <dpop-proof>" \
  -d '@- << EOF
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<>
    a sa:Assessment ;
    dcterms:created     "2026-03-09T10:00:00Z"^^xsd:dateTime ;
    sa:sourceApp        "curl-test" ;
    sa:sourceVersion    "0.0.1" .
EOF' \
  https://vaults.selfactual.ai/sandbox-alice/sub/assessments/curl-test
```

## Checking Access (HEAD Request)

```bash
curl -I \
  -H "Authorization: DPoP <access-token>" \
  -H "DPoP: <dpop-proof>" \
  https://vaults.selfactual.ai/sandbox-alice/sub/

# Look for the WAC-Allow header in the response:
# WAC-Allow: user="read", public=""
```

## Unauthenticated Request (Expect 401)

```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://vaults.selfactual.ai/sandbox-alice/sub/assessments/starcard

# Returns: 401
```

## CSS Account Login (Step 1 of Auth Flow)

This is the only step that can be done purely in curl:

```bash
curl -X POST https://vaults.selfactual.ai/.account/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-service@example.com",
    "password": "your-password"
  }'

# Returns: {"authorization": "CSS-Account-Token <token>"}
```

## Generate Client Credentials (Step 2)

```bash
curl -X POST https://vaults.selfactual.ai/.account/client-credentials/ \
  -H "Authorization: CSS-Account-Token <token-from-step-1>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-test-credentials",
    "webId": "https://vaults.selfactual.ai/yourapp-service/profile/card#me"
  }'

# Returns: {"id": "<client_id>", "secret": "<client_secret>"}
```

After this point, the DPoP token exchange requires JWK generation and JWT signing, which is impractical in pure curl. Use the Node.js examples for the remaining steps.
