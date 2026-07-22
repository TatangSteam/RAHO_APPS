#!/bin/sh
set -eu

: "${MINIO_ENDPOINT:?MINIO_ENDPOINT wajib diisi}"
: "${MINIO_ACCESS_KEY:?MINIO_ACCESS_KEY wajib diisi}"
: "${MINIO_SECRET_KEY:?MINIO_SECRET_KEY wajib diisi}"
: "${MINIO_BUCKET:?MINIO_BUCKET wajib diisi}"

backup_dir="${1:-./backups/minio}"
case "$backup_dir" in
  /|.|..) echo "Target backup terlalu luas: $backup_dir" >&2; exit 1 ;;
esac
command -v mc >/dev/null 2>&1 || { echo "MinIO client (mc) tidak tersedia" >&2; exit 1; }

mkdir -p "$backup_dir"
umask 077
scheme="http"
[ "${MINIO_USE_SSL:-false}" = "true" ] && scheme="https"
endpoint="$scheme://$MINIO_ENDPOINT:${MINIO_PORT:-9000}"
alias_name="raho_backup_$$_alias"

mc alias set "$alias_name" "$endpoint" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 >/dev/null
trap 'mc alias remove "$alias_name" >/dev/null 2>&1 || true' EXIT
mc mirror --preserve "$alias_name/$MINIO_BUCKET" "$backup_dir"
mc find "$alias_name/$MINIO_BUCKET" --print '{size} {path}' > "$backup_dir.manifest.txt"
echo "Object-storage backup selesai: $backup_dir"
echo "Manifest: $backup_dir.manifest.txt"
