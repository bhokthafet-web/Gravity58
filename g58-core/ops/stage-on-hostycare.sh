#!/usr/bin/env bash
set -euo pipefail

install_dir="/opt/g58-core-staging"
appwrite_env="/opt/g58-backend/appwrite/.env"
cd "$install_dir"
umask 077

read_legacy_env() {
  local key="$1"
  if [[ ! -r "$appwrite_env" ]]; then return 0; fi
  sudo awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$appwrite_env"
}

if [[ ! -f .env ]]; then
  postgres_password="$(openssl rand -hex 32)"
  admin_password="$(openssl rand -base64 30 | tr -d '\n' | tr '/+' '_-')"
  smtp_host="$(read_legacy_env _APP_SMTP_HOST)"
  smtp_port="$(read_legacy_env _APP_SMTP_PORT)"
  smtp_user="$(read_legacy_env _APP_SMTP_USERNAME)"
  smtp_pass="$(read_legacy_env _APP_SMTP_PASSWORD)"
  smtp_address="$(read_legacy_env _APP_SYSTEM_EMAIL_ADDRESS)"
  smtp_name="$(read_legacy_env _APP_SYSTEM_EMAIL_NAME)"

  {
    printf '%s\n' "NODE_ENV=production"
    printf '%s\n' "PORT=8088"
    printf '%s\n' "POSTGRES_PASSWORD=$postgres_password"
    printf '%s\n' "SESSION_COOKIE=g58_session"
    printf '%s\n' "SESSION_DOMAIN=.g58.in"
    printf '%s\n' "SESSION_DAYS=30"
    printf '%s\n' "PUBLIC_API_URL=https://api.g58.in"
    printf '%s\n' "PUBLIC_SITE_URL=https://g58.in"
    printf '%s\n' "ALLOWED_ORIGINS=https://g58.in,https://www.g58.in,capacitor://localhost,http://localhost"
    printf '%s\n' "MEDIA_ROOT=/data/media"
    printf '%s\n' "MAX_MEDIA_BYTES=15728640"
    printf '%s\n' "MAX_MENU_IMAGE_BYTES=102400"
    printf '%s\n' "SMTP_HOST=${smtp_host:-smtp-relay.brevo.com}"
    printf '%s\n' "SMTP_PORT=${smtp_port:-587}"
    printf '%s\n' "SMTP_SECURE=false"
    printf '%s\n' "SMTP_USER=$smtp_user"
    printf '%s\n' "SMTP_PASS=$smtp_pass"
    printf '%s\n' "SMTP_FROM=${smtp_name:-Gravity58} <${smtp_address:-no-reply@g58.in}>"
    printf '%s\n' "BOOTSTRAP_ADMIN_EMAIL=rajeshqvd@gmail.com"
    printf '%s\n' "BOOTSTRAP_ADMIN_PASSWORD=$admin_password"
  } > .env

  sudo install -m 600 /dev/null /root/g58-core-bootstrap-credentials
  {
    printf '%s\n' "G58 Core staging console"
    printf '%s\n' "Email: rajeshqvd@gmail.com"
    printf '%s\n' "Password: $admin_password"
  } | sudo tee /root/g58-core-bootstrap-credentials >/dev/null
fi

sudo docker compose up -d --build
sleep 3
curl --fail --silent http://127.0.0.1:8088/api/v1/health
printf '\nG58 Core staging is healthy on 127.0.0.1:8088\n'
