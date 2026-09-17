#!/bin/sh
set -eu

node prisma/recover-failed-migrations.cjs

attempt=0
while ! npx prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -gt 3 ]; then
    echo "Migration recovery retry limit exceeded; refusing further retries." >&2
    exit 1
  fi
  echo "Migrate deploy failed; checking for a recognized recovery case (attempt $attempt/3)."
  node prisma/recover-failed-migrations.cjs
done
