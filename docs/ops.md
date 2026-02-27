# Operations Reference

## SSH into the instance

```bash
ssh -i ~/.ssh/your-key.pem ubuntu@<PUBLIC_IP>
```

## First boot: issue TLS cert

Nginx won't serve HTTPS until certs exist. After DNS propagates:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d vaults.selfactual.ai --non-interactive --agree-tos -m you@example.com
```

Certbot auto-renews via a systemd timer. Verify: `sudo certbot renew --dry-run`

## CSS container logs

```bash
docker logs -f css          # follow live
docker logs --tail 100 css  # last 100 lines
```

## Restart CSS

```bash
docker restart css
```

## Stop & re-create with different settings

```bash
docker stop css && docker rm css

docker run -d \
  --name css \
  --restart=always \
  -p 3000:3000 \
  -v /srv/css-data:/data \
  -e CSS_CONFIG=config/file.json \
  -e CSS_LOGGING_LEVEL=info \
  -e CSS_BASE_URL="https://vaults.selfactual.ai/" \
  solidproject/community-server:latest
```

## Pin a specific CSS version

Replace `latest` with a version tag:

```bash
docker pull solidproject/community-server:7.1.3
# then re-create the container as above, using :7.1.3 instead of :latest
```

## Confirm the configured base URL

```bash
docker inspect css --format '{{range .Config.Env}}{{println .}}{{end}}' | grep CSS_BASE_URL
```

## Check cloud-init logs (first boot debugging)

```bash
sudo cat /var/log/cloud-init-output.log
```

## Pod data location

All pod data lives in `/srv/css-data` on the host, mounted as `/data` inside the container.
Back this up before any destructive operations.

## Nginx

```bash
sudo nginx -t                 # test config
sudo systemctl reload nginx   # reload after config changes
sudo tail -f /var/log/nginx/error.log
```
