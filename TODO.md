# TODO

## AWS Console / Manual Steps
- [x] Verify or create an EC2 key pair in us-west-2
- [x] After deploy: add A record for `vaults.selfactual.ai` → Elastic IP at your DNS provider
- [x] Verify the Ubuntu 24.04 AMI ID is current in us-west-2 (check EC2 console)
- [x] After deploy: SSH in and run certbot for TLS cert
- [ ] Set up billing alerts / budget in AWS console

## Infrastructure
- [x] Fill in `infra/terraform.tfvars` with actual domain, IP, key pair name
- [x] Run `terraform init && terraform apply`
- [ ] Pin CSS Docker image to a specific version tag before demo

## Pod Architecture
On user connect, each user gets two pods:
- **Master Pod** — stores all user data (full profile, preferences, activity, etc.)
- **Sub Pod** — curated subset of data the user explicitly shares with 3rd-party apps

- [x] Design master pod schema (what resources/containers live there) → `docs/pod-resources-sketch.md`
- [x] Design sub pod schema (what subset is exposed, how user controls what's shared) → `docs/pod-resources-sketch.md`
- [ ] Define the provisioning flow: user signs up → both pods auto-created
- [x] Determine access control: master pod locked to user only, sub pod grants read to authorized apps → ACL sketch in `docs/pod-resources-sketch.md`
- [x] Decide how data syncs from master → sub → Push at write time; AST writes to both pods, stripping private data (reflection links) from sub copy
- [ ] Build or script automated dual-pod provisioning (CSS API or custom registration flow)

## Pod Validation (COMPLETED 2026-02-27)
- [x] Create test account on CSS instance (`test_pod`)
- [x] Register Solid-OIDC client credentials for programmatic access
- [x] Create dual-pod container structure (master/ + sub/ with all sub-containers)
- [x] Write Star Card assessment to master pod (with reflection link)
- [x] Write Star Card assessment to sub pod (without reflection link)
- [x] Write test reflection to master pod only
- [x] Read back all resources and verify data round-trips correctly
- [x] Verify master/sub distinction holds (reflection link present in master, absent in sub)
- [x] Verify unauthenticated access is denied (HTTP 401 on both pods)

## Access Control (Next)
- [ ] Set WAC ACL on master pod (owner-only: read, write, control)
- [ ] Set WAC ACL on sub pod (owner: full control; authorized app: read-only)
- [ ] Create a second CSS account to simulate a third-party app
- [ ] Verify second account can read sub pod but NOT master pod
- [ ] Document ACL setup in ops.md

## AST Integration
- [x] Analyze AST database schema (Drizzle ORM in `shared/schema.ts`)
- [x] Map AST tables to pod resources: starCards, flowAttributes, reflectionResponses, finalReflections
- [x] Identify implicit assessment↔reflection relationships in schema
- [x] Design RDF serialization that adds explicit context links
- [ ] Build pod write service module in AST codebase
- [ ] Test pod write service against live CSS instance
- [ ] Wire pod writes into AST workshop completion flow

## App Ecosystem
- [x] Document app ecosystem → `docs/app-ecosystem.md`
- [x] Define data producer/consumer roles for each app
- [x] Decision: Atlas is pod-native (no separate database)
- [x] Decision: Shared Auth0 tenant across all apps
- [x] Decision: Coaching Mentor app (not just Growth Plan) with "Working With Me" document
- [ ] Rework Atlas ticket backlog for pod-native architecture
- [ ] Scope Coaching Mentor app (data model, AI integration)
- [ ] Build Vault Viewer POC app

## Product / Features
- [ ] Build or choose a Solid client app to demo against the pods → Vault Viewer (planned)
- [x] Decide on authentication flow → Shared Auth0 tenant for apps + CSS built-in Solid-OIDC for pod access; unification deferred to post-POC
- [ ] Demo scenario: show a 3rd-party app reading from the sub pod while master stays private

## Trust Architecture
- [x] Document data fiduciary model → `docs/trust-architecture.md`
- [ ] Build pod export tool (one-click ZIP download of full pod)
- [ ] Add access logging to pods (which apps read what, when)
- [ ] Draft ToS with fiduciary language
- [ ] Implement application-level encryption for sensitive resources (Phase 2)
- [ ] Publish self-hosting documentation

## Future / Post-Demo
- [ ] Add automated backups for `/srv/css-data`
- [ ] Move to a larger instance or ECS if usage grows
- [ ] Set up monitoring / alerting (CloudWatch or similar)
- [ ] Automate TLS renewal verification
- [ ] Consider multi-pod-server architecture if needed
- [ ] Publish SelfActual vocabulary (`sa:` prefix) as proper ontology
- [ ] Unify Auth0 and CSS Solid-OIDC identity systems
