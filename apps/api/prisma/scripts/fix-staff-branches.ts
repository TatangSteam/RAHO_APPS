/**
 * Script to fix missing StaffBranch records for DOCTOR and NURSE users
 * 
 * This script finds all DOCTOR and NURSE users who have a branchId but don't have
 * a corresponding StaffBranch record, and creates the missing records.
 * 
 * Run with: npx ts-node prisma/scripts/fix-staff-branches.ts
 */

import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding DOCTOR and NURSE users without StaffBranch records...\n');

  // Find all DOCTOR and NURSE users with branchId
  const staffUsers = await prisma.user.findMany({
    where: {
      role: { in: [Role.DOCTOR, Role.NURSE] },
      branchId: { not: null },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
      branchId: true,
      staffCode: true,
      profile: {
        select: { fullName: true },
      },
      staffBranches: {
        select: { branchId: true },
      },
    },
  });

  console.log(`Found ${staffUsers.length} active DOCTOR/NURSE users with branchId\n`);

  let created = 0;
  let skipped = 0;

  for (const user of staffUsers) {
    // Check if StaffBranch already exists for this user's branchId
    const hasStaffBranch = user.staffBranches.some(
      (sb) => sb.branchId === user.branchId
    );

    if (hasStaffBranch) {
      console.log(`⏭️  Skipping ${user.profile?.fullName || user.email} (${user.role}) - already has StaffBranch`);
      skipped++;
      continue;
    }

    // Create StaffBranch record
    try {
      await prisma.staffBranch.create({
        data: {
          userId: user.id,
          branchId: user.branchId!,
        },
      });
      console.log(`✅ Created StaffBranch for ${user.profile?.fullName || user.email} (${user.role}) - Branch: ${user.branchId}`);
      created++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation - record already exists
        console.log(`⏭️  Skipping ${user.profile?.fullName || user.email} - StaffBranch already exists`);
        skipped++;
      } else {
        console.error(`❌ Error creating StaffBranch for ${user.email}:`, error.message);
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total processed: ${staffUsers.length}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
