/**
 * Check Admin Manager's managed branches
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking Admin Manager Branches\n');

  // Get all admin managers
  const adminManagers = await prisma.user.findMany({
    where: {
      role: 'ADMIN_MANAGER',
      isActive: true
    },
    include: {
      profile: true,
      branch: true,
      managedBranches: {
        include: {
          branch: true
        }
      }
    }
  });

  if (adminManagers.length === 0) {
    console.log('❌ No Admin Managers found\n');
    return;
  }

  console.log(`Found ${adminManagers.length} Admin Manager(s):\n`);

  for (const manager of adminManagers) {
    console.log(`👤 ${manager.profile?.fullName || 'No Name'}`);
    console.log(`   Email: ${manager.email}`);
    console.log(`   Staff Code: ${manager.staffCode}`);
    console.log(`   Primary Branch: ${manager.branch?.name || 'None'} (${manager.branch?.branchCode || 'N/A'})`);
    console.log(`   Managed Branches (${manager.managedBranches.length}):`);
    
    if (manager.managedBranches.length === 0) {
      console.log('      ❌ No managed branches assigned!');
      console.log('      ⚠️  This Admin Manager cannot see any branches!');
    } else {
      manager.managedBranches.forEach(mb => {
        console.log(`      - ${mb.branch.name} (${mb.branch.branchCode})`);
      });
    }
    console.log('');
  }

  // Check if PST branch has an admin manager
  const pstBranch = await prisma.branch.findFirst({
    where: { branchCode: 'PST' },
    include: {
      managerBranches: {
        include: {
          user: {
            include: {
              profile: true
            }
          }
        }
      }
    }
  });

  if (pstBranch) {
    console.log(`\n📍 PST (Jakarta) Branch Managers:`);
    if (pstBranch.managerBranches.length === 0) {
      console.log('   ❌ No managers assigned to PST branch');
    } else {
      pstBranch.managerBranches.forEach(m => {
        console.log(`   - ${m.user.profile?.fullName} (${m.user.email})`);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Solution:');
  console.log('Admin Managers need to have managed branches assigned via ManagerBranch table.');
  console.log('Without managed branches, they cannot see any branch data!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
