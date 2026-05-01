#!/bin/sh
set -e

# Load secrets from /run/secrets into environment variables (if present)
if [ -d "/run/secrets" ]; then
  for f in /run/secrets/*; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    value=$(cat "$f")
    export "$name"="$value"
  done
fi

exec "$@"
