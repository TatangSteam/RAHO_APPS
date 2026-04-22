import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCrossBranchAccess() {
  console.log('🧪 Testing Cross-Branch Access Feature\n');

  // 1. Get branches
  const branches = await prisma.branch.findMany({
    orderBy: { branchCode: 'asc' },
  });

  console.log('📍 Available Branches:');
  branches.forEach((b) => {
    console.log(`   - ${b.branchCode}: ${b.name}`);
  });

  // 2. Get a member from PST
  const pstBranch = branches.find((b) => b.branchCode === 'PST');
  if (!pstBranch) {
    console.log('\n❌ PST branch not found');
    return;
  }

  const pstMember = await prisma.member.findFirst({
    where: {
      registrationBranchId: pstBranch.id,
    },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
      branchAccesses: {
        include: {
          branch: true,
        },
      },
    },
  });

  if (!pstMember) {
    console.log('\n❌ No member found in PST branch');
    return;
  }

  console.log(`\n👤 Test Member: ${pstMember.memberNo} - ${pstMember.user.profile?.fullName}`);
  console.log(`   Registration Branch: PST`);

  // 3. Check current cross-branch access
  console.log(`\n🔗 Current Cross-Branch Access:`);
  if (pstMember.branchAccesses.length === 0) {
    console.log('   ❌ No cross-branch access');
  } else {
    pstMember.branchAccesses.forEach((access) => {
      console.log(`   ✅ ${access.branch.name} (granted at ${access.grantedAt.toLocaleDateString()})`);
    });
  }

  // 4. Test: Can BDG staff see this member?
  const bdgBranch = branches.find((b) => b.branchCode === 'BDG');
  if (!bdgBranch) {
    console.log('\n❌ BDG branch not found');
    return;
  }

  const canBdgSee = pstMember.branchAccesses.some((a) => a.branchId === bdgBranch.id);
  console.log(`\n🔍 Can BDG staff see this member?`);
  console.log(`   ${canBdgSee ? '✅ YES' : '❌ NO'}`);

  // 5. Simulate grant access to BDG
  if (!canBdgSee) {
    console.log(`\n📝 Simulating grant access to BDG...`);
    
    const existingAccess = await prisma.branchMemberAccess.findFirst({
      where: {
        memberId: pstMember.id,
        branchId: bdgBranch.id,
      },
    });

    if (!existingAccess) {
      await prisma.branchMemberAccess.create({
        data: {
          memberId: pstMember.id,
          branchId: bdgBranch.id,
          grantedBy: 'system-test',
        },
      });
      console.log('   ✅ Access granted to BDG');
    } else {
      console.log('   ℹ️  Access already exists');
    }
  }

  // 6. Verify access
  const updatedMember = await prisma.member.findUnique({
    where: { id: pstMember.id },
    include: {
      branchAccesses: {
        include: {
          branch: true,
        },
      },
    },
  });

  console.log(`\n✅ Final Cross-Branch Access:`);
  updatedMember?.branchAccesses.forEach((access) => {
    console.log(`   - ${access.branch.name} (${access.branch.branchCode})`);
  });

  // 7. Test query from BDG perspective
  console.log(`\n🔍 Testing query from BDG staff perspective...`);
  
  const membersVisibleToBdg = await prisma.member.findMany({
    where: {
      OR: [
        { registrationBranchId: bdgBranch.id },
        { branchAccesses: { some: { branchId: bdgBranch.id } } },
      ],
    },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
      registrationBranch: true,
    },
  });

  console.log(`   Total members visible to BDG: ${membersVisibleToBdg.length}`);
  
  const crossBranchMembers = membersVisibleToBdg.filter(
    (m) => m.registrationBranchId !== bdgBranch.id
  );
  
  console.log(`   Cross-branch members: ${crossBranchMembers.length}`);
  crossBranchMembers.forEach((m) => {
    console.log(`   - ${m.memberNo} (from ${m.registrationBranch.name})`);
  });

  console.log('\n✅ Cross-branch access test completed!');

  await prisma.$disconnect();
}

testCrossBranchAccess().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
