#!/usr/bin/env bash
set -euo pipefail

APPWRITE_DIR="${APPWRITE_DIR:-/opt/g58-backend/appwrite}"
ENV_FILE="${APPWRITE_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Appwrite environment file was not found at ${ENV_FILE}." >&2
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this command with sudo." >&2
  exit 1
fi

if [[ "${1:-}" == "--gmail" ]]; then
  smtp_host="smtp.gmail.com"
  smtp_port="587"
  smtp_secure="tls"
  smtp_username="rajeshqvd@gmail.com"
  sender_name="Gravity58"
  sender_email="${smtp_username}"
else
  read -r -p "SMTP host [smtp.gmail.com]: " smtp_host
  smtp_host="${smtp_host:-smtp.gmail.com}"
  read -r -p "SMTP port [587]: " smtp_port
  smtp_port="${smtp_port:-587}"
  read -r -p "SMTP security [tls]: " smtp_secure
  smtp_secure="${smtp_secure:-tls}"
  read -r -p "SMTP username/email [rajeshqvd@gmail.com]: " smtp_username
  smtp_username="${smtp_username:-rajeshqvd@gmail.com}"
  read -r -p "Sender name [Gravity58]: " sender_name
  sender_name="${sender_name:-Gravity58}"
  read -r -p "Sender email [${smtp_username}]: " sender_email
  sender_email="${sender_email:-${smtp_username}}"
fi
read -r -s -p "SMTP password (use a Google App Password, not your normal password): " smtp_password
echo

if [[ -z "${smtp_password}" ]]; then
  echo "SMTP password cannot be empty." >&2
  exit 1
fi
if [[ ! "${smtp_port}" =~ ^[0-9]+$ ]]; then
  echo "SMTP port must be a number." >&2
  exit 1
fi
if [[ "${smtp_secure}" != "tls" && "${smtp_secure}" != "ssl" && -n "${smtp_secure}" ]]; then
  echo "SMTP security must be tls, ssl, or blank." >&2
  exit 1
fi
if [[ "${smtp_host}" == "smtp.gmail.com" ]]; then
  smtp_password="${smtp_password// /}"
fi

umask 077
backup="${ENV_FILE}.smtp-$(date +%Y%m%d-%H%M%S).bak"
cp -p "${ENV_FILE}" "${backup}"

set_env() {
  local key="$1" value="$2" line found=0 tmp
  tmp="$(mktemp)"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    if [[ "${line}" == "${key}="* ]]; then
      printf '%s=%s\n' "${key}" "${value}" >> "${tmp}"
      found=1
    else
      printf '%s\n' "${line}" >> "${tmp}"
    fi
  done < "${ENV_FILE}"
  if [[ "${found}" -eq 0 ]]; then
    printf '%s=%s\n' "${key}" "${value}" >> "${tmp}"
  fi
  cat "${tmp}" > "${ENV_FILE}"
  rm -f "${tmp}"
}

set_env "_APP_SMTP_HOST" "${smtp_host}"
set_env "_APP_SMTP_PORT" "${smtp_port}"
set_env "_APP_SMTP_SECURE" "${smtp_secure}"
set_env "_APP_SMTP_USERNAME" "${smtp_username}"
set_env "_APP_SMTP_PASSWORD" "${smtp_password}"
set_env "_APP_SYSTEM_EMAIL_NAME" "${sender_name}"
set_env "_APP_SYSTEM_EMAIL_ADDRESS" "${sender_email}"

unset smtp_password
cd "${APPWRITE_DIR}"
docker compose up -d --force-recreate appwrite appwrite-worker-mails

echo "Waiting for Appwrite to become healthy..."
for _ in $(seq 1 30); do
  if docker inspect --format '{{.State.Health.Status}}' appwrite 2>/dev/null | grep -qx healthy; then
    echo "SMTP configuration applied. Password-reset mail is ready for testing."
    echo "Backup saved at ${backup}."
    exit 0
  fi
  sleep 2
done

echo "SMTP settings were saved, but Appwrite did not report healthy in time." >&2
echo "Check: cd ${APPWRITE_DIR} && docker compose logs appwrite appwrite-worker-mails" >&2
exit 1
