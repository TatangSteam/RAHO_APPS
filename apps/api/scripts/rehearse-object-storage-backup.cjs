const { createHash, randomUUID } = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const container = process.env.MINIO_CONTAINER || 'raho-minio';
const endpoint = process.env.MINIO_INTERNAL_ENDPOINT || 'http://localhost:9000';
const accessKey = process.env.MINIO_ACCESS_KEY || 'raho_minio_user';
const secretKey = process.env.MINIO_SECRET_KEY || 'raho_minio_secret';
const sourceBucket = process.env.MINIO_BUCKET || 'raho-uploads';
const restoreBucket = process.env.MINIO_RESTORE_BUCKET || 'raho-restore-rehearsal';
const outputDirectory = path.resolve(process.argv[2] || path.join(process.cwd(), 'backups', 'object-storage-rehearsal'));
const safeName = /^[A-Za-z0-9][A-Za-z0-9._-]{1,62}$/;
const alias = `sprint11-${randomUUID().slice(0, 8)}`;
const tempDirectory = `/tmp/${alias}`;
const restoredTempDirectory = `/tmp/${alias}-restored`;
const backupName = `${sourceBucket}-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`;
const localBackupDirectory = path.join(outputDirectory, backupName);
const localRestoreValidationDirectory = path.join(outputDirectory, `.${alias}-restored`);

function assertSafeConfiguration() {
  for (const [name, value] of Object.entries({ container, sourceBucket, restoreBucket })) {
    if (!safeName.test(value)) throw new Error(`${name} tidak valid: ${value}`);
  }
  if (sourceBucket === restoreBucket) throw new Error('Bucket sumber dan restore wajib berbeda.');
  if (!/(restore|rehearsal|test)/i.test(restoreBucket)) {
    throw new Error('Nama MINIO_RESTORE_BUCKET wajib mengandung restore, rehearsal, atau test.');
  }
}

function run(args, capture = false) {
  const output = execFileSync('docker', ['exec', container, ...args], {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  return typeof output === 'string' ? output.trim() : '';
}

function localManifest(directory) {
  const rows = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      if (entry.isFile()) {
        rows.push({
          path: path.relative(directory, absolute).split(path.sep).join('/'),
          size: fs.statSync(absolute).size,
          sha256: createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'),
        });
      }
    }
  };
  visit(directory);
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

function main() {
  assertSafeConfiguration();
  fs.mkdirSync(outputDirectory, { recursive: true });
  const startedAt = Date.now();
  try {
    run(['mc', 'alias', 'set', alias, endpoint, accessKey, secretKey, '--api', 'S3v4']);
    run(['mc', 'stat', `${alias}/${sourceBucket}`], true);
    run(['mkdir', '-p', tempDirectory]);
    run(['mc', 'mirror', '--preserve', `${alias}/${sourceBucket}`, tempDirectory], true);

    fs.rmSync(localBackupDirectory, { recursive: true, force: true });
    fs.mkdirSync(localBackupDirectory, { recursive: true });
    execFileSync('docker', ['cp', `${container}:${tempDirectory}/.`, localBackupDirectory], { stdio: 'inherit' });
    const copiedManifest = localManifest(localBackupDirectory);
    const backupManifest = copiedManifest.map(({ path: objectPath, size }) => ({ path: objectPath, size }));
    const checksum = createHash('sha256').update(JSON.stringify(copiedManifest)).digest('hex');
    const manifestFile = `${localBackupDirectory}.manifest.json`;
    fs.writeFileSync(manifestFile, `${JSON.stringify(copiedManifest, null, 2)}\n`, { mode: 0o600 });
    fs.writeFileSync(`${manifestFile}.sha256`, `${checksum}  ${path.basename(manifestFile)}\n`, { mode: 0o600 });

    try { run(['mc', 'rb', '--force', `${alias}/${restoreBucket}`], true); } catch (_) { /* bucket may not exist */ }
    run(['mc', 'mb', `${alias}/${restoreBucket}`]);
    run(['mc', 'mirror', '--overwrite', tempDirectory, `${alias}/${restoreBucket}`], true);
    run(['mkdir', '-p', restoredTempDirectory]);
    run(['mc', 'mirror', '--overwrite', `${alias}/${restoreBucket}`, restoredTempDirectory], true);
    fs.rmSync(localRestoreValidationDirectory, { recursive: true, force: true });
    fs.mkdirSync(localRestoreValidationDirectory, { recursive: true });
    execFileSync('docker', ['cp', `${container}:${restoredTempDirectory}/.`, localRestoreValidationDirectory], { stdio: 'inherit' });
    const restoredManifest = localManifest(localRestoreValidationDirectory);
    const manifestsMatch = copiedManifest.length === restoredManifest.length
      && copiedManifest.every((item, index) => (
        item.path === restoredManifest[index].path
        && item.size === restoredManifest[index].size
        && item.sha256 === restoredManifest[index].sha256
      ));
    if (!manifestsMatch) {
      const max = Math.max(copiedManifest.length, restoredManifest.length);
      let firstDifference = null;
      for (let index = 0; index < max; index += 1) {
        if (
          copiedManifest[index]?.path !== restoredManifest[index]?.path
          || copiedManifest[index]?.size !== restoredManifest[index]?.size
          || copiedManifest[index]?.sha256 !== restoredManifest[index]?.sha256
        ) {
          firstDifference = { index, backup: copiedManifest[index], restored: restoredManifest[index] };
          break;
        }
      }
      throw new Error(`Manifest object hasil restore tidak sama: ${JSON.stringify({ backupCount: copiedManifest.length, restoredCount: restoredManifest.length, firstDifference })}`);
    }

    const evidence = {
      status: 'PASS',
      generatedAt: new Date().toISOString(),
      sourceBucket,
      restoreBucket,
      backupDirectory: localBackupDirectory,
      manifestFile,
      manifestSha256: checksum,
      objectCount: backupManifest.length,
      objectBytes: backupManifest.reduce((sum, item) => sum + item.size, 0),
      durationMs: Date.now() - startedAt,
      manifest: backupManifest,
    };
    fs.writeFileSync(`${localBackupDirectory}.restore-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    const { manifest: _manifest, ...summary } = evidence;
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    try { run(['mc', 'alias', 'remove', alias], true); } catch (_) { /* best effort */ }
    try { run(['rm', '-rf', tempDirectory, restoredTempDirectory], true); } catch (_) { /* best effort */ }
    fs.rmSync(localRestoreValidationDirectory, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`Object-storage backup/restore rehearsal gagal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
