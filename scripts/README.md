# SelfActual Scripts

Tools for interacting with the Solid pod server at `https://vaults.selfactual.ai/`.

## Setup

```bash
cd scripts
npm install
```

## Scripts

### `create-credentials.mjs` — Register Client Credentials (One-Time)

Creates a Solid-OIDC client credential (client_id + secret) tied to your WebID. Run once, save the output.

```bash
export CSS_EMAIL="brad@selfactual.ai"
export CSS_PASSWORD="your-password"
node create-credentials.mjs
```

Outputs a `Client ID` and `Client Secret`. Export them for use with other scripts:

```bash
export CSS_CLIENT_ID="the-id"
export CSS_CLIENT_SECRET="the-secret"
```

### `validate-pod.mjs` — Pod Validation

Creates the dual-pod structure, writes test data, reads it back, and verifies everything works. This is the script that proved the infrastructure on 2026-02-27.

```bash
export CSS_CLIENT_ID="your-id"
export CSS_CLIENT_SECRET="your-secret"
node validate-pod.mjs
```

What it does:
1. Authenticates via Solid-OIDC (client credentials)
2. Creates master/ and sub/ container structure
3. Writes a Star Card assessment to both pods (with/without reflection link)
4. Writes a test reflection to master only
5. Reads everything back and verifies data integrity
6. Tests that unauthenticated access is denied

### `validate-pod.sh` — (Deprecated)

Initial bash attempt. Doesn't work because CSS requires Solid-OIDC DPoP tokens for pod operations, which are too complex for curl. Kept for reference. Use `validate-pod.mjs` instead.

## Dependencies

- `@inrupt/solid-client` — Solid data read/write (RDF datasets, things, containers)
- `@inrupt/solid-client-authn-node` — Solid-OIDC authentication for Node.js
- `@inrupt/vocab-common-rdf` — Standard RDF vocabulary constants

## Key Concept: CSS Auth Layers

CSS has two separate auth systems:

| Layer | Token Type | Used For | Tool |
|-------|-----------|----------|------|
| Account API | `CSS-Account-Token` | Account management, creating credentials | `create-credentials.mjs` |
| Solid-OIDC | DPoP tokens | Pod read/write operations | `validate-pod.mjs` (via `session.fetch`) |

You cannot use the Account API token to read/write pod resources. You must register client credentials first, then use them with the Inrupt auth library.
