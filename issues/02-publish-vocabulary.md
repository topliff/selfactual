<!-- gh issue create --title "Publish sa: vocabulary at vocab.selfactual.ai" --label "infrastructure" --label "partner-integration" --body-file issues/02-publish-vocabulary.md -->

## Summary

Serve the SelfActual OWL ontology (`sa.ttl`) at `https://vocab.selfactual.ai/` so the `sa:` namespace URI (`https://vocab.selfactual.ai/`) resolves to a real, dereferenceable RDF document.

## Components

### A. Nginx config (`infra/nginx/vocab.conf`)

Server block for `vocab.selfactual.ai` that:
- Serves `/var/www/vocab/sa.ttl` with `Content-Type: text/turtle`
- Content negotiation stub (future JSON-LD support)
- CORS headers (`Access-Control-Allow-Origin: *`)
- TLS via Let's Encrypt (certbot)
- HTTP → HTTPS redirect
- Modeled after existing `infra/nginx/pods.conf`

### B. Deploy script (`scripts/deploy-vocab.sh`)

- SCPs `docs/developer-guide/vocabulary/sa.ttl` + `infra/nginx/vocab.conf` to EC2
- Creates `/var/www/vocab/` directory on EC2
- Symlinks config to `sites-enabled`, validates, reloads nginx
- Notes certbot first-run command for initial TLS provisioning

### C. DNS A record (manual — see issue #3)

Depends on the DNS A record being set up first.

## Acceptance Criteria

- [ ] `infra/nginx/vocab.conf` exists and matches production nginx patterns
- [ ] `scripts/deploy-vocab.sh` exists, is executable, and is idempotent
- [ ] After deploy: `curl -H "Accept: text/turtle" https://vocab.selfactual.ai/` returns valid Turtle
- [ ] HTTPS works with valid Let's Encrypt certificate
- [ ] CORS header present in response
