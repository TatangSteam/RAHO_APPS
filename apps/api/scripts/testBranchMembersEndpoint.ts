import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testEndpoint() {
  console.log('🧪 Testing branch members endpoint logic...\n');

  // Get first branch
  const branch = await prisma.branch.findFirst({
    where: { branchCode: 'SBY' },
  });

  if (!branch) {
    console.log('❌ No branch found');
    return;
  }

  console.log(`📍 Testing with branch: ${branch.name} (${branch.id})\n`);

  // Simulate the service call
  const where = {
    registrationBranchId: branch.id,
  };

  const members = await prisma.member.findMany({
    where,
    include: {
      user: {
        include: {
          profile: true,
        },
      },
      registrationBranch: true,
    },
    take: 5,
  });

  console.log(`✅ Found ${members.length} members:`);
  members.forEach((m) => {
    console.log(`  - ${m.memberNo}: ${m.user.profile?.fullName} (Branch: ${m.registrationBranch.name})`);
  });

  // Test the actual service
  console.log('\n🔧 Testing actual service method...');
  const { MembersService } = await import('../src/modules/members/members.service');
  const service = new MembersService();
  
  const result = await service.getMembersByBranch(branch.id, {
    page: 1,
    limit: 100,
  });

  console.log(`\n📊 Service returned:`);
  console.log(`  - Total: ${result.pagination.total}`);
  console.log(`  - Members: ${result.members.length}`);
  if (result.members.length > 0) {
    console.log(`\n  First member:`);
    console.log(`    - Name: ${result.members[0].fullName}`);
    console.log(`    - Email: ${result.members[0].email}`);
    console.log(`    - Branch: ${result.members[0].registrationBranch}`);
  }
}

testEndpoint()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
