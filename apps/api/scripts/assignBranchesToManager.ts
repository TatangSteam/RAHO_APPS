import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Assigning existing branches to Admin Manager...');

  // Get Admin Manager user
  const adminManager = await prisma.user.findUnique({
    where: { email: 'manager@raho.id' },
  });

  if (!adminManager) {
    console.error('❌ Admin Manager not found!');
    console.log('Please run seed first: npx prisma db seed');
    return;
  }

  console.log(`✅ Found Admin Manager: ${adminManager.email} (${adminManager.id})`);

  // Update all branches without createdBy
  const result = await prisma.branch.updateMany({
    where: {
      createdBy: null,
    },
    data: {
      createdBy: adminManager.id,
    },
  });

  console.log(`✅ Updated ${result.count} branches`);

  // Show updated branches
  const branches = await prisma.branch.findMany({
    where: {
      createdBy: adminManager.id,
    },
    select: {
      branchCode: true,
      name: true,
      type: true,
    },
  });

  console.log('\n📋 Branches now owned by Admin Manager:');
  branches.forEach((branch) => {
    console.log(`   - ${branch.branchCode}: ${branch.name} (${branch.type})`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
