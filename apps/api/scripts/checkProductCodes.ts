import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProductCodes() {
  console.log('🔍 Checking product codes in database...\n');

  try {
    // Get all packages
    const allPackages = await prisma.memberPackage.findMany({
      select: {
        id: true,
        packageCode: true,
        productCode: true,
        packageType: true,
        totalSessions: true,
        serviceType: true,
        boosterType: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`📦 Total packages in database: ${allPackages.length}\n`);

    if (allPackages.length === 0) {
      console.log('⚠️  No packages found in database. Run seed first!');
      return;
    }

    console.log('Recent packages:');
    allPackages.forEach((pkg, index) => {
      console.log(`\n${index + 1}. ${pkg.packageCode}`);
      console.log(`   Type: ${pkg.packageType}`);
      console.log(`   Sessions: ${pkg.totalSessions}`);
      console.log(`   Service Type: ${pkg.serviceType || 'NULL'}`);
      console.log(`   Booster Type: ${pkg.boosterType || 'NULL'}`);
      console.log(`   Product Code: ${pkg.productCode || '❌ MISSING'}`);
    });

    // Count packages without product codes
    const withoutCode = allPackages.filter(p => !p.productCode || p.productCode === '');
    console.log(`\n📊 Summary:`);
    console.log(`   Total: ${allPackages.length}`);
    console.log(`   With product code: ${allPackages.length - withoutCode.length}`);
    console.log(`   Without product code: ${withoutCode.length}`);

  } catch (error) {
    console.error('❌ Error checking product codes:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkProductCodes()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error);
    process.exit(1);
  });
