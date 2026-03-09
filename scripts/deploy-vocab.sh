#!/usr/bin/env bash
# Deploy the SelfActual vocabulary ontology to vocab.selfactual.ai
# Prerequisite: DNS A record for vocab.selfactual.ai → 52.32.95.140
set -euo pipefail

EC2_HOST="52.32.95.140"
SSH_KEY="${SSH_KEY:-~/.ssh/selfactual.pem}"
SSH_USER="ubuntu"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Deploying vocabulary to vocab.selfactual.ai..."

# Copy vocabulary file
scp -i "$SSH_KEY" "$REPO_ROOT/docs/developer-guide/vocabulary/sa.ttl" \
  "$SSH_USER@$EC2_HOST:/tmp/sa.ttl"

# Copy nginx config
scp -i "$SSH_KEY" "$REPO_ROOT/infra/nginx/vocab.conf" \
  "$SSH_USER@$EC2_HOST:/tmp/vocab.conf"

# Install files and reload nginx
ssh -i "$SSH_KEY" "$SSH_USER@$EC2_HOST" << 'REMOTE'
  sudo mkdir -p /var/www/vocab
  sudo cp /tmp/sa.ttl /var/www/vocab/sa.ttl
  sudo cp /tmp/vocab.conf /etc/nginx/sites-available/vocab.conf
  sudo ln -sf /etc/nginx/sites-available/vocab.conf /etc/nginx/sites-enabled/vocab.conf

  # Obtain SSL cert if not yet provisioned
  if [ ! -f /etc/letsencrypt/live/vocab.selfactual.ai/fullchain.pem ]; then
    echo "SSL cert not found — run certbot manually:"
    echo "  sudo certbot --nginx -d vocab.selfactual.ai"
    exit 0
  fi

  sudo nginx -t && sudo systemctl reload nginx
  echo "vocab.selfactual.ai deployed and nginx reloaded."
REMOTE

echo "Done. Ensure DNS A record: vocab.selfactual.ai → $EC2_HOST"
