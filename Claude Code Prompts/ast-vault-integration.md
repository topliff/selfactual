# Claude Code Prompt: AST Vault Integration (Dev Only)

## Context

The SelfActual provisioning service is running on EC2. This task adds a thin HTTP client to the AST codebase so that new users get pods provisioned on signup. 

**Critical requirement:** This must ONLY be active in development. Production must not be affected. The safeguard is: if `VAULT_PROVISIONING_TOKEN` is not set, all provisioning calls silently skip. Production on Lightsail does not have this env var and never will until we're ready.

## Branch

Work on the existing branch `feature/solid-pod-integration`. Do NOT touch `main` or `development`.

```bash
cd ~/Desktop/HI_Replit
git checkout feature/solid-pod-integration
```

If this branch is behind development/main, do NOT merge — just work on it as-is.

## Read First

- `~/Desktop/HI_Replit/server/routes/auth0-routes.ts` — the Auth0 session handler
- `~/Desktop/HI_Replit/server/services/vault-client.ts` — may already exist from a previous session. If it does, check its contents and update per the spec below. If not, create it.

## Task A: Create (or Update) vault-client.ts

File: `~/Desktop/HI_Replit/server/services/vault-client.ts`

```typescript
/**
 * Vault Provisioning Client
 * 
 * Thin HTTP client for the SelfActual provisioning service.
 * SAFE BY DEFAULT: If VAULT_PROVISIONING_TOKEN is not set, all calls silently skip.
 * This means production (which doesn't have this env var) is never affected.
 */

const PROVISIONING_URL = process.env.VAULT_PROVISIONING_URL || '';
const PROVISIONING_TOKEN = process.env.VAULT_PROVISIONING_TOKEN || '';

function isEnabled(): boolean {
  return !!(PROVISIONING_URL && PROVISIONING_TOKEN);
}

export async function provisionUserVault(
  auth0Sub: string, 
  userId: number, 
  displayName: string
): Promise<{ status: string; skipped?: boolean } | null> {
  if (!isEnabled()) {
    // Silently skip — no token means provisioning is not configured for this environment
    return { status: 'skipped', skipped: true };
  }

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

export async function getVaultStatus(
  auth0Sub: string
): Promise<{ status: string; skipped?: boolean } | null> {
  if (!isEnabled()) {
    return { status: 'skipped', skipped: true };
  }

  const response = await fetch(
    `${PROVISIONING_URL}/status/${encodeURIComponent(auth0Sub)}`, 
    { headers: { 'Authorization': `Bearer ${PROVISIONING_TOKEN}` } }
  );
  
  if (!response.ok) return null;
  return response.json();
}
```

The `isEnabled()` guard is the safety mechanism. No token = no HTTP calls = production unaffected.

## Task B: Hook into auth0-routes.ts (New Users)

In `~/Desktop/HI_Replit/server/routes/auth0-routes.ts`, find the `handleAuth0Session` function. Locate where a NEW user is created — it's the block with `userManagementService.createUser()`.

Add the import at the top of the file with the other imports:
```typescript
import { provisionUserVault, getVaultStatus } from '../services/vault-client.js';
```

After the line `console.log('Created new user from Auth0:', user.id);`, add:

```typescript
      // Provision Solid Pod vault (dev only — silently skips if not configured)
      provisionUserVault(decoded.sub, user.id, decoded.name || email?.split('@')[0] || 'user')
        .then(result => {
          if (result?.skipped) return;
          console.log('🔐 Vault provisioning initiated:', result?.status || 'sent');
        })
        .catch(err => console.error('🔐 Vault provisioning failed (non-blocking):', err.message));
```

## Task C: Retroactive Provisioning for Existing Users

In the same `handleAuth0Session` function, find the `else` branch — where an EXISTING user is found (not a new user). This is after the block that updates `auth0Sub` and `lastLoginAt`.

Before the session creation (`req.session.userId = user.id`), add:

```typescript
      // Check vault status for existing users (dev only — silently skips if not configured)
      if (decoded.sub) {
        getVaultStatus(decoded.sub)
          .then(result => {
            if (result?.skipped) return;
            if (!result || result.status === 'not_found') {
              // User exists but has no vault — provision retroactively
              provisionUserVault(decoded.sub, user.id, user.name || email?.split('@')[0] || 'user')
                .then(r => {
                  if (r?.skipped) return;
                  console.log('🔐 Retroactive vault provisioning:', r?.status || 'sent');
                })
                .catch(err => console.error('🔐 Retroactive provisioning failed (non-blocking):', err.message));
            }
          })
          .catch(err => console.error('🔐 Vault status check failed (non-blocking):', err.message));
      }
```

## Task D: Verify .env Has the Vault Vars

Check that `~/Desktop/HI_Replit/server/.env` contains:
```
VAULT_PROVISIONING_URL=http://52.32.95.140:3001
VAULT_PROVISIONING_TOKEN=65837193e86f8994d3ac188292a8628ff582e513d9331e04ce390fa9064ce3b7
```

If the URL is set to `localhost:3001`, change it to `http://52.32.95.140:3001` — AST runs on Lightsail, not on the same EC2 as the provisioning service.

**Note:** Port 3001 on EC2 may not be open yet. The fire-and-forget pattern means this won't break anything — provisioning will silently fail until the port is opened or Nginx is configured as a reverse proxy.

Also add to `~/Desktop/HI_Replit/.env` if not already there:
```
VAULT_PROVISIONING_URL=http://52.32.95.140:3001
VAULT_PROVISIONING_TOKEN=65837193e86f8994d3ac188292a8628ff582e513d9331e04ce390fa9064ce3b7
```

## Task E: Commit

```bash
cd ~/Desktop/HI_Replit
git add server/services/vault-client.ts server/routes/auth0-routes.ts
git commit -m "feat: vault provisioning client (dev-only, safe by default)

- Thin HTTP client for SelfActual provisioning service
- isEnabled() guard: silently skips if VAULT_PROVISIONING_TOKEN not set
- Production on Lightsail has no vault env vars → zero impact
- Fire-and-forget: provisioning failure never blocks login
- Retroactive provisioning for existing users on login"
```

Do NOT push. Do NOT merge to development or main. Leave on `feature/solid-pod-integration`.

## Production Safety Verification

After completing all tasks, verify:
1. `vault-client.ts` has the `isEnabled()` check that returns early if env vars are missing
2. All provisioning calls use `.catch()` and never await in the login flow
3. The deploy script (`deploy-latest-code.sh`) does NOT contain `VAULT_PROVISIONING_URL` or `VAULT_PROVISIONING_TOKEN` — do NOT add them
4. The `.env` files are in `.gitignore` — verify this

Report these verification results.
