# Claude Code Prompt: Build Vault Provisioning Service (Standalone)

## Context

You are building a standalone Solid Pod provisioning service for the SelfActual system. This service runs independently and exposes an HTTP API that any first-party app (AST, Atlas, Imaginal Agility, etc.) can call to provision user vaults on the Community Solid Server (CSS) at `https://vaults.selfactual.ai/`.

This service lives in the SelfActual repo, NOT inside any application codebase.

**Read these files before writing any code:**
- `~/Desktop/SelfActualSystem/docs/next-conversation-starter.md` — Full design spec with all decisions, ACL structures, pod scaffolding
- `~/Desktop/SelfActualSystem/docs/pod-resources-sketch.md` — RDF resource design and container layouts
- `~/Desktop/SelfActualSystem/scripts/create-credentials.mjs` — Reference: CSS Account API login, credential creation
- `~/Desktop/SelfActualSystem/scripts/validate-pod.mjs` — Reference: Solid-OIDC auth, container creation, RDF write/read patterns

**For understanding the first consumer (AST) and its Auth0 flow:**
- `~/Desktop/HI_Replit/server/routes/auth0-routes.ts` — Auth0 session handler where the provisioning call will be added
- `~/Desktop/HI_Replit/shared/schema.ts` — AST's Drizzle schema (for reference, not for modification)

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  AST App    │     │  Atlas App  │     │  Future App  │
│  (Auth0)    │     │  (Auth0)    │     │  (Auth0)     │
└──────┬──────┘     └──────┬──────┘     └──────┬───────┘
       │                   │                   │
       │  POST /provision  │                   │
       ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────┐
│  SelfActual Provisioning Service                     │
│  ~/Desktop/SelfActualSystem/services/provisioning/   │
│                                                      │
│  • HTTP API on port 3001 (configurable)              │
│  • Own Postgres database for vault_accounts          │
│  • Talks to CSS Account API + Solid-OIDC             │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│  Community Solid Server (CSS)                        │
│  https://vaults.selfactual.ai/                       │
└──────────────────────────────────────────────────────┘
```

## Project Structure

Create this structure inside `~/Desktop/SelfActualSystem/`:

```
services/
  provisioning/
    package.json           # Standalone Node.js service (ESM, type: module)
    .env.example           # Template for env vars
    src/
      index.mjs            # Express server entry point
      routes.mjs           # API route handlers
      css-client.mjs       # CSS Account API wrapper (create account, create pod, register credentials)
      acl-generator.mjs    # Generates ACL Turtle strings parameterized by username
      scaffolding.mjs      # Creates container structure + initial RDF documents
      database.mjs         # Postgres connection + vault_accounts CRUD
      schema.sql           # Table definition (vault_accounts)
      username.mjs         # Username slugification + collision handling
    tests/
      test-programmatic-pod.mjs   # Step 0: validate CSS pod creation
      test-provisioning.mjs       # End-to-end smoke test
```

## Step 0: Validate Programmatic Pod Creation

**Do this first. Stop and report results before proceeding.**

Create `~/Desktop/SelfActualSystem/services/provisioning/tests/test-programmatic-pod.mjs`:

1. Create a NEW CSS account via `POST https://vaults.selfactual.ai/.account/` with a generated email/password
2. Get account controls via `GET /.account/` with the CSS-Account-Token
3. Use the pod creation endpoint from controls to create a pod
4. Create client credentials for the new account
5. Authenticate via Solid-OIDC and create a test container in the pod
6. Report success/failure at each step

Use `@inrupt/solid-client` and `@inrupt/solid-client-authn-node` — same as the existing scripts in `~/Desktop/SelfActualSystem/scripts/`. Mirror those patterns.

This validates the one untested assumption. The existing scripts only work with a pod created via the CSS web UI. Stop here and report results.

## Step 1: Database Schema

Create `~/Desktop/SelfActualSystem/services/provisioning/src/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS vault_accounts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,          -- opaque ID from calling app
  auth0_sub VARCHAR(255) NOT NULL UNIQUE, -- Auth0 subject identifier
  css_account_id VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  web_id VARCHAR(500) NOT NULL,
  master_pod_url VARCHAR(500) NOT NULL,
  sub_pod_url VARCHAR(500) NOT NULL,
  provisioning_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  last_error TEXT,
  provisioned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vault_accounts_auth0_sub ON vault_accounts(auth0_sub);
CREATE INDEX idx_vault_accounts_username ON vault_accounts(username);
```

Create `src/database.mjs` with:
- Postgres connection via `pg` (node-postgres) — keep it simple, no ORM needed for one table
- Functions: `createVaultAccount()`, `getByAuth0Sub()`, `getByUsername()`, `updateStatus()`, `usernameExists()`

Use `DATABASE_URL` env var for connection.

## Step 2: Build the Service Modules

### `src/css-client.mjs`
Wraps CSS Account API calls. Mirror patterns from `scripts/create-credentials.mjs`:
- `createCssAccount(email, password)` — POST to `/.account/`, returns authorization token
- `getAccountControls(token)` — GET `/.account/`, returns controls object
- `createPod(token, controls, podName)` — uses pod creation endpoint from controls
- `registerCredentials(token, controls, name, webId)` — creates client credentials

### `src/acl-generator.mjs`
Generates ACL Turtle strings. Two functions:
- `generateMasterAcl(username, webId, serviceWebId)` — owner full control + service write
- `generateSubAcl(username, webId, serviceWebId)` — owner full control + service write + first-party read

ACL templates are in `~/Desktop/SelfActualSystem/docs/next-conversation-starter.md` under "ACL Structure".

### `src/scaffolding.mjs`
Creates container structure and writes initial documents. Mirror patterns from `scripts/validate-pod.mjs`:
- `createContainerStructure(session, podUrl)` — creates master/, sub/, and all sub-containers
- `writeInitialDocuments(session, podUrl, username, displayName)` — WebID profile card + AST framework context

Container layout and RDF document content are in `docs/pod-resources-sketch.md`.

### `src/username.mjs`
- `generateUsername(displayName)` — slugify (lowercase, remove special chars, replace spaces with hyphens)
- `resolveUsername(displayName, usernameExistsFn)` — try base slug, then append 2, 3, 4... until unique

### `src/routes.mjs`
Express router with these endpoints:

**`POST /provision`**
```
Authorization: Bearer <internal-service-token>
Content-Type: application/json

{
  "auth0Sub": "auth0|abc123",
  "userId": "42",
  "displayName": "Jacob Kim"
}
```

Response (success):
```json
{
  "status": "complete",
  "masterPodUrl": "https://vaults.selfactual.ai/jacobkim/master/",
  "subPodUrl": "https://vaults.selfactual.ai/jacobkim/sub/",
  "webId": "https://vaults.selfactual.ai/jacobkim/master/profile/card#me",
  "username": "jacobkim"
}
```

Error responses: 409 (username/auth0Sub already provisioned), 400 (bad input), 502 (CSS failure), 500 (internal).

**`GET /status/:auth0Sub`**
Returns provisioning status for a user. Used by apps to check if a user has been provisioned.

**`POST /retry/:auth0Sub`**
Re-attempt provisioning for a failed user.

**Authentication:** Use a shared secret token (`PROVISIONING_API_TOKEN` env var) in the Authorization header. Simple Bearer token check — all first-party apps share this secret.

### `src/index.mjs`
Express server:
- Load env vars (dotenv)
- Connect to Postgres
- Mount routes
- Listen on `PORT` (default 3001)
- Health check endpoint at `GET /health`

## Step 3: Package Configuration

`~/Desktop/SelfActualSystem/services/provisioning/package.json`:
```json
{
  "name": "selfactual-provisioning-service",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/index.mjs",
    "dev": "node --watch src/index.mjs",
    "test:pod": "node tests/test-programmatic-pod.mjs",
    "test:provision": "node tests/test-provisioning.mjs",
    "db:init": "psql $DATABASE_URL -f src/schema.sql"
  },
  "dependencies": {
    "@inrupt/solid-client": "^2.1.0",
    "@inrupt/solid-client-authn-node": "^2.1.0",
    "express": "^4.18.0",
    "pg": "^8.11.0",
    "dotenv": "^16.3.0"
  }
}
```

`.env.example`:
```
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/selfactual
CSS_BASE_URL=https://vaults.selfactual.ai
SERVICE_CLIENT_ID=
SERVICE_CLIENT_SECRET=
SERVICE_WEBID=https://vaults.selfactual.ai/service/profile/card#me
PROVISIONING_API_TOKEN=<shared-secret-for-first-party-apps>
```

## Step 4: Smoke Test

Create `~/Desktop/SelfActualSystem/services/provisioning/tests/test-provisioning.mjs`:

1. Start by calling `POST /provision` with a test user
2. Verify the API returns success with pod URLs and WebID
3. Query the vault_accounts table to verify the record
4. Authenticate as the service account via Solid-OIDC
5. Read the test user's master and sub pods
6. Verify container structure (master/assessments/, master/reflections/, sub/assessments/, etc.)
7. Verify initial documents (profile card, framework context)
8. Call `GET /status/:auth0Sub` and verify the response
9. Report pass/fail for each check

## Step 5: AST Integration (Caller Side)

**This is a MINIMAL change to the AST codebase.** Create one small file:

`~/Desktop/HI_Replit/server/services/vault-client.ts`

A thin HTTP client that calls the provisioning service:

```typescript
const PROVISIONING_URL = process.env.VAULT_PROVISIONING_URL || 'http://localhost:3001';
const PROVISIONING_TOKEN = process.env.VAULT_PROVISIONING_TOKEN || '';

export async function provisionUserVault(auth0Sub: string, userId: number, displayName: string) {
  const response = await fetch(`${PROVISIONING_URL}/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PROVISIONING_TOKEN}`,
    },
    body: JSON.stringify({ auth0Sub, userId: String(userId), displayName }),
  });
  return response.json();
}

export async function getVaultStatus(auth0Sub: string) {
  const response = await fetch(`${PROVISIONING_URL}/status/${encodeURIComponent(auth0Sub)}`, {
    headers: { 'Authorization': `Bearer ${PROVISIONING_TOKEN}` },
  });
  return response.json();
}
```

Then modify `~/Desktop/HI_Replit/server/routes/auth0-routes.ts` — inside `handleAuth0Session()`, after `userManagementService.createUser()` for new users:

```typescript
// Fire-and-forget — provisioning failure must NOT block login
import { provisionUserVault } from '../services/vault-client.js';
provisionUserVault(decoded.sub, createResult.user.id, decoded.name || email?.split('@')[0] || 'user')
  .catch(err => console.error('🔐 Vault provisioning failed (non-blocking):', err.message));
```

Add to AST's `server/.env`:
```
VAULT_PROVISIONING_URL=http://localhost:3001
VAULT_PROVISIONING_TOKEN=<same-shared-secret>
```

## Important Notes

- The provisioning service is a STANDALONE service in `~/Desktop/SelfActualSystem/services/provisioning/`
- It has its OWN package.json, dependencies, database table, and Express server
- AST (and future apps) call it via HTTP — they only need a thin client and two env vars
- Use plain `.mjs` files (no TypeScript) — consistent with existing SelfActual scripts
- The service account must be manually bootstrapped on CSS before the service can operate (one-time setup using the create-credentials.mjs pattern)
- Pod provisioning must NEVER block user login in any calling app. The HTTP call should be fire-and-forget.
- The database can be a separate database or a separate schema in an existing Postgres instance — use DATABASE_URL to configure
