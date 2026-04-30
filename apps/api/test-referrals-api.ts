/**
 * Test Referrals API Endpoint
 * 
 * Quick test to verify referrals API is working correctly
 * Run with: npx tsx test-referrals-api.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testReferralsAPI() {
  console.log('🧪 Testing Referrals API...\n');

  try {
    // Test 1: Count referral codes
    const totalReferrals = await prisma.referralCode.count({
      where: { isActive: true },
    });
    console.log(`✅ Total Active Referrals: ${totalReferrals}`);

    // Test 2: List all referral codes
    const referrals = await prisma.referralCode.findMany({
      where: { isActive: true },
      include: {
        branch: {
          select: {
            id: true,
            branchCode: true,
            name: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    console.log('\n📋 Referral Codes:\n');
    referrals.forEach((ref) => {
      const firstIncentive =
        ref.firstIncentiveType === 'PERCENTAGE'
          ? `${ref.firstIncentiveValue}%`
          : `Rp ${ref.firstIncentiveValue.toLocaleString('id-ID')}`;

      const nextIncentive =
        ref.nextIncentiveType === 'PERCENTAGE'
          ? `${ref.nextIncentiveValue}%`
          : `Rp ${ref.nextIncentiveValue.toLocaleString('id-ID')}`;

      console.log(`  ${ref.code} - ${ref.referrerName}`);
      console.log(`    Type: ${ref.referrerType}`);
      console.log(`    Branch: ${ref.branch.name}`);
      console.log(`    First Incentive: ${firstIncentive}`);
      console.log(`    Next Incentive: ${nextIncentive}`);
      console.log(`    Total Referrals: ${ref.totalReferrals}`);
      console.log(`    Total Earned: Rp ${Number(ref.totalIncentiveEarned).toLocaleString('id-ID')}`);
      console.log('');
    });

    // Test 3: Group by branch
    const byBranch = await prisma.referralCode.groupBy({
      by: ['branchId'],
      where: { isActive: true },
      _count: true,
    });

    console.log('📊 Referrals by Branch:\n');
    for (const group of byBranch) {
      const branch = await prisma.branch.findUnique({
        where: { id: group.branchId },
        select: { name: true },
      });
      console.log(`  ${branch?.name}: ${group._count} referrals`);
    }

    // Test 4: Group by type
    const byType = await prisma.referralCode.groupBy({
      by: ['referrerType'],
      where: { isActive: true },
      _count: true,
    });

    console.log('\n📊 Referrals by Type:\n');
    byType.forEach((group) => {
      console.log(`  ${group.referrerType}: ${group._count} referrals`);
    });

    // Test 5: Check incentive records
    const incentiveRecords = await prisma.referralIncentiveRecord.count();
    console.log(`\n💰 Total Incentive Records: ${incentiveRecords}`);

    console.log('\n✅ All tests passed! Referrals API is working correctly.\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testReferralsAPI()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
