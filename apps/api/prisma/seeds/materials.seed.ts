import { PrismaClient, ProductCategory } from '@prisma/client';

/**
 * ⚠️ DEPRECATED - DO NOT USE THIS FILE! ⚠️
 * 
 * This file creates products with WRONG names like:
 * - "EDTA 100ml", "EDTA 50ml" (should be just "EDTA" in ml)
 * - "GASO 100ml" (should be "NB Gasotransmitter (GT)" in ml)
 * - "H2 (Hydrogen) 100ml" (should be just "H2" in ml)
 * - "H2S 1ml" (should be "Cairan H2S" in ml)
 * - etc.
 * 
 * USE INSTEAD:
 * - seedProducts() from products.seed.ts
 * - seedConsolidatedInventoryItems() from inventory-items-consolidated.seed.ts
 * 
 * These follow the official "List Barang RAHO" exactly with correct:
 * - SKU codes (e.g., PRD-NBT-HHO-001)
 * - Product names (e.g., "NB-HHO", "H2", "Cairan H2S")
 * - Units (ml for cairan terapi, Botol for IFA, Piece for Handscoon, etc.)
 * 
 * This file is kept for reference only and is NOT exported from index.ts
 * 
 * ============================================================
 * ORIGINAL DESCRIPTION (DEPRECATED):
 * ============================================================
 * MATERIALS SEEDER
 * 
 * Purpose:
 * - Create master products for therapy materials
 * - Create inventory items for each branch with proper stock levels
 * - Products are mapped to match infusion execution fields
 * 
 * This seeder is IDEMPOTENT - safe to run multiple times
 * Uses upsert to avoid duplicates
 */

interface MaterialProduct {
  name: string;
  category: ProductCategory;
  baseUnit: string;
  usageUnit: string;
  conversionFactor: number;
  description: string;
  stockPusat: number;
  stockBandung: number;
  stockSurabaya: number;
  minStock: number;
}

export async function seedMaterials(prisma: PrismaClient) {
  console.log('\n💊 Seeding therapy materials...\n');

  // Get all branches
  const branches = await prisma.branch.findMany();
  if (branches.length === 0) {
    console.log('⚠️  No branches found, skipping materials seed');
    return;
  }

  const branchPusat = branches.find(b => b.branchCode === 'PST');
  const branchBandung = branches.find(b => b.branchCode === 'BDG');
  const branchSurabaya = branches.find(b => b.branchCode === 'SBY');

  // ============================================================
  // MATERIAL PRODUCTS - Mapped to InfusionExecution fields
  // ============================================================
  // InfusionExecution fields: ifa, hho, h2, no, gaso, o2, o3, edta, mb, h2s, kcl, jmlNb
  
  const materials: MaterialProduct[] = [
    // ============================================================
    // CAIRAN INFUS UTAMA
    // ============================================================
    {
      name: 'IFA 500ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      description: 'Cairan infus IFA dengan Magnesium 500ml per botol - untuk field: ifa',
      stockPusat: 100,
      stockBandung: 70,
      stockSurabaya: 50,
      minStock: 10,
    },
    {
      name: 'IFA 250ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 250,
      description: 'Cairan infus IFA dengan Magnesium 250ml per botol - untuk field: ifa',
      stockPusat: 80,
      stockBandung: 50,
      stockSurabaya: 40,
      minStock: 10,
    },
    
    // ============================================================
    // BOOSTER - HHO (Hydrogen)
    // ============================================================
    {
      name: 'HHO 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      description: 'Hydrogen-Hydrogen-Oxygen 100ml per botol - untuk field: hho',
      stockPusat: 150,
      stockBandung: 100,
      stockSurabaya: 80,
      minStock: 20,
    },
    {
      name: 'Nano Bubble HHO 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      description: 'Nano Bubble HHO 100ml per botol - untuk field: hho',
      stockPusat: 120,
      stockBandung: 80,
      stockSurabaya: 60,
      minStock: 15,
    },
    {
      name: 'NB HHO 250ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 250,
      description: 'Nano Bubble HHO 250ml per botol - untuk field: hho',
      stockPusat: 80,
      stockBandung: 50,
      stockSurabaya: 40,
      minStock: 10,
    },
    {
      name: 'NB HHO 25ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 25,
      description: 'Nano Bubble HHO 25ml per botol - untuk field: hho',
      stockPusat: 200,
      stockBandung: 150,
      stockSurabaya: 100,
      minStock: 30,
    },
    
    // ============================================================
    // BOOSTER - H2 (Hydrogen Pure)
    // ============================================================
    {
      name: 'H2 (Hydrogen) 25ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 25,
      description: 'Hydrogen murni 25ml per botol - untuk field: h2',
      stockPusat: 150,
      stockBandung: 100,
      stockSurabaya: 80,
      minStock: 25,
    },
    {
      name: 'H2 (Hydrogen) 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      description: 'Hydrogen murni 100ml per botol - untuk field: h2',
      stockPusat: 100,
      stockBandung: 70,
      stockSurabaya: 50,
      minStock: 15,
    },
    
    // ============================================================
    // BOOSTER - NO (Nitric Oxide)
    // ============================================================
    {
      name: 'NO (Nitric Oxide) 25ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 25,
      description: 'Nitric Oxide 25ml per botol - untuk field: no',
      stockPusat: 180,
      stockBandung: 120,
      stockSurabaya: 90,
      minStock: 30,
    },
    {
      name: 'NO (Nitric Oxide) 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      description: 'Nitric Oxide 100ml per botol - untuk field: no',
      stockPusat: 100,
      stockBandung: 70,
      stockSurabaya: 50,
      minStock: 15,
    },
    
    // ============================================================
    // BOOSTER - GASO (Gas Oxygen)
    // ============================================================
    {
      name: 'GASO 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      description: 'Gas Oxygen 100ml per botol - untuk field: gaso',
      stockPusat: 80,
      stockBandung: 50,
      stockSurabaya: 40,
      minStock: 10,
    },
    
    // ============================================================
    // BOOSTER - O2 (Oxygen)
    // ============================================================
    {
      name: 'O2 (Oxygen) 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      description: 'Oxygen murni 100ml per botol - untuk field: o2',
      stockPusat: 100,
      stockBandung: 70,
      stockSurabaya: 50,
      minStock: 15,
    },
    
    // ============================================================
    // BOOSTER - O3 (Ozone)
    // ============================================================
    {
      name: 'O3 (Ozone) 50ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 50,
      description: 'Ozone 50ml per botol - untuk field: o3',
      stockPusat: 80,
      stockBandung: 50,
      stockSurabaya: 40,
      minStock: 10,
    },
    {
      name: 'O3 (Ozone) 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      description: 'Ozone 100ml per botol - untuk field: o3',
      stockPusat: 60,
      stockBandung: 40,
      stockSurabaya: 30,
      minStock: 10,
    },
    
    // ============================================================
    // BOOSTER - EDTA
    // ============================================================
    {
      name: 'EDTA 50ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 50,
      description: 'EDTA chelation 50ml per botol - untuk field: edta',
      stockPusat: 100,
      stockBandung: 70,
      stockSurabaya: 50,
      minStock: 15,
    },
    {
      name: 'EDTA 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      description: 'EDTA chelation 100ml per botol - untuk field: edta',
      stockPusat: 80,
      stockBandung: 50,
      stockSurabaya: 40,
      minStock: 10,
    },
    
    // ============================================================
    // BOOSTER - MB (Methylene Blue)
    // ============================================================
    {
      name: 'MB (Methylene Blue) 50ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 50,
      description: 'Methylene Blue 50ml per botol - untuk field: mb',
      stockPusat: 80,
      stockBandung: 50,
      stockSurabaya: 40,
      minStock: 10,
    },
    {
      name: 'NB Methylene Blue 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      description: 'Nano Bubble Methylene Blue 100ml per botol - untuk field: mb',
      stockPusat: 60,
      stockBandung: 40,
      stockSurabaya: 30,
      minStock: 10,
    },
    
    // ============================================================
    // BOOSTER - H2S (Hydrogen Sulfide)
    // ============================================================
    {
      name: 'H2S 1ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'vial',
      usageUnit: 'ml',
      conversionFactor: 1,
      description: 'Hydrogen Sulfide konsentrat 1ml per vial - untuk field: h2s',
      stockPusat: 300,
      stockBandung: 200,
      stockSurabaya: 150,
      minStock: 50,
    },
    {
      name: 'NB H2S Konsentrat 1ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'vial',
      usageUnit: 'ml',
      conversionFactor: 1,
      description: 'Nano Bubble H2S Konsentrat 1ml per vial - untuk field: h2s',
      stockPusat: 250,
      stockBandung: 180,
      stockSurabaya: 120,
      minStock: 40,
    },
    
    // ============================================================
    // BOOSTER - KCL (Potassium Chloride)
    // ============================================================
    {
      name: 'KCL 25ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 25,
      description: 'Potassium Chloride 25ml per botol - untuk field: kcl',
      stockPusat: 200,
      stockBandung: 150,
      stockSurabaya: 100,
      minStock: 30,
    },
    {
      name: 'KCL 50ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 50,
      description: 'Potassium Chloride 50ml per botol - untuk field: kcl',
      stockPusat: 150,
      stockBandung: 100,
      stockSurabaya: 80,
      minStock: 20,
    },
    
    // ============================================================
    // BOOSTER - JML/NB (Nano Bubble Koktail)
    // ============================================================
    {
      name: 'NB Koktail 250ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 250,
      description: 'Nano Bubble Koktail 250ml per botol - untuk field: jmlNb',
      stockPusat: 60,
      stockBandung: 40,
      stockSurabaya: 30,
      minStock: 10,
    },
    {
      name: 'JML/NB 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      description: 'JML Nano Bubble 100ml per botol - untuk field: jmlNb',
      stockPusat: 80,
      stockBandung: 50,
      stockSurabaya: 40,
      minStock: 15,
    },
    
    // ============================================================
    // ALAT MEDIS HABIS PAKAI
    // ============================================================
    {
      name: 'Infus Set',
      category: ProductCategory.DEVICE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      description: 'Infus Set steril 1 piece',
      stockPusat: 500,
      stockBandung: 350,
      stockSurabaya: 250,
      minStock: 100,
    },
    {
      name: 'Jarum Infus',
      category: ProductCategory.DEVICE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      description: 'Jarum infus steril 1 piece',
      stockPusat: 1000,
      stockBandung: 700,
      stockSurabaya: 500,
      minStock: 200,
    },
    {
      name: 'Handscoon',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      description: 'Sarung tangan medis 1 piece',
      stockPusat: 100,
      stockBandung: 70,
      stockSurabaya: 50,
      minStock: 20,
    },
    {
      name: 'Alkohol Swab',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      description: 'Alkohol swab 1 piece',
      stockPusat: 50,
      stockBandung: 35,
      stockSurabaya: 25,
      minStock: 10,
    },
    {
      name: 'Plester',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'roll',
      usageUnit: 'piece',
      conversionFactor: 50,
      description: 'Plester medis 1 roll (50 potongan)',
      stockPusat: 60,
      stockBandung: 40,
      stockSurabaya: 30,
      minStock: 10,
    },
    {
      name: 'Kapas',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'pack',
      usageUnit: 'gram',
      conversionFactor: 100,
      description: 'Kapas medis 1 pack (100 gram)',
      stockPusat: 80,
      stockBandung: 50,
      stockSurabaya: 40,
      minStock: 15,
    },
    {
      name: 'Syringe 50cc',
      category: ProductCategory.DEVICE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      description: 'Syringe 50cc dengan catheter tip',
      stockPusat: 300,
      stockBandung: 200,
      stockSurabaya: 150,
      minStock: 50,
    },
    {
      name: 'Syringe 20cc',
      category: ProductCategory.DEVICE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      description: 'Syringe 20cc dengan catheter tip',
      stockPusat: 400,
      stockBandung: 280,
      stockSurabaya: 200,
      minStock: 75,
    },
    {
      name: 'Syringe 5cc',
      category: ProductCategory.DEVICE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      description: 'Syringe 5cc dengan catheter tip',
      stockPusat: 500,
      stockBandung: 350,
      stockSurabaya: 250,
      minStock: 100,
    },
  ];

  let productsCreated = 0;
  let productsUpdated = 0;
  let inventoryCreated = 0;
  let inventorySkipped = 0;

  console.log(`📋 Processing ${materials.length} materials across ${branches.length} branches...\n`);

  for (const material of materials) {
    // Upsert MasterProduct
    const existingProduct = await prisma.masterProduct.findUnique({
      where: { name: material.name },
    });

    const masterProduct = await prisma.masterProduct.upsert({
      where: { name: material.name },
      update: {
        category: material.category,
        unit: material.usageUnit,
        baseUnit: material.baseUnit,
        usageUnit: material.usageUnit,
        conversionFactor: material.conversionFactor,
        description: material.description,
        isActive: true,
      },
      create: {
        name: material.name,
        category: material.category,
        unit: material.usageUnit,
        baseUnit: material.baseUnit,
        usageUnit: material.usageUnit,
        conversionFactor: material.conversionFactor,
        description: material.description,
        isActive: true,
      },
    });

    if (existingProduct) {
      productsUpdated++;
    } else {
      productsCreated++;
    }

    // Create InventoryItem for each branch
    for (const branch of branches) {
      let stockAmount = material.stockPusat;
      
      if (branch.branchCode === 'BDG') {
        stockAmount = material.stockBandung;
      } else if (branch.branchCode === 'SBY') {
        stockAmount = material.stockSurabaya;
      }

      const existing = await prisma.inventoryItem.findUnique({
        where: {
          masterProductId_branchId: {
            masterProductId: masterProduct.id,
            branchId: branch.id,
          },
        },
      });

      if (!existing) {
        await prisma.inventoryItem.create({
          data: {
            masterProductId: masterProduct.id,
            branchId: branch.id,
            stock: stockAmount,
            minThreshold: material.minStock,
          },
        });
        inventoryCreated++;
      } else {
        inventorySkipped++;
      }
    }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('✅ Materials seeding completed!');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`\n📊 Summary:`);
  console.log(`   • ${productsCreated} new master products created`);
  console.log(`   • ${productsUpdated} master products updated`);
  console.log(`   • ${inventoryCreated} new inventory items created`);
  console.log(`   • ${inventorySkipped} inventory items already existed`);
  
  console.log(`\n📦 Product Categories:`);
  const categoryCount = materials.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(categoryCount).forEach(([category, count]) => {
    console.log(`   • ${category}: ${count} products`);
  });

  console.log(`\n🏢 Stock Distribution:`);
  if (branchPusat) console.log(`   • ${branchPusat.name} (PST): Full stock`);
  if (branchBandung) console.log(`   • ${branchBandung.name} (BDG): ~70% stock`);
  if (branchSurabaya) console.log(`   • ${branchSurabaya.name} (SBY): ~50% stock`);

  console.log(`\n💉 Infusion Field Mapping:`);
  console.log('   • ifa → IFA 500ml, IFA 250ml');
  console.log('   • hho → HHO 100ml, Nano Bubble HHO, NB HHO');
  console.log('   • h2 → H2 (Hydrogen)');
  console.log('   • no → NO (Nitric Oxide)');
  console.log('   • gaso → GASO');
  console.log('   • o2 → O2 (Oxygen)');
  console.log('   • o3 → O3 (Ozone)');
  console.log('   • edta → EDTA');
  console.log('   • mb → MB (Methylene Blue), NB Methylene Blue');
  console.log('   • h2s → H2S, NB H2S Konsentrat');
  console.log('   • kcl → KCL');
  console.log('   • jmlNb → NB Koktail, JML/NB');
  console.log('══════════════════════════════════════════════════════════\n');
}

// Standalone execution
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const runSeed = async () => {
    console.log('🌱 Running materials seeder...\n');
    await seedMaterials(prisma);
  };

  runSeed()
    .catch((e) => {
      console.error('\n❌ Seeding failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
