# Provisioning Service — Implementation Conversation Starter

**Updated: March 6, 2026** — Revised after codebase review. Corrects service account model, Auth0 integration point, and removes OpenAI references.

---

## What This Service Does

When a user signs up via Auth0 in any first-party app, the Provisioning Service creates their dual-pod infrastructure on CSS. It's the foundation everything else depends on — the Pod Write Service can't write anywhere until pods exist, Atlas can't read anything until pods exist.

**The end-to-end sequence:**

1. User signs up in AST (or any first-party app) via Auth0
2. AST's Auth0 session handler detects a new user (no existing DB record)
3. After creating the user in Postgres, the handler calls the Provisioning Service
4. Provisioning Service creates a CSS account, pod, containers, ACLs, and scaffolding
5. Returns pod URLs and WebID; stores the mapping in Postgres
6. AST continues with its normal post-login redirect

---

## Design Decisions (All Resolved)

### Identity Mapping

Users have two identities that are linked but separate:

- **Auth0 identity** (`auth0|abc123`) — app-level authentication across all first-party apps
- **CSS WebID** (`https://vaults.selfactual.ai/{username}/master/profile/card#me`) — data-level identity for Solid pod operations

The Provisioning Service maintains the mapping between them. The user never sees or manages the CSS identity directly — it's created transparently during provisioning. This is consistent with the fiduciary model.

**Mapping stored in `vault_accounts` table:** `auth0Sub` ↔ `cssAccountId` ↔ `username` ↔ `webId` ↔ `masterPodUrl` ↔ `subPodUrl`

### Service Account Model — Single Service Account

**Decision:** One service account ("SelfActual Pod Service") with delegated Write access to all user pods. No per-user credential management.

- WebID: `https://vaults.selfactual.ai/service/profile/card#me`
- During provisioning, each user's pod ACLs grant Write permission to this service WebID
- When AST writes assessment data, it calls the Pod Write Service, which authenticates as the service account
- Provenance log records which app triggered each write (auditability preserved)

**Why single service account:** Simpler (one credential pair to manage), maps to fiduciary model (SelfActual-the-custodian is an explicit named agent), avoids managing per-user secrets. Tradeoff: if the service credential leaks, it has write access to all pods. Acceptable risk for pre-seed POC.

**The service account must be bootstrapped manually ONCE before the provisioning service can operate.** Use the existing `create-credentials.mjs` script pattern to create this account and its credentials on the live CSS instance. Store the resulting `SERVICE_CLIENT_ID` and `SERVICE_CLIENT_SECRET` in the server `.env`.

### Provisioning Timing — On Auth0 Signup (Eager)

**Decision:** Eager provisioning. Every user gets pods immediately on signup.

**Why not lazy (on first assessment):** Empty pods have negligible overhead on CSS with file storage. Eager provisioning simplifies the write path (never handle "pods don't exist yet"). Atlas is pod-native and needs pods before it can do anything.

### Dual-Pod Architecture

Each user gets two top-level containers under a single CSS pod:

- **`/{username}/master/`** — all user data, owner-only access + service write
- **`/{username}/sub/`** — curated subset shared with authorized apps + service write

Reflections exist *only* in the master pod. Assessment results exist in *both*. The sub pod is what third-party apps see.

**Key insight**: The "two pods" are actually two top-level containers (`master/` and `sub/`) within a single CSS pod, owned by a single WebID. This is already validated — see `~/Desktop/SelfActualSystem/scripts/validate-pod.mjs`.

---

## Pre-Implementation Validation Step

**IMPORTANT:** Before building the service, validate programmatic pod creation against the live CSS.

The existing scripts prove that container creation, RDF writes, and credential registration work. But the test pod (`/test_pod/`) was created via the CSS web UI, not programmatically. The provisioning service needs to create pods via the CSS Account API.

**Test this first:**
1. Use the CSS Account API to create a new account programmatically (`POST /.account/`)
2. Use the account controls to create a pod for that account
3. Verify the pod is accessible and containers can be created within it

This should be a quick standalone script (`scripts/test-programmatic-pod.mjs`) that proves the pattern before building the full service.

---

## Auth0 Integration Point

**This is different from what you might expect.** AST does NOT use Auth0 post-signup webhooks. Instead:

1. The Auth0Provider on the client side handles login/signup
2. After Auth0 authentication, the client calls `POST /api/auth0-session` with the Bearer token
3. The server handler in `server/routes/auth0-routes.ts` decodes the JWT
4. If no user exists in the database, it creates one via `userManagementService.createUser()`
5. Session is created and user is redirected

**The provisioning hook goes inside `auth0-routes.ts`**, right after the `userManagementService.createUser()` call succeeds for a new user. Specifically, in the `handleAuth0Session` function, after the block:

```typescript
if (!user) {
  // ... role determination ...
  const createResult = await userManagementService.createUser({ ... });
  // ← PROVISIONING CALL GOES HERE
  // Only for new users, not existing users
}
```

The call should be **fire-and-forget with error logging** — pod provisioning failure should NOT block the user from logging in. The user can still use AST normally (Postgres is the source of truth). Provisioning can be retried later.

---

## Existing Codebase Patterns

Before writing code, read these files to understand conventions:

### AST Codebase Structure
```
~/Desktop/HI_Replit/
├── shared/schema.ts           # Drizzle ORM schema — ALL tables defined here
├── server/db.ts               # Database connection (Drizzle + postgres-js)
├── server/services/           # Service classes (your new service goes here)
├── server/routes/             # Express route handlers
├── server/routes/auth0-routes.ts  # Auth0 callback — WHERE TO ADD PROVISIONING HOOK
├── migrations/                # SQL migration files
├── drizzle.config.ts          # Drizzle Kit config
├── package.json               # Dependencies (ESM, TypeScript)
```

### Key Patterns
- **ORM**: Drizzle ORM with `postgres-js` driver. Schema in `shared/schema.ts`.
- **Migrations**: SQL files in `migrations/` directory, managed by `drizzle-kit push`. Look at existing migrations for naming convention.
- **Services**: Class-based services in `server/services/`. Some use the `pg` Pool directly, some use Drizzle. **Use Drizzle** for new code — it matches the schema.ts pattern.
- **TypeScript**: ESM modules (`"type": "module"` in package.json). Import with `.js` extensions.
- **Environment**: Env vars in `server/.env`. `DATABASE_URL` is the main one.
- **AI Provider**: Claude API via `server/services/claude-provider.ts` with abstraction layer in `ai-provider.ts`. OpenAI is no longer used.

### CSS Account API (Already Validated)
The scripts at `~/Desktop/SelfActualSystem/scripts/` show the exact API calls that work:

- `create-credentials.mjs` — Shows CSS Account API login, control discovery, and client credential creation
- `validate-pod.mjs` — Shows Solid-OIDC auth, container creation, RDF write/read, and the full dual-pod structure

**These scripts are your reference implementation.** The provisioning service does the same things programmatically for each new user.

### SelfActual Documentation
Read these for full context:
- `~/Desktop/SelfActualSystem/docs/project-context.md` — System architecture
- `~/Desktop/SelfActualSystem/docs/app-ecosystem.md` — How apps relate to the vault
- `~/Desktop/SelfActualSystem/docs/trust-architecture.md` — Custodial model (explains why we hold keys)
- `~/Desktop/SelfActualSystem/docs/pod-resources-sketch.md` — RDF resource design for pods

---

## What to Build (5 Deliverables)

### 0. Pre-validation Script (Do This First)

**File**: `~/Desktop/SelfActualSystem/scripts/test-programmatic-pod.mjs`

A standalone script that:
1. Creates a new CSS account via `POST /.account/` with generated email/password
2. Uses account controls to create a pod
3. Creates client credentials for the new account
4. Authenticates via Solid-OIDC and creates containers in the pod
5. Cleans up (or leaves for inspection)

This validates the one untested assumption before building the full service.

### 1. Schema Addition: `vault_accounts` Table

**File**: `shared/schema.ts` (add to existing file)

Add a new table `vault_accounts` to the Drizzle schema:

```typescript
export const vaultAccounts = pgTable('vault_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  auth0Sub: varchar('auth0_sub', { length: 255 }).notNull().unique(),
  cssAccountId: varchar('css_account_id', { length: 255 }).notNull(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  webId: varchar('web_id', { length: 500 }).notNull(),
  masterPodUrl: varchar('master_pod_url', { length: 500 }).notNull(),
  subPodUrl: varchar('sub_pod_url', { length: 500 }).notNull(),
  provisionedAt: timestamp('provisioned_at').notNull().defaultNow(),
  provisioningStatus: varchar('provisioning_status', { length: 20 }).notNull().default('pending'), // pending, complete, failed
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Note:** This table does NOT store CSS credentials. The single service account's `CLIENT_ID` and `CLIENT_SECRET` live in env vars, not the database.

### 2. Provisioning Service

**File**: `server/services/vault-provisioning-service.ts`

A service class that orchestrates:
1. **Username generation** — slugify `displayName`, handle collisions by appending numbers
2. **CSS account creation** — `POST /.account/` with generated email/password
3. **Pod creation** — use account controls endpoint (validated in step 0)
4. **Container scaffolding** — create `master/`, `sub/`, and all sub-containers using patterns from `validate-pod.mjs`
5. **ACL writing** — set master and sub pod ACLs (see ACL section below)
6. **Initial documents** — WebID profile card, AST framework context
7. **Database mapping** — insert `vault_accounts` record
8. **Error handling** — rollback on failure, store error in `lastError` column

**Environment variables needed:**
```
CSS_BASE_URL=https://vaults.selfactual.ai
SERVICE_CLIENT_ID=<from manual service account setup>
SERVICE_CLIENT_SECRET=<from manual service account setup>
SERVICE_WEBID=https://vaults.selfactual.ai/service/profile/card#me
```

**Dependencies to add to AST's package.json:**
```
@inrupt/solid-client
@inrupt/solid-client-authn-node
```

### 3. Auth0 Route Integration

**File**: `server/routes/auth0-routes.ts` (modify existing)

Add a provisioning call inside `handleAuth0Session()`, immediately after successful user creation:

```typescript
// After: const createResult = await userManagementService.createUser({...});
// Add:
try {
  const { vaultProvisioningService } = await import('../services/vault-provisioning-service.js');
  // Fire and don't await — provisioning shouldn't block login
  vaultProvisioningService.provisionUser({
    auth0Sub: decoded.sub,
    userId: createResult.user.id,
    displayName: decoded.name || email?.split('@')[0] || 'user',
  }).catch(err => {
    console.error('🔐 Vault provisioning failed (non-blocking):', err.message);
  });
} catch (err) {
  console.error('🔐 Vault provisioning import failed:', err);
}
```

### 4. Smoke Test Script

**File**: `~/Desktop/SelfActualSystem/scripts/test-provisioning.mjs`

An end-to-end test that:
1. Calls the provisioning service directly (bypassing Auth0) for a test user
2. Verifies the `vault_accounts` record was created
3. Authenticates as the service account
4. Reads the test user's master and sub pods
5. Verifies container structure, ACLs, and initial documents
6. Reports pass/fail for each step

### 5. Admin Route (Optional but Useful)

**File**: `server/routes/vault-admin-routes.ts`

Endpoints for managing vault provisioning:
- `GET /api/admin/vault-status/:userId` — check if a user has been provisioned
- `POST /api/admin/vault-provision/:userId` — manually trigger provisioning for a user
- `GET /api/admin/vault-stats` — count of provisioned vs unprovisioned users

Useful for debugging and for manually provisioning existing users who signed up before this feature was built.

---

## ACL Structure

### Master Pod ACL — Owner + Service Write

```turtle
# /{username}/master/.acl
@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner>
    a acl:Authorization ;
    acl:agent           <https://vaults.selfactual.ai/{username}/master/profile/card#me> ;
    acl:accessTo        <https://vaults.selfactual.ai/{username}/master/> ;
    acl:default         <https://vaults.selfactual.ai/{username}/master/> ;
    acl:mode            acl:Read, acl:Write, acl:Control .

<#serviceWrite>
    a acl:Authorization ;
    acl:agent           <https://vaults.selfactual.ai/service/profile/card#me> ;
    acl:accessTo        <https://vaults.selfactual.ai/{username}/master/> ;
    acl:default         <https://vaults.selfactual.ai/{username}/master/> ;
    acl:mode            acl:Write .
```

### Sub Pod ACL — Owner + First-Party Read + Service Write

```turtle
# /{username}/sub/.acl
@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner>
    a acl:Authorization ;
    acl:agent           <https://vaults.selfactual.ai/{username}/master/profile/card#me> ;
    acl:accessTo        <https://vaults.selfactual.ai/{username}/sub/> ;
    acl:default         <https://vaults.selfactual.ai/{username}/sub/> ;
    acl:mode            acl:Read, acl:Write, acl:Control .

<#firstPartyAppRead>
    a acl:Authorization ;
    acl:origin          <https://app.selfactual.ai> ;
    acl:accessTo        <https://vaults.selfactual.ai/{username}/sub/> ;
    acl:default         <https://vaults.selfactual.ai/{username}/sub/> ;
    acl:mode            acl:Read .

<#serviceWrite>
    a acl:Authorization ;
    acl:agent           <https://vaults.selfactual.ai/service/profile/card#me> ;
    acl:accessTo        <https://vaults.selfactual.ai/{username}/sub/> ;
    acl:default         <https://vaults.selfactual.ai/{username}/sub/> ;
    acl:mode            acl:Write .
```

---

## Pod Scaffolding

### Master Pod Structure

```
/{username}/master/
  profile/
    card              ← WebID document (RDF)
  assessments/        ← empty container
  reflections/        ← empty container
  context/
    ast-framework     ← AST framework context document
  provenance/         ← empty container
```

### Sub Pod Structure

```
/{username}/sub/
  assessments/        ← empty container
  context/
    ast-framework     ← AST framework context document
```

### Initial Documents

**WebID Profile Card** (`/master/profile/card`):
```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix sa:   <https://vocab.selfactual.ai/> .

<#me>
    a foaf:Person, sa:VaultOwner ;
    foaf:name       "{displayName}" ;
    sa:masterPod    <https://vaults.selfactual.ai/{username}/master/> ;
    sa:subPod       <https://vaults.selfactual.ai/{username}/sub/> .
```

**AST Framework Context** — the self-describing framework document goes into `context/ast-framework` in both pods. Full RDF in `docs/pod-resources-sketch.md`, section 7.

---

## CSS Account API Reference

Based on what we validated with existing scripts (`scripts/create-credentials.mjs`):

### Create Account

```
POST https://vaults.selfactual.ai/.account/
Content-Type: application/json

{ "email": "{generated}@vaults.selfactual.ai", "password": "{generated}" }
```

Returns a `CSS-Account-Token` for account management operations.

### Account Controls

```
GET https://vaults.selfactual.ai/.account/
Authorization: CSS-Account-Token {token}
```

Returns JSON with `controls` object containing endpoints for pod creation, WebID linking, and client credential registration.

### Create Pod

Use the pod creation endpoint from account controls. Creates a pod under the account. **This needs to be validated in the pre-implementation step.**

### Register Client Credentials

```
POST {clientCredentials endpoint from controls}
Authorization: CSS-Account-Token {token}
Content-Type: application/json

{ "name": "SelfActual Pod Service", "webId": "{webId}" }
```

Returns `{ id: "client_id", secret: "client_secret" }` for Solid-OIDC authentication.

### Key Insight: Two Auth Layers

CSS has two separate auth systems:
1. **Account API** — email/password login → `CSS-Account-Token` (account management only)
2. **Pod operations** — Solid-OIDC with DPoP tokens via client credentials (read/write pod data)

The Provisioning Service uses layer 1 to create accounts and pods, then the Pod Write Service uses layer 2 (via the service account) to write data.

---

## What Already Exists

### Live Infrastructure

- CSS running at `https://vaults.selfactual.ai/` (EC2 t3.small, Docker, Nginx, Let's Encrypt)
- Test pod at `/test_pod/` with validated dual-pod structure and real RDF data

### Validated Scripts

| Script | What It Does |
|--------|-------------|
| `scripts/create-credentials.mjs` | Registers client credentials via CSS Account API |
| `scripts/validate-pod.mjs` | Creates containers, writes/reads RDF resources, tests auth |

Both scripts use `@inrupt/solid-client` and `@inrupt/solid-client-authn-node`. They demonstrate working patterns for all pod operations the Provisioning Service needs.

### Dependencies Already Proven

```json
{
  "@inrupt/solid-client": "^2.1.0",
  "@inrupt/solid-client-authn-node": "^2.1.0"
}
```

### Repository

- GitHub: `https://github.com/topliff/selfactual`
- Local: `~/Desktop/SelfActualSystem/`
- Branch: `main`

### Related Documentation

| Doc | Content |
|-----|---------|
| `docs/project-context.md` | System overview, infrastructure, architecture |
| `docs/pod-resources-sketch.md` | RDF resource design, Turtle examples, container layouts, ACL sketches |
| `docs/app-ecosystem.md` | All six apps, their vault roles, data flows |
| `docs/trust-architecture.md` | Data fiduciary model, custodial relationship |
| `docs/progress-log.md` | Chronological record of what's been built and tested |

---

## Sequence Diagram

```
User          AST Client        auth0-routes.ts     Provisioning Svc    CSS             Postgres
 │                │                    │                    │              │                │
 │──Auth0 login──▶│                    │                    │              │                │
 │                │──POST /auth0-session▶                   │              │                │
 │                │                    │──decode JWT         │              │                │
 │                │                    │──lookup user        │              │────────────────▶│
 │                │                    │  (not found)        │              │                │
 │                │                    │──createUser()───────│──────────────│───────────────▶│
 │                │                    │                     │              │                │
 │                │                    │──provisionUser()───▶│              │                │
 │                │                    │  (fire & forget)    │──create acct▶│                │
 │                │                    │                     │◀─account id──│                │
 │                │                    │──create session     │──create pod─▶│                │
 │                │                    │──respond to client  │──set ACLs──▶│                │
 │                │◀─{ user, redirect }│                     │──scaffold──▶│                │
 │◀─redirect──────│                    │                     │──store map──│───────────────▶│
 │                │                    │                     │              │                │
```

**Key difference from previous version:** The provisioning call happens inside `auth0-routes.ts` as fire-and-forget, not as an external webhook. The user gets their session immediately; pod creation happens in the background.

---

## Implementation Order

1. **Pre-validation script** (`test-programmatic-pod.mjs`) — prove programmatic pod creation works
2. **Schema addition** (`vault_accounts` table in `shared/schema.ts`)
3. **Provisioning service** (`vault-provisioning-service.ts`) — CSS account + pod + containers + ACLs + initial docs + DB mapping
4. **Auth0 route integration** (modify `auth0-routes.ts`)
5. **Smoke test** (`test-provisioning.mjs`)
6. **Admin routes** (optional, for debugging)

**Service account bootstrapping** (manual, one-time): Create the `/service/` pod and its client credentials on the live CSS instance using a modified version of `create-credentials.mjs`. This must happen before step 3 can work.

---

## Open Questions for Implementation

1. **ACL writing bootstrapping** — During provisioning, the new account creates its own pods. At that point, the pod owner can set ACLs. But can the owner's Account API token be used to write `.acl` resources, or does it require Solid-OIDC auth? If the latter, the provisioning service needs to register client credentials for the new account temporarily, write ACLs, then discard them. Test this in the pre-validation step.

2. **Username collision handling** — We slugify `displayName`. What's the collision strategy? Append incrementing numbers (`jacobkim`, `jacobkim2`, `jacobkim3`)? Or use a hash suffix? The former is more human-readable.

3. **Existing users** — When this ships, existing Auth0 users won't have pods. Options: (a) provision on next login (check if `vault_accounts` record exists), (b) batch provision all existing users via admin route. Recommend (a) for simplicity.
