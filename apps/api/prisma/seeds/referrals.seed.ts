/**
 * Seed Referral Codes
 * 
 * Creates sample referral codes for testing the incentive system
 * NOTE: Incentive settings are now stored in Member model, not ReferralCode
 */

import { PrismaClient, ReferrerType } from '@prisma/client';

export async function seedReferralCodes(prisma: PrismaClient) {
  console.log('📋 Seeding referral codes...\n');

  // Get branches
  const branchPusat = await prisma.branch.findFirst({
    where: { branchCode: 'PST' },
  });

  const branchBandung = await prisma.branch.findFirst({
    where: { branchCode: 'BDG' },
  });

  const branchSurabaya = await prisma.branch.findFirst({
    where: { branchCode: 'SBY' },
  });

  if (!branchPusat || !branchBandung || !branchSurabaya) {
    console.log('  ⚠️  Branches not found, skipping referral codes seed');
    return;
  }

  // Referral codes data
  const referralCodes = [
    // Jakarta Pusat - Sales
    {
      code: 'REF-001',
      referrerName: 'Ahmad Wijaya',
      referrerType: 'SALES' as ReferrerType,
      branchId: branchPusat.id,
      phone: '081234567890',
      email: 'ahmad.wijaya@raho.id',
      isActive: true,
    },
    {
      code: 'REF-002',
      referrerName: 'Siti Nurhaliza',
      referrerType: 'SALES' as ReferrerType,
      branchId: branchPusat.id,
      phone: '081234567891',
      email: 'siti.nurhaliza@raho.id',
      isActive: true,
    },
    
    // Bandung - Sales & Dokter
    {
      code: 'REF-003',
      referrerName: 'Budi Santoso',
      referrerType: 'SALES' as ReferrerType,
      branchId: branchBandung.id,
      phone: '081234567892',
      email: 'budi.santoso@raho.id',
      isActive: true,
    },
    {
      code: 'REF-004',
      referrerName: 'Dr. Andi Pratama',
      referrerType: 'DOKTER' as ReferrerType,
      branchId: branchBandung.id,
      phone: '081234567893',
      email: 'dr.andi@raho.id',
      isActive: true,
    },
    
    // Surabaya - Sales & Member
    {
      code: 'REF-005',
      referrerName: 'Dewi Lestari',
      referrerType: 'SALES' as ReferrerType,
      branchId: branchSurabaya.id,
      phone: '081234567894',
      email: 'dewi.lestari@raho.id',
      isActive: true,
    },
    {
      code: 'REF-006',
      referrerName: 'Rina Kusuma (Member)',
      referrerType: 'MEMBER' as ReferrerType,
      branchId: branchSurabaya.id,
      phone: '081234567895',
      email: 'rina.kusuma@example.com',
      isActive: true,
    },
    
    // Additional referrals for testing
    {
      code: 'REF-007',
      referrerName: 'Joko Widodo',
      referrerType: 'SALES' as ReferrerType,
      branchId: branchPusat.id,
      phone: '081234567896',
      email: 'joko.widodo@raho.id',
      isActive: true,
    },
    {
      code: 'REF-008',
      referrerName: 'Maya Sari',
      referrerType: 'SALES' as ReferrerType,
      branchId: branchBandung.id,
      phone: '081234567897',
      email: 'maya.sari@raho.id',
      isActive: true,
    },
  ];

  // Upsert referral codes
  for (const referralData of referralCodes) {
    await prisma.referralCode.upsert({
      where: { code: referralData.code },
      update: referralData,
      create: referralData,
    });

    console.log(`  ✅ ${referralData.code} - ${referralData.referrerName} (${referralData.referrerType})`);
  }

  console.log(`\n✅ Seeded ${referralCodes.length} referral codes\n`);
}

// Standalone execution
if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  seedReferralCodes(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
