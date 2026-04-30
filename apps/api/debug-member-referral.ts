/**
 * Debug script to check member referral data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugMemberReferral() {
  try {
    console.log('🔍 Debugging member referral data...\n');

    // Find the member from the screenshot (asdsds)
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
        referralCode: true
      }
    });

    if (!member) {
      console.log('❌ Member "asdsds" not found');
      
      // Let's check all recent members
      console.log('\n📋 Recent members:');
      const recentMembers = await prisma.member.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: { profile: true }
          },
          referralCode: true
        }
      });

      recentMembers.forEach(m => {
        console.log(`- ${m.memberNo}: ${m.user.profile?.fullName} | Referral: ${m.referralCode?.code || 'None'}`);
      });
      
      return;
    }

    console.log(`📋 Found member: ${member.memberNo} - ${member.user.profile?.fullName}`);
    console.log(`Member ID: ${member.id}`);
    console.log(`Referral Code ID: ${member.referralCodeId}`);
    
    if (member.referralCode) {
      console.log(`✅ Referral Code: ${member.referralCode.code}`);
      console.log(`✅ Referrer Name: ${member.referralCode.referrerName}`);
      console.log(`✅ Referrer Type: ${member.referralCode.referrerType}`);
    } else {
      console.log('❌ No referral code assigned');
    }
    
    console.log(`First Incentive: ${member.firstIncentiveType} - ${member.firstIncentiveValue}`);
    console.log(`Next Incentive: ${member.nextIncentiveType} - ${member.nextIncentiveValue}`);

    // Test API call
    console.log('\n🌐 Testing API call...');
    const { MemberRetrievalService } = await import('./src/modules/members/services/member-retrieval.service');
    const service = new MemberRetrievalService();
    
    try {
      const apiResult = await service.getMemberById(member.id);
      console.log('\n📊 API Service Result:');
      console.log(`Referral Code ID: ${apiResult.referralCodeId}`);
      console.log(`Referral Code: ${apiResult.referralCode?.code || 'null'}`);
      console.log(`First Incentive: ${apiResult.firstIncentiveType} - ${apiResult.firstIncentiveValue}`);
    } catch (error) {
      console.error('❌ API Service Error:', error);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugMemberReferral();