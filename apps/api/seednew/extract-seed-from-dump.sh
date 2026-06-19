#!/usr/bin/env bash
set -euo pipefail

DUMP_FILE="${1:-postgres.dump}"
OUTPUT_FILE="${2:-prisma/seed.sql}"

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore tidak ditemukan. Install PostgreSQL client dulu." >&2
  echo "Windows: install PostgreSQL lalu tambahkan folder bin ke PATH." >&2
  echo "Ubuntu/Debian: sudo apt-get install postgresql-client" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"

# pg_restore tidak support --inserts, hanya bisa output COPY format
# Untuk INSERT statements, perlu restore ke database dulu lalu dump lagi
echo "Note: pg_restore akan generate COPY statements, bukan INSERT" >&2
echo "Untuk INSERT statements, gunakan convert-to-inserts.sh" >&2

pg_restore \
  --data-only \
  --no-owner \
  --no-privileges \
  --file "$OUTPUT_FILE" \
  "$DUMP_FILE"

echo "Generated $OUTPUT_FILE (with COPY statements)"
