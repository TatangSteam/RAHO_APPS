const { readdirSync } = require('node:fs');
const { join, relative, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const apiRoot = resolve(__dirname, '..');
const sourceRoot = join(apiRoot, 'src');
const jestBin = require.resolve('jest/bin/jest');
const chunkSize = Number.parseInt(process.env.JEST_REGRESSION_CHUNK_SIZE || '8', 10);

if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 25) {
  throw new Error('JEST_REGRESSION_CHUNK_SIZE must be an integer between 1 and 25');
}

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return findTests(entryPath);
    return entry.name.endsWith('.test.ts') ? [entryPath] : [];
  });
}

const testFiles = findTests(sourceRoot)
  .map((file) => relative(apiRoot, file).replaceAll('\\', '/'))
  .sort();

if (testFiles.length === 0) {
  throw new Error('No API regression test files found');
}

const totalChunks = Math.ceil(testFiles.length / chunkSize);

for (let index = 0; index < testFiles.length; index += chunkSize) {
  const chunk = testFiles.slice(index, index + chunkSize);
  const chunkNumber = Math.floor(index / chunkSize) + 1;
  process.stdout.write(
    `\n[api-regression] chunk ${chunkNumber}/${totalChunks} (${chunk.length} files)\n`,
  );

  const result = spawnSync(
    process.execPath,
    [jestBin, '--runInBand', '--silent', ...chunk],
    { cwd: apiRoot, env: process.env, stdio: 'inherit' },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

process.stdout.write(
  `\n[api-regression] PASS: ${testFiles.length} files in ${totalChunks} isolated chunks\n`,
);
