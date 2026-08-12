const dotenv = require('dotenv');
const path = require('path');

const SAFE_DATABASE_NAME = /(?:^|[_-])(test|testing|rehearsal|restore)(?:$|[_-])/i;

function databaseName(databaseUrl) {
  try {
    return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  } catch {
    throw new Error('DATABASE_URL integration test tidak valid.');
  }
}

function assertSafeTestDatabase(databaseUrl) {
  if (!databaseUrl) throw new Error('TEST_DATABASE_URL wajib diisi untuk integration test database.');
  const name = databaseName(databaseUrl);
  if (!SAFE_DATABASE_NAME.test(name)) {
    throw new Error(`Integration test ditolak: database "${name}" bukan database test/restore/rehearsal.`);
  }
  return name;
}

function configureTestDatabase() {
  dotenv.config({ path: path.resolve(__dirname, '.env') });
  const applicationUrl = process.env.DATABASE_URL;
  const testUrl = process.env.TEST_DATABASE_URL;
  assertSafeTestDatabase(testUrl);
  if (testUrl === applicationUrl) {
    throw new Error('TEST_DATABASE_URL tidak boleh sama dengan DATABASE_URL aplikasi.');
  }
  process.env.DATABASE_URL = testUrl;
  return databaseName(testUrl);
}

module.exports = { assertSafeTestDatabase, configureTestDatabase, databaseName };
