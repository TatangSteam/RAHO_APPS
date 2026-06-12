/**
 * Check dr. Citra Wijaya's branch assignments
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking dr. Citra Wijaya assignments...\n');

  // Find dr. Citra Wijaya
  const citra = await prisma.user.findFirst({
    where: {
      profile: {
        fullName: {
          contains: 'Citra Wijaya'
        }
      }
    },
    include: {
      profile: true,
      branch: true,
      staffBranches: {
        include: {
          branch: true
        }
      }
    }
  });

  if (!citra) {
    console.log('❌ dr. Citra Wijaya not found');
    return;
  }

  console.log('👨‍⚕️  dr. Citra Wijaya:');
  console.log(`   ID: ${citra.id}`);
  console.log(`   Email: ${citra.email}`);
  console.log(`   Staff Code: ${citra.staffCode}`);
  console.log(`   Primary Branch: ${citra.branch?.name} (${citra.branch?.branchCode})`);
  console.log('');

  console.log('📍 Assigned Branches (StaffBranch table):');
  if (citra.staffBranches.length === 0) {
    console.log('   ❌ No branch assignments found');
  } else {
    citra.staffBranches.forEach((sb, i) => {
      console.log(`   ${i + 1}. ${sb.branch.name} (${sb.branch.branchCode}) - ID: ${sb.branch.id}`);
    });
  }
  console.log('');

  // Check if assigned to Bandung
  const bandung = await prisma.branch.findFirst({
    where: {
      OR: [
        { branchCode: 'BDG' },
        { name: { contains: 'Bandung' } }
      ]
    }
  });

  if (bandung) {
    console.log(`🏥 Bandung Branch: ${bandung.name} (${bandung.branchCode})`);
    console.log(`   ID: ${bandung.id}`);
    
    const isAssigned = citra.staffBranches.some(sb => sb.branchId === bandung.id);
    console.log(`   Is dr. Citra assigned to Bandung? ${isAssigned ? '✅ YES' : '❌ NO'}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
