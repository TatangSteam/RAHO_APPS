/**
 * Test creating a member with custom incentive settings
 */

import { PrismaClient } from '@prisma/client';
import { signAccessToken } from './src/lib/jwt';

const prisma = new PrismaClient();

async function testMemberWithCustomIncentive() {
  try {
    console.log('🧪 Testing member creation with custom incentive settings...\n');
    
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
    
    // Create member data with custom incentive settings
    const memberData = {
      fullName: 'Test Member Custom Incentive',
      phone: `081${Date.now().toString().slice(-9)}`,
      memberEmail: `testcustomincentive${Date.now()}@example.com`,
      memberPassword: 'password123',
      referralCodeId: referralCode.id,
      isConsentToPhoto: 'true',
      // Custom incentive settings
      firstIncentiveType: 'PERCENTAGE',
      firstIncentiveValue: '15', // 15% for first package (custom)
      nextIncentiveType: 'FIXED_AMOUNT',
      nextIncentiveValue: '75000' // Rp 75,000 for next packages (custom)
    };
    
    console.log('📝 Creating member with custom incentive settings...');
    console.log(`   First Package: ${memberData.firstIncentiveValue}%`);
    console.log(`   Next Packages: Rp ${Number(memberData.nextIncentiveValue).toLocaleString('id-ID')}`);
    
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
    
    console.log(`\n📡 Create Response Status: ${createResponse.status}`);
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log(`❌ Create Error: ${errorText}`);
      return;
    }
    
    const createData = await createResponse.json();
    console.log(`✅ Member created: ${createData.data.memberNo} (ID: ${createData.data.memberId})`);
    
    // Now get member detail to check if custom incentive settings are saved
    console.log('\n🔍 Checking member detail...');
    
    const detailResponse = await fetch(`http://localhost:4000/api/v1/members/${createData.data.memberId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!detailResponse.ok) {
      const errorText = await detailResponse.text();
      console.log(`❌ Detail Error: ${errorText}`);
      return;
    }
    
    const detailData = await detailResponse.json();
    const member = detailData.data;
    
    console.log('\n💰 Custom Incentive Settings:');
    console.log('==============================');
    console.log(`Member ID: ${member.memberId}`);
    console.log(`Member No: ${member.memberNo}`);
    console.log(`Full Name: ${member.profile?.fullName}`);
    console.log(`Referral Code: ${member.referralCode?.code} - ${member.referralCode?.referrerName}`);
    console.log(`\nFirst Package Incentive: ${member.firstIncentiveType} - ${member.firstIncentiveValue}`);
    console.log(`Next Package Incentive: ${member.nextIncentiveType} - ${member.nextIncentiveValue}`);
    
    // Verify custom values
    const firstMatch = member.firstIncentiveType === 'PERCENTAGE' && member.firstIncentiveValue === 15;
    const nextMatch = member.nextIncentiveType === 'FIXED_AMOUNT' && member.nextIncentiveValue === 75000;
    
    if (firstMatch && nextMatch) {
      console.log('\n🎉 SUCCESS! Custom incentive settings saved correctly!');
      console.log(`\n🌐 Test in browser with member ID: ${member.memberId}`);
      console.log(`📋 Member No: ${member.memberNo}`);
    } else {
      console.log('\n❌ FAILED! Custom incentive settings do not match.');
      console.log(`Expected: PERCENTAGE 15% and FIXED_AMOUNT Rp 75,000`);
      console.log(`Got: ${member.firstIncentiveType} ${member.firstIncentiveValue} and ${member.nextIncentiveType} ${member.nextIncentiveValue}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMemberWithCustomIncentive();