# Claude Code Prompt: EC2 Setup — pm2, Service Account, Nginx

Three tasks on the EC2 instance at `52.32.95.140`. All done via SSH.

SSH access: `ssh -i ~/.ssh/selfactual.pem ubuntu@52.32.95.140`

The provisioning service is running at `~/provisioning/` on EC2 (this is a deployed copy of `~/Desktop/SelfActualSystem/services/provisioning/`). CSS (Community Solid Server) runs on port 3000 behind Nginx with TLS at `vaults.selfactual.ai`.

Do these in order. Report results after each task.

---

## Task 1: pm2 for Service Persistence

The provisioning service currently dies when the SSH session closes. Make it persistent.

```bash
ssh -i ~/.ssh/selfactual.pem ubuntu@52.32.95.140
sudo npm install -g pm2
cd ~/provisioning
pm2 start src/index.mjs --name provisioning
pm2 save
pm2 startup
```

`pm2 startup` will print a command — copy and run it (it starts with `sudo env PATH=...`).

Verify:
```bash
pm2 list                              # should show "provisioning" as "online"
pm2 restart provisioning              # test restart
curl http://localhost:3001/health      # should return OK
```

---

## Task 2: Bootstrap Service Account on CSS

Run the bootstrap script locally (NOT on EC2). It creates a service account on the live CSS instance.

```bash
cd ~/Desktop/SelfActualSystem/scripts
node bootstrap-service-account.mjs
```

This script (already in the repo at `~/Desktop/SelfActualSystem/scripts/bootstrap-service-account.mjs`):
1. Creates a new CSS account
2. Registers a password login for `service@vaults.selfactual.ai`
3. Creates a pod named "service" (resulting in path `/service/`)
4. Registers client credentials tied to WebID `https://vaults.selfactual.ai/service/profile/card#me`
5. Prints `SERVICE_CLIENT_ID` and `SERVICE_CLIENT_SECRET`

After the script outputs the credentials, SSH into EC2 and update the provisioning .env:

```bash
ssh -i ~/.ssh/selfactual.pem ubuntu@52.32.95.140
nano ~/provisioning/.env
```

Set the two empty values:
```
SERVICE_CLIENT_ID=<value from script output>
SERVICE_CLIENT_SECRET=<value from script output>
```

Then restart and verify:
```bash
pm2 restart provisioning
# Re-run smoke test with credentials to verify pod verification (step 5) passes:
cd ~/provisioning
SERVICE_CLIENT_ID=<value> SERVICE_CLIENT_SECRET=<value> PROVISIONING_TOKEN=65837193e86f8994d3ac188292a8628ff582e513d9331e04ce390fa9064ce3b7 node tests/test-provisioning.mjs
```

Step 5 (pod verification) should now pass instead of being skipped.

---

## Task 3: Nginx Proxy for Provisioning API

AST runs on Lightsail and needs to reach the provisioning service on this EC2 instance. Rather than opening port 3001 to the internet, route provisioning API traffic through the existing Nginx + TLS setup.

The current Nginx config is at `/etc/nginx/sites-available/pods.conf` (or similar — check with `ls /etc/nginx/sites-available/` and `ls /etc/nginx/sites-enabled/`).

It currently looks like this:
```nginx
server {
    server_name vaults.selfactual.ai;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        # ... proxy headers ...
    }

    listen 443 ssl;
    # ... SSL config ...
}
```

Add a NEW location block for `/api/` BEFORE the `location /` block:

```nginx
    # Provisioning API — proxied to standalone service on port 3001
    location /api/ {
        proxy_pass         http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-Host  $host;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }
```

**Important:** The `proxy_pass` has a trailing slash (`http://127.0.0.1:3001/`). This strips the `/api/` prefix — so `https://vaults.selfactual.ai/api/provision` becomes `http://localhost:3001/provision` on the backend. The provisioning service routes don't need to change.

SSH commands:
```bash
ssh -i ~/.ssh/selfactual.pem ubuntu@52.32.95.140

# Find the config file
ls /etc/nginx/sites-enabled/

# Edit it (it's likely pods.conf or default)
sudo nano /etc/nginx/sites-enabled/pods.conf

# Add the /api/ location block BEFORE the location / block

# Test config
sudo nginx -t

# Reload (not restart — keeps connections alive)
sudo nginx -s reload
```

Verify from your local machine:
```bash
curl https://vaults.selfactual.ai/api/health
```

Should return the health check response from the provisioning service.

Also verify CSS still works:
```bash
curl -I https://vaults.selfactual.ai/
```

Should still return the CSS welcome page headers.

---

## After All Three Tasks

Update the vault provisioning URL in AST's env files. The URL changes from `http://52.32.95.140:3001` to `https://vaults.selfactual.ai/api`.

On your local machine, update BOTH env files in the AST repo:

`~/Desktop/HI_Replit/.env` — change:
```
VAULT_PROVISIONING_URL=https://vaults.selfactual.ai/api
```

`~/Desktop/HI_Replit/server/.env` — change:
```
VAULT_PROVISIONING_URL=https://vaults.selfactual.ai/api
```

This gives you HTTPS, no exposed ports, and a clean URL.

Also update the local copy of the Nginx config in the SelfActual repo for reference:
Edit `~/Desktop/SelfActualSystem/infra/nginx/pods.conf` to match what's now on the server (with the `/api/` location block added).

Then commit the bootstrap script and updated Nginx config:
```bash
cd ~/Desktop/SelfActualSystem
git add scripts/bootstrap-service-account.mjs infra/nginx/pods.conf
git commit -m "ops: service account bootstrap script + nginx proxy for provisioning API"
git push origin main
```
