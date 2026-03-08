# Operations Reference

## SSH into the instance

```bash
ssh -i ~/.ssh/selfactual.pem ubuntu@52.32.95.140
```

## CSS container logs

```bash
docker logs -f css          # follow live
docker logs --tail 100 css  # last 100 lines
```

## Restart CSS

```bash
docker restart css
```

## Stop & re-create with different settings

```bash
docker stop css && docker rm css

docker run -d \
  --name css \
  --restart=always \
  -p 3000:3000 \
  -v /srv/css-data:/data \
  -e CSS_CONFIG=config/file.json \
  -e CSS_LOGGING_LEVEL=info \
  -e CSS_BASE_URL="https://vaults.selfactual.ai/" \
  solidproject/community-server:latest
```

## Pin a specific CSS version

Replace `latest` with a version tag:

```bash
docker pull solidproject/community-server:7.1.3
# then re-create the container as above, using :7.1.3 instead of :latest
```

## Confirm the configured base URL

```bash
docker inspect css --format '{{range .Config.Env}}{{println .}}{{end}}' | grep CSS_BASE_URL
```

## Check cloud-init logs (first boot debugging)

```bash
sudo cat /var/log/cloud-init-output.log
```

## Pod data location

All pod data lives in `/srv/css-data` on the host, mounted as `/data` inside the container.
Back this up before any destructive operations.

## Nginx

```bash
sudo nginx -t                 # test config
sudo systemctl reload nginx   # reload after config changes
sudo tail -f /var/log/nginx/error.log
```

## TLS certificate

```bash
sudo certbot renew --dry-run   # verify auto-renewal works
sudo certbot certificates      # check certificate status/expiry
```

---

## Solid-OIDC Authentication

CSS has two auth layers. Understanding the difference is critical.

### Layer 1: Account API (`CSS-Account-Token`)

For account management only — creating credentials, linking WebIDs, managing your account. NOT for pod read/write.

```bash
# Login to account API
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "your-password"}' \
  https://vaults.selfactual.ai/.account/login/password/

# Returns: {"authorization": "css-account-token-here"}
# Use with: Authorization: CSS-Account-Token <token>
```

### Layer 2: Solid-OIDC (DPoP tokens)

For pod operations — reading/writing resources, creating containers, setting ACLs. Requires client credentials registered via the Account API.

**One-time setup:** Register client credentials using `scripts/create-credentials.mjs`:
```bash
cd scripts
npm install
export CSS_EMAIL="your-email"
export CSS_PASSWORD="your-password"
node create-credentials.mjs
# Outputs: Client ID and Client Secret — save these
```

**Programmatic access:** Use `@inrupt/solid-client-authn-node`:
```javascript
import { Session } from "@inrupt/solid-client-authn-node";

const session = new Session();
await session.login({
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  oidcIssuer: "https://vaults.selfactual.ai",
});

// session.fetch automatically adds DPoP tokens
const response = await session.fetch("https://vaults.selfactual.ai/test_pod/master/assessments/starcard", {
  headers: { Accept: "text/turtle" },
});
```

**Why not curl?** Solid-OIDC requires DPoP (Demonstration of Proof-of-Possession) tokens — cryptographic proof that the sender holds a private key. This is too complex for bash scripts. Use the Inrupt Node.js libraries.

### Current credentials

- **Test pod WebID:** `https://vaults.selfactual.ai/test_pod/profile/card#me`
- **Client credentials:** Created via `create-credentials.mjs`, stored in environment variables (`CSS_CLIENT_ID`, `CSS_CLIENT_SECRET`)
- **Account email:** `brad@selfactual.ai`

---

## Test Pod Structure

Live data created during validation (2026-02-27):

```
https://vaults.selfactual.ai/test_pod/
├── profile/card                    # WebID profile (CSS-generated)
├── master/
│   ├── assessments/
│   │   └── starcard                # T78 A65 F82 P71, shape: Connector
│   ├── reflections/
│   │   └── strength-reflections/
│   │       └── thinking            # Linked to starcard, score 78
│   ├── context/                    # (empty)
│   └── provenance/                 # (empty)
└── sub/
    ├── assessments/
    │   └── starcard                # Same scores, NO reflection link
    └── context/                    # (empty)
```
