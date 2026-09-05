#!/usr/bin/env bash
set -euo pipefail

core_dir="/opt/g58-core-staging"

cd "$core_dir"
curl --fail --silent http://127.0.0.1:8088/api/v1/health >/dev/null
sudo docker compose pull edge
sudo docker compose --profile edge up -d edge

for attempt in $(seq 1 40); do
  if curl --fail --silent --max-time 5 https://server.g58.in/api/v1/health >/dev/null; then
    printf '%s\n' "G58 Core now owns HTTPS for server.g58.in."
    exit 0
  fi
  sleep 3
done

cd "$core_dir"
sudo docker compose --profile edge stop edge
printf '%s\n' "HTTPS verification failed; the G58 edge service was stopped." >&2
exit 1
