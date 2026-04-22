import { PrismaClient } from '@prisma/client';

export async function seedReferralCodes(prisma: PrismaClient) {
  console.log('🔗 Seeding referral codes...');

  const referralCodes = [
    { code: 'DR-SUSI-001', referrerName: 'dr. Susi Wijaya', referrerType: 'DOKTER' as const },
    { code: 'MBR-BUDI-001', referrerName: 'Budi Santoso', referrerType: 'MEMBER' as const },
    { code: 'IG-RAHO-2026', referrerName: 'Instagram @rahoklinik', referrerType: 'MEDIA' as const },
  ];

  for (const rc of referralCodes) {
    await prisma.referralCode.upsert({
      where: { code: rc.code },
      update: {},
      create: rc,
    });
  }

  console.log(`✅ Referral codes: ${referralCodes.length} entries`);
}
