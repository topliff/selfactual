# Authentication

SelfActual pods use [Solid-OIDC](https://solidproject.org/TR/oidc) for authentication. Your application authenticates as a **service account** — a dedicated identity with its own WebID — and makes HTTP requests using DPoP-bound access tokens.

## Overview

```
Your App                    CSS (vaults.selfactual.ai)
   │                                │
   │  1. POST /.account/login       │
   │  ────────────────────────►     │
   │         (email + password)     │
   │                                │
   │  2. CSS-Account-Token          │
   │  ◄────────────────────────     │
   │                                │
   │  3. POST /.account/client-     │
   │     credentials                │
   │  ────────────────────────►     │
   │                                │
   │  4. client_id + client_secret  │
   │  ◄────────────────────────     │
   │                                │
   │  5. POST /.oidc/token          │
   │     (DPoP proof, grant_type=   │
   │      client_credentials)       │
   │  ────────────────────────►     │
   │                                │
   │  6. DPoP-bound access_token    │
   │  ◄────────────────────────     │
   │                                │
   │  7. GET /sub/assessments/      │
   │     starcard                   │
   │     Authorization: DPoP <token>│
   │     DPoP: <proof>              │
   │  ────────────────────────►     │
   │                                │
   │  8. 200 OK (Turtle RDF)        │
   │  ◄────────────────────────     │
```

## Step-by-Step

### 1. Obtain Your Service Account Credentials

SelfActual will provision a service account for your application. You'll receive:

| Credential | Description |
|---|---|
| `SERVICE_EMAIL` | The CSS account email for your service |
| `SERVICE_PASSWORD` | The CSS account password |
| `SERVICE_WEBID` | Your app's WebID URI (e.g., `https://vaults.selfactual.ai/yourapp-service/profile/card#me`) |

Store these securely. Never commit them to source control.

### 2. Get a CSS Account Token

```bash
# Login to the CSS account system
curl -X POST https://vaults.selfactual.ai/.account/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "$SERVICE_EMAIL",
    "password": "$SERVICE_PASSWORD"
  }'
```

Response:
```json
{
  "authorization": "CSS-Account-Token <token>"
}
```

Save the `CSS-Account-Token` — you'll need it for the next step.

### 3. Generate Client Credentials

```bash
# Create a client credentials token linked to your WebID
curl -X POST https://vaults.selfactual.ai/.account/client-credentials/ \
  -H "Authorization: CSS-Account-Token <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "yourapp-service-credentials",
    "webId": "https://vaults.selfactual.ai/yourapp-service/profile/card#me"
  }'
```

Response:
```json
{
  "id": "<client_id>",
  "secret": "<client_secret>"
}
```

Save both values. These are long-lived and reusable.

### 4. Obtain a DPoP-Bound Access Token

This is the most involved step. You need to:

1. Generate an ephemeral key pair (for DPoP proofs)
2. Create a DPoP proof JWT
3. Exchange client credentials for an access token

See the [Node.js code example](../examples/node-read-starcard/) for a working implementation. The key libraries:

```
npm install @inrupt/solid-client-authn-node @inrupt/solid-client
```

In code (simplified):

```javascript
import { Session } from "@inrupt/solid-client-authn-node";

const session = new Session();
await session.login({
  clientId: process.env.SERVICE_CLIENT_ID,
  clientSecret: process.env.SERVICE_CLIENT_SECRET,
  oidcIssuer: "https://vaults.selfactual.ai/",
});

// session.fetch is now an authenticated fetch function
const response = await session.fetch(
  "https://vaults.selfactual.ai/jacobkim/sub/assessments/starcard"
);
```

### 5. Make Authenticated Requests

Once you have an authenticated session, use `session.fetch` as a drop-in replacement for `fetch`. It automatically attaches the correct `Authorization` and `DPoP` headers.

```javascript
const response = await session.fetch(podResourceUrl, {
  headers: {
    "Accept": "text/turtle"  // Request Turtle format
  }
});

const turtle = await response.text();
```

## Token Lifecycle

| Token | Lifetime | Refresh |
|---|---|---|
| CSS-Account-Token | Session-scoped | Re-login if expired |
| Client credentials (id/secret) | Long-lived | Stored in env vars |
| DPoP access token | Short-lived (~5 min) | `@inrupt/solid-client-authn-node` handles refresh automatically |

## Environment Variables

Your `.env` file should contain:

```env
# SelfActual service account
SELFACTUAL_OIDC_ISSUER=https://vaults.selfactual.ai/
SERVICE_CLIENT_ID=<your-client-id>
SERVICE_CLIENT_SECRET=<your-client-secret>
SERVICE_WEBID=https://vaults.selfactual.ai/yourapp-service/profile/card#me
```

## Troubleshooting

| Error | Likely Cause |
|---|---|
| `401 Unauthorized` | Token expired, or WebID not authorized for this resource |
| `403 Forbidden` | Your WebID doesn't have the required ACL permission on this pod |
| `404 Not Found` | Resource doesn't exist, or you're hitting the wrong URL path |
| DPoP signature mismatch | Clock skew between your server and CSS, or key pair mismatch |

## Security Notes

- Your service account credentials grant access to **all pods that have ACL entries for your WebID**. Protect them accordingly.
- DPoP proofs are bound to a specific HTTP method and URL, preventing token replay.
- SelfActual may rotate or revoke your credentials if a security issue is detected. Ensure your app handles auth failures gracefully.

---

Next: [Sandbox Setup →](sandbox-setup.md)
