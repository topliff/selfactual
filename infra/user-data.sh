#!/bin/bash
set -eux

# ---------- Config ----------
DOMAIN="${subdomain}"
CSS_IMAGE="solidproject/community-server:latest"
DATA_DIR="/srv/css-data"

# ---------- System updates ----------
apt-get update -y
apt-get upgrade -y

# ---------- Install Docker ----------
apt-get install -y \
  ca-certificates curl gnupg lsb-release nginx

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io

# Let ubuntu user run docker
usermod -aG docker ubuntu

# ---------- Persistent data directory ----------
mkdir -p "$DATA_DIR"
chown ubuntu:ubuntu "$DATA_DIR"

# ---------- Pull & run CSS ----------
docker pull "$CSS_IMAGE"

docker run -d \
  --name css \
  --restart=always \
  -p 3000:3000 \
  -v "$DATA_DIR:/data" \
  -e CSS_CONFIG=config/file.json \
  -e CSS_LOGGING_LEVEL=info \
  -e CSS_BASE_URL="https://$DOMAIN/" \
  "$CSS_IMAGE"

# ---------- Nginx reverse proxy (HTTP only — certbot adds SSL later) ----------
cat > /etc/nginx/sites-available/pods <<NGINX
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Forwarded-Host  \$host;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        \$connection_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/pods /etc/nginx/sites-enabled/pods
rm -f /etc/nginx/sites-enabled/default

systemctl enable nginx
systemctl restart nginx
