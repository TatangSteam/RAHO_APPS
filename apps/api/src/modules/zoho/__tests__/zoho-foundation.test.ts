import fs from 'fs';
import path from 'path';
import {
  getMissingRequiredScopes,
  parseGrantedScopes,
  resolveZohoAccountsBaseUrl,
  ZOHO_REQUIRED_SCOPES,
} from '../zoho.client';
import { isZohoReconnectRequired, ZohoApiError, normalizeZohoError } from '../zoho.error';
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

  it('classifies invalid or revoked refresh grants as requiring OAuth reconnect', () => {
    expect(isZohoReconnectRequired(new ZohoApiError(
      'invalid_code',
      'ZOHO_REFRESH_FAILED',
      401,
      false,
    ))).toBe(true);
    expect(isZohoReconnectRequired('invalid_grant')).toBe(true);
    expect(isZohoReconnectRequired(new ZohoApiError('Rate limited', '4290', 429, true))).toBe(false);
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

  it('tracks ERP versus manual Zoho origin and rejects duplicate external keys', () => {
    const migration = fs.readFileSync(
      path.resolve(__dirname, '../../../../prisma/migrations/20260805090000_add_zoho_data_origin/migration.sql'),
      'utf8',
    );
    expect(migration).toContain("'ERP', 'MANUAL_ZOHO'");
    expect(migration).toContain('"originVerifiedAt"');
    expect(migration).toContain('zoho_entity_mappings_zohoConnectionId_externalKey_key');
    expect(migration).toContain('Duplicate Zoho externalKey ditemukan');
  });

  it('backfills origin safely and scopes external-key uniqueness by entity type', () => {
    const migration = fs.readFileSync(
      path.resolve(__dirname, '../../../../prisma/migrations/20260805100000_harden_zoho_origin_management/migration.sql'),
      'utf8',
    );
    expect(migration).toContain("'UNKNOWN', 'ERP', 'MANUAL_ZOHO'");
    expect(migration).toContain("'REVIEW_REQUIRED', 'ERP_MANAGED', 'MANUAL_ONLY'");
    expect(migration).toContain('"entityType", "externalKey"');
    expect(migration).toContain('"dataOrigin" = \'UNKNOWN\'');
    expect(migration).toContain("'ACCOUNT_ROLE', 'UOM', 'CASH_BANK_ACCOUNT'");
  });

  it('enforces Zoho Books-only in OAuth, runtime adapters, and stored capability', () => {
    const moduleDir = path.resolve(__dirname, '..');
    const runtimeSources = fs.readdirSync(moduleDir)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => fs.readFileSync(path.join(moduleDir, name), 'utf8'))
      .join('\n');
    const migration = fs.readFileSync(
      path.resolve(__dirname, '../../../../prisma/migrations/20260805110000_enforce_zoho_books_only/migration.sql'),
      'utf8',
    );
    expect(runtimeSources).not.toContain('/inventory/v1');
    expect(runtimeSources).not.toContain('ZohoInventory.');
    expect(ZOHO_REQUIRED_SCOPES.every((scope) => scope.startsWith('ZohoBooks.'))).toBe(true);
    expect(migration).toContain('"inventoryAdjustmentsSupported" = FALSE');
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

  it('uses only trusted Zoho accounts servers from the OAuth callback', () => {
    expect(resolveZohoAccountsBaseUrl('https://accounts.zoho.com.au/'))
      .toBe('https://accounts.zoho.com.au');
    expect(resolveZohoAccountsBaseUrl('accounts.zoho.eu'))
      .toBe('https://accounts.zoho.eu');
    expect(() => resolveZohoAccountsBaseUrl('https://accounts.zoho.com.evil.test'))
      .toThrow('Accounts server Zoho tidak didukung.');
    expect(() => resolveZohoAccountsBaseUrl('not a valid url'))
      .toThrow(/Accounts server Zoho tidak/);
  });

  it('forwards the callback accounts server and suspends invalid refresh grants', () => {
    const controller = fs.readFileSync(path.resolve(__dirname, '../zoho.controller.ts'), 'utf8');
    const client = fs.readFileSync(path.resolve(__dirname, '../zoho.client.ts'), 'utf8');
    expect(controller).toContain("req.query['accounts-server']");
    expect(controller).toContain('handleCallback(code, state, accountsServer)');
    expect(client).toContain('resolveZohoAccountsBaseUrl(connection.dataCenter)');
    expect(client).toContain('reconnectRequired ? { isActive: false }');
  });

  it('retains all read-only scopes introduced in Sprint 2', () => {
    expect(ZOHO_REQUIRED_SCOPES).toEqual(expect.arrayContaining([
      'ZohoBooks.settings.READ',
      'ZohoBooks.banking.READ',
      'ZohoBooks.accountants.READ',
    ]));
  });
});
