const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { recoverFailedMigrations, findFailedMigrations } = require('./recover-failed-migrations.cjs');

function runDeploy() {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    stdio: 'inherit', env: process.env,
  });
  if (result.error) throw result.error;
  return result.status === 0;
}

async function deployWithRecovery(prisma, options = {}) {
  const recover = options.recover || recoverFailedMigrations;
  const findFailed = options.findFailed || findFailedMigrations;
  const deploy = options.deploy || runDeploy;
  await recover(prisma);
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    if (await deploy()) return;
    if (attempt === 3) throw new Error('Migration recovery retry limit exceeded; refusing further retries.');
    if ((await findFailed(prisma)).length === 0) {
      throw new Error('Migration deploy failed without a recoverable failed migration; check the Prisma error above.');
    }
    console.warn(`Checking recognized migration recovery (attempt ${attempt + 1}/3).`);
    await recover(prisma);
  }
}

async function main() {
  const root = resolve(__dirname, '..');
  require('dotenv').config({ path: resolve(root, '.env') });
  process.chdir(root);
  const prisma = new (require('@prisma/client').PrismaClient)();
  try { await deployWithRecovery(prisma); }
  finally { await prisma.$disconnect(); }
}

module.exports = { deployWithRecovery };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
