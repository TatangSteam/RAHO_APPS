#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL sumber wajib diisi}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL database disposable wajib diisi}"
: "${BACKUP_FILE:?BACKUP_FILE wajib diisi}"

if [ "$DATABASE_URL" = "$RESTORE_DATABASE_URL" ]; then
  echo "Restore ditolak: database sumber dan target sama." >&2
  exit 1
fi
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup tidak ditemukan: $BACKUP_FILE" >&2
  exit 1
fi

case "$RESTORE_DATABASE_URL" in
  *prod*|*production*) echo "Restore ditolak: target tampak seperti production." >&2; exit 1 ;;
esac

command -v pg_restore >/dev/null 2>&1 || { echo "pg_restore tidak tersedia" >&2; exit 1; }
pg_restore --list "$BACKUP_FILE" >/dev/null

echo "PERINGATAN: seluruh object pada RESTORE_DATABASE_URL akan diganti dari backup."
if [ "${CONFIRM_DISPOSABLE_RESTORE:-}" != "YES" ]; then
  echo "Set CONFIRM_DISPOSABLE_RESTORE=YES setelah target diverifikasi disposable." >&2
  exit 1
fi

pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"
DATABASE_URL="$RESTORE_DATABASE_URL" npx prisma migrate deploy --schema prisma/schema.prisma
if [ -n "${CUTOVER_AT:-}" ]; then
  DATABASE_URL="$RESTORE_DATABASE_URL" npm run go-live:audit -- "--cutover=$CUTOVER_AT"
else
  DATABASE_URL="$RESTORE_DATABASE_URL" npm run go-live:audit
fi
echo "Restore dan go-live audit selesai. Simpan output ini sebagai evidence restore rehearsal."
