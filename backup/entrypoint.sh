#!/bin/sh
set -eu

RCLONE_DIR="/root/.config/rclone"
RCLONE_CONF_PATH="${RCLONE_DIR}/rclone.conf"
mkdir -p "$RCLONE_DIR"

if [ -n "${RCLONE_CONF_B64:-}" ]; then
  echo "$RCLONE_CONF_B64" | base64 -d > "$RCLONE_CONF_PATH"
elif [ -n "${RCLONE_CONF_CONTENT:-}" ]; then
  printf "%s" "$RCLONE_CONF_CONTENT" > "$RCLONE_CONF_PATH"
elif [ -f "/config/rclone.conf" ]; then
  cp /config/rclone.conf "$RCLONE_CONF_PATH"
else
  echo "Missing rclone configuration. Set RCLONE_CONF_B64, RCLONE_CONF_CONTENT or mount /config/rclone.conf." >&2
  exit 1
fi

chmod 600 "$RCLONE_CONF_PATH"

MODE="${BACKUP_MODE:-loop}"
RUN_ON_START="${BACKUP_RUN_ON_START:-true}"
INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"

if [ "$MODE" = "once" ]; then
  exec /scripts/backup.sh
fi

if [ "$RUN_ON_START" = "true" ]; then
  /scripts/backup.sh
fi

echo "[backup] Entering loop mode. Interval: ${INTERVAL_SECONDS}s"
while true; do
  sleep "$INTERVAL_SECONDS"
  /scripts/backup.sh || echo "[backup] Backup failed. Keeping container alive for next attempt." >&2
done
