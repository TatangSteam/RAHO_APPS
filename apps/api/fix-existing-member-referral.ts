/**
 * Fix existing member to have referral code (for the member in screenshot)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixExistingMemberReferral() {
  try {
    console.log('🔧 Fixing existing member referral...\n');

    // Find the member from screenshot (asdsds)
    const member = await prisma.member.findFirst({
      where: { 
        user: {
          profile: {
            fullName: { contains: 'asdsds', mode: 'insensitive' }
          }
        }
      },
      include: {
        user: {
          include: { profile: true }
        },
        registrationBranch: true
      }
    });

    if (!member) {
      console.log('❌ Member "asdsds" not found');
      return;
    }

    console.log(`📋 Found member: ${member.memberNo} - ${member.user.profile?.fullName}`);

    // Get a referral code from the same branch
    const referralCode = await prisma.referralCode.findFirst({
      where: { 
        isActive: true,
        branchId: member.registrationBranchId
      }
    });

    if (!referralCode) {
      console.log('❌ No active referral code found for this branch');
      return;
    }

    console.log(`🎁 Using referral code: ${referralCode.code} - ${referralCode.referrerName}`);

    // Update member with referral code and incentive settings
    const updatedMember = await prisma.member.update({
      where: { id: member.id },
      data: {
        referralCodeId: referralCode.id,
        firstIncentiveType: 'PERCENTAGE',
        firstIncentiveValue: 10.0,
        nextIncentiveType: 'PERCENTAGE',
        nextIncentiveValue: 5.0
      }
    });

    console.log(`✅ Updated member ${member.memberNo} with referral code and incentive settings`);
    console.log(`\n🌐 You can now test in browser with member ID: ${member.id}`);
    console.log(`📋 Member No: ${member.memberNo}`);

  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixExistingMemberReferral();