/**
 * Test the member detail API endpoint with proper authentication
 */

import { PrismaClient } from '@prisma/client';
import { signAccessToken } from './src/lib/jwt';

const prisma = new PrismaClient();

async function testMemberDetailAPIWithAuth() {
  const memberId = 'cmokukz4i00jpan3wpe8q2t3m'; // From previous test
  
  try {
    console.log('🔐 Generating authentication token...\n');
    
    // Get a super admin user for testing
    const superAdmin = await prisma.user.findFirst({
      where: { 
        role: 'SUPER_ADMIN',
        isActive: true 
      },
      include: {
        profile: true
      }
    });
    
    if (!superAdmin) {
      console.log('❌ No super admin user found');
      return;
    }
    
    console.log(`👤 Using user: ${superAdmin.email}`);
    
    // Generate a valid JWT token
    const token = signAccessToken({
      userId: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role,
      branchId: superAdmin.branchId,
      branchCode: null,
      fullName: superAdmin.profile?.fullName || superAdmin.email,
      staffCode: superAdmin.staffCode
    });
    
    console.log(`🎫 Generated token: ${token.substring(0, 50)}...`);
    
    console.log('\n🌐 Testing member detail API endpoint...\n');
    
    // Make request to the API endpoint
    const response = await fetch(`http://localhost:4000/api/v1/members/${memberId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`📡 Response Status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error Response: ${errorText}`);
      return;
    }
    
    const data = await response.json();
    
    console.log('\n📊 Full API Response:');
    console.log('=====================');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n📊 API Response Structure:');
    console.log('==========================');
    console.log(`Success: ${data.success}`);
    console.log(`Data keys: ${Object.keys(data.data || {}).join(', ')}`);
    
    // Check if referral data is present
    if (data.success && data.data) {
      const member = data.data;
      console.log('\n🎁 Referral Information:');
      console.log('========================');
      console.log(`Member ID: ${member.memberId}`);
      console.log(`Member No: ${member.memberNo}`);
      console.log(`Full Name: ${member.profile?.fullName}`);
      console.log(`Referral Code ID: ${member.referralCodeId}`);
      
      if (member.referralCode) {
        console.log(`✅ Referral Code: ${member.referralCode.code}`);
        console.log(`✅ Referrer Name: ${member.referralCode.referrerName}`);
        console.log(`✅ Referrer Type: ${member.referralCode.referrerType}`);
      } else {
        console.log(`❌ Referral Code: null`);
      }
      
      console.log(`First Incentive Type: ${member.firstIncentiveType}`);
      console.log(`First Incentive Value: ${member.firstIncentiveValue}`);
      console.log(`Next Incentive Type: ${member.nextIncentiveType}`);
      console.log(`Next Incentive Value: ${member.nextIncentiveValue}`);
      
      console.log('\n✅ Test completed successfully!');
      
      if (member.referralCode) {
        console.log('\n🎉 REFERRAL DATA IS WORKING! The API is returning referral information correctly.');
        console.log('The issue might be in the frontend component or data loading.');
      } else {
        console.log('\n❌ REFERRAL DATA IS MISSING! The API is not returning referral information.');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testMemberDetailAPIWithAuth();