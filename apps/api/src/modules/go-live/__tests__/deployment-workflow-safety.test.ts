import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('production deployment workflow safety', () => {
  const repositoryRoot = resolve(__dirname, '../../../../../..');
  const workflow = readFileSync(resolve(repositoryRoot, '.github/workflows/deploy.yml'), 'utf8');
  const deployScript = readFileSync(resolve(repositoryRoot, '.github/scripts/deploy-production.sh'), 'utf8');
  const compose = readFileSync(resolve(repositoryRoot, 'docker-compose.prod.yml'), 'utf8');

  it('cannot push commits and never performs broad Docker pruning', () => {
    expect(workflow).toMatch(/permissions:\s*\n\s+contents: read/);
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toMatch(/git\s+push/);
    expect(workflow).toContain('RAHO_SECRETS_DIR=$secrets_dir');
    expect(workflow).not.toContain('cp -a');
    expect(deployScript).not.toMatch(/docker\s+system\s+prune/);
    expect(deployScript).not.toMatch(/docker\s+(container|volume|network)\s+prune/);
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
