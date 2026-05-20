import { PrismaClient } from '@prisma/client';

/**
 * INFUSION MATERIAL USAGE SEEDER
 * 
 * Purpose:
 * - Create material usage records for existing infusion executions
 * - Match infusion quantities with inventory items
 * - Apply proper unit conversion (ml → botol)
 * - Update stock accordingly
 * 
 * This seeder is IDEMPOTENT - safe to run multiple times
 * It will skip sessions that already have material usage records
 */

export async function seedInfusionMaterialUsage(prisma: PrismaClient) {
  console.log('\n💉 Seeding material usage from existing infusion executions...\n');

  // Get all infusion executions that don't have material usage yet
  const infusions = await prisma.infusionExecution.findMany({
    include: {
      session: {
        include: {
          branch: true,
          nurse: true,
          materials: true, // Check if already has material usage
        },
      },
    },
  });

  console.log(`📋 Found ${infusions.length} infusion executions\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const infusion of infusions) {
    const session = infusion.session;
    const branchId = session.branchId;
    const sessionCode = session.sessionCode;

    // Skip if this session already has material usage for infusion materials
    const existingMaterialUsage = session.materials.length;
    if (existingMaterialUsage > 0) {
      console.log(`⏭️  Skipping ${sessionCode} - already has ${existingMaterialUsage} material usage records`);
      skipped++;
      continue;
    }

    console.log(`\n📍 Processing ${sessionCode} (${session.branch.name})`);

    // Map infusion fields to product name patterns
    // Sesuai List Barang RAHO Official
    const materials = [
      // IFA - Satuan BOTOL
      { field: 'ifa250', sku: 'PRD-INF-IFA-002', namePattern: 'IFA A + MG 250ml', qty: infusion.ifa250 },
      { field: 'ifa500', sku: 'PRD-INF-IFA-001', namePattern: 'IFA A + MG 500ml', qty: infusion.ifa500 },
      // Cairan Terapi - Satuan ML
      { field: 'hho', sku: 'PRD-NBT-HHO-001', namePattern: 'NB-HHO', qty: infusion.hho },
      { field: 'h2', sku: 'PRD-NBT-CH2-001', namePattern: 'H2', qty: infusion.h2 },
      { field: 'no', sku: 'PRD-NBT-CNO-001', namePattern: 'NB-NO', qty: infusion.no },
      { field: 'gaso', sku: 'PRD-NBT-CGT-001', namePattern: 'NB Gasotransmitter', qty: infusion.gaso },
      { field: 'o2', namePattern: 'O2', qty: infusion.o2 }, // No specific SKU for O2
      { field: 'o3', sku: 'PRD-NBT-CO3-001', namePattern: 'Ozone', qty: infusion.o3 },
      { field: 'edta', sku: 'PRD-NBT-EDT-001', namePattern: 'EDTA', qty: infusion.edta },
      { field: 'mb', sku: 'PRD-NBT-CMB-001', namePattern: 'NB Methyln Blue', qty: infusion.mb },
      { field: 'h2s', sku: 'PRD-NBT-H2S-001', namePattern: 'Cairan H2S', qty: infusion.h2s },
      { field: 'kcl', sku: 'PRD-NBT-KCL-001', namePattern: 'KCL', qty: infusion.kcl },
      { field: 'jmlNb', namePattern: 'JML/NB', qty: infusion.jmlNb }, // No specific SKU
    ];

    let sessionCreated = 0;

    for (const material of materials) {
      if (!material.qty || Number(material.qty) <= 0) continue;

      try {
        // Find master product by SKU first, then fallback to name pattern
        let masterProduct = null;
        
        if ((material as any).sku) {
          masterProduct = await prisma.masterProduct.findFirst({
            where: {
              sku: (material as any).sku,
            },
          });
        }
        
        // Fallback to name pattern if SKU not found
        if (!masterProduct) {
          masterProduct = await prisma.masterProduct.findFirst({
            where: {
              name: {
                contains: material.namePattern,
                mode: 'insensitive',
              },
            },
          });
        }

        if (!masterProduct) {
          console.log(`  ⚠️  Product not found: ${material.namePattern}`);
          continue;
        }

        // Find inventory item for this branch
        const inventoryItem = await prisma.inventoryItem.findFirst({
          where: {
            masterProductId: masterProduct.id,
            branchId: branchId,
          },
          include: {
            masterProduct: true,
          },
        });

        if (!inventoryItem) {
          console.log(`  ⚠️  Inventory item not found: ${masterProduct.name} at ${session.branch.name}`);
          continue;
        }

        // Get conversion factor
        const conversionFactor = Number(inventoryItem.masterProduct.conversionFactor);
        const usageQuantity = Number(material.qty); // in usage unit (ml)
        const baseQuantityUsed = usageQuantity / conversionFactor; // in base unit (botol)

        // Check stock availability
        const stockBefore = Number(inventoryItem.stock);
        const stockAfter = stockBefore - baseQuantityUsed;

        if (stockAfter < 0) {
          const availableUsageUnit = stockBefore * conversionFactor;
          console.log(`  ❌ Insufficient stock for ${masterProduct.name}: need ${usageQuantity} ${inventoryItem.masterProduct.usageUnit}, available ${availableUsageUnit.toFixed(0)} ${inventoryItem.masterProduct.usageUnit}`);
          errors++;
          continue;
        }

        // Create material usage in transaction
        await prisma.$transaction(async (tx) => {
          // Create material usage record (stored in usage unit)
          await tx.materialUsage.create({
            data: {
              treatmentSessionId: session.id,
              inventoryItemId: inventoryItem.id,
              quantity: usageQuantity,
              unit: inventoryItem.masterProduct.usageUnit,
              recordedBy: session.nurseId || session.doctorId,
            },
          });

          // Update inventory stock (in base unit)
          await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { stock: stockAfter },
          });

          // Create stock mutation (in base unit)
          await tx.stockMutation.create({
            data: {
              inventoryItemId: inventoryItem.id,
              type: 'USED',
              quantity: baseQuantityUsed,
              stockBefore,
              stockAfter,
              referenceType: 'InfusionExecution',
              referenceId: infusion.id,
              notes: `Seeding: Material usage untuk ${sessionCode} - ${usageQuantity} ${inventoryItem.masterProduct.usageUnit} (${baseQuantityUsed.toFixed(4)} ${inventoryItem.masterProduct.baseUnit})`,
              createdBy: session.nurseId || session.doctorId,
            },
          });
        });

        console.log(`  ✅ ${masterProduct.name}: ${usageQuantity} ${inventoryItem.masterProduct.usageUnit} (${baseQuantityUsed.toFixed(4)} ${inventoryItem.masterProduct.baseUnit})`);
        sessionCreated++;
        created++;
      } catch (error) {
        console.error(`  ❌ Error processing ${material.namePattern}:`, error);
        errors++;
      }
    }

    if (sessionCreated > 0) {
      console.log(`  📊 Created ${sessionCreated} material usage records for ${sessionCode}`);
    }
  }

  console.log('\n══════════════════════════════════════════');
  console.log('✅ Infusion material usage seeding completed!');
  console.log(`   • ${created} material usage records created`);
  console.log(`   • ${skipped} sessions skipped (already have records)`);
  console.log(`   • ${errors} errors encountered`);
  console.log('══════════════════════════════════════════\n');
}

// Standalone execution
if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  async function main() {
    console.log('🌱 Running infusion material usage seeder...\n');
    await seedInfusionMaterialUsage(prisma);
  }

  main()
    .catch((e) => {
      console.error('\n❌ Seeding failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
