import { prisma } from './src/lib/prisma';

async function testUserRole() {
  try {
    // Get all users to see their roles
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        staffCode: true,
        branchId: true,
        profile: {
          select: {
            fullName: true
          }
        },
        branch: {
          select: {
            name: true,
            branchCode: true
          }
        }
      },
      where: {
        NOT: {
          role: 'MEMBER'
        }
      }
    });

    console.log('🔍 All Staff Users:');
    users.forEach(user => {
      console.log(`- ${user.profile?.fullName || 'No Name'} (${user.email})`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Staff Code: ${user.staffCode}`);
      console.log(`  Branch: ${user.branch?.name || 'No Branch'} (${user.branch?.branchCode || 'N/A'})`);
      console.log(`  Branch ID: ${user.branchId || 'No Branch ID'}`);
      console.log('');
    });

    // Check specific roles
    const adminManagers = users.filter(u => u.role === 'ADMIN_MANAGER');
    console.log(`📊 Found ${adminManagers.length} ADMIN_MANAGER users`);
    
    const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN');
    console.log(`📊 Found ${superAdmins.length} SUPER_ADMIN users`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUserRole();