import { PrismaClient, PackageType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Update all existing packages with proper product codes
 * This script generates product codes for packages that don't have them
 */

function generateProductCode(
  packageType: PackageType,
  totalSessions: number,
  serviceType?: string | null,
  boosterType?: string | null
): string {
  if (packageType === PackageType.BASIC) {
    // BASIC packages: TNB-P{sessions}-{serviceType}
    const sessionsCode = `P${totalSessions}`;
    const serviceCode = serviceType || 'HC';
    return `TNB-${sessionsCode}-${serviceCode}`;
  } else {
    // BOOSTER packages: BST-{boosterType}-P1-{serviceType}
    // Map Prisma enum to extended booster type
    let boosterCode = 'NO';
    if (boosterType === 'NO2') {
      boosterCode = 'NO';
    } else if (boosterType === 'HHO') {
      boosterCode = 'HHO';
    }
    const serviceCode = serviceType || 'HC';
    return `BST-${boosterCode}-P1-${serviceCode}`;
  }
}

async function updateProductCodes() {
  console.log('🔄 Starting product code update for all packages...\n');

  try {
    // Get all packages without product codes
    const packagesWithoutCode = await prisma.memberPackage.findMany({
      where: {
        OR: [
          { productCode: null },
          { productCode: '' }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`📦 Found ${packagesWithoutCode.length} packages without product codes\n`);

    let updated = 0;
    let skipped = 0;

    for (const pkg of packagesWithoutCode) {
      try {
        // Determine service type from package code or default to HC
        let serviceType = pkg.serviceType;
        
        if (!serviceType) {
          // Try to extract from package code
          const codeMatch = pkg.packageCode.match(/-(HC|PS|PTY|PDA|PHC)$/);
          if (codeMatch) {
            serviceType = codeMatch[1];
          } else {
            serviceType = 'HC'; // Default
          }
        }

        // Generate product code
        const productCode = generateProductCode(
          pkg.packageType,
          pkg.totalSessions,
          serviceType,
          pkg.boosterType
        );

        // Update package
        await prisma.memberPackage.update({
          where: { id: pkg.id },
          data: {
            productCode,
            serviceType
          }
        });

        console.log(`  ✅ ${pkg.packageCode} → ${productCode}`);
        updated++;
      } catch (error) {
        console.error(`  ❌ Failed to update ${pkg.packageCode}:`, error);
        skipped++;
      }
    }

    console.log(`\n✅ Update complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${packagesWithoutCode.length}`);

  } catch (error) {
    console.error('❌ Error updating product codes:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateProductCodes()
  .then(() => {
    console.log('\n🎉 Product code update completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Product code update failed:', error);
    process.exit(1);
  });
