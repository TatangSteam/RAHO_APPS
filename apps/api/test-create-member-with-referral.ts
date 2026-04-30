/**
 * Test creating a member with referral code and checking if it appears in member detail
 */

import { PrismaClient } from '@prisma/client';
import { signAccessToken } from './src/lib/jwt';

const prisma = new PrismaClient();

async function testCreateMemberWithReferral() {
  try {
    console.log('🧪 Testing member creation with referral code...\n');
    
    // Get an admin cabang user for authentication
    const adminCabang = await prisma.user.findFirst({
      where: { 
        role: 'ADMIN_CABANG',
        isActive: true,
        branchId: { not: null }
      },
      include: {
        profile: true,
        branch: true
      }
    });
    
    if (!adminCabang) {
      console.log('❌ No admin cabang user found');
      return;
    }
    
    console.log(`👤 Using admin: ${adminCabang.email} (Branch: ${adminCabang.branch?.name})`);
    
    // Get a referral code from the same branch
    const referralCode = await prisma.referralCode.findFirst({
      where: { 
        isActive: true,
        branchId: adminCabang.branchId
      }
    });
    
    if (!referralCode) {
      console.log('❌ No active referral code found for this branch');
      return;
    }
    
    console.log(`🎁 Using referral code: ${referralCode.code} - ${referralCode.referrerName}`);
    
    // Generate a valid JWT token
    const token = signAccessToken({
      userId: adminCabang.id,
      email: adminCabang.email,
      role: adminCabang.role,
      branchId: adminCabang.branchId,
      branchCode: adminCabang.branch?.branchCode || null,
      fullName: adminCabang.profile?.fullName || adminCabang.email,
      staffCode: adminCabang.staffCode
    });
    
    // Create member data
    const memberData = {
      fullName: 'Test Member Referral',
      phone: `081${Date.now().toString().slice(-9)}`, // Generate unique phone number
      memberEmail: `testmemberreferral${Date.now()}@example.com`, // Generate unique email
      memberPassword: 'password123',
      referralCodeId: referralCode.id,
      isConsentToPhoto: true
    };
    
    console.log('📝 Creating member with referral...');
    
    // Create FormData
    const formData = new FormData();
    Object.entries(memberData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, typeof value === 'boolean' ? String(value) : value);
      }
    });
    
    // Make API call to create member
    const createResponse = await fetch('http://localhost:4000/api/v1/members', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    console.log(`📡 Create Response Status: ${createResponse.status}`);
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log(`❌ Create Error: ${errorText}`);
      return;
    }
    
    const createData = await createResponse.json();
    console.log(`✅ Member created: ${createData.data.memberNo} (ID: ${createData.data.memberId})`);
    
    // Now get member detail to check if referral data is present
    console.log('\n🔍 Checking member detail...');
    
    const detailResponse = await fetch(`http://localhost:4000/api/v1/members/${createData.data.memberId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📡 Detail Response Status: ${detailResponse.status}`);
    
    if (!detailResponse.ok) {
      const errorText = await detailResponse.text();
      console.log(`❌ Detail Error: ${errorText}`);
      return;
    }
    
    const detailData = await detailResponse.json();
    const member = detailData.data;
    
    console.log('\n🎁 Referral Information in Detail:');
    console.log('==================================');
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
    
    console.log(`First Incentive: ${member.firstIncentiveType} - ${member.firstIncentiveValue}`);
    console.log(`Next Incentive: ${member.nextIncentiveType} - ${member.nextIncentiveValue}`);
    
    if (member.referralCode && member.firstIncentiveType) {
      console.log('\n🎉 SUCCESS! Member created with referral code and incentive settings!');
      console.log(`\n🌐 You can now test in browser with member ID: ${member.memberId}`);
      console.log(`📋 Member No: ${member.memberNo}`);
    } else {
      console.log('\n❌ FAILED! Referral code or incentive settings are missing.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreateMemberWithReferral();