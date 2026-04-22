/**
 * Script to update productCode for existing packages
 * Run with: npx tsx scripts/updateProductCodes.ts
 */

import { PrismaClient, PackageType } from '@prisma/client';

const prisma = new PrismaClient();

function generateProductCode(
  packageType: PackageType,
  totalSessions: number,
  serviceType?: string | null,
  boosterType?: string | null
): string {
  if (packageType === 'BASIC') {
    // BASIC packages: TNB-P{sessions}-{serviceType}
    const sessionsCode = `P${totalSessions}`;
    const serviceCode = serviceType || 'HC';
    return `TNB-${sessionsCode}-${serviceCode}`;
  } else {
    // BOOSTER packages: BST-{boosterType}-P1-{serviceType}
    // Map boosterType from enum to code
    let boosterCode = 'NO';
    if (boosterType === 'NO2') boosterCode = 'NO';
    else if (boosterType === 'HHO') boosterCode = 'GT'; // Default HHO to GT
    
    const serviceCode = serviceType || 'HC';
    return `BST-${boosterCode}-P1-${serviceCode}`;
  }
}

async function main() {
  console.log('🔄 Updating product codes for existing packages...\n');

  // Get all packages without productCode
  const packages = await prisma.memberPackage.findMany({
    where: {
      OR: [
        { productCode: null },
        { productCode: '' }
      ]
    },
  });

  console.log(`Found ${packages.length} packages without product code\n`);

  let updated = 0;

  for (const pkg of packages) {
    try {
      const productCode = generateProductCode(
        pkg.packageType,
        pkg.totalSessions,
        pkg.serviceType,
        pkg.boosterType
      );

      await prisma.memberPackage.update({
        where: { id: pkg.id },
        data: { productCode },
      });

      console.log(`✅ ${pkg.packageCode} → ${productCode}`);
      updated++;
    } catch (error) {
      console.error(`❌ Failed to update ${pkg.packageCode}:`, error);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total:   ${packages.length}`);
  
  // Also update invoice items
  console.log(`\n🔄 Updating invoice items...\n`);
  
  const invoiceItems = await prisma.invoiceItem.findMany({
    where: {
      itemType: 'PACKAGE',
      OR: [
        { code: null },
        { code: '' },
        { code: { startsWith: 'PKG-' } } // Update old package codes
      ]
    },
    include: {
      invoice: true
    }
  });

  console.log(`Found ${invoiceItems.length} invoice items to update\n`);

  let itemsUpdated = 0;

  for (const item of invoiceItems) {
    try {
      // Get the package
      const pkg = await prisma.memberPackage.findUnique({
        where: { id: item.itemId }
      });

      if (!pkg) {
        console.log(`⏭️  Skipped ${item.id} - package not found`);
        continue;
      }

      const productCode = pkg.productCode || generateProductCode(
        pkg.packageType,
        pkg.totalSessions,
        pkg.serviceType,
        pkg.boosterType
      );

      await prisma.invoiceItem.update({
        where: { id: item.id },
        data: { 
          code: productCode,
          description: `${pkg.packageType} Package`
        },
      });

      console.log(`✅ Invoice ${item.invoice.invoiceNumber} item → ${productCode}`);
      itemsUpdated++;
    } catch (error) {
      console.error(`❌ Failed to update invoice item ${item.id}:`, error);
    }
  }

  console.log(`\n📊 Invoice Items Summary:`);
  console.log(`   Updated: ${itemsUpdated}`);
  console.log(`   Total:   ${invoiceItems.length}`);
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
