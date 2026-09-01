#!/usr/bin/env bash
set -Eeuo pipefail

cd "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"

compose_file="docker-compose.prod.yml"
backup_root="${RAHO_BACKUP_ROOT:-$HOME/RAHO_APPS/backups/deployments}"
deploy_id="${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}-${GITHUB_SHA:-unknown}"
deploy_id="${deploy_id:0:80}"
backup_path="$backup_root/raho-db-$deploy_id.dump"
backup_tmp="$backup_path.tmp"
backup_checksum="$backup_path.sha256"
api_image="raho-erp-api:latest"
web_image="raho-erp-web:latest"
api_rollback_image="raho-erp-api:rollback"
web_rollback_image="raho-erp-web:rollback"
deployment_started=0
minimum_docker_free_kb="${RAHO_MIN_DOCKER_FREE_KB:-6291456}"

mkdir -p "$backup_root"
chmod 700 "$backup_root"
umask 077

exec 9>/tmp/raho-deploy.lock
flock -x 9

compose() {
  docker compose -f "$compose_file" "$@"
}

docker_root_dir() {
  docker info --format '{{.DockerRootDir}}'
}

docker_available_kb() {
  df -Pk "$(docker_root_dir)" | awk 'NR == 2 { print $4 }'
}

show_docker_disk_usage() {
  echo "Docker storage: $(docker_root_dir)"
  df -h "$(docker_root_dir)"
  docker system df || true
}

require_docker_build_space() {
  local available_kb
  available_kb="$(docker_available_kb)"
  if [[ ! "$available_kb" =~ ^[0-9]+$ ]]; then
    echo "Unable to determine free space for Docker storage." >&2
    return 1
  fi
  if (( available_kb < minimum_docker_free_kb )); then
    show_docker_disk_usage >&2
    echo "Deployment blocked: Docker has $((available_kb / 1024)) MiB free; at least $((minimum_docker_free_kb / 1024)) MiB is required." >&2
    return 1
  fi
  echo "Docker build preflight passed: $((available_kb / 1024)) MiB free."
}

prepare_docker_build_space() {
  # Keep BuildKit/npm cache while disk is healthy. Reclaiming it before every
  # deployment forces a complete registry download and makes a flaky network
  # much more likely to break npm ci.
  if require_docker_build_space; then
    return 0
  fi

  echo "Docker storage is low; reclaiming build cache older than seven days." >&2
  docker builder prune -af --filter 'until=168h'
  if require_docker_build_space; then
    return 0
  fi

  echo "Old cache cleanup was insufficient; reclaiming all unused BuildKit cache." >&2
  docker builder prune -af
  require_docker_build_space
}

container_running() {
  [[ "$(docker inspect --format '{{.State.Running}}' "$1" 2>/dev/null || true)" == "true" ]]
}

api_healthy() {
  docker exec raho-erp-api node -e \
    "fetch('http://127.0.0.1:4000/health').then(async response => { const body = await response.json(); if (!response.ok || body.status !== 'ok') process.exit(1); }).catch(() => process.exit(1));"
}

web_healthy() {
  docker exec raho-erp-web node -e \
    "fetch('http://127.0.0.1:3000/', { redirect: 'manual' }).then(response => { if (response.status < 200 || response.status >= 400) process.exit(1); }).catch(() => process.exit(1));"
}

stack_healthy() {
  container_running raho-postgres \
    && container_running raho-erp-api \
    && container_running raho-erp-web \
    && compose exec -T postgres pg_isready -U raho_user -d raho-db >/dev/null \
    && api_healthy \
    && web_healthy
}

wait_for_stack() {
  local attempt
  for attempt in $(seq 1 30); do
    if stack_healthy; then
      echo "Production health checks passed on attempt $attempt."
      return 0
    fi
    echo "Waiting for production health checks ($attempt/30)..."
    sleep 5
  done
  return 1
}

rollback_apps() {
  local original_status="$1"
  trap - ERR
  set +e

  echo "Deployment failed. Database backup: $backup_path" >&2
  if [[ "$deployment_started" == "1" ]]; then
    echo "Restoring the previously running API and web images..." >&2
    docker tag "$api_rollback_image" "$api_image"
    docker tag "$web_rollback_image" "$web_image"
    compose up -d --no-build --no-deps --force-recreate api web
    if wait_for_stack; then
      echo "Application rollback is healthy. Database was not auto-restored." >&2
    else
      echo "CRITICAL: application rollback health checks also failed." >&2
    fi
  else
    echo "Existing application containers were not replaced; no app rollback was needed." >&2
  fi
  exit "$original_status"
}

on_error() {
  local status="$?"
  rollback_apps "$status"
}
trap on_error ERR

command -v docker >/dev/null
command -v sha256sum >/dev/null
command -v flock >/dev/null
compose config --quiet

for container in raho-postgres raho-erp-api raho-erp-web; do
  if ! container_running "$container"; then
    echo "Required production container is not running: $container" >&2
    exit 1
  fi
done

if ! stack_healthy; then
  echo "Existing production stack is not healthy; deployment is blocked." >&2
  exit 1
fi

# Zoho must be paused during a production migration/deploy. This also prevents
# a restarted worker from consuming integration events before verification.
zoho_non_off_count="$(compose exec -T postgres psql -U raho_user -d raho-db -Atc \
  "SELECT COUNT(*) FROM \"zoho_go_live_controls\" WHERE \"mode\" <> 'OFF';")"
if [[ "$zoho_non_off_count" != "0" ]]; then
  echo "Zoho synchronization must be OFF before deployment." >&2
  exit 1
fi

# Reclaim only data Docker has marked unused. BuildKit cache is reproducible
# and is the main source of growth on this self-hosted runner. Never prune
# containers, networks, or volumes; production database/object data is kept.
docker image prune -f
prepare_docker_build_space

# Preserve the images actually used by the running containers. The :latest
# tags may point to a prior failed build and are not reliable rollback sources.
api_running_image_id="$(docker inspect --format '{{.Image}}' raho-erp-api)"
web_running_image_id="$(docker inspect --format '{{.Image}}' raho-erp-web)"
docker tag "$api_running_image_id" "$api_rollback_image"
docker tag "$web_running_image_id" "$web_rollback_image"

build_service() {
  local service="$1"
  prepare_docker_build_space
  echo "Building $service image..."
  if ! BUILDKIT_PROGRESS=plain compose build --pull "$service"; then
    echo "$service build failed. Preserving npm/BuildKit cache for one retry..." >&2
    show_docker_disk_usage >&2
    if command -v free >/dev/null; then
      free -h >&2 || true
    fi
    prepare_docker_build_space
    echo "Retrying $service with the packages already downloaded by the first attempt..." >&2
    BUILDKIT_PROGRESS=plain compose build --pull "$service"
  fi
}

# Build first: a compilation failure cannot affect the running application.
build_service api
build_service web

echo "Creating verified pre-migration database backup..."
compose exec -T postgres pg_dump \
  -U raho_user \
  -d raho-db \
  --format=custom \
  --no-owner \
  --no-privileges > "$backup_tmp"
test -s "$backup_tmp"
compose exec -T postgres pg_restore --list < "$backup_tmp" >/dev/null
mv "$backup_tmp" "$backup_path"
sha256sum "$backup_path" > "$backup_checksum"
echo "Verified backup written to $backup_path"

echo "Applying database migrations..."
compose run --rm --no-deps migrate

deployment_started=1
echo "Starting new API and web containers..."
compose up -d --no-deps --force-recreate api web
wait_for_stack

echo "Verifying migration status from the deployed API image..."
compose run --rm --no-deps migrate npx prisma migrate status

# Only dangling, untagged images are cleaned after the new stack is healthy.
# The stable rollback tags remain available for manual recovery.
deployment_started=0
trap - ERR
docker image prune -f || echo "Warning: post-deploy dangling image cleanup failed." >&2
docker builder prune -af --filter 'until=168h' || echo "Warning: post-deploy BuildKit cleanup failed." >&2
echo "Deployment completed successfully. Backup: $backup_path"
