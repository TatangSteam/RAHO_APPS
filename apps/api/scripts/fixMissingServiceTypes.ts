import { PrismaClient, PackageType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fix packages with missing serviceType
 * Extract serviceType from packageCode or default to HC
 */

function extractServiceTypeFromCode(packageCode: string): string {
  // Try to extract service type from package code
  // Format: PKG-{branch}-{type}-{date}-{random}
  // Some old codes might have service type at the end
  const match = packageCode.match(/-(HC|PS|PTY|PDA|PHC)$/);
  if (match) {
    return match[1];
  }
  
  // Default to HC (Homecare)
  return 'HC';
}

function generateProductCode(
  packageType: PackageType,
  totalSessions: number,
  serviceType: string,
  boosterType?: string | null
): string {
  if (packageType === PackageType.BASIC) {
    // BASIC packages: TNB-P{sessions}-{serviceType}
    const sessionsCode = `P${totalSessions}`;
    return `TNB-${sessionsCode}-${serviceType}`;
  } else {
    // BOOSTER packages: BST-{boosterType}-P1-{serviceType}
    // Map Prisma enum to extended booster type
    let boosterCode = 'NO';
    if (boosterType === 'NO2') {
      boosterCode = 'NO';
    } else if (boosterType === 'HHO') {
      boosterCode = 'HHO';
    }
    return `BST-${boosterCode}-P1-${serviceType}`;
  }
}

async function fixMissingServiceTypes() {
  console.log('🔄 Fixing packages with missing service types...\n');

  try {
    // Get all packages with NULL serviceType
    const packagesWithoutServiceType = await prisma.memberPackage.findMany({
      where: {
        OR: [
          { serviceType: null },
          { serviceType: '' }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`📦 Found ${packagesWithoutServiceType.length} packages without service type\n`);

    let updated = 0;
    let skipped = 0;

    for (const pkg of packagesWithoutServiceType) {
      try {
        // Extract or default service type
        const serviceType = extractServiceTypeFromCode(pkg.packageCode);

        // Regenerate product code with correct service type
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
            serviceType,
            productCode
          }
        });

        console.log(`  ✅ ${pkg.packageCode}`);
        console.log(`     Service Type: NULL → ${serviceType}`);
        console.log(`     Product Code: ${pkg.productCode} → ${productCode}`);
        updated++;
      } catch (error) {
        console.error(`  ❌ Failed to update ${pkg.packageCode}:`, error);
        skipped++;
      }
    }

    console.log(`\n✅ Update complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${packagesWithoutServiceType.length}`);

  } catch (error) {
    console.error('❌ Error fixing service types:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixMissingServiceTypes()
  .then(() => {
    console.log('\n🎉 Service type fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Service type fix failed:', error);
    process.exit(1);
  });
