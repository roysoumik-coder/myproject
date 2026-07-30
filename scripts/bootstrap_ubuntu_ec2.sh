#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-student-management-system}"
APP_DIR="${APP_DIR:-/opt/student-management-system}"
APP_PORT="${APP_PORT:-3000}"
APP_USER="${APP_USER:-ubuntu}"
SERVER_NAME="${SERVER_NAME:-_}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl gnupg nginx rsync ufw

if ! command -v node >/dev/null 2>&1; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi

if ! command -v ngrok >/dev/null 2>&1; then
  curl -fsSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
    | tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
  echo "deb https://ngrok-agent.s3.amazonaws.com bookworm main" \
    > /etc/apt/sources.list.d/ngrok.list
  apt-get update
  apt-get install -y ngrok
fi

mkdir -p "$APP_DIR" "$APP_DIR/data"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 750 "$APP_DIR"

ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

cat >/etc/systemd/system/${APP_NAME}.service <<SERVICE
[Unit]
Description=Student Management System
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
Environment=DATA_DIR=${APP_DIR}/data
ExecStart=/usr/bin/node ${APP_DIR}/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=${APP_DIR}/data

[Install]
WantedBy=multi-user.target
SERVICE

cat >/etc/nginx/sites-available/${APP_NAME} <<NGINX
server {
    listen 80;
    server_name ${SERVER_NAME};

    access_log /var/log/nginx/${APP_NAME}.access.log;
    error_log /var/log/nginx/${APP_NAME}.error.log;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sfn /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/${APP_NAME}
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

cat >/etc/systemd/system/ngrok-${APP_NAME}.service <<SERVICE
[Unit]
Description=ngrok tunnel for Student Management System
After=network-online.target nginx.service ${APP_NAME}.service
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
ExecStart=/usr/bin/ngrok http 80 --log=stdout
Restart=always
RestartSec=8

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable "${APP_NAME}.service"
systemctl enable "ngrok-${APP_NAME}.service"

echo "Bootstrap complete."
echo "Next: run 'ngrok config add-authtoken YOUR_TOKEN' as ${APP_USER}, then start ngrok-${APP_NAME}.service."
