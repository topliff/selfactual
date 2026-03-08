# SelfActual — Project Context

This document describes the current state of the SelfActual system as of February 2026. It is intended as a reference for ongoing design conversations and onboarding new contributors.

**Last updated:** 2026-02-27

## What SelfActual Is

SelfActual is a personal data infrastructure product built on the Solid protocol. The core idea: users own their data in Solid Pods (personal data stores), and selectively share subsets of that data with third-party applications — rather than handing all their data to each app individually.

This is a pre-seed prototype being built toward a product demo.

## What Solid Pods Are

Solid (Social Linked Data) is a W3C-backed specification originally created by Tim Berners-Lee. Key concepts:

- A **Pod** is a personal web server that stores a user's data as Linked Data (RDF resources, organized in containers/directories).
- Pods support **authentication** via Solid-OIDC (OpenID Connect) — users have a WebID (a URI that identifies them) and authenticate against an identity provider.
- Pods support **authorization** via WAC (Web Access Control) or ACP (Access Control Policies) — users grant fine-grained read/write/append permissions to specific agents (people, apps) on specific resources or containers.
- Third-party apps interact with pods over standard HTTP using Solid protocol conventions (LDP, content negotiation, etc.). Apps never store user data themselves — they read/write it from the user's pod with the user's permission.
- Data in pods is typically represented as RDF (Turtle, JSON-LD, etc.) and can use standard vocabularies (FOAF for profiles, vCard, Schema.org, Activity Streams, etc.).

## Current System Status

### What's Live and Working

| Component | Status | Details |
|-----------|--------|---------|
| CSS pod server | ✅ Running | `https://vaults.selfactual.ai/` — Community Solid Server over HTTPS |
| Pod creation | ✅ Working | Users can create accounts and pods via the CSS web UI |
| Solid-OIDC auth | ✅ Working | Client credentials flow validated for programmatic pod access |
| Dual-pod structure | ✅ Validated | master/ and sub/ containers created and tested with real RDF data |
| RDF read/write | ✅ Validated | Star Card assessments, reflections, and metadata round-trip correctly |
| Master/sub separation | ✅ Validated | Reflection links present in master, absent in sub — trust boundary holds |
| Access control (default) | ✅ Working | Unauthenticated access returns HTTP 401 |
| Infrastructure as Code | ✅ Complete | Terraform-managed EC2, security groups, Elastic IP |
| TLS | ✅ Auto-renewing | Let's Encrypt via certbot |

### What's Designed but Not Yet Built

| Component | Status | Reference |
|-----------|--------|-----------|
| WAC ACLs (explicit) | 📋 Designed | ACL sketch in `pod-resources-sketch.md` — needs implementation and cross-account testing |
| AST pod write service | 📋 Designed | Data flow and RDF serialization designed, needs code |
| Atlas (pod-native) | 📋 Planned | Architecture decided, backlog needs rework for pod-native approach |
| Coaching Mentor app | 💡 Concept | App role and data model defined, not scoped for implementation |
| Vault Viewer (POC demo) | 📋 Planned | Scope defined, not yet built |
| Dual-pod auto-provisioning | 📋 Planned | Manual creation works; automated flow on signup not built |
| Auth0 ↔ Solid-OIDC unification | 📋 Deferred | Using separate auth for apps (Auth0) and pods (CSS built-in) for now |

### Test Pod (Live Data)

A test pod exists with real RDF data written during validation:

```
https://vaults.selfactual.ai/test_pod/
├── profile/card                                    # CSS-generated profile (WebID)
├── master/
│   ├── assessments/
│   │   └── starcard                                # Star Card: T78 A65 F82 P71, Connector
│   ├── reflections/
│   │   └── strength-reflections/
│   │       └── thinking                            # Reflection linked to starcard, score 78
│   ├── context/                                    # (empty, ready for framework doc)
│   └── provenance/                                 # (empty, ready for write log)
└── sub/
    ├── assessments/
    │   └── starcard                                # Same scores, NO reflection link
    └── context/                                    # (empty, ready for framework doc)
```

**WebID:** `https://vaults.selfactual.ai/test_pod/profile/card#me`

## Infrastructure Architecture

```
Internet
   │
   │  HTTPS (443)
   ▼
┌──────────────────────────────────────────┐
│  EC2 t3.small  ·  Ubuntu 24.04          │
│  us-west-2  ·  Elastic IP 52.32.95.140  │
│                                          │
│  ┌──────────────┐     ┌───────────────┐  │
│  │    Nginx     │────▶│  CSS (Docker) │  │
│  │  :80 / :443  │     │    :3000      │  │
│  │  TLS termn.  │     │               │  │
│  └──────────────┘     └───────┬───────┘  │
│                               │          │
│                        /srv/css-data     │
│                     (persistent storage) │
└──────────────────────────────────────────┘
```

### Component Details

**EC2 Instance**
- Type: `t3.small` (2 vCPU, 2 GB RAM) — adequate for prototype
- OS: Ubuntu 24.04 LTS
- Region: `us-west-2` (Oregon)
- 20 GB gp3 root volume
- Elastic IP for stable DNS binding
- Security group: SSH (port 22) from developer IP only, HTTP/HTTPS (80/443) from anywhere

**Community Solid Server (CSS)**
- Docker image: `solidproject/community-server:latest`
- Configuration: `config/file.json` — file-based persistent storage, includes setup UI on first visit
- Base URL: `https://vaults.selfactual.ai/` (set via `CSS_BASE_URL` environment variable — critical for CSS to generate correct URLs behind the reverse proxy)
- Data directory: `/srv/css-data` on the host, mounted as `/data` in the container
- Restart policy: `always` (survives reboots)
- CSS exposes the Solid protocol over HTTP on port 3000; it handles pod creation, authentication, authorization, and Linked Data resource management

**Nginx**
- Reverse proxy sitting in front of CSS
- TLS termination via Let's Encrypt (certbot, auto-renewing)
- Forwards `Host`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Forwarded-For` headers so CSS sees the real origin
- Conditional WebSocket upgrade support (needed for CSS live update notifications)
- HTTP requests redirect to HTTPS

**DNS**
- Domain `selfactual.ai` is hosted at an external DNS provider (not Route 53)
- A record: `vaults.selfactual.ai` → `52.32.95.140`

**AWS IAM**
- Dedicated IAM user: `SelfActualDeploy` with `AmazonEC2FullAccess` and `AmazonVPCFullAccess`
- AWS CLI profile: `selfactual`
- EC2 key pair: `selfactual` (private key at `~/.ssh/selfactual.pem`)

### Infrastructure as Code

All infrastructure is defined in Terraform and versioned in the repo:

| File | Purpose |
|---|---|
| `infra/main.tf` | EC2 instance, security group, Elastic IP, outputs |
| `infra/variables.tf` | Input variables (region, instance type, AMI, SSH IP, key pair name) |
| `infra/user-data.sh` | Cloud-init script: installs Docker + Nginx, pulls and runs CSS, configures Nginx vhost |
| `infra/nginx/pods.conf` | Reference copy of the production Nginx config |
| `infra/terraform.tfvars` | Local-only (gitignored) — actual values for my_ip and key_pair_name |

Terraform state is local (not in S3). The `.terraform/` directory, state files, and `terraform.tfvars` are all gitignored.

### Repository

- GitHub: `https://github.com/topliff/selfactual`
- Branch: `main`
- Local path: `~/Desktop/SelfActualSystem/`

## Dual-Pod Architecture

The core product concept requires each user to have **two pods**. This architecture has been validated against the live CSS instance.

### Master Pod
- Contains **all** of the user's data: full profile, preferences, activity history, reflections, coaching data, etc.
- Access: locked to the user only (private by default)
- This is the user's complete personal data store

### Sub Pod (Sharing Pod)
- Contains a **curated subset** of the user's data that they explicitly choose to make available to third-party apps
- Access: the user grants read permissions to specific authorized applications
- Acts as a controlled sharing layer — apps never touch the master pod

### Key Design Decisions (Resolved)

| Decision | Resolution |
|----------|------------|
| **Pod schemas** | Designed — container layouts, RDF resources, and Turtle examples in `pod-resources-sketch.md` |
| **Data sync: master → sub** | Push at write time. Data producers write to both pods in a single operation, stripping private data (reflection links) from the sub copy |
| **What goes where** | Assessments + framework context → both pods. Reflections, coaching data, personal insights → master only. "Working With Me" doc → sub pod (after user review) |
| **Authentication for apps** | Shared Auth0 tenant — one tenant, multiple apps, single user identity |
| **Authentication for pods** | CSS built-in Solid-OIDC with client credentials. Auth0 ↔ Solid-OIDC unification deferred to post-POC |
| **Atlas architecture** | Pod-native — no separate database, reads/writes directly to pods |
| **AST architecture** | Middle-path — keeps existing Postgres, adds pod write service to sync data to pods |
| **Custom vocabulary** | `sa:` prefix at `https://vocab.selfactual.ai/`. Static file for POC, proper ontology for production |

### Remaining Design Questions

1. **Dual-pod provisioning flow**: When a user signs up, how do we automatically create both pods? CSS API, custom registration wrapper, or manual for POC?
2. **User identity mapping**: How does the pod WebID relate to AST's user ID and Auth0 sub? Need a mapping strategy.
3. **Flow attributes structure**: The Postgres `flowAttributes.attributes` column is JSONB with unknown internal structure. Need to inspect actual data.
4. **Workshop step data**: `workshopStepData` stores arbitrary JSONB per step. Decide what (if any) goes into pods.

## What CSS Gives Us Out of the Box

Community Solid Server provides:
- **Pod provisioning**: Users can create pods via the web UI or API
- **Solid-OIDC authentication**: Built-in identity provider with WebID, client credentials for programmatic access
- **Web Access Control (WAC)**: Fine-grained ACLs on resources and containers
- **LDP (Linked Data Platform)**: Standard REST API for reading/writing RDF resources
- **Content negotiation**: Serve data as Turtle, JSON-LD, etc.
- **Notifications**: WebSocket-based live updates when resources change

What we need to build on top:
- Automated dual-pod provisioning on signup
- AST pod write service (Postgres → RDF → pod)
- Atlas pod-native frontend
- Vault Viewer demo app
- WAC ACL configuration for the sub pod sharing model
- Coaching Mentor app (future)

## App Ecosystem

See `app-ecosystem.md` for the full ecosystem doc. Summary:

**Data Producers:**
1. **AllStarTeams (AST)** — Live microcourse. Primary POC producer. DB + pod sync.
2. **Atlas** — Assessment aggregator. Pod-native (no separate DB). Second POC producer.
3. **Imaginal Agility (IA)** — Future microcourse. Same integration pattern as AST.

**Data Consumers:**
4. **Coaching Mentor** — AI coaching companion with "Working With Me" document. Concept stage.
5. **Vault Viewer** — POC demo app. Reads both pods to demonstrate access control.
6. **Future third-party integrations** — Team dynamics, HR tools, coaching platforms.

## Cost

- EC2 t3.small: ~$15/month
- Elastic IP (while attached): free
- Data transfer: negligible at prototype scale
- Domain: existing

## Key Technical Decisions

1. **Community Solid Server** over Node Solid Server (NSS) — CSS is actively maintained, modular, and better documented
2. **Single EC2 instance** — simplicity over HA; fine for pre-seed demo
3. **Docker** — reproducible, easy to version-pin, restart-on-reboot
4. **Nginx on host** (not containerized) — simpler certbot integration
5. **Let's Encrypt** — free, auto-renewing TLS
6. **File-based storage** (`config/file.json`) — pod data stored as files on disk; simple, inspectable, easy to back up
7. **Terraform** — infrastructure is reproducible and versioned, even for a single instance
8. **External DNS** — domain is managed outside AWS, only an A record needed
9. **Shared Auth0 tenant** — single identity across all apps in the ecosystem
10. **Atlas is pod-native** — no separate backend database; reads/writes directly to pods
11. **@inrupt/solid-client** — official Solid client library for Node.js, used for pod operations
12. **Client credentials auth** — CSS account API → client credentials → Solid-OIDC DPoP tokens for programmatic access

## Documentation Map

| Document | Purpose |
|----------|---------|
| `docs/project-context.md` | This file — system overview, architecture, current status |
| `docs/trust-architecture.md` | Data fiduciary model — custody, portability, encryption roadmap, business model alignment |
| `docs/app-ecosystem.md` | App roles, data flows, Auth0 decision, POC scope |
| `docs/pod-resources-sketch.md` | RDF resource design — container layouts, Turtle examples, ACL sketch |
| `docs/ops.md` | Operations reference — SSH, Docker, Nginx, CSS commands |
| `docs/progress-log.md` | Chronological log of what was built and validated |
| `TODO.md` | Task tracking with completion status |
| `scripts/` | Validation scripts and tooling (see `scripts/README.md`) |
