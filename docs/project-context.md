# SelfActual — Project Context

This document describes the current state of the SelfActual system as of February 2026. It is intended as a reference for ongoing design conversations.

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

## What We Built (Current Infrastructure)

### Live Environment

- **URL**: `https://vaults.selfactual.ai/`
- **Status**: Running, serving the Community Solid Server welcome page over HTTPS
- **Server**: Community Solid Server (CSS) — the most actively maintained open-source Solid server implementation, written in Node.js

### Architecture

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

## Dual-Pod Architecture (Designed, Not Yet Implemented)

The core product concept requires each user to have **two pods**:

### Master Pod
- Contains **all** of the user's data: full profile, preferences, activity history, personal records, etc.
- Access: locked to the user only (private by default)
- This is the user's complete personal data store

### Sub Pod (Sharing Pod)
- Contains a **curated subset** of the user's data that they explicitly choose to make available to third-party apps
- Access: the user grants read permissions to specific authorized applications
- Acts as a controlled sharing layer — apps never touch the master pod

### Open Design Questions

1. **Pod schemas**: What resources and containers live in each pod? What vocabularies/ontologies do we use?
2. **Provisioning flow**: When a user signs up, how do we automatically create both pods? (CSS API, custom registration flow, or a wrapper service?)
3. **Access control model**: How exactly does the user control what goes into the sub pod? Is it a UI toggle per data type? Per resource?
4. **Data sync mechanism**: How does data flow from master to sub? Options:
   - Push on change (master pod write triggers a copy to sub pod)
   - User-triggered (explicit "share this" action)
   - Linked resources (sub pod contains references/links to master pod resources, with appropriate ACLs)
   - Derived views (sub pod is a computed projection of master pod data)
5. **Authentication flow**: Use CSS's built-in Solid-OIDC identity provider, or integrate an external OIDC provider?
6. **Demo scenario**: What does the demo look like? A 3rd-party app reading from the sub pod while master stays private.

## What CSS Gives Us Out of the Box

Community Solid Server provides:
- **Pod provisioning**: Users can create pods via the web UI or API
- **Solid-OIDC authentication**: Built-in identity provider with WebID
- **Web Access Control (WAC)**: Fine-grained ACLs on resources and containers
- **LDP (Linked Data Platform)**: Standard REST API for reading/writing RDF resources
- **Content negotiation**: Serve data as Turtle, JSON-LD, etc.
- **Notifications**: WebSocket-based live updates when resources change

What we will likely need to build on top:
- Automated dual-pod provisioning on signup
- A sharing/consent UI for the user to manage what goes into the sub pod
- A demo client app that reads from the sub pod
- Possibly a middleware service that handles the master-to-sub data flow

## Cost

- EC2 t3.small: ~$15/month
- Elastic IP (while attached): free
- Data transfer: negligible at prototype scale
- Domain: existing

## Key Technical Decisions Made

1. **Community Solid Server** over Node Solid Server (NSS) — CSS is actively maintained, modular, and better documented
2. **Single EC2 instance** — simplicity over HA; fine for pre-seed demo
3. **Docker** — reproducible, easy to version-pin, restart-on-reboot
4. **Nginx on host** (not containerized) — simpler certbot integration
5. **Let's Encrypt** — free, auto-renewing TLS
6. **File-based storage** (`config/file.json`) — pod data stored as files on disk; simple, inspectable, easy to back up
7. **Terraform** — infrastructure is reproducible and versioned, even for a single instance
8. **External DNS** — domain is managed outside AWS, only an A record needed
