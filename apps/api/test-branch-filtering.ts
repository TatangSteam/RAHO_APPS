import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function testBranchFiltering() {
  console.log('🧪 Testing Branch Filtering API...\n');

  // Get managers
  const manager1 = await prisma.user.findUnique({
    where: { email: 'manager1@raho.id' },
    select: { id: true, email: true, role: true }
  });

  const manager2 = await prisma.user.findUnique({
    where: { email: 'manager2@raho.id' },
    select: { id: true, email: true, role: true }
  });

  if (!manager1 || !manager2) {
    console.log('❌ Managers not found');
    return;
  }

  // Import the service function
  const branchService = await import('./src/modules/branches/branches.service');

  // Test Manager 1 filtering
  console.log('📋 Testing Manager 1 (manager1@raho.id)...');
  const manager1Branches = await branchService.listBranchesService(
    { page: 1, limit: 10 },
    manager1.id,
    manager1.role
  );

  console.log(`  Found ${manager1Branches.branches.length} branches:`);
  for (const branch of manager1Branches.branches) {
    console.log(`    ✅ ${branch.branchCode} - ${branch.name}`);
  }

  // Test Manager 2 filtering
  console.log('\n📋 Testing Manager 2 (manager2@raho.id)...');
  const manager2Branches = await branchService.listBranchesService(
    { page: 1, limit: 10 },
    manager2.id,
    manager2.role
  );

  console.log(`  Found ${manager2Branches.branches.length} branches:`);
  for (const branch of manager2Branches.branches) {
    console.log(`    ✅ ${branch.branchCode} - ${branch.name}`);
  }

  // Test SUPER_ADMIN (should see all branches)
  const superAdmin = await prisma.user.findUnique({
    where: { email: 'superadmin@raho.id' },
    select: { id: true, email: true, role: true }
  });

  if (superAdmin) {
    console.log('\n📋 Testing SUPER_ADMIN (superadmin@raho.id)...');
    const allBranches = await branchService.listBranchesService(
      { page: 1, limit: 10 },
      superAdmin.id,
      superAdmin.role
    );

    console.log(`  Found ${allBranches.branches.length} branches:`);
    for (const branch of allBranches.branches) {
      console.log(`    ✅ ${branch.branchCode} - ${branch.name}`);
    }
  }

  await prisma.$disconnect();
}

testBranchFiltering().catch(console.error);