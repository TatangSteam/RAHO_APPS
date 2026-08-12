import { createRequire } from 'module';

const requireFromHere = createRequire(__filename);
const safety = requireFromHere('../../../../database-test-safety.cjs') as {
  assertSafeTestDatabase(databaseUrl?: string): string;
  databaseName(databaseUrl: string): string;
};

describe('database integration test safety', () => {
  it.each([
    'postgresql://user:pass@localhost:5432/raho_integration_test',
    'postgresql://user:pass@localhost:5432/raho_restore_rehearsal',
    'postgresql://user:pass@localhost:5432/testing-raho',
  ])('accepts disposable database %s', (databaseUrl) => {
    expect(safety.assertSafeTestDatabase(databaseUrl)).toBe(safety.databaseName(databaseUrl));
  });

  it.each([
    'postgresql://user:pass@localhost:5432/raho-db',
    'postgresql://user:pass@localhost:5432/production',
    undefined,
  ])('rejects application database %s', (databaseUrl) => {
    expect(() => safety.assertSafeTestDatabase(databaseUrl)).toThrow();
  });
});
