import fs from 'fs';
import path from 'path';
import { claimVoucherSchema, createVoucherCampaignSchema, createVoucherLocationSchema, issueVoucherSchema } from '../voucher.schema';
import { decryptVoucherCode, encryptVoucherCode, hashVoucherIdentity } from '../voucher.crypto';
import { createClaimReceiptPdf, normalizeVoucherCode } from '../voucher.service';

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

  it('adds the RAHO Reguler location group and all 14 supplied locations', () => {
    const migration = fs.readFileSync(
      path.join(apiRoot, 'prisma/migrations/20260904110000_manage_voucher_claim_locations/migration.sql'),
      'utf8',
    );
    expect(migration).toContain('"locationGroup"');
    expect(migration.match(/\('VCL-REG-\d{3}'/g)).toHaveLength(14);
    expect(migration).toContain("'RAHO Citraland'");
    expect(migration).toContain("'RAHO Lippo Mall Nusantara'");
    expect(migration).toContain("HAVING COUNT(DISTINCT assignment.\"locationId\") = 20");
    expect(migration).toContain('scope."validUntil"');
  });

  it('validates a managed voucher claim location', () => {
    expect(createVoucherLocationSchema.safeParse({
      displayName: 'RAHO Surabaya',
      locationGroup: 'RAHO_REGULER',
      city: 'Surabaya',
      address: 'Jl. Contoh No. 1',
      phone: '08123456789',
    }).success).toBe(true);
    expect(createVoucherLocationSchema.safeParse({
      displayName: 'X',
      locationGroup: 'LAINNYA',
      city: '',
    }).success).toBe(false);
  });

  it('validates freely configurable campaign benefits and periods', () => {
    expect(createVoucherCampaignSchema.safeParse({
      code: 'PROMO-20B-5BST',
      title: 'Campaign Voucher Baru',
      description: 'Dibuat oleh Super Admin.',
      quota: 500,
      basicSessions: 20,
      boosterSessions: 5,
      boosterType: 'NO',
      totalPrice: 25_000_000,
      issueStartAt: '2026-09-01',
      issueEndAt: '2026-12-31',
      claimStartAt: '2026-09-01',
      claimEndAt: '2027-01-31',
      locationPolicy: 'ALL_ACTIVE',
      codeMode: 'AUTO',
      status: 'ACTIVE',
    }).success).toBe(true);
    expect(createVoucherCampaignSchema.safeParse({
      code: 'INVALID',
      title: 'Tanpa manfaat',
      description: 'Basic dan booster sama-sama nol.',
      quota: 10,
      basicSessions: 0,
      boosterSessions: 0,
    }).success).toBe(false);
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

  it('generates a valid PDF claim receipt without exposing full identity data', async () => {
    const receipt = await createClaimReceiptPdf({
      receiptNumber: 'VCR-20260903-TEST0001',
      maskedCode: 'RAHO-****-1234',
      recipientName: 'Penerima Voucher',
      maskedNik: '************5678',
      campaignCode: 'GIFT-10B',
      campaignTitle: 'Gift Voucher 10 Basic',
      basicSessions: 10,
      boosterSessions: 0,
      claimedAt: new Date('2026-09-03T03:00:00.000Z'),
      locationName: 'RAHO Premier Jakarta',
      locationCity: 'Jakarta',
      operatorName: 'Pengelola Voucher',
      operatorCode: 'STF-001',
    });
    expect(receipt.subarray(0, 5).toString()).toBe('%PDF-');
    expect(receipt.length).toBeGreaterThan(1_000);
    expect(receipt.toString('latin1')).not.toContain('3173000000005678');
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
    expect(sidebar).toContain("roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'VOUCHER_OPERATOR']");
    expect(sidebar).toContain("VOUCHER_OPERATOR: new Set(['/extra/vouchers', '/extra/vouchers/history'])");
    expect(middleware).toContain("pathname === '/extra/vouchers/history'");
    expect(middleware).not.toContain("pathname.startsWith('/extra/vouchers/')");
    expect(page).toContain('Klaim Voucher');
    expect(page).toContain('Riwayat Klaim');
    expect(page).toContain('Tipe Voucher');
    expect(page).toContain('formatVoucherType');
    expect(page).toContain("view === 'registry'");
    expect(page).toContain("view === 'campaigns'");
    expect(page).toContain("view === 'locations'");
    expect(page).toContain("view === 'operators'");
    expect(page).toContain('Terbitkan Voucher');
    expect(page).toContain('Akun Pengelola');
    expect(page).toContain('Export kode untuk print (CSV)');
    expect(page).toContain('kode berikutnya');
    expect(page).toContain('Buat Campaign Baru');
    expect(page).toContain('Buat Campaign Voucher Baru');
    expect(page).toContain('Simpan Campaign');
    expect(page).not.toContain('Tambah voucher dummy');
    expect(page).toContain('AVAILABLE');
    expect(page).toContain('Klaim ini tidak membuat member, paket, atau sesi terapi.');
    expect(page).toContain('Unduh bukti tanda terima PDF');
    expect(page).toContain('Nama, 4 digit NIK/kode, campaign, atau lokasi');
    expect(page).toContain('RAHO Reguler');
    expect(page).toContain('Kelola lokasi');
    expect(page).toContain('Tambah Lokasi Klaim');
    expect(page).toContain('Hapus dari pilihan klaim');
  });

  it('supports scoped claim search, PDF receipts, and Admin Manager issuance', () => {
    const routes = fs.readFileSync(path.join(apiRoot, 'src/modules/vouchers/voucher.routes.ts'), 'utf8');
    const service = fs.readFileSync(path.join(apiRoot, 'src/modules/vouchers/voucher.service.ts'), 'utf8');
    expect(routes).toContain("Role.ADMIN_MANAGER, Role.VOUCHER_OPERATOR");
    expect(routes).toContain("router.get('/claims'");
    expect(routes).toContain("router.get('/claims/:voucherId/receipt'");
    expect(routes).toContain('VOUCHER_ISSUER_ROLES');
    expect(routes).toContain("router.post('/locations', authorize([Role.SUPER_ADMIN])");
    expect(routes).toContain("router.post('/campaigns', authorize([Role.SUPER_ADMIN])");
    expect(routes).toContain("router.delete('/locations/:locationId', authorize([Role.SUPER_ADMIN])");
    expect(service).toContain('listVoucherClaims');
    expect(service).toContain('getVoucherClaimReceipt');
    expect(service).toContain("new PDFDocument({ size: 'A4'");
    expect(service).toContain('Admin Manager wajib memilih lokasi klaim yang dikelola');
    expect(service).toContain("action: 'EXPORT'");
    expect(service).toContain('createVoucherClaimLocation');
    expect(service).toContain('createVoucherCampaign');
    expect(service).toContain('archiveVoucherClaimLocation');
    expect(service).toContain("deletionMode: 'SOFT_DELETE'");
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
