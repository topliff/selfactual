# TODO

## AWS Console / Manual Steps
- [ ] Verify or create an EC2 key pair in us-west-2
- [ ] After deploy: add A record for `vaults.selfactual.ai` → Elastic IP at your DNS provider
- [ ] Verify the Ubuntu 24.04 AMI ID is current in us-west-2 (check EC2 console)
- [ ] After deploy: SSH in and run certbot for TLS cert
- [ ] Set up billing alerts / budget in AWS console

## Infrastructure
- [ ] Fill in `infra/terraform.tfvars` with actual domain, IP, key pair name
- [ ] Run `terraform init && terraform apply`
- [ ] Pin CSS Docker image to a specific version tag before demo

## Pod Architecture
On user connect, each user gets two pods:
- **Master Pod** — stores all user data (full profile, preferences, activity, etc.)
- **Sub Pod** — curated subset of data the user explicitly shares with 3rd-party apps

- [ ] Design master pod schema (what resources/containers live there)
- [ ] Design sub pod schema (what subset is exposed, how user controls what's shared)
- [ ] Define the provisioning flow: user signs up → both pods auto-created
- [ ] Determine access control: master pod locked to user only, sub pod grants read to authorized apps
- [ ] Decide how data syncs from master → sub (push on change? user-triggered? linked resources?)
- [ ] Build or script automated dual-pod provisioning (CSS API or custom registration flow)

## Product / Features
- [ ] Build or choose a Solid client app to demo against the pods
- [ ] Decide on authentication flow (CSS built-in vs external OIDC provider)
- [ ] Demo scenario: show a 3rd-party app reading from the sub pod while master stays private

## Future / Post-Demo
- [ ] Add automated backups for `/srv/css-data`
- [ ] Move to a larger instance or ECS if usage grows
- [ ] Set up monitoring / alerting (CloudWatch or similar)
- [ ] Automate TLS renewal verification
- [ ] Consider multi-pod-server architecture if needed
