# Claude Code Prompt: Add Developer Guide & Provision Sandbox Environment

## Context

You are working in the SelfActual repository at `~/Desktop/SelfActualSystem/`. This is a personal data infrastructure product built on the Solid protocol. The system runs a Community Solid Server (CSS) at `https://vaults.selfactual.ai/` with a provisioning service at `/api/*`.

The repo structure currently looks like:

```
~/Desktop/SelfActualSystem/
├── infra/                    # Terraform (EC2, nginx, security group)
│   ├── main.tf
│   ├── variables.tf
│   ├── user-data.sh
│   └── nginx/pods.conf
├── services/
│   └── provisioning/         # Pod provisioning service (Node.js, deployed via rsync + PM2)
│       ├── src/
│       ├── package.json
│       └── .env              # SERVICE_CLIENT_ID, SERVICE_CLIENT_SECRET, SERVICE_WEBID
└── README.md
```

The provisioning service runs on an EC2 instance at `52.32.95.140`. Deployment is manual:

```bash
rsync -avz services/provisioning/ ubuntu@52.32.95.140:~/provisioning/
ssh -i ~/.ssh/selfactual.pem ubuntu@52.32.95.140 "cd ~/provisioning && pm2 restart provisioning"
```

SSH access: `ssh -i ~/.ssh/selfactual.pem ubuntu@52.32.95.140`

The CSS Account API base URL is `https://vaults.selfactual.ai/.account/`.

The existing service account WebID is: `https://vaults.selfactual.ai/service/profile/card#me`

## Task Overview

There are **three tasks** to complete, in order:

### Task 1: Add the Developer Guide to the Repo

A complete developer guide has been prepared as a tarball. It needs to be integrated into the main repo.

**Steps:**

1. Download and extract the developer guide tarball from this location (I will provide it, or it may already be at `~/Downloads/selfactual-developer-guide.tar.gz`). If the tarball isn't available, look for a `selfactual-developer-guide/` directory — I may have already extracted it.

2. Move the contents into `docs/developer-guide/` within the repo:

```bash
cd ~/Desktop/SelfActualSystem/
mkdir -p docs/developer-guide
# Copy all contents from the extracted tarball into docs/developer-guide/
# The result should be:
# docs/developer-guide/README.md
# docs/developer-guide/getting-started/
# docs/developer-guide/api-reference/
# docs/developer-guide/vocabulary/
# docs/developer-guide/examples/
# docs/developer-guide/decisions/
# docs/developer-guide/sandbox/
# docs/developer-guide/.gitignore
```

3. Verify the structure looks right with `find docs/developer-guide -type f | head -30`.

4. Git add and commit:
```bash
git add docs/developer-guide/
git commit -m "Add developer guide for partner integration

Includes:
- Getting started (auth, sandbox, first read tutorial)
- API reference (reading, writing, ACLs, provenance)
- SelfActual vocabulary reference + OWL ontology (sa.ttl)
- Working Node.js code examples (read + write)
- curl examples for protocol-level understanding
- Schema extension process (ADR-001)
- Sub pod integration surface rationale (ADR-002)
- Sandbox Turtle files for offline development"
```

5. Push to the remote.

### Task 2: Build the Sandbox Provisioning Script

Create a standalone Node.js script at `services/sandbox/` that provisions the sandbox environment for partner testing. This script will:

1. Create three sandbox user accounts on the CSS instance
2. Provision dual pods (master + sub) for each sandbox user using the existing provisioning API
3. Populate the sub pods with sample assessment data (Turtle files)
4. Create a sandbox org pod with a team roster
5. Optionally create a partner service account for testing

**Before building, examine the existing provisioning service:**

```bash
# Understand the existing provisioning API contract
cat services/provisioning/src/*.ts
cat services/provisioning/src/*.js
# Look at how it calls CSS Account API and creates pods
# Look at how it seeds the AST framework context
# Look at the .env file structure (don't print secrets, just variable names)
grep -E "^[A-Z_]+=" services/provisioning/.env.example 2>/dev/null || grep -E "^[A-Z_]+" services/provisioning/.env | sed 's/=.*/=<redacted>/'
```

**Build the sandbox provisioning script with this structure:**

```
services/sandbox/
├── package.json
├── .env.example
├── provision-sandbox.js       # Main script
├── data/                      # Sample Turtle data to seed into pods
│   ├── alice-starcard.ttl
│   ├── alice-flow-attributes.ttl
│   ├── alice-profile-summary.ttl
│   ├── bob-starcard.ttl
│   ├── bob-profile-summary.ttl
│   ├── cara-starcard.ttl
│   ├── cara-flow-attributes.ttl
│   ├── cara-profile-summary.ttl
│   ├── ast-framework.ttl
│   └── org-acme-team-engineering.ttl
└── README.md
```

**The script (`provision-sandbox.js`) must do the following:**

#### Step A: Authenticate as the existing service account

Use `@inrupt/solid-client-authn-node` to login with the service account credentials from `.env`. The service account already exists — you don't need to create it.

```javascript
import { Session } from "@inrupt/solid-client-authn-node";

const session = new Session();
await session.login({
  clientId: process.env.SERVICE_CLIENT_ID,
  clientSecret: process.env.SERVICE_CLIENT_SECRET,
  oidcIssuer: "https://vaults.selfactual.ai/",
});
```

#### Step B: Create sandbox CSS accounts

For each sandbox user (sandbox-alice, sandbox-bob, sandbox-cara), create a CSS account using the CSS Account API:

```
POST https://vaults.selfactual.ai/.account/
Content-Type: application/json
{"email": "sandbox-alice@selfactual.dev", "password": "<generated>"}
```

> **IMPORTANT:** Before creating accounts, check if the provisioning service has an API endpoint for this. The provisioning service at `https://vaults.selfactual.ai/api/` may already expose a `/api/provision` or similar endpoint that handles dual-pod creation. If so, use that endpoint instead of calling CSS directly. Examine the provisioning service code first.

#### Step C: Provision dual pods

For each sandbox user, create master + sub pods with the correct container structure:

**Master pod containers:**
```
/{username}/master/
├── assessments/
├── context/
│   └── ast-framework    (seed with data/ast-framework.ttl)
├── profile/
├── provenance/
└── reflections/
```

**Sub pod containers:**
```
/{username}/sub/
├── assessments/
└── context/
    └── ast-framework    (seed with data/ast-framework.ttl)
```

Again — check if the provisioning API already does this. If it has a provision endpoint, call that. If you need to do it directly against CSS, use the CSS Account API + authenticated HTTP PUTs.

#### Step D: Set up ACLs

Each sandbox user's pod needs ACLs matching the verified patterns:

**Master pod ACL** — owner (the sandbox user) gets full control, service account gets read+write.

**Sub pod ACL** — owner gets full control, service account gets read+write, first-party app origin (`https://app.selfactual.ai`) gets read.

> Again, the provisioning service likely already handles ACLs. Check its code.

#### Step E: Seed sample data into sub pods

Using the authenticated session, PUT the sample Turtle files into the correct sub pod locations:

| Source File | Target URL |
|---|---|
| `data/alice-starcard.ttl` | `https://vaults.selfactual.ai/sandbox-alice/sub/assessments/starcard` |
| `data/alice-flow-attributes.ttl` | `https://vaults.selfactual.ai/sandbox-alice/sub/assessments/flow-attributes` |
| `data/alice-profile-summary.ttl` | `https://vaults.selfactual.ai/sandbox-alice/sub/profile-summary` |
| `data/bob-starcard.ttl` | `https://vaults.selfactual.ai/sandbox-bob/sub/assessments/starcard` |
| `data/bob-profile-summary.ttl` | `https://vaults.selfactual.ai/sandbox-bob/sub/profile-summary` |
| `data/cara-starcard.ttl` | `https://vaults.selfactual.ai/sandbox-cara/sub/assessments/starcard` |
| `data/cara-flow-attributes.ttl` | `https://vaults.selfactual.ai/sandbox-cara/sub/assessments/flow-attributes` |
| `data/cara-profile-summary.ttl` | `https://vaults.selfactual.ai/sandbox-cara/sub/profile-summary` |

Use `session.fetch` with PUT and `Content-Type: text/turtle`:

```javascript
const turtleContent = fs.readFileSync("data/alice-starcard.ttl", "utf-8");
const response = await session.fetch(targetUrl, {
  method: "PUT",
  headers: { "Content-Type": "text/turtle" },
  body: turtleContent,
});
```

Also seed starcard data into master pods (same content plus the `sa:hasReflections` triple for the master copy).

#### Step F: Provision the sandbox org pod

Create an org pod at `https://vaults.selfactual.ai/org-sandbox-acme/` with:
- An org profile resource
- A team roster at `teams/engineering` linking to the three sandbox user sub pods
- AST framework context

This may need to be done by creating a CSS account for the org, then creating the pod, then writing resources. Check how the provisioning service handles this — it may not support org pods yet, in which case you'll need to use CSS Account API directly.

#### Step G: Create a partner service account (optional, flag-gated)

If the script is run with `--create-partner-account`, create an additional CSS account for a test partner app:

- Username: `partner-test-service`
- WebID: `https://vaults.selfactual.ai/partner-test-service/profile/card#me`
- Add this WebID to each sandbox user's sub pod ACL with `acl:Read` permission

Generate client credentials and print them to stdout so the partner can use them.

### Step H: Verification

After provisioning, the script should verify by reading back each seeded resource and confirming the data round-trips correctly. Print a summary:

```
Sandbox Provisioning Complete
=============================
✅ sandbox-alice: master + sub pods, starcard, flow-attributes, profile-summary
✅ sandbox-bob:   master + sub pods, starcard, profile-summary
✅ sandbox-cara:  master + sub pods, starcard, flow-attributes, profile-summary
✅ org-sandbox-acme: profile, teams/engineering
✅ Framework context seeded in all pods

Partner test account: [created / skipped]
```

**The sample Turtle data files:**

Use the `.ttl` files from `docs/developer-guide/sandbox/` as the source data — copy them into `services/sandbox/data/` and add two missing files:

`bob-profile-summary.ttl`:
```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix schema:  <http://schema.org/> .
@prefix foaf:    <http://xmlns.com/foaf/0.1/> .

<>
    a foaf:Person, sa:SharedProfile ;
    foaf:name           "Bob Nakamura" ;
    schema:jobTitle     "Engineering Lead" ;
    schema:worksFor     "Acme Corp" ;
    sa:hasAssessment    <https://vaults.selfactual.ai/sandbox-bob/sub/assessments/starcard> .
```

`cara-profile-summary.ttl`:
```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix schema:  <http://schema.org/> .
@prefix foaf:    <http://xmlns.com/foaf/0.1/> .

<>
    a foaf:Person, sa:SharedProfile ;
    foaf:name           "Cara Osei" ;
    schema:jobTitle     "Design Director" ;
    schema:worksFor     "Acme Corp" ;
    sa:hasAssessment    <https://vaults.selfactual.ai/sandbox-cara/sub/assessments/starcard> ;
    sa:hasAssessment    <https://vaults.selfactual.ai/sandbox-cara/sub/assessments/flow-attributes> .
```

`cara-flow-attributes.ttl`:
```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<>
    a sa:Assessment, sa:FlowProfile ;
    dcterms:created     "2026-02-22T09:30:00Z"^^xsd:dateTime ;
    sa:framework        <https://vocab.selfactual.ai/frameworks/ast> ;
    sa:sourceApp        "AllStarTeams" ;
    sa:sourceVersion    "2.1.7" ;
    sa:flowAttribute [
        sa:name         "Rapid Prototyping" ;
        sa:score        9 ;
        sa:category     "generative"
    ] ;
    sa:flowAttribute [
        sa:name         "Team Momentum" ;
        sa:score        8 ;
        sa:category     "social"
    ] ;
    sa:flowAttribute [
        sa:name         "Decisive Action" ;
        sa:score        9 ;
        sa:category     "cognitive"
    ] ;
    sa:relatedAssessment <https://vaults.selfactual.ai/sandbox-cara/sub/assessments/starcard> .
```

### Task 3: Publish `sa.ttl` via Nginx

Create a small nginx config change and deployment script so that `https://vocab.selfactual.ai/` resolves to the `sa.ttl` ontology file.

**Option A (simpler):** Serve the vocabulary from the same EC2 instance. This requires:

1. A DNS A record for `vocab.selfactual.ai` → `52.32.95.140` (I'll handle DNS — just note it in the README)
2. An nginx server block for `vocab.selfactual.ai` that:
   - Serves `sa.ttl` at the root path with `Content-Type: text/turtle`
   - Supports content negotiation: if `Accept: application/ld+json`, serve a JSON-LD version (future); default to Turtle
   - Auto-renewing TLS via certbot (same as vaults subdomain)
3. A deployment script to copy `docs/developer-guide/vocabulary/sa.ttl` to the EC2 instance

Create these files:

```
infra/nginx/vocab.conf          # Nginx server block for vocab.selfactual.ai
scripts/deploy-vocab.sh         # Script to copy sa.ttl + reload nginx
```

The nginx config should look something like:

```nginx
server {
    listen 443 ssl;
    server_name vocab.selfactual.ai;

    ssl_certificate /etc/letsencrypt/live/vocab.selfactual.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vocab.selfactual.ai/privkey.pem;

    root /var/www/vocab;

    location / {
        # Default: serve Turtle
        default_type text/turtle;
        try_files /sa.ttl =404;

        # Content negotiation
        if ($http_accept ~* "application/ld\+json") {
            rewrite ^ /sa.jsonld last;
        }

        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "public, max-age=3600";
    }
}

server {
    listen 80;
    server_name vocab.selfactual.ai;
    return 301 https://$host$request_uri;
}
```

The deploy script:

```bash
#!/bin/bash
# Deploy vocabulary to vocab.selfactual.ai
EC2_HOST="ubuntu@52.32.95.140"
KEY="~/.ssh/selfactual.pem"

scp -i $KEY docs/developer-guide/vocabulary/sa.ttl $EC2_HOST:/var/www/vocab/sa.ttl
scp -i $KEY infra/nginx/vocab.conf $EC2_HOST:/etc/nginx/sites-available/vocab.selfactual.ai
ssh -i $KEY $EC2_HOST "sudo ln -sf /etc/nginx/sites-available/vocab.selfactual.ai /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx"

echo "Deployed. Ensure DNS A record for vocab.selfactual.ai → 52.32.95.140"
echo "If first deploy, run: ssh -i $KEY $EC2_HOST 'sudo certbot --nginx -d vocab.selfactual.ai'"
```

## Final Commit Structure

After all three tasks, the new files in the repo should be:

```
docs/developer-guide/           # Task 1 — the full developer guide
services/sandbox/               # Task 2 — sandbox provisioning
  ├── package.json
  ├── .env.example
  ├── provision-sandbox.js
  ├── data/*.ttl
  └── README.md
infra/nginx/vocab.conf          # Task 3 — vocabulary hosting
scripts/deploy-vocab.sh         # Task 3 — vocabulary deployment
```

Commit these in separate commits:
1. "Add developer guide for partner integration"
2. "Add sandbox provisioning script for partner testing"
3. "Add vocabulary hosting config and deploy script"

## Critical Reminders

- **Examine the existing provisioning service code first** before building the sandbox script. Reuse its patterns and, if possible, call its API rather than reimplementing CSS Account API interactions.
- **Don't hardcode credentials.** All secrets go in `.env` files that are gitignored.
- **The sandbox script must be idempotent.** Running it twice should not fail or create duplicates. Check if accounts/pods exist before creating them.
- **Use TypeScript ESM modules** if the existing provisioning service uses them. Match the codebase conventions.
- **Test the sandbox script** by running it and verifying the seeded data can be read back.
- All Turtle files should be valid RDF. If unsure, validate with a Turtle parser before writing to pods.
