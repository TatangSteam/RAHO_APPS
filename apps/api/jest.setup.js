// Jest setup file for global test configuration

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '24h';
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-32-chars-long-minimum';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-32-chars-long-minimum';
process.env.JWT_ACCESS_EXPIRES = '15m';
process.env.JWT_REFRESH_EXPIRES = '7d';

// Database integration suites are destructive by design. Never allow their
// opt-in flags to target the application database, even when Jest is invoked
// manually instead of through the guarded npm scripts.
const databaseTestsEnabled = (
  process.env.RUN_FINANCE_DB_TESTS === 'true'
  || process.env.RUN_INVENTORY_DB_TESTS === 'true'
  || process.env.RUN_ZOHO_DB_TESTS === 'true'
);

if (databaseTestsEnabled) {
  const { assertSafeTestDatabase } = require('./database-test-safety.cjs');
  assertSafeTestDatabase(process.env.DATABASE_URL);
} else {
  // Unit/contract tests may import modules that construct Prisma at module
  // load time even though their database suites are skipped. Use an
  // intentionally unreachable test URL; no connection is made unless a test
  // incorrectly performs database I/O.
  process.env.DATABASE_URL ||= 'postgresql://jest:jest@127.0.0.1:1/raho_jest_no_database';
}

// Satisfy configuration validation without using deployment secrets or an
// external object-storage service during unit tests.
process.env.MINIO_ACCESS_KEY ||= 'jest-minio-access-key';
process.env.MINIO_SECRET_KEY ||= 'jest-minio-secret-key';
process.env.MINIO_PUBLIC_URL ||= 'http://127.0.0.1:9000';

// Mock console methods to reduce noise in tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
