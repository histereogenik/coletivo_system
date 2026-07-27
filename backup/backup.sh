#!/bin/sh
set -eu

required_vars="POSTGRES_HOST POSTGRES_PORT POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD GDRIVE_PATH"
for var_name in $required_vars; do
  eval "var_value=\${$var_name:-}"
  if [ -z "$var_value" ]; then
    echo "Missing required environment variable: $var_name" >&2
    exit 1
  fi
done

TMP_DIR="${BACKUP_TMP_DIR:-/tmp/db-backups}"
FILE_PREFIX="${BACKUP_FILE_PREFIX:-coletivo}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATE_UTC="$(date -u +%Y-%m-%d_%H-%M-%S)"
FILE_NAME="${FILE_PREFIX}_${POSTGRES_DB}_${DATE_UTC}.sql.gz"
FILE_PATH="${TMP_DIR}/${FILE_NAME}"
SQL_FILE_PATH="${FILE_PATH%.gz}"

mkdir -p "$TMP_DIR"

cleanup() {
  rm -f "$SQL_FILE_PATH" "$FILE_PATH"
}
trap cleanup EXIT HUP INT TERM

echo "[backup] Starting pg_dump for database ${POSTGRES_DB}..."
export PGPASSWORD="${POSTGRES_PASSWORD}"
pg_dump \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --no-owner \
  --no-privileges \
  > "$SQL_FILE_PATH"

if [ ! -s "$SQL_FILE_PATH" ]; then
  echo "[backup] pg_dump produced an empty file." >&2
  exit 1
fi

echo "[backup] Compressing ${FILE_NAME%.gz}..."
gzip -c "$SQL_FILE_PATH" > "$FILE_PATH"

if [ ! -s "$FILE_PATH" ]; then
  echo "[backup] Compression produced an empty file." >&2
  exit 1
fi

echo "[backup] Uploading ${FILE_NAME} to ${GDRIVE_PATH}..."
rclone copy "$FILE_PATH" "$GDRIVE_PATH"

if [ "$RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
  echo "[backup] Deleting remote backups older than ${RETENTION_DAYS} days..."
  rclone delete --min-age "${RETENTION_DAYS}d" "$GDRIVE_PATH"
fi

echo "[backup] Backup finished successfully."
