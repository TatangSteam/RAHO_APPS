import fs from 'fs';
import path from 'path';
import { claimVoucherSchema, issueVoucherSchema } from '../voucher.schema';
import { decryptVoucherCode, encryptVoucherCode, hashVoucherIdentity } from '../voucher.crypto';
import { normalizeVoucherCode } from '../voucher.service';

const apiRoot = path.resolve(__dirname, '../../../..');
const repoRoot = path.resolve(apiRoot, '../..');

describe('Voucher Partnership foundation', () => {
  it('validates recipient identity without accepting malformed NIK', () => {
    const result = issueVoucherSchema.safeParse({
      campaignId: 'campaign-1',
      recipientName: 'Penerima Voucher',
      nik: '1234',
      dateOfBirth: '1990-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('requires an idempotency UUID on every claim', () => {
    const result = claimVoucherSchema.safeParse({
      code: 'RAHO-TEST-ABCD',
      recipientName: 'Penerima Voucher',
      nik: '3173000000001234',
      dateOfBirth: '1990-01-01',
      locationId: 'VCL-001',
      requestId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a future date of birth before recording a failed claim attempt', () => {
    const result = claimVoucherSchema.safeParse({
      code: 'RAHO-TEST-ABCD',
      recipientName: 'Penerima Voucher',
      nik: '3173000000001234',
      dateOfBirth: '2999-01-01',
      locationId: 'VCL-001',
      requestId: '4d660640-5786-48fa-8902-7d2b94d05015',
    });
    expect(result.success).toBe(false);
  });

  it('normalizes voucher codes copied from quoted CSV cells', () => {
    expect(normalizeVoucherCode('"RAHO-GIFT10-EPTBCCGG77"')).toBe('RAHO-GIFT10-EPTBCCGG77');
    expect(normalizeVoucherCode(' RAHO-GIFT10-EPTBCCGG77" ')).toBe('RAHO-GIFT10-EPTBCCGG77');
  });

  it('seeds exactly the three approved campaigns and all 20 initial locations', () => {
    const migration = fs.readFileSync(
      path.join(apiRoot, 'prisma/migrations/20260901120000_add_voucher_partnership/migration.sql'),
      'utf8',
    );
    expect(migration).toContain("'SOCIAL-15B-10BST'");
    expect(migration).toContain("'GIFT-10B'");
    expect(migration).toContain("'SOCIAL-15B'");
    expect(migration.match(/\('VCL-\d{3}'/g)).toHaveLength(20);

    const priceAlignmentMigration = fs.readFileSync(
      path.join(apiRoot, 'prisma/migrations/20260901140000_align_gift_voucher_undecided_price/migration.sql'),
      'utf8',
    );
    expect(priceAlignmentMigration).toContain('"totalPrice" = NULL');
    expect(priceAlignmentMigration).toContain("WHERE \"code\" = 'GIFT-10B'");
  });

  it('keeps raw voucher codes and NIK values out of voucher persistence', () => {
    const schema = fs.readFileSync(path.join(apiRoot, 'prisma/schema.prisma'), 'utf8');
    const voucherModel = schema.match(/model CampaignVoucher \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(voucherModel).toContain('codeHash');
    expect(voucherModel).toContain('codeEncrypted');
    expect(voucherModel).toContain('codeLast4');
    expect(voucherModel).toContain('nikLast4');
    expect(voucherModel).not.toMatch(/\n\s+code\s+String/);
    expect(voucherModel).not.toMatch(/\n\s+nik\s+String/);
  });

  it('encrypts printable voucher codes at rest and can decrypt them for audited export', () => {
    const code = 'RAHO-SOCIAL-ABCD2345';
    const encrypted = encryptVoucherCode(code);
    expect(encrypted).not.toContain(code);
    expect(decryptVoucherCode(encrypted)).toBe(code);
  });

  it('stores an irreversible keyed hash for standalone recipient verification', () => {
    const identity = '3173000000001234';
    expect(hashVoucherIdentity(identity)).toBe(hashVoucherIdentity(identity));
    expect(hashVoucherIdentity(identity)).not.toContain(identity);
  });

  it('registers the role-scoped Ekstra voucher pages', () => {
    const sidebar = fs.readFileSync(path.join(repoRoot, 'apps/web/src/components/layout/Sidebar.tsx'), 'utf8');
    const page = fs.readFileSync(path.join(repoRoot, 'apps/web/src/app/(staff)/extra/vouchers/page.tsx'), 'utf8');
    const middleware = fs.readFileSync(path.join(repoRoot, 'apps/web/src/middleware.ts'), 'utf8');
    expect(sidebar).toContain("title: 'Ekstra'");
    expect(sidebar).toContain("href: '/extra/vouchers'");
    expect(sidebar).toContain("href: '/extra/vouchers/history'");
    expect(sidebar).toContain("href: '/extra/vouchers/registry'");
    expect(sidebar).toContain("href: '/extra/vouchers/campaigns'");
    expect(sidebar).toContain("href: '/extra/vouchers/locations'");
    expect(sidebar).toContain("href: '/extra/vouchers/operators'");
    expect(sidebar).toContain("roles: ['SUPER_ADMIN', 'VOUCHER_OPERATOR']");
    expect(sidebar).toContain("VOUCHER_OPERATOR: new Set(['/extra/vouchers', '/extra/vouchers/history'])");
    expect(middleware).toContain("pathname === '/extra/vouchers/history'");
    expect(middleware).not.toContain("pathname.startsWith('/extra/vouchers/')");
    expect(page).toContain('Klaim Voucher');
    expect(page).toContain('Riwayat Klaim');
    expect(page).toContain("view === 'registry'");
    expect(page).toContain("view === 'campaigns'");
    expect(page).toContain("view === 'locations'");
    expect(page).toContain("view === 'operators'");
    expect(page).toContain('Terbitkan Voucher');
    expect(page).toContain('Akun Pengelola');
    expect(page).toContain('Export kode untuk print (CSV)');
    expect(page).toContain('Generate sisa');
    expect(page).toContain('AVAILABLE');
    expect(page).toContain('Klaim ini tidak membuat member, paket, atau sesi terapi.');
  });

  it('allows first-use activation while rate-limiting only suspicious identity failures', () => {
    const service = fs.readFileSync(path.join(apiRoot, 'src/modules/vouchers/voucher.service.ts'), 'utf8');
    expect(service).toContain('voucher.status === CampaignVoucherStatus.AVAILABLE');
    expect(service).toContain("failureCode: { in: CLAIM_RATE_LIMIT_FAILURE_CODES }");
    expect(service).toContain("'VOUCHER_NOT_FOUND'");
    expect(service).toContain("'VOUCHER_IDENTITY_MISMATCH'");
    expect(service).not.toContain('tx.memberPackage.createMany');
    expect(service).toContain("fulfillmentMode: 'STANDALONE'");
  });
});
