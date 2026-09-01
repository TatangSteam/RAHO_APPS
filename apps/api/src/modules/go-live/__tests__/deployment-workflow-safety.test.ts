import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('production deployment workflow safety', () => {
  const repositoryRoot = resolve(__dirname, '../../../../../..');
  const workflow = readFileSync(resolve(repositoryRoot, '.github/workflows/deploy-main.yml'), 'utf8');
  const deployScript = readFileSync(resolve(repositoryRoot, '.github/scripts/deploy-production.sh'), 'utf8');
  const compose = readFileSync(resolve(repositoryRoot, 'docker-compose.prod.yml'), 'utf8');
  const apiDockerfile = readFileSync(resolve(repositoryRoot, 'apps/api/Dockerfile'), 'utf8');
  const webDockerfile = readFileSync(resolve(repositoryRoot, 'apps/web/Dockerfile'), 'utf8');

  it('cannot push commits and never performs broad Docker pruning', () => {
    expect(workflow).toMatch(/permissions:\s*\n\s+contents: read/);
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toMatch(/git\s+push/);
    expect(workflow).toContain('RAHO_SECRETS_DIR=$secrets_dir');
    expect(workflow).not.toContain('cp -a');
    expect(workflow).not.toMatch(/docker\s+system\s+prune/);
    expect(deployScript).not.toMatch(/docker\s+system\s+prune/);
    expect(deployScript).not.toMatch(/docker\s+(container|volume|network)\s+prune/);
    expect(deployScript).toContain("docker builder prune -af --filter 'until=168h'");
    expect(workflow).toContain("docker builder prune -af --filter 'until=168h'");
  });

  it('checks Docker space while preserving recent cache for build retries', () => {
    expect(deployScript).toContain('RAHO_MIN_DOCKER_FREE_KB:-6291456');
    expect(deployScript).toContain('prepare_docker_build_space');
    const prepareFunction = deployScript.slice(
      deployScript.indexOf('prepare_docker_build_space()'),
      deployScript.indexOf('container_running()'),
    );
    expect(prepareFunction).toContain('if require_docker_build_space; then');
    expect(prepareFunction).toContain('return 0');
    expect(prepareFunction).toContain("docker builder prune -af --filter 'until=168h'");

    const buildFunction = deployScript.slice(
      deployScript.indexOf('build_service()'),
      deployScript.indexOf('# Build first:'),
    );
    expect(buildFunction).toContain('prepare_docker_build_space');
    expect(buildFunction).toContain('BUILDKIT_PROGRESS=plain compose build --pull');
    expect(buildFunction).not.toContain('--no-cache');
    expect(buildFunction).not.toContain('docker builder prune -af');
  });

  it('uses persistent npm cache mounts and network retry settings in both images', () => {
    for (const dockerfile of [apiDockerfile, webDockerfile]) {
      // Use BuildKit's bundled Dockerfile frontend so a transient Docker Hub
      // failure cannot stop the build before the first FROM instruction.
      expect(dockerfile).not.toMatch(/^#\s*syntax=/m);
      expect(dockerfile).toContain('--mount=type=cache');
      expect(dockerfile).toContain('target=/root/.npm');
      expect(dockerfile).toContain('npm ci --prefer-offline');
      expect(dockerfile).toContain('npm ci --omit=dev --prefer-offline');
      expect(dockerfile).toContain('NPM_CONFIG_FETCH_RETRIES=5');
    }
  });

  it('backs up and verifies PostgreSQL before migration and replacement', () => {
    const backup = deployScript.indexOf('pg_dump');
    const verifyBackup = deployScript.indexOf('pg_restore --list');
    const migrate = deployScript.indexOf('compose run --rm --no-deps migrate');
    const replace = deployScript.lastIndexOf('compose up -d --no-deps --force-recreate api web');

    expect(backup).toBeGreaterThan(-1);
    expect(verifyBackup).toBeGreaterThan(backup);
    expect(migrate).toBeGreaterThan(verifyBackup);
    expect(replace).toBeGreaterThan(migrate);
    expect(deployScript).toContain('sha256sum "$backup_path"');
  });

  it('preserves running images and rolls the app back on failed health checks', () => {
    expect(deployScript).toContain("docker inspect --format '{{.Image}}' raho-erp-api");
    expect(deployScript).toContain("docker inspect --format '{{.Image}}' raho-erp-web");
    expect(deployScript).toContain('docker tag "$api_rollback_image" "$api_image"');
    expect(deployScript).toContain('docker tag "$web_rollback_image" "$web_image"');
    expect(deployScript).toContain('wait_for_stack');
    expect(deployScript).toContain('Zoho synchronization must be OFF before deployment.');
  });

  it('defines runtime health checks for API and web containers', () => {
    expect(compose).toContain("fetch('http://127.0.0.1:4000/health')");
    expect(compose).toContain("fetch('http://127.0.0.1:3000/'");
    expect(compose).toContain('${RAHO_SECRETS_DIR:-./secrets}/DATABASE_URL');
    expect(compose.match(/healthcheck:/g)).toHaveLength(4);
  });
});
