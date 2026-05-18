const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check ADMIN_LAYANAN users
  const adminLayanan = await prisma.user.findMany({
    where: { role: 'ADMIN_LAYANAN' },
    select: { 
      id: true, 
      email: true, 
      role: true, 
      branchId: true, 
      isActive: true,
      branch: { select: { branchCode: true, name: true } }
    }
  });
  
  console.log('=== ADMIN_LAYANAN Users ===');
  console.log(JSON.stringify(adminLayanan, null, 2));
  console.log('Total:', adminLayanan.length);
  
  // Check all staff for SBY branch
  const sbyBranch = await prisma.branch.findFirst({
    where: { branchCode: 'SBY' }
  });
  
  if (sbyBranch) {
    console.log('\n=== Staff in SBY Branch ===');
    const sbyStaff = await prisma.user.findMany({
      where: { 
        branchId: sbyBranch.id,
        isActive: true,
        NOT: { role: { in: ['MEMBER', 'ADMIN_MANAGER'] } }
      },
      select: {
        email: true,
        role: true,
        isActive: true
      }
    });
    console.log(JSON.stringify(sbyStaff, null, 2));
    console.log('Total:', sbyStaff.length);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
