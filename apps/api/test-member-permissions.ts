import { prisma } from './src/lib/prisma';

async function testMemberPermissions() {
  try {
    // Get a sample member to test with
    const member = await prisma.member.findFirst({
      select: {
        id: true,
        memberNo: true,
        user: {
          select: {
            email: true,
            profile: {
              select: {
                fullName: true
              }
            }
          }
        },
        registrationBranchId: true,
        registrationBranch: {
          select: {
            name: true,
            branchCode: true
          }
        }
      }
    });

    if (!member) {
      console.log('❌ No members found');
      return;
    }

    console.log('🔍 Sample Member for Testing:');
    console.log(`- ID: ${member.id}`);
    console.log(`- Member No: ${member.memberNo}`);
    console.log(`- Name: ${member.user.profile?.fullName}`);
    console.log(`- Email: ${member.user.email}`);
    console.log(`- Registration Branch: ${member.registrationBranch?.name} (${member.registrationBranch?.branchCode})`);
    console.log(`- Registration Branch ID: ${member.registrationBranchId}`);
    console.log('');

    // Check which users can access this member
    console.log('🔐 Users who can access this member:');
    
    // SUPER_ADMIN and ADMIN_MANAGER can access all members
    const globalUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['SUPER_ADMIN', 'ADMIN_MANAGER']
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        profile: {
          select: {
            fullName: true
          }
        }
      }
    });

    globalUsers.forEach(user => {
      console.log(`✅ ${user.profile?.fullName} (${user.email}) - ${user.role} - Global Access`);
    });

    // Users from the same branch
    const branchUsers = await prisma.user.findMany({
      where: {
        branchId: member.registrationBranchId,
        NOT: {
          role: 'MEMBER'
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        profile: {
          select: {
            fullName: true
          }
        }
      }
    });

    branchUsers.forEach(user => {
      console.log(`✅ ${user.profile?.fullName} (${user.email}) - ${user.role} - Branch Access`);
    });

    // Check branch access grants
    const branchAccesses = await prisma.branchMemberAccess.findMany({
      where: {
        memberId: member.id
      },
      include: {
        branch: {
          select: {
            name: true,
            branchCode: true
          }
        }
      }
    });

    if (branchAccesses.length > 0) {
      console.log('');
      console.log('🔑 Additional Branch Access Grants:');
      branchAccesses.forEach(access => {
        console.log(`- Branch: ${access.branch.name} (${access.branch.branchCode})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMemberPermissions();