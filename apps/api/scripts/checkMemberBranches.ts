import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMemberBranches() {
  console.log('🔍 Checking member distribution across branches...\n');

  // Get all branches
  const branches = await prisma.branch.findMany({
    select: {
      id: true,
      branchCode: true,
      name: true,
    },
  });

  console.log('📍 Branches:');
  branches.forEach((b) => {
    console.log(`  - ${b.branchCode}: ${b.name} (ID: ${b.id})`);
  });

  console.log('\n👥 Members per branch:');

  for (const branch of branches) {
    const memberCount = await prisma.member.count({
      where: {
        registrationBranchId: branch.id,
      },
    });

    const members = await prisma.member.findMany({
      where: {
        registrationBranchId: branch.id,
      },
      select: {
        memberNo: true,
        user: {
          select: {
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
      take: 5,
    });

    console.log(`\n  ${branch.branchCode} (${branch.name}): ${memberCount} members`);
    if (members.length > 0) {
      members.forEach((m) => {
        console.log(`    - ${m.memberNo}: ${m.user.profile?.fullName}`);
      });
      if (memberCount > 5) {
        console.log(`    ... and ${memberCount - 5} more`);
      }
    }
  }

  // Check total members
  const totalMembers = await prisma.member.count();
  console.log(`\n📊 Total members in database: ${totalMembers}`);
}

checkMemberBranches()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
