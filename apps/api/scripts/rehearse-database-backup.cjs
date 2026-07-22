const { createHash } = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const container = process.env.POSTGRES_CONTAINER || 'raho-postgres';
const user = process.env.POSTGRES_USER || 'raho_user';
const sourceDatabase = process.env.SOURCE_DATABASE || 'raho-db';
const restoreDatabase = process.env.RESTORE_DATABASE || 'raho_restore_rehearsal';
const outputDirectory = path.resolve(process.argv[2] || path.join(process.cwd(), 'backups', 'database-rehearsal'));
const safeIdentifier = /^[A-Za-z][A-Za-z0-9_-]{0,62}$/;
const criticalTables = [
  '_prisma_migrations',
  'accounts',
  'inventory_items',
  'inventory_balances',
  'inventory_cost_layers',
  'inventory_postings',
  'journal_entries',
  'shipments',
  'treatment_sessions',
];

function assertSafeConfiguration() {
  for (const [name, value] of Object.entries({ container, user, sourceDatabase, restoreDatabase })) {
    if (!safeIdentifier.test(value)) throw new Error(`${name} tidak valid: ${value}`);
  }
  if (sourceDatabase === restoreDatabase) throw new Error('Database sumber dan restore wajib berbeda.');
  if (!/(restore|rehearsal|test)/i.test(restoreDatabase)) {
    throw new Error('Nama RESTORE_DATABASE wajib mengandung restore, rehearsal, atau test.');
  }
  const workspace = path.resolve(process.cwd());
  if (outputDirectory === workspace || outputDirectory === path.parse(outputDirectory).root) {
    throw new Error('Direktori output backup terlalu luas.');
  }
}

function run(command, args, options = {}) {
  const output = execFileSync(command, args, { encoding: 'utf8', stdio: options.capture ? 'pipe' : 'inherit' });
  return typeof output === 'string' ? output.trim() : '';
}

function docker(args, options) {
  return run('docker', args, options);
}

function tableCounts(database) {
  const sql = criticalTables
    .map((table) => `SELECT '${table}', COUNT(*)::text FROM "${table}"`)
    .join(' UNION ALL ');
  const output = docker(['exec', container, 'psql', '-U', user, '-d', database, '-At', '-F', '|', '-c', sql], { capture: true });
  return Object.fromEntries(output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [table, count] = line.split('|');
    return [table, Number(count)];
  }));
}

function assertCountsMatch(source, restored) {
  const mismatches = criticalTables.flatMap((table) => source[table] === restored[table]
    ? []
    : [{ table, source: source[table], restored: restored[table] }]);
  if (mismatches.length) throw new Error(`Restore row-count mismatch: ${JSON.stringify(mismatches)}`);
}

function main() {
  assertSafeConfiguration();
  fs.mkdirSync(outputDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const dumpName = `raho-${sourceDatabase}-${timestamp}.dump`;
  const localDump = path.join(outputDirectory, dumpName);
  const evidenceFile = `${localDump}.restore-evidence.json`;
  const containerDump = `/tmp/${dumpName}`;
  const restoreDump = `/tmp/restore-${dumpName}`;
  const startedAt = Date.now();

  try {
    const sourceCounts = tableCounts(sourceDatabase);
    docker(['exec', container, 'pg_dump', '-U', user, '-d', sourceDatabase, '--format=custom', '--compress=9', '--no-owner', '--no-acl', '--file', containerDump]);
    docker(['exec', container, 'pg_restore', '--list', containerDump], { capture: true });
    docker(['cp', `${container}:${containerDump}`, localDump]);

    const checksum = createHash('sha256').update(fs.readFileSync(localDump)).digest('hex');
    fs.writeFileSync(`${localDump}.sha256`, `${checksum}  ${dumpName}\n`, { mode: 0o600 });

    docker(['exec', container, 'dropdb', '-U', user, '--if-exists', '--force', restoreDatabase]);
    docker(['exec', container, 'createdb', '-U', user, restoreDatabase]);
    docker(['cp', localDump, `${container}:${restoreDump}`]);
    docker(['exec', container, 'pg_restore', '-U', user, '-d', restoreDatabase, '--no-owner', '--no-acl', '--exit-on-error', restoreDump]);

    const restoredCounts = tableCounts(restoreDatabase);
    assertCountsMatch(sourceCounts, restoredCounts);
    const unresolvedMigrations = Number(docker([
      'exec', container, 'psql', '-U', user, '-d', restoreDatabase, '-At', '-c',
      'SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL',
    ], { capture: true }));
    if (unresolvedMigrations !== 0) throw new Error(`${unresolvedMigrations} migration belum selesai pada hasil restore.`);

    const evidence = {
      status: 'PASS',
      generatedAt: new Date().toISOString(),
      sourceDatabase,
      restoreDatabase,
      dumpFile: localDump,
      dumpBytes: fs.statSync(localDump).size,
      sha256: checksum,
      durationMs: Date.now() - startedAt,
      unresolvedMigrations,
      sourceCounts,
      restoredCounts,
    };
    fs.writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } finally {
    try { docker(['exec', container, 'rm', '-f', containerDump, restoreDump], { capture: true }); } catch (_) { /* best-effort temporary-file cleanup */ }
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`Database backup/restore rehearsal gagal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
