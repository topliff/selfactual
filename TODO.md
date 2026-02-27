# TODO

## AWS Console / Manual Steps
- [ ] Verify or create an EC2 key pair in us-west-2
- [ ] Confirm Route 53 hosted zone exists for your domain
- [ ] Verify the Ubuntu 24.04 AMI ID is current in us-west-2 (check EC2 console)
- [ ] After deploy: SSH in and run certbot for TLS cert
- [ ] Set up billing alerts / budget in AWS console

## Infrastructure
- [ ] Fill in `infra/terraform.tfvars` with actual domain, IP, key pair name
- [ ] Run `terraform init && terraform apply`
- [ ] Pin CSS Docker image to a specific version tag before demo

## Product / Features
- [ ] Define pod structure and data schemas for demo
- [ ] Build or choose a Solid client app to demo against the pods
- [ ] Decide on authentication flow (CSS built-in vs external OIDC provider)

## Future / Post-Demo
- [ ] Add automated backups for `/srv/css-data`
- [ ] Move to a larger instance or ECS if usage grows
- [ ] Set up monitoring / alerting (CloudWatch or similar)
- [ ] Automate TLS renewal verification
- [ ] Consider multi-pod-server architecture if needed
