#!/bin/sh
set -eu

: "${MINIO_ENDPOINT:?MINIO_ENDPOINT wajib diisi}"
: "${MINIO_ACCESS_KEY:?MINIO_ACCESS_KEY wajib diisi}"
: "${MINIO_SECRET_KEY:?MINIO_SECRET_KEY wajib diisi}"
: "${MINIO_BUCKET:?MINIO_BUCKET sumber wajib diisi}"
: "${MINIO_RESTORE_BUCKET:?MINIO_RESTORE_BUCKET disposable wajib diisi}"
: "${MINIO_BACKUP_DIR:?MINIO_BACKUP_DIR wajib diisi}"

[ "$MINIO_BUCKET" != "$MINIO_RESTORE_BUCKET" ] || { echo "Restore bucket harus berbeda dari bucket sumber." >&2; exit 1; }
[ "${CONFIRM_DISPOSABLE_RESTORE:-}" = "YES" ] || { echo "Set CONFIRM_DISPOSABLE_RESTORE=YES." >&2; exit 1; }
[ -d "$MINIO_BACKUP_DIR" ] || { echo "Direktori backup tidak ditemukan." >&2; exit 1; }
command -v mc >/dev/null 2>&1 || { echo "MinIO client (mc) tidak tersedia" >&2; exit 1; }

scheme="http"
[ "${MINIO_USE_SSL:-false}" = "true" ] && scheme="https"
endpoint="$scheme://$MINIO_ENDPOINT:${MINIO_PORT:-9000}"
alias_name="raho_restore_$$_alias"
mc alias set "$alias_name" "$endpoint" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 >/dev/null
trap 'mc alias remove "$alias_name" >/dev/null 2>&1 || true' EXIT
mc mb --ignore-existing "$alias_name/$MINIO_RESTORE_BUCKET"
mc mirror --overwrite "$MINIO_BACKUP_DIR" "$alias_name/$MINIO_RESTORE_BUCKET"
diff_output="$(mc diff "$MINIO_BACKUP_DIR" "$alias_name/$MINIO_RESTORE_BUCKET")"
if [ -n "$diff_output" ]; then
  echo "$diff_output" >&2
  echo "Object-storage restore memiliki perbedaan." >&2
  exit 2
fi
echo "Object-storage restore verification selesai pada bucket disposable $MINIO_RESTORE_BUCKET."
