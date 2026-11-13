const { createHash, createCipheriv, randomBytes } = require('node:crypto');
const vouchers = require('./data/default-vouchers-2026-09-02.json');

function encryptCode(code, secret) {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

async function seedDefaultVouchers(prisma, environment = process.env) {
  const secret = environment.VOUCHER_CODE_ENCRYPTION_KEY || environment.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('Default vouchers require VOUCHER_CODE_ENCRYPTION_KEY or JWT_ACCESS_SECRET.');
  if (new Set(vouchers.map((row) => row.code)).size !== vouchers.length) {
    throw new Error('Duplicate code in default voucher data.');
  }
  return prisma.$transaction(async (tx) => {
    // Serialize repeated/concurrent deployments of this same catalogue.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('DEFAULT_VOUCHERS_2026_09_02'))`;
    const campaigns = await tx.voucherCampaign.findMany({
      where: { code: { in: [...new Set(vouchers.map((row) => row.campaignCode))] }, version: 1 },
    });
    for (const campaign of [...campaigns].sort((a, b) => a.id.localeCompare(b.id))) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`VOUCHER_CAMPAIGN:${campaign.id}`}))`;
    }
    const data = vouchers.map((row) => {
      const campaign = campaigns.find((item) => item.code === row.campaignCode);
      if (!campaign || campaign.basicSessions !== row.basicSessions || campaign.boosterSessions !== row.boosterSessions) {
        throw new Error(`Missing or incompatible default voucher campaign: ${row.campaignCode}`);
      }
      return {
        campaignId: campaign.id,
        codeHash: createHash('sha256').update(row.code, 'utf8').digest('hex'),
        codeEncrypted: encryptCode(row.code, secret),
        codeLast4: row.code.slice(-4),
        status: 'AVAILABLE',
        issuedAt: new Date(row.issuedAt),
        createdBy: 'SYSTEM', updatedBy: 'SYSTEM',
      };
    });
    // Never reset CLAIMED/ISSUED/CANCELLED vouchers or recipient information.
    const result = await tx.campaignVoucher.createMany({ data, skipDuplicates: true });
    for (const campaign of campaigns) {
      const count = await tx.campaignVoucher.count({ where: { campaignId: campaign.id } });
      // Existing generated codes also remain valid when adding the catalogue.
      if (count > campaign.quota) {
        await tx.voucherCampaign.update({ where: { id: campaign.id }, data: { quota: count } });
      }
    }
    return result.count;
  }, { timeout: 30000 });
}

async function main() {
  require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
  const prisma = new (require('@prisma/client').PrismaClient)();
  try { console.log(`Default vouchers: ${await seedDefaultVouchers(prisma)} added; existing codes preserved.`); }
  finally { await prisma.$disconnect(); }
}

module.exports = { seedDefaultVouchers };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
