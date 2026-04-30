/**
 * Test script to add referral code to a member and test the API response
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testReferralDisplay() {
  try {
    console.log('🔍 Testing referral display functionality...\n');

    // 1. Find an existing member
    const member = await prisma.member.findFirst({
      where: { isActive: true },
      include: {
        user: {
          include: { profile: true }
        },
        registrationBranch: true
      }
    });

    if (!member) {
      console.log('❌ No members found');
      return;
    }

    console.log(`📋 Found member: ${member.memberNo} - ${member.user.profile?.fullName}`);

    // 2. Find an existing referral code from the same branch
    const referralCode = await prisma.referralCode.findFirst({
      where: { 
        branchId: member.registrationBranchId,
        isActive: true 
      }
    });

    if (!referralCode) {
      console.log('❌ No referral codes found for this branch');
      return;
    }

    console.log(`🎁 Found referral code: ${referralCode.code} - ${referralCode.referrerName}`);

    // 3. Update member to use this referral code with incentive settings
    const updatedMember = await prisma.member.update({
      where: { id: member.id },
      data: {
        referralCodeId: referralCode.id,
        firstIncentiveType: 'PERCENTAGE',
        firstIncentiveValue: 10.0,
        nextIncentiveType: 'FIXED_AMOUNT',
        nextIncentiveValue: 50000.0
      }
    });

    console.log(`✅ Updated member ${member.memberNo} with referral code and incentive settings`);

    // 4. Test the database query directly
    const memberDetail = await prisma.member.findUnique({
      where: { id: member.id },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        registrationBranch: true,
        branchAccesses: {
          include: {
            branch: true,
          },
        },
        referralCode: true,
        documents: true,
        memberPackages: {
          where: {
            packageType: 'BASIC',
            status: 'ACTIVE',
          },
          select: {
            totalSessions: true,
            usedSessions: true,
          },
        },
      },
    });
    
    console.log('\n📊 Database Query Result:');
    console.log('=========================');
    console.log(`Member ID: ${memberDetail?.id}`);
    console.log(`Member No: ${memberDetail?.memberNo}`);
    console.log(`Full Name: ${memberDetail?.user.profile?.fullName}`);
    console.log(`Referral Code ID: ${memberDetail?.referralCodeId}`);
    
    if (memberDetail?.referralCode) {
      console.log(`Referral Code: ${memberDetail.referralCode.code}`);
      console.log(`Referrer Name: ${memberDetail.referralCode.referrerName}`);
      console.log(`Referrer Type: ${memberDetail.referralCode.referrerType}`);
    } else {
      console.log('❌ Referral Code: null');
    }
    
    console.log(`First Incentive: ${memberDetail?.firstIncentiveType} - ${memberDetail?.firstIncentiveValue}`);
    console.log(`Next Incentive: ${memberDetail?.nextIncentiveType} - ${memberDetail?.nextIncentiveValue}`);

    console.log('\n✅ Test completed successfully!');
    console.log(`\n🌐 You can now test in browser with member ID: ${member.id}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testReferralDisplay();