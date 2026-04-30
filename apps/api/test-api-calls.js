async function testAPIFiltering() {
  console.log('🧪 Testing Branch Filtering via API...\n');

  const baseURL = 'http://localhost:4000/api/v1';

  // Test login for manager1
  console.log('🔐 Testing Manager 1 Login...');
  const manager1Login = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'manager1@raho.id',
      password: 'Manager@123'
    })
  });

  if (!manager1Login.ok) {
    console.log('❌ Manager 1 login failed:', await manager1Login.text());
    return;
  }

  const manager1Data = await manager1Login.json();
  const manager1Token = manager1Data.data.token;
  console.log('✅ Manager 1 logged in successfully');

  // Test branches for manager1
  console.log('\n📋 Fetching branches for Manager 1...');
  const manager1Branches = await fetch(`${baseURL}/branches?page=1&limit=10`, {
    headers: { 'Authorization': `Bearer ${manager1Token}` }
  });

  if (manager1Branches.ok) {
    const manager1BranchData = await manager1Branches.json();
    console.log(`  Found ${manager1BranchData.data.length} branches:`);
    for (const branch of manager1BranchData.data) {
      console.log(`    ✅ ${branch.branchCode} - ${branch.name}`);
    }
  } else {
    console.log('❌ Failed to fetch branches for Manager 1:', await manager1Branches.text());
  }

  // Test login for manager2
  console.log('\n🔐 Testing Manager 2 Login...');
  const manager2Login = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'manager2@raho.id',
      password: 'Manager@123'
    })
  });

  if (!manager2Login.ok) {
    console.log('❌ Manager 2 login failed:', await manager2Login.text());
    return;
  }

  const manager2Data = await manager2Login.json();
  const manager2Token = manager2Data.data.token;
  console.log('✅ Manager 2 logged in successfully');

  // Test branches for manager2
  console.log('\n📋 Fetching branches for Manager 2...');
  const manager2Branches = await fetch(`${baseURL}/branches?page=1&limit=10`, {
    headers: { 'Authorization': `Bearer ${manager2Token}` }
  });

  if (manager2Branches.ok) {
    const manager2BranchData = await manager2Branches.json();
    console.log(`  Found ${manager2BranchData.data.length} branches:`);
    for (const branch of manager2BranchData.data) {
      console.log(`    ✅ ${branch.branchCode} - ${branch.name}`);
    }
  } else {
    console.log('❌ Failed to fetch branches for Manager 2:', await manager2Branches.text());
  }

  // Test SUPER_ADMIN
  console.log('\n🔐 Testing SUPER_ADMIN Login...');
  const superAdminLogin = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@raho.id',
      password: 'SuperAdmin@123'
    })
  });

  if (!superAdminLogin.ok) {
    console.log('❌ SUPER_ADMIN login failed:', await superAdminLogin.text());
    return;
  }

  const superAdminData = await superAdminLogin.json();
  const superAdminToken = superAdminData.data.token;
  console.log('✅ SUPER_ADMIN logged in successfully');

  // Test branches for SUPER_ADMIN
  console.log('\n📋 Fetching branches for SUPER_ADMIN...');
  const superAdminBranches = await fetch(`${baseURL}/branches?page=1&limit=10`, {
    headers: { 'Authorization': `Bearer ${superAdminToken}` }
  });

  if (superAdminBranches.ok) {
    const superAdminBranchData = await superAdminBranches.json();
    console.log(`  Found ${superAdminBranchData.data.length} branches:`);
    for (const branch of superAdminBranchData.data) {
      console.log(`    ✅ ${branch.branchCode} - ${branch.name}`);
    }
  } else {
    console.log('❌ Failed to fetch branches for SUPER_ADMIN:', await superAdminBranches.text());
  }
}

testAPIFiltering().catch(console.error);