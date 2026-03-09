<!-- gh issue create --title "Repeatable process for adding partner WebIDs to sandbox ACLs" --label "infrastructure" --label "partner-integration" --body-file issues/07-add-partner-webids.md -->

## Summary

The sandbox script supports `--create-partner-account` for a single test partner during initial provisioning. We need a repeatable process for adding additional partner service accounts to sandbox sub pod ACLs after the sandbox is already provisioned.

## Problem

After initial provisioning, the sandbox pod owner credentials (used for ACL writes) are no longer available in memory. The service account has `acl:Read` + `acl:Write` but NOT `acl:Control`, so it cannot modify ACLs.

## Options to Evaluate

1. **Store sandbox user credentials** securely (e.g., in a `.env.sandbox-creds` file, gitignored) so ACLs can be updated by re-authenticating as the pod owner
2. **Grant the service account `acl:Control`** on sandbox sub pods (simpler, but deviates from the production ACL model)
3. **Extend the sandbox script** with an `--add-partner <webid>` flag that re-authenticates as each sandbox user to update ACLs
4. **Edit ACL files directly on disk** via SSH — `sudo vim /srv/css-data/sandbox-alice/sub/.acl` — pragmatic for the current scale

## Recommendation

Option 3 is cleanest but requires storing sandbox user credentials. Option 4 is the pragmatic fallback. Decide based on how many partners are expected in the near term.

## Acceptance Criteria

- [ ] Documented process for adding a new partner WebID to all sandbox sub pod ACLs
- [ ] Process tested with at least one additional partner account
