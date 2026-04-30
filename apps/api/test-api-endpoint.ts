/**
 * Test the member detail API endpoint directly
 */

async function testMemberDetailAPI() {
  const memberId = 'cmokukz4i00jpan3wpe8q2t3m'; // From previous test
  
  try {
    console.log('🌐 Testing member detail API endpoint...\n');
    
    // Make request to the API endpoint
    const response = await fetch(`http://localhost:4000/api/v1/members/${memberId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Using a test token - in real scenario you'd need a valid JWT
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log(`📡 Response Status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error Response: ${errorText}`);
      return;
    }
    
    const data = await response.json();
    
    console.log('\n📊 API Response:');
    console.log('================');
    console.log(JSON.stringify(data, null, 2));
    
    // Check if referral data is present
    if (data.success && data.data) {
      const member = data.data;
      console.log('\n🎁 Referral Information:');
      console.log('========================');
      console.log(`Referral Code ID: ${member.referralCodeId}`);
      console.log(`Referral Code: ${member.referralCode?.code || 'null'}`);
      console.log(`Referrer Name: ${member.referralCode?.referrerName || 'null'}`);
      console.log(`Referrer Type: ${member.referralCode?.referrerType || 'null'}`);
      console.log(`First Incentive: ${member.firstIncentiveType} - ${member.firstIncentiveValue}`);
      console.log(`Next Incentive: ${member.nextIncentiveType} - ${member.nextIncentiveValue}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testMemberDetailAPI();