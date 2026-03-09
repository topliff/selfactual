<!-- gh issue create --title "Run sandbox provisioning against live CSS" --label "infrastructure" --label "partner-integration" --body-file issues/04-run-sandbox-provisioning.md -->

## Summary

Run `services/sandbox/provision-sandbox.mjs` against the live CSS at `vaults.selfactual.ai` to create the actual sandbox environment partners will use.

## Depends On

- Issue #5 (clean up stale test pods) — should be done first so the CSS instance is clean
- `services/sandbox/` already exists with the provisioning script and sample data

## Steps

1. Configure `.env` in `services/sandbox/`:
   ```bash
   cd services/sandbox
   cp .env.example .env
   # Fill in SERVICE_CLIENT_ID, SERVICE_CLIENT_SECRET from provisioning service .env
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run provisioning:
   ```bash
   node provision-sandbox.mjs
   ```

4. Verify with the developer guide example:
   ```bash
   cd ../../docs/developer-guide/examples/node-read-starcard
   cp .env.example .env
   # Fill in credentials
   npm install
   node index.js
   ```

5. Optionally create a partner test account:
   ```bash
   cd ../../services/sandbox
   node provision-sandbox.mjs --create-partner-account
   ```

6. Store sandbox user credentials securely (not in the repo)

## Acceptance Criteria

- [ ] sandbox-alice, sandbox-bob, sandbox-cara pods exist with sample data
- [ ] org-sandbox-acme pod exists with team roster
- [ ] Developer guide Node.js example runs successfully
- [ ] Re-running the script is idempotent (no errors, no duplicates)
