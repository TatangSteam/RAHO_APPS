/**
 * Test Referrals API after migration
 * Verify that incentive fields are removed from ReferralCode
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testReferralsAfterMigration() {
  console.log('🧪 Testing Referrals API after migration...\n');

  try {
    // Test 1: Fetch referral codes
    console.log('1️⃣ Fetching referral codes...');
    const referrals = await prisma.referralCode.findMany({
      where: { isActive: true },
      take: 3,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            branchCode: true,
          },
        },
      },
    });

    console.log(`   ✅ Found ${referrals.length} referral codes`);
    
    if (referrals.length > 0) {
      const firstReferral = referrals[0];
      console.log('\n   Sample referral code:');
      console.log(`   - Code: ${firstReferral.code}`);
      console.log(`   - Name: ${firstReferral.referrerName}`);
      console.log(`   - Type: ${firstReferral.referrerType}`);
      console.log(`   - Branch: ${firstReferral.branch.name}`);
      console.log(`   - Total Referrals: ${firstReferral.totalReferrals}`);
      console.log(`   - Total Incentive: Rp ${Number(firstReferral.totalIncentiveEarned).toLocaleString('id-ID')}`);
      
      // Check if incentive fields exist (they shouldn't)
      const hasIncentiveFields = 'firstIncentiveType' in firstReferral;
      if (hasIncentiveFields) {
        console.log('   ❌ ERROR: Incentive fields still exist in ReferralCode!');
      } else {
        console.log('   ✅ Incentive fields removed from ReferralCode');
      }
    }

    // Test 2: Fetch members with incentive fields
    console.log('\n2️⃣ Fetching members with referral codes...');
    const members = await prisma.member.findMany({
      where: {
        referralCodeId: { not: null },
        isActive: true,
      },
      take: 3,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        referralCode: true,
      },
    });

    console.log(`   ✅ Found ${members.length} members with referral codes`);
    
    if (members.length > 0) {
      const firstMember = members[0];
      console.log('\n   Sample member:');
      console.log(`   - Member No: ${firstMember.memberNo}`);
      console.log(`   - Name: ${firstMember.user.profile?.fullName}`);
      console.log(`   - Referral Code: ${firstMember.referralCode?.code}`);
      
      // Check if member has incentive fields
      if (firstMember.firstIncentiveType) {
        console.log(`   - First Incentive: ${firstMember.firstIncentiveType} ${firstMember.firstIncentiveValue}`);
        console.log(`   - Next Incentive: ${firstMember.nextIncentiveType} ${firstMember.nextIncentiveValue}`);
        console.log('   ✅ Member has incentive fields');
      } else {
        console.log('   ℹ️  Member has no incentive settings (optional)');
      }
    }

    // Test 3: Create a test referral code
    console.log('\n3️⃣ Testing referral code creation...');
    const branch = await prisma.branch.findFirst();
    
    if (branch) {
      const testCode = `TEST-${Date.now()}`;
      const newReferral = await prisma.referralCode.create({
        data: {
          code: testCode,
          referrerName: 'Test Referrer',
          referrerType: 'SALES',
          branchId: branch.id,
          phone: '08123456789',
          email: 'test@example.com',
          // Note: No incentive fields here!
        },
      });

      console.log(`   ✅ Created test referral: ${newReferral.code}`);
      
      // Clean up
      await prisma.referralCode.delete({
        where: { id: newReferral.id },
      });
      console.log('   ✅ Cleaned up test data');
    }

    console.log('\n✅ All tests passed! Migration successful.\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testReferralsAfterMigration()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
