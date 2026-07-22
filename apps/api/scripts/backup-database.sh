#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL wajib diisi}"

backup_dir="${1:-./backups}"
case "$backup_dir" in
  /|.|..) echo "Target backup terlalu luas: $backup_dir" >&2; exit 1 ;;
esac

command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump tidak tersedia" >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "pg_restore tidak tersedia" >&2; exit 1; }

mkdir -p "$backup_dir"
umask 077
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/raho-$timestamp.dump"

pg_dump --format=custom --compress=9 --no-owner --no-acl --file="$backup_file" "$DATABASE_URL"
pg_restore --list "$backup_file" >/dev/null

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$backup_file" > "$backup_file.sha256"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$backup_file" > "$backup_file.sha256"
else
  echo "Checksum tool tidak tersedia" >&2
  exit 1
fi

echo "Backup tervalidasi: $backup_file"
echo "Checksum: $backup_file.sha256"
