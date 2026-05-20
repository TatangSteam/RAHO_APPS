import { PrismaClient, ProductCategory } from '@prisma/client';

/**
 * Official Inventory Items Seeder
 * Based on "List Barang RAHO.md" - Official RAHO Product List
 * 
 * This seed creates master products with proper unit conversion:
 * - baseUnit: Storage unit (Botol, Kotak, Pack, Rim, etc.)
 * - usageUnit: Usage unit (Botol, Piece, Lembar, etc.)
 * - conversionFactor: How many usage units per base unit
 * 
 * IFA Products:
 * - IFA + NO 2,5ml (250ml): 1 Botol per terapi (WAJIB)
 * - IFA A + MG 500ml: 1 Botol (special case/alternatif)
 */

export async function seedOfficialInventoryItems(prisma: PrismaClient) {
  console.log('\n📦 Seeding OFFICIAL inventory items from List Stok...\n');

  // Get all branches
  const branches = await prisma.branch.findMany();
  if (branches.length === 0) {
    console.log('⚠️  No branches found, skipping inventory items seed');
    return;
  }

  const masterProducts = [
    // ============================================================
    // CAIRAN INFUS (INF) - Category: MEDICINE
    // ============================================================
    // IFA + NO 2,5ml - WAJIB 1 botol per terapi (250ml)
    {
      sku: 'PRD-INF-IFA-001',
      name: 'IFA + NO 2,5ml (250ml)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'Botol',
      conversionFactor: 1,
      pricePerUnit: 12500000,
      description: 'IFA + NO 2,5ml dalam botol 250ml - Wajib 1 botol per terapi',
      stock: 100,
      minStock: 20,
    },
    // IFA Biasa 500ml - Special case / alternatif
    {
      sku: 'PRD-INF-IFA-002',
      name: 'IFA A + MG 500ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'Botol',
      conversionFactor: 1,
      pricePerUnit: 2000000,
      description: 'IFA A + MG 500ml - Alternatif/special case',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'INF-HHO-V100-BT',
      name: 'HHO 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      pricePerUnit: 1000000,
      description: 'Hydrogen-Hydrogen-Oxygen 100ml per botol',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'INF-NNB-HHO-V100-BT',
      name: 'Nano Bubble HHO 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      pricePerUnit: 1000000,
      description: 'Nano Bubble HHO 100ml per botol',
      stock: 80,
      minStock: 15,
    },
    {
      sku: 'INF-NNB-HHO-V250-BT',
      name: 'NB HHO 250ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 250,
      pricePerUnit: 1000000,
      description: 'Nano Bubble HHO 250ml per botol',
      stock: 60,
      minStock: 10,
    },
    {
      sku: 'INF-NNB-HHO-V25-BT',
      name: 'NB HHO 25ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 25,
      pricePerUnit: 1000000,
      description: 'Nano Bubble HHO 25ml per botol',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'INF-NO-V25-BT',
      name: 'NO 25ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 25,
      pricePerUnit: 1000000,
      description: 'Nitric Oxide 25ml per botol',
      stock: 120,
      minStock: 25,
    },
    {
      sku: 'INF-KCL-V25-BT',
      name: 'KCL 25ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 25,
      pricePerUnit: 600000,
      description: 'Potassium Chloride 25ml per botol',
      stock: 150,
      minStock: 30,
    },
    {
      sku: 'INF-NNB-KTL-V250-BT',
      name: 'NB Koktail 250ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 250,
      pricePerUnit: 650000,
      description: 'Nano Bubble Koktail 250ml per botol',
      stock: 40,
      minStock: 10,
    },
    {
      sku: 'INF-NNB-MB-V50-BT',
      name: 'NB Methyln 50ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 50,
      pricePerUnit: 600000,
      description: 'Nano Bubble Methylene Blue 50ml per botol',
      stock: 60,
      minStock: 15,
    },
    {
      sku: 'INF-NNB-MB-V100-BT',
      name: 'NB Methyln 100ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      pricePerUnit: 600000,
      description: 'Nano Bubble Methylene Blue 100ml per botol',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'INF-H2S-V1-VL',
      name: 'NB H2S Konsentrat 1ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'vial',
      usageUnit: 'ml',
      conversionFactor: 1,
      pricePerUnit: 600000,
      description: 'Nano Bubble H2S Konsentrat 1ml per vial',
      stock: 200,
      minStock: 50,
    },
    // ❌ REMOVED DUPLICATE: Cairan H2S 1ml (identical to NB H2S Konsentrat 1ml)

    // ============================================================
    // AIR NANO (ARN) - Category: MEDICINE
    // ============================================================
    {
      sku: 'INF-ARN-V600-CB-BT',
      name: 'Air Nano Biru 600ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 600,
      pricePerUnit: 650000,
      description: 'Air Nano warna Biru 600ml per botol',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'INF-ARN-V600-CK-BT',
      name: 'Air Nano Kuning 600ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 600,
      pricePerUnit: 650000,
      description: 'Air Nano warna Kuning 600ml per botol',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'INF-ARN-V600-CH-BT',
      name: 'Air Nano Hijau H2S 600ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 600,
      pricePerUnit: 650000,
      description: 'Air Nano warna Hijau H2S 600ml per botol',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'INF-ARN-V1500-CB-BT',
      name: 'Air Nano Biru 1500ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 1500,
      pricePerUnit: 650000,
      description: 'Air Nano warna Biru 1500ml per botol',
      stock: 60,
      minStock: 15,
    },
    {
      sku: 'INF-ARN-V1500-CK-BT',
      name: 'Air Nano Kuning 1500ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 1500,
      pricePerUnit: 650000,
      description: 'Air Nano warna Kuning 1500ml per botol',
      stock: 60,
      minStock: 15,
    },
    {
      sku: 'INF-ARN-V1500-CH-BT',
      name: 'Air Nano Hijau H2S 1500ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 1500,
      pricePerUnit: 650000,
      description: 'Air Nano warna Hijau H2S 1500ml per botol',
      stock: 60,
      minStock: 15,
    },

    // ============================================================
    // ALAT MEDIS HABIS PAKAI (MED) - Category: DEVICE
    // ============================================================
    {
      sku: 'PRD-INF-SET-001',
      name: 'Infus Set',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 22500000,
      description: 'Set infus lengkap',
      stock: 500,
      minStock: 100,
    },
    {
      sku: 'MED-JRM-PC',
      name: 'Jarum',
      category: ProductCategory.DEVICE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      pricePerUnit: 850000,
      description: 'Jarum infus 1 piece',
      stock: 1000,
      minStock: 200,
    },
    {
      sku: 'MED-SWB-ULT-KT',
      name: 'Ultrafik',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'kotak',
      usageUnit: 'piece',
      conversionFactor: 100,
      pricePerUnit: 1000000,
      description: 'Ultrafik swab 1 kotak (100 piece)',
      stock: 20,
      minStock: 5,
    },
    {
      sku: 'MED-SWB-ONE-KT',
      name: 'One Swab',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'kotak',
      usageUnit: 'piece',
      conversionFactor: 100,
      pricePerUnit: 1000000,
      description: 'One Swab 1 kotak (100 piece)',
      stock: 25,
      minStock: 5,
    },
    {
      sku: 'MED-GLV-KT',
      name: 'Handscoon',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'kotak',
      usageUnit: 'piece',
      conversionFactor: 100,
      pricePerUnit: 65000,
      description: 'Sarung tangan medis 1 kotak (100 pasang)',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'MED-SYR-P3-PC',
      name: 'Syringe 50cc Catheter Tip',
      category: ProductCategory.DEVICE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      pricePerUnit: 750000,
      description: 'Syringe 50cc dengan catheter tip',
      stock: 200,
      minStock: 50,
    },
    {
      sku: 'MED-SYR-P2-PC',
      name: 'Syringe 20cc Catheter Tip',
      category: ProductCategory.DEVICE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      pricePerUnit: 750000,
      description: 'Syringe 20cc dengan catheter tip',
      stock: 300,
      minStock: 75,
    },
    {
      sku: 'MED-SYR-P1-PC',
      name: 'Syringe 5cc Catheter Tip',
      category: ProductCategory.DEVICE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      pricePerUnit: 750000,
      description: 'Syringe 5cc dengan catheter tip',
      stock: 400,
      minStock: 100,
    },
    {
      sku: 'MED-SFB-2500-PC',
      name: 'Safety Box Sampah Medis 2500ml',
      category: ProductCategory.DEVICE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      pricePerUnit: 750000,
      description: 'Safety Box untuk sampah medis 2500ml (Include Inner & Tali)',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'MED-OXI-GEA-PC',
      name: 'Oximeter Gea FP-A200',
      category: ProductCategory.DEVICE,
      baseUnit: 'unit',
      usageUnit: 'unit',
      conversionFactor: 1,
      pricePerUnit: 750000,
      description: 'Oximeter Gea FP-A200 (alat permanen)',
      stock: 10,
      minStock: 2,
    },

    // ============================================================
    // OPERASIONAL (OPS) - Category: CONSUMABLE
    // ============================================================
    {
      sku: 'OPS-PLT-RL',
      name: 'Plestrin',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'roll',
      usageUnit: 'piece',
      conversionFactor: 50,
      pricePerUnit: 1000000,
      description: 'Plester medis 1 roll (50 potongan)',
      stock: 30,
      minStock: 10,
    },
    {
      sku: 'OPS-KSH-4050-BK',
      name: 'Kantong Sampah Hitam 40 x 50',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'pack',
      usageUnit: 'piece',
      conversionFactor: 20,
      pricePerUnit: 65000,
      description: 'Kantong sampah hitam ukuran 40 x 50 cm (20 kantong per pack)',
      stock: 25,
      minStock: 5,
    },
    {
      sku: 'OPS-KSH-4060-BK',
      name: 'Kantong Sampah Hitam 40 x 60',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'pack',
      usageUnit: 'piece',
      conversionFactor: 20,
      pricePerUnit: 65000,
      description: 'Kantong sampah hitam ukuran 40 x 60 cm (20 kantong per pack)',
      stock: 25,
      minStock: 5,
    },
    {
      sku: 'OPS-KSH-60100-BK',
      name: 'Kantong Sampah Hitam 60 x 100',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'pack',
      usageUnit: 'piece',
      conversionFactor: 20,
      pricePerUnit: 65000,
      description: 'Kantong sampah hitam ukuran 60 x 100 cm (20 kantong per pack)',
      stock: 20,
      minStock: 5,
    },
    {
      sku: 'OPS-KSH-100120-BK',
      name: 'Kantong Sampah Hitam 100 x 120',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'pack',
      usageUnit: 'piece',
      conversionFactor: 20,
      pricePerUnit: 65000,
      description: 'Kantong sampah hitam ukuran 100 x 120 cm (20 kantong per pack)',
      stock: 15,
      minStock: 3,
    },
    {
      sku: 'OPS-BAT-AA-BK',
      name: 'Baterai AA',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'pack',
      usageUnit: 'piece',
      conversionFactor: 4,
      pricePerUnit: 750000,
      description: 'Baterai AA 1 pack (4 baterai)',
      stock: 40,
      minStock: 10,
    },
    {
      sku: 'OPS-BAT-AAA-BK',
      name: 'Baterai AAA',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'pack',
      usageUnit: 'piece',
      conversionFactor: 4,
      pricePerUnit: 750000,
      description: 'Baterai AAA 1 pack (4 baterai)',
      stock: 40,
      minStock: 10,
    },
    {
      sku: 'OPS-KRT-A4-RM',
      name: 'Kertas HVS',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'rim',
      usageUnit: 'lembar',
      conversionFactor: 500,
      pricePerUnit: 0,
      description: 'Kertas HVS A4 1 rim (500 lembar)',
      stock: 20,
      minStock: 5,
    },
    {
      sku: 'MED-TRP-3K-PC',
      name: 'Tiang Infus Tripod 3 Kaki',
      category: ProductCategory.DEVICE,
      baseUnit: 'unit',
      usageUnit: 'unit',
      conversionFactor: 1,
      pricePerUnit: 65000,
      description: 'Tiang infus tripod 3 kaki (alat permanen)',
      stock: 15,
      minStock: 3,
    },
    {
      sku: 'MED-TNS-MNL-PC',
      name: 'Tensi Manual + Stetoskop',
      category: ProductCategory.DEVICE,
      baseUnit: 'unit',
      usageUnit: 'unit',
      conversionFactor: 1,
      pricePerUnit: 0,
      description: 'Tensimeter manual dengan stetoskop (alat permanen)',
      stock: 10,
      minStock: 2,
    },
    {
      sku: 'MED-TNS-DGT-PC',
      name: 'Tensi Digital',
      category: ProductCategory.DEVICE,
      baseUnit: 'unit',
      usageUnit: 'unit',
      conversionFactor: 1,
      pricePerUnit: 0,
      description: 'Tensimeter digital (alat permanen)',
      stock: 8,
      minStock: 2,
    },
    {
      sku: 'MED-BNT-INF-PC',
      name: 'Bantal Indus',
      category: ProductCategory.DEVICE,
      baseUnit: 'unit',
      usageUnit: 'unit',
      conversionFactor: 1,
      pricePerUnit: 10500000,
      description: 'Bantal untuk terapi infus (alat permanen)',
      stock: 20,
      minStock: 5,
    },
    {
      sku: 'OPS-FRM-PDF-BK',
      name: 'Form Pendaftaran',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'pack',
      usageUnit: 'lembar',
      conversionFactor: 100,
      pricePerUnit: 10000000,
      description: 'Form pendaftaran member 1 pack (100 lembar)',
      stock: 10,
      minStock: 2,
    },
    {
      sku: 'MED-TRN-PC',
      name: 'Tourniquet',
      category: ProductCategory.DEVICE,
      baseUnit: 'unit',
      usageUnit: 'unit',
      conversionFactor: 1,
      pricePerUnit: 20500000,
      description: 'Tourniquet untuk pemasangan infus (alat permanen)',
      stock: 25,
      minStock: 5,
    },
    {
      sku: 'MED-MAP-RM-PC',
      name: 'Map Rekam Medis',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      pricePerUnit: 15000,
      description: 'Map untuk rekam medis pasien',
      stock: 200,
      minStock: 50,
    },
    {
      sku: 'MED-GEL-TRP-20G',
      name: 'Thrombophop Gel 20gr',
      category: ProductCategory.MEDICINE,
      baseUnit: 'tube',
      usageUnit: 'gram',
      conversionFactor: 20,
      pricePerUnit: 0,
      description: 'Thrombophop Gel 20 gram per tube',
      stock: 30,
      minStock: 10,
    },
    {
      sku: 'OPS-SPR-NPN',
      name: 'No Pain Spray',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      pricePerUnit: 600000,
      description: 'No Pain Spray 100ml per botol',
      stock: 40,
      minStock: 10,
    },
    {
      sku: 'OPS-CMP-HTC',
      name: 'Hot Cool Compress',
      category: ProductCategory.DEVICE,
      baseUnit: 'unit',
      usageUnit: 'unit',
      conversionFactor: 1,
      pricePerUnit: 65000,
      description: 'Hot/Cool compress pack (alat permanen)',
      stock: 30,
      minStock: 10,
    },
    // ❌ REMOVED DUPLICATE: NB H2S Konsentrat 100ml (not needed if we have 1ml vials)
  ];

  let created = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`📋 Processing ${masterProducts.length} products across ${branches.length} branches...\n`);

  for (const product of masterProducts) {
    // Create or update MasterProduct
    const existingProduct = await prisma.masterProduct.findUnique({
      where: { name: product.name },
    });

    const masterProduct = await prisma.masterProduct.upsert({
      where: { name: product.name },
      update: {
        category: product.category,
        unit: product.usageUnit, // Legacy field
        baseUnit: product.baseUnit,
        usageUnit: product.usageUnit,
        conversionFactor: product.conversionFactor,
        description: product.description,
        isActive: true,
      },
      create: {
        name: product.name,
        category: product.category,
        unit: product.usageUnit, // Legacy field
        baseUnit: product.baseUnit,
        usageUnit: product.usageUnit,
        conversionFactor: product.conversionFactor,
        description: product.description,
        isActive: true,
      },
    });

    if (existingProduct) {
      updated++;
    }

    // Create InventoryItem for EACH branch
    for (const branch of branches) {
      const existing = await prisma.inventoryItem.findUnique({
        where: {
          masterProductId_branchId: {
            masterProductId: masterProduct.id,
            branchId: branch.id,
          },
        },
      });

      if (!existing) {
        // Different stock levels for different branches
        let stockAmount = product.stock;
        if (branch.branchCode === 'BDG') {
          stockAmount = Math.floor(product.stock * 0.7); // Bandung: 70% stock
        } else if (branch.branchCode === 'SBY') {
          stockAmount = Math.floor(product.stock * 0.5); // Surabaya: 50% stock
        }

        await prisma.inventoryItem.create({
          data: {
            masterProductId: masterProduct.id,
            branchId: branch.id,
            stock: stockAmount,
            minThreshold: product.minStock,
          },
        });
        created++;
      } else {
        skipped++;
      }
    }
  }

  console.log('✅ Official inventory seeding completed!\n');
  console.log('──────────────────────────────────────────');
  console.log(`📊 Summary:`);
  console.log(`   • ${masterProducts.length} master products processed`);
  console.log(`   • ${created} new inventory items created`);
  console.log(`   • ${updated} master products updated`);
  console.log(`   • ${skipped} inventory items already existed`);
  console.log(`\n📦 Product Categories:`);
  
  const categoryCount = masterProducts.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(categoryCount).forEach(([category, count]) => {
    console.log(`   • ${category}: ${count} products`);
  });
  
  console.log(`\n🏢 Stock Distribution:`);
  branches.forEach(branch => {
    const percentage = branch.branchCode === 'PST' ? '100%' : 
                       branch.branchCode === 'BDG' ? '70%' : '50%';
    console.log(`   • ${branch.name} (${branch.branchCode}): ${percentage} of base stock`);
  });
  
  console.log('\n💡 Unit Conversion Examples:');
  console.log('   • IFA + NO 2,5ml (250ml): 1 Botol = 1 Botol (wajib per terapi)');
  console.log('   • IFA A + MG 500ml: 1 Botol = 1 Botol (special case)');
  console.log('   • Handscoon: 1 kotak = 100 piece');
  console.log('   • Kertas HVS: 1 rim = 500 lembar');
  console.log('   • Baterai AA: 1 pack = 4 piece');
  console.log('──────────────────────────────────────────\n');
}

// Standalone execution
if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  async function main() {
    console.log('🌱 Running official inventory seeder...\n');
    await seedOfficialInventoryItems(prisma);
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
