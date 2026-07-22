#!/bin/sh
set -eu

node prisma/recover-failed-migrations.cjs

if npx prisma migrate deploy; then
  exit 0
fi

echo "Initial migrate deploy failed; checking for the one supported recovery case."
node prisma/recover-failed-migrations.cjs
npx prisma migrate deploy
