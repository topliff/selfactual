<!-- gh issue create --title "Add DNS A record for vocab.selfactual.ai" --label "infrastructure" --label "manual" --body-file issues/03-dns-a-record-vocab.md -->

## Summary

Add a DNS A record so `vocab.selfactual.ai` resolves to the EC2 instance. This is a manual step — it must be done at the DNS provider (not Route 53).

## What to Do

Log into the DNS provider for `selfactual.ai` and add:

| Field | Value |
|-------|-------|
| **Name** | `vocab` |
| **Type** | `A` |
| **Value** | `52.32.95.140` |
| **TTL** | 300 (or default) |

This is the same Elastic IP used by `vaults.selfactual.ai`.

## Context

- Domain `selfactual.ai` is managed at an external DNS provider (not AWS Route 53)
- The existing A record `vaults.selfactual.ai → 52.32.95.140` was set up the same way
- The EC2 instance at this IP runs nginx, which will route `vocab.selfactual.ai` to a separate server block serving the `sa.ttl` ontology file

## After Adding the Record

1. Verify propagation: `dig vocab.selfactual.ai` — should return `52.32.95.140`
2. Run the vocab deploy script (see issue #2) to set up nginx + TLS
3. On first deploy, provision the TLS cert:
   ```bash
   ssh -i ~/.ssh/selfactual.pem ubuntu@52.32.95.140
   sudo certbot --nginx -d vocab.selfactual.ai
   ```
4. Verify: `curl -I https://vocab.selfactual.ai/` — should return 200 with `Content-Type: text/turtle`

## Depends On

Nothing — this can be done immediately.

## Blocks

- Issue #2 (publish vocabulary) — nginx config won't work until DNS resolves

## Acceptance Criteria

- [ ] `dig vocab.selfactual.ai` returns `52.32.95.140`
- [ ] HTTP request to `http://vocab.selfactual.ai/` gets a response (even if just nginx default until vocab is deployed)
