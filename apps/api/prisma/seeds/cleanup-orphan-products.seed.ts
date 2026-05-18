import { PrismaClient } from '@prisma/client';

/**
 * CLEANUP ORPHAN PRODUCTS
 * 
 * Removes MasterProducts that don't have any InventoryItem.
 * These are "orphan" products that show as "Belum ada cabang" in the UI.
 * 
 * Safe to run multiple times (idempotent).
 */

export async function cleanupOrphanProducts(prisma: PrismaClient) {
  console.log('\n🧹 Cleaning up orphan master products...\n');

  // Find MasterProducts that have no InventoryItem
  const orphanProducts = await prisma.masterProduct.findMany({
    where: {
      inventoryItems: {
        none: {},
      },
    },
    select: {
      id: true,
      name: true,
      category: true,
    },
  });

  if (orphanProducts.length === 0) {
    console.log('✅ No orphan products found. Database is clean!\n');
    return;
  }

  console.log(`📋 Found ${orphanProducts.length} orphan products to delete:\n`);
  orphanProducts.forEach((p) => {
    console.log(`  ❌ ${p.name} (${p.category})`);
  });

  // Delete orphan products
  const result = await prisma.masterProduct.deleteMany({
    where: {
      id: {
        in: orphanProducts.map((p) => p.id),
      },
    },
  });

  console.log(`\n✅ Deleted ${result.count} orphan master products\n`);
  console.log('══════════════════════════════════════════════════════════');
  console.log(`📊 Summary:`);
  console.log(`   • ${result.count} products removed`);
  console.log(`   • These products had no inventory in any branch`);
  console.log(`   • Safe operation - no related data was affected`);
  console.log('══════════════════════════════════════════════════════════\n');
}

// Standalone execution
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const runCleanup = async () => {
    console.log('🌱 Running orphan products cleanup...\n');
    await cleanupOrphanProducts(prisma);
  };

  runCleanup()
    .catch((e) => {
      console.error('\n❌ Cleanup failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
