# SelfActual Sandbox Provisioning

Provisions a sandbox environment on the CSS instance for partner integration testing.

## What It Creates

- **3 sandbox users** (sandbox-alice, sandbox-bob, sandbox-cara) each with dual pods (master + sub)
- **1 org pod** (org-sandbox-acme) with a team roster linking the three users
- **Sample assessment data** (StarCards, Flow Attributes, Profile Summaries) seeded into sub pods
- **AST Framework context** seeded into all pods
- **ACLs** matching the production pattern (owner full, service R+W, first-party app read on sub)

## Setup

```bash
cd services/sandbox
npm install
cp .env.example .env
# Fill in SERVICE_CLIENT_ID and SERVICE_CLIENT_SECRET from the bootstrap process
```

## Usage

```bash
# Provision sandbox users and org pod
npm run provision

# Also create a partner test service account with read access to sub pods
npm run provision:with-partner
```

## Idempotency

The script is safe to run multiple times:
- Existing pods are detected via HEAD request and account creation is skipped
- Container creation tolerates 409 (already exists)
- All document writes use PUT (naturally idempotent)
- On re-runs, the service account is used for scaffolding/seeding

## Data Files

The `data/` directory contains Turtle (.ttl) files seeded into sandbox pods:

| File | Pod Location |
|------|-------------|
| alice-starcard.ttl | sandbox-alice/sub/assessments/starcard |
| alice-flow-attributes.ttl | sandbox-alice/sub/assessments/flow-attributes |
| alice-profile-summary.ttl | sandbox-alice/sub/profile-summary |
| bob-starcard.ttl | sandbox-bob/sub/assessments/starcard |
| bob-profile-summary.ttl | sandbox-bob/sub/profile-summary |
| cara-starcard.ttl | sandbox-cara/sub/assessments/starcard |
| cara-flow-attributes.ttl | sandbox-cara/sub/assessments/flow-attributes |
| cara-profile-summary.ttl | sandbox-cara/sub/profile-summary |
| ast-framework.ttl | All pods: master/context/ast-framework + sub/context/ast-framework |
| org-acme-team-engineering.ttl | org-sandbox-acme/teams/engineering |
