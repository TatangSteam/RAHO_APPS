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
if (process.env.RUN_FINANCE_DB_TESTS === 'true' || process.env.RUN_INVENTORY_DB_TESTS === 'true') {
  const { assertSafeTestDatabase } = require('./database-test-safety.cjs');
  assertSafeTestDatabase(process.env.DATABASE_URL);
}

// Mock console methods to reduce noise in tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
