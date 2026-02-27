# selfactual

Personal data infrastructure built on [Solid Pods](https://solidproject.org/).

## Architecture

```
┌─────────────┐      HTTPS (443)      ┌──────────────────────────────┐
│   Browser   │ ───────────────────▶   │  EC2  t3.small  (Ubuntu)    │
└─────────────┘                        │                              │
                                       │  ┌────────┐    ┌──────────┐ │
                                       │  │ Nginx  │───▶│ CSS :3000│ │
                                       │  │ :80/443│    │ (Docker) │ │
                                       │  └────────┘    └──────────┘ │
                                       │                  │          │
                                       │           /srv/css-data     │
                                       └──────────────────────────────┘
```

- **EC2**: `t3.small`, Ubuntu 24.04, `us-west-2`
- **CSS**: `solidproject/community-server` Docker image, `config/file-no-setup.json`, data persisted to `/srv/css-data`
- **Nginx**: reverse proxy with TLS termination (Let's Encrypt)
- **DNS**: A record `vaults.selfactual.ai` → Elastic IP (managed at external DNS provider)

## Quickstart

### Prerequisites

- AWS CLI configured (`aws sts get-caller-identity` works)
- Terraform >= 1.5
- An EC2 key pair in `us-west-2`
- Access to DNS for `selfactual.ai` to create an A record

### Deploy

```bash
cd infra

# Create a terraform.tfvars (not committed):
cat > terraform.tfvars <<'EOF'
my_ip         = "YOUR_PUBLIC_IP/32"
key_pair_name = "your-keypair"
EOF

terraform init
terraform plan
terraform apply
```

After apply, note the `public_ip` output and create a DNS A record:
- **Name:** `vaults`
- **Type:** A
- **Value:** `<public_ip from terraform output>`

### After first boot

1. Wait ~3 min for cloud-init to finish (Docker install + CSS pull).
2. SSH in: `ssh -i ~/.ssh/your-key.pem ubuntu@<PUBLIC_IP>`
3. Verify CSS is running: `docker ps`
4. Issue TLS cert:
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d vaults.selfactual.ai
   ```
5. Visit `https://vaults.selfactual.ai/` — you should see the CSS interface.

## Repo layout

```
infra/
  main.tf          # EC2, SG, EIP
  variables.tf     # Input variables
  user-data.sh     # Cloud-init bootstrap (Docker + CSS + Nginx)
  nginx/
    pods.conf      # Reference Nginx vhost config
docs/
  ops.md           # Operations cheat sheet
```
