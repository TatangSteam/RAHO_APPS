import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkManagerAssignments() {
  console.log('🔍 Checking Manager Branch Assignments...\n');

  // Get all managers
  const managers = await prisma.user.findMany({
    where: { role: 'ADMIN_MANAGER' },
    select: {
      id: true,
      email: true,
      profile: {
        select: { fullName: true }
      }
    }
  });

  console.log('👥 Managers found:', managers.length);
  for (const manager of managers) {
    console.log(`  - ${manager.email} (${manager.profile?.fullName})`);
  }

  // Get all manager branch assignments
  const assignments = await prisma.managerBranch.findMany({
    include: {
      user: {
        select: {
          email: true,
          profile: { select: { fullName: true } }
        }
      },
      branch: {
        select: {
          branchCode: true,
          name: true
        }
      }
    }
  });

  console.log('\n🔗 Manager Branch Assignments:', assignments.length);
  for (const assignment of assignments) {
    console.log(`  - ${assignment.user.email} → ${assignment.branch.branchCode} (${assignment.branch.name})`);
  }

  // Test filtering for each manager
  console.log('\n🧪 Testing Branch Filtering...');
  for (const manager of managers) {
    const branches = await prisma.branch.findMany({
      where: {
        managerBranches: {
          some: {
            userId: manager.id
          }
        }
      },
      select: {
        branchCode: true,
        name: true
      }
    });

    console.log(`\n📋 Branches for ${manager.email}:`);
    if (branches.length === 0) {
      console.log('  ❌ No branches assigned');
    } else {
      for (const branch of branches) {
        console.log(`  ✅ ${branch.branchCode} - ${branch.name}`);
      }
    }
  }

  await prisma.$disconnect();
}

checkManagerAssignments().catch(console.error);