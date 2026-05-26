import { PrismaClient, ProductCategory } from '@prisma/client';

/**
 * Infus Set + Pelengkap Stock Seed
 * 
 * Menambahkan stok "Infus Set + Pelengkap" ke semua cabang yang sudah ada.
 * Produk ini WAJIB tersedia untuk membuat sesi terapi.
 * 
 * Jalankan dengan: npx ts-node prisma/seeds/infus-set-stock.seed.ts
 * Atau melalui: npx prisma db seed (jika sudah ditambahkan ke index.ts)
 */

const prisma = new PrismaClient();

const INFUS_SET_PELENGKAP = {
  sku: 'PRD-INF-SET-002',
  name: 'Infus Set + Pelengkap',
  category: ProductCategory.DEVICE,
  unit: 'Piece',
  baseUnit: 'Piece',
  usageUnit: 'Piece',
  conversionFactor: 1,
  description: 'Set infus lengkap dengan pelengkap - WAJIB otomatis digunakan per sesi terapi',
  isAutoUsedPerSession: true,
  isAutoAddedToBranch: true,
  defaultInitialStock: 100,
};

const DEFAULT_STOCK = 100; // Default stock per branch
const MIN_THRESHOLD = 20;  // Minimum threshold for low stock warning

export async function seedInfusSetStock() {
  console.log('💉 Seeding Infus Set + Pelengkap stock...\n');

  // 1. Ensure the master product exists
  console.log('📦 Step 1: Ensuring master product exists...');
  const masterProduct = await prisma.masterProduct.upsert({
    where: { sku: INFUS_SET_PELENGKAP.sku },
    update: {
      name: INFUS_SET_PELENGKAP.name,
      category: INFUS_SET_PELENGKAP.category,
      unit: INFUS_SET_PELENGKAP.unit,
      baseUnit: INFUS_SET_PELENGKAP.baseUnit,
      usageUnit: INFUS_SET_PELENGKAP.usageUnit,
      conversionFactor: INFUS_SET_PELENGKAP.conversionFactor,
      description: INFUS_SET_PELENGKAP.description,
      isAutoUsedPerSession: INFUS_SET_PELENGKAP.isAutoUsedPerSession,
      isAutoAddedToBranch: INFUS_SET_PELENGKAP.isAutoAddedToBranch,
      defaultInitialStock: INFUS_SET_PELENGKAP.defaultInitialStock,
    },
    create: INFUS_SET_PELENGKAP,
  });
  console.log(`   ✅ Master product: ${masterProduct.name} (${masterProduct.sku})`);

  // 2. Get all active branches
  console.log('\n📍 Step 2: Getting all active branches...');
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, branchCode: true, name: true },
  });
  console.log(`   Found ${branches.length} active branches`);

  // 3. Add inventory item to each branch
  console.log('\n📊 Step 3: Adding inventory to branches...');
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const branch of branches) {
    // Check if inventory item already exists
    const existingItem = await prisma.inventoryItem.findUnique({
      where: {
        masterProductId_branchId: {
          masterProductId: masterProduct.id,
          branchId: branch.id,
        },
      },
    });

    if (existingItem) {
      // If stock is 0 or very low, update it
      if (existingItem.stock.toNumber() < 10) {
        await prisma.inventoryItem.update({
          where: { id: existingItem.id },
          data: { 
            stock: DEFAULT_STOCK,
            minThreshold: MIN_THRESHOLD,
          },
        });
        console.log(`   🔄 ${branch.branchCode} (${branch.name}): Updated stock from ${existingItem.stock} to ${DEFAULT_STOCK}`);
        updatedCount++;
      } else {
        console.log(`   ⏭️  ${branch.branchCode} (${branch.name}): Already has ${existingItem.stock} stock`);
        skippedCount++;
      }
    } else {
      // Create new inventory item
      await prisma.inventoryItem.create({
        data: {
          masterProductId: masterProduct.id,
          branchId: branch.id,
          stock: DEFAULT_STOCK,
          minThreshold: MIN_THRESHOLD,
        },
      });
      console.log(`   ✅ ${branch.branchCode} (${branch.name}): Added ${DEFAULT_STOCK} stock`);
      addedCount++;
    }
  }

  // 4. Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📋 SUMMARY');
  console.log('═'.repeat(50));
  console.log(`   Product: ${masterProduct.name}`);
  console.log(`   SKU: ${masterProduct.sku}`);
  console.log(`   Total branches: ${branches.length}`);
  console.log(`   Added: ${addedCount}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped (already has stock): ${skippedCount}`);
  console.log('═'.repeat(50));
  console.log('\n✅ Infus Set + Pelengkap stock seeding completed!');
  console.log('   Sekarang Anda dapat membuat sesi terapi.\n');

  return {
    masterProduct,
    branches: branches.length,
    added: addedCount,
    updated: updatedCount,
    skipped: skippedCount,
  };
}

// Run directly if executed as script
async function main() {
  try {
    await seedInfusSetStock();
  } catch (error) {
    console.error('❌ Error seeding Infus Set stock:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Check if running directly (not imported)
if (require.main === module) {
  main();
}
