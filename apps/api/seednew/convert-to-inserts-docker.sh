#!/usr/bin/env bash
set -euo pipefail

DUMP_FILE="${1:-postgres.dump}"
OUTPUT_FILE="${2:-seed.sql}"
DB_NAME="temp_seed_db"
CONTAINER_NAME="temp_postgres_seed"

echo "Converting PostgreSQL dump to INSERT statements using Docker..."
echo "Dump file: $DUMP_FILE"
echo "Output file: $OUTPUT_FILE"
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker not found. Install Docker Desktop for Windows." >&2
  exit 1
fi

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting temporary PostgreSQL container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=temp123 \
  -e POSTGRES_DB="$DB_NAME" \
  postgres:15 >/dev/null

echo "Waiting for PostgreSQL to be ready..."
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Copying dump file to container..."
docker cp "$DUMP_FILE" "$CONTAINER_NAME:/tmp/postgres.dump"

echo "Restoring dump to database..."
docker exec "$CONTAINER_NAME" pg_restore \
  -U postgres \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  /tmp/postgres.dump

echo "Exporting database with INSERT statements..."
docker exec "$CONTAINER_NAME" pg_dump \
  -U postgres \
  -d "$DB_NAME" \
  --data-only \
  --inserts \
  --column-inserts \
  --no-owner \
  --no-privileges \
  > "$OUTPUT_FILE"

echo "Cleaning up..."
cleanup
trap - EXIT

echo ""
echo "Successfully converted to INSERT statements: $OUTPUT_FILE"
