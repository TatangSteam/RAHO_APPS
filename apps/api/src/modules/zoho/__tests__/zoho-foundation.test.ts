import fs from 'fs';
import path from 'path';
import { getMissingRequiredScopes, parseGrantedScopes, ZOHO_REQUIRED_SCOPES } from '../zoho.client';
import { ZohoApiError, normalizeZohoError } from '../zoho.error';
import { sanitizeForAudit, stablePayloadHash } from '../zoho.sanitizer';
import { calculateRetryAt } from '../zoho.worker';

describe('Zoho Sprint 1 foundation', () => {
  it('redacts secrets recursively without removing safe values', () => {
    expect(sanitizeForAudit({
      authorization: 'Zoho-oauthtoken secret',
      nested: { accessToken: 'secret', amount: 150_000 },
      items: [{ client_secret: 'secret', sku: 'BOOSTER' }],
    })).toEqual({
      authorization: '[REDACTED]',
      nested: { accessToken: '[REDACTED]', amount: 150_000 },
      items: [{ client_secret: '[REDACTED]', sku: 'BOOSTER' }],
    });
  });

  it('creates the same hash regardless of object key order', () => {
    expect(stablePayloadHash({ amount: 10, item: { sku: 'A', qty: 2 } }))
      .toBe(stablePayloadHash({ item: { qty: 2, sku: 'A' }, amount: 10 }));
  });

  it('normalizes an already normalized Zoho error', () => {
    const error = new ZohoApiError('Too many requests', '4290', 429, true, 5_000);
    expect(normalizeZohoError(error)).toBe(error);
    expect(error.retryable).toBe(true);
  });

  it('uses exponential retry delay and honors Retry-After', () => {
    const start = Date.now();
    expect(calculateRetryAt(1).getTime()).toBeGreaterThanOrEqual(start + 29_000);
    expect(calculateRetryAt(4, 7_000).getTime()).toBeLessThanOrEqual(Date.now() + 7_100);
  });

  it('migration contains locking, mapping, attempts, and discovery cache', () => {
    const migration = fs.readFileSync(
      path.resolve(__dirname, '../../../../prisma/migrations/20260728110000_add_zoho_sync_foundation/migration.sql'),
      'utf8',
    );
    expect(migration).toContain('"leaseUntil"');
    expect(migration).toContain('"zoho_entity_mappings"');
    expect(migration).toContain('"zoho_sync_attempts"');
    expect(migration).toContain('"zoho_discovery_cache"');
  });
});

describe('Zoho Sprint 2 scope versioning', () => {
  it('accepts comma and space separated scope responses', () => {
    const scopes = parseGrantedScopes('ZohoBooks.settings.READ,ZohoBooks.banking.READ ZohoBooks.accountants.READ');
    expect(scopes.has('ZohoBooks.banking.READ')).toBe(true);
  });

  it('reports missing required scopes so reconnect can be requested', () => {
    const missing = getMissingRequiredScopes('ZohoBooks.settings.READ');
    expect(missing).toContain('ZohoBooks.banking.READ');
    expect(missing).toContain('ZohoBooks.accountants.READ');
  });

  it('retains all read-only scopes introduced in Sprint 2', () => {
    expect(ZOHO_REQUIRED_SCOPES).toEqual(expect.arrayContaining([
      'ZohoBooks.settings.READ',
      'ZohoBooks.banking.READ',
      'ZohoBooks.accountants.READ',
    ]));
  });
});
