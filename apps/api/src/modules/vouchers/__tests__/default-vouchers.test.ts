const { createHash, createDecipheriv } = require('node:crypto');
const { seedDefaultVouchers } = require('../../../../prisma/seed-default-vouchers.cjs');
const catalogue = require('../../../../prisma/data/default-vouchers-2026-09-02.json');

describe('deployment default vouchers', () => {
  function database() {
    const stored = new Map();
    const campaigns = [
      { id: 'gift', code: 'GIFT-10B', basicSessions: 10, boosterSessions: 0, quota: 100 },
      { id: 'social', code: 'SOCIAL-15B', basicSessions: 15, boosterSessions: 0, quota: 50 },
      { id: 'booster', code: 'SOCIAL-15B-10BST', basicSessions: 15, boosterSessions: 10, quota: 50 },
    ];
    const tx: any = {
      $executeRaw: jest.fn(),
      voucherCampaign: { findMany: async () => campaigns, update: jest.fn() },
      campaignVoucher: {
        createMany: async ({ data, skipDuplicates }: any) => {
          expect(skipDuplicates).toBe(true);
          let count = 0;
          for (const row of data) if (!stored.has(row.codeHash)) { stored.set(row.codeHash, row); count++; }
          return { count };
        },
        count: async ({ where }: any) => [...stored.values()].filter((row: any) => row.campaignId === where.campaignId).length,
      },
    };
    tx.$transaction = (callback: any) => callback(tx);
    return { tx, stored, campaigns };
  }

  it('imports all 200 exact codes, encrypts them compatibly and preserves claims on rerun', async () => {
    const { tx, stored } = database();
    const environment = { VOUCHER_CODE_ENCRYPTION_KEY: 'test-voucher-key' };
    expect(await seedDefaultVouchers(tx, environment)).toBe(200);
    expect(stored.size).toBe(200);
    for (const source of catalogue) {
      const hash = createHash('sha256').update(source.code).digest('hex');
      const row: any = stored.get(hash);
      expect(row.status).toBe('AVAILABLE');
      expect(row.recipientMemberId).toBeUndefined();
      const [version, iv, tag, ciphertext] = row.codeEncrypted.split('.');
      expect(version).toBe('v1');
      const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(environment.VOUCHER_CODE_ENCRYPTION_KEY).digest(), Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      expect(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString()).toBe(source.code);
    }
    const claimed: any = stored.values().next().value;
    claimed.status = 'CLAIMED';
    claimed.recipientNameSnapshot = 'Penerima';
    expect(await seedDefaultVouchers(tx, environment)).toBe(0);
    expect(claimed.status).toBe('CLAIMED');
    expect(claimed.recipientNameSnapshot).toBe('Penerima');
    expect(tx.voucherCampaign.update).not.toHaveBeenCalled();
  });

  it('refuses an incompatible campaign before inserting any voucher', async () => {
    const { tx, campaigns, stored } = database();
    campaigns[0].basicSessions = 99;
    await expect(seedDefaultVouchers(tx, { JWT_ACCESS_SECRET: 'fallback-key' })).rejects.toThrow('incompatible');
    expect(stored.size).toBe(0);
  });

  it('requires an encryption key', async () => {
    await expect(seedDefaultVouchers(database().tx, {})).rejects.toThrow('require');
  });
});
