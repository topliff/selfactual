# Claude Code Prompt: Post-Deployment Setup

The provisioning service is running on EC2 at `52.32.95.140:3001` and passing all smoke tests. There are 4 tasks to complete in order. SSH access is via `ssh -i ~/.ssh/selfactual.pem ubuntu@52.32.95.140`.

## Task 1: Make the Service Persistent with pm2

SSH into the EC2 instance and run:

```bash
sudo npm install -g pm2
cd ~/provisioning
pm2 start src/index.mjs --name provisioning
pm2 save
pm2 startup
```

Follow the output of `pm2 startup` — it will print a command you need to copy and run with sudo. After that, verify with `pm2 list` that the provisioning service shows as "online". Test that it survives by running `pm2 restart provisioning` and then hitting the health endpoint: `curl http://localhost:3001/health`.

## Task 2: Bootstrap the Service Account on CSS

The provisioning service creates user pods, but the future Pod Write Service needs a persistent service account that has write access to all user pods. This account doesn't exist yet on CSS.

Create a script at `~/Desktop/SelfActualSystem/scripts/bootstrap-service-account.mjs` that:

1. Creates a new CSS account at `https://vaults.selfactual.ai/.account/` with email `service@vaults.selfactual.ai` and a strong generated password
2. Creates a pod for this account (the pod name should result in a path like `/service/`)
3. Creates client credentials tied to WebID `https://vaults.selfactual.ai/service/profile/card#me`
4. Prints the `SERVICE_CLIENT_ID` and `SERVICE_CLIENT_SECRET` values

Mirror the patterns from `~/Desktop/SelfActualSystem/scripts/create-credentials.mjs` — it already shows the CSS Account API flow (login → get controls → create credentials). The new script needs to additionally create the pod programmatically (same approach validated in `~/Desktop/SelfActualSystem/services/provisioning/tests/test-programmatic-pod.mjs`).

**Important:** Print the credentials clearly so they can be copied into the provisioning service's `.env` file. Also print the exact lines to add:
```
SERVICE_CLIENT_ID=<actual value>
SERVICE_CLIENT_SECRET=<actual value>
```

After running this script successfully, SSH into EC2, update `~/provisioning/.env` with the credentials, and restart: `pm2 restart provisioning`.

Then re-run the smoke test with SERVICE_CLIENT_ID and SERVICE_CLIENT_SECRET set to verify step 5 (pod verification) now passes.

## Task 3: Commit the Provisioning Service Code

The local files at `~/Desktop/SelfActualSystem/services/provisioning/` need to be committed. Also commit the new `Claude Code Prompts/` directory and the updated `docs/next-conversation-starter.md`.

```bash
cd ~/Desktop/SelfActualSystem
git add services/ "Claude Code Prompts/" docs/next-conversation-starter.md
git commit -m "feat: standalone vault provisioning service

- Express API on port 3001 with /provision, /status, /retry endpoints
- CSS Account API integration for programmatic pod creation
- Dual-pod scaffolding (master + sub) with ACLs
- vault_accounts Postgres table for identity mapping
- Bearer token auth for first-party app callers
- Smoke tests passing against live CSS"
git push origin main
```

## Task 4: AST Integration (Thin Client)

This adds two things to the AST codebase at `~/Desktop/HI_Replit/`:

### 4a. Create the vault client

Create `~/Desktop/HI_Replit/server/services/vault-client.ts`:

```typescript
/**
 * Vault Provisioning Client
 * Thin HTTP client for the SelfActual provisioning service.
 * Any first-party app can use this pattern — just needs two env vars.
 */

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

### 4b. Hook into auth0-routes.ts

Read `~/Desktop/HI_Replit/server/routes/auth0-routes.ts`. Find the `handleAuth0Session` function. Inside it, find the block where a NEW user is created — it looks like:

```typescript
const createResult = await userManagementService.createUser({...});
if (!createResult.success) {
  return res.status(500).json({ error: 'Failed to create user account' });
}
user = createResult.user;
console.log('Created new user from Auth0:', user.id);
```

Immediately after `console.log('Created new user from Auth0:', user.id);`, add:

```typescript
// Provision Solid Pod vault — fire-and-forget, must not block login
import { provisionUserVault } from '../services/vault-client.js';
provisionUserVault(decoded.sub, user.id, decoded.name || email?.split('@')[0] || 'user')
  .then(result => console.log('🔐 Vault provisioning initiated:', result.status || 'sent'))
  .catch(err => console.error('🔐 Vault provisioning failed (non-blocking):', err.message));
```

Note: The import should be moved to the top of the file with the other imports. Use a dynamic import or a top-level import — check what pattern the file uses and match it. The key requirement is that the `.catch()` ensures this NEVER blocks login even if the provisioning service is down.

### 4c. Also handle existing users who don't have vaults yet

In the same `handleAuth0Session` function, in the `else` branch (existing user found), add a check: call `getVaultStatus(decoded.sub)` and if it returns 404 or an error, fire-and-forget a `provisionUserVault` call. This handles users who signed up before the provisioning service existed.

### 4d. Add env vars

Add to `~/Desktop/HI_Replit/server/.env` (and any `.env.example`):
```
VAULT_PROVISIONING_URL=http://52.32.95.140:3001
VAULT_PROVISIONING_TOKEN=65837193e86f8994d3ac188292a8628ff582e513d9331e04ce390fa9064ce3b7
```

Note: If AST runs on the same EC2 instance as the provisioning service, use `http://localhost:3001` instead.

### 4e. Commit

```bash
cd ~/Desktop/HI_Replit
git add server/services/vault-client.ts server/routes/auth0-routes.ts
git commit -m "feat: integrate vault provisioning on Auth0 signup

- Thin HTTP client for SelfActual provisioning service
- Fire-and-forget pod creation on new user signup
- Retroactive provisioning for existing users on login
- Non-blocking: provisioning failure never prevents login"
```

## Execution Order

1. pm2 (SSH into EC2)
2. Service account bootstrap (run script locally, then update EC2 .env)
3. Commit SelfActual repo
4. AST integration + commit

Do these in order. Stop after each task and report results.
