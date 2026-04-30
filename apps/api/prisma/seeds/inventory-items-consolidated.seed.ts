import { PrismaClient, ProductCategory } from '@prisma/client';

/**
 * CONSOLIDATED Inventory Items Seeder
 * 
 * MAJOR CHANGES:
 * - 1 JENIS CAIRAN = 1 PRODUK (tidak ada duplikasi ukuran)
 * - Stok dalam BOTOL, penggunaan dalam ML
 * - Ukuran standar: 500ml per botol (kecuali MB=100ml, H2S=1ml vial)
 * - Total produk: ~30 (dari 46)
 * 
 * KONSOLIDASI:
 * - HHO 100ml, NB HHO 100ml, NB HHO 250ml, NB HHO 25ml → HHO 500ml
 * - IFA 500ml, IFA 250ml → IFA 500ml
 * - NO 25ml → NO 500ml
 * - KCL 25ml → KCL 500ml
 * - NB Methyln 50ml, 100ml → MB 100ml
 * - NB Koktail → JML/NB 500ml
 */

export async function seedConsolidatedInventoryItems(prisma: PrismaClient) {
  console.log('\n📦 Seeding CONSOLIDATED inventory items...\n');
  console.log('🔄 MAJOR CONSOLIDATION: 1 jenis cairan = 1 produk\n');

  // Get all branches
  const branches = await prisma.branch.findMany();
  if (branches.length === 0) {
    console.log('⚠️  No branches found, skipping inventory items seed');
    return;
  }

  const masterProducts = [
    // ============================================================
    // CAIRAN INFUS UNTUK TERAPI (12 produk - CONSOLIDATED!)
    // Stok dalam BOTOL, penggunaan dalam ML
    // ============================================================
    {
      sku: 'INF-IFA-500',
      name: 'IFA (Iron + Folic Acid + Mg)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 2000000,
      description: 'Iron + Folic Acid + Magnesium infusion solution, 500ml per botol',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'INF-HHO-500',
      name: 'HHO (Hydrogen-Hydrogen-Oxygen)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 1000000,
      description: 'Hydrogen-Hydrogen-Oxygen therapy solution, 500ml per botol',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'INF-H2-500',
      name: 'H2 (Hydrogen)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 1000000,
      description: 'Hydrogen gas infusion solution, 500ml per botol',
      stock: 80,
      minStock: 15,
    },
    {
      sku: 'INF-NO-500',
      name: 'NO (Nitric Oxide)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 1000000,
      description: 'Nitric Oxide therapy solution, 500ml per botol',
      stock: 120,
      minStock: 25,
    },
    {
      sku: 'INF-O2-500',
      name: 'O2 (Oxygen)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 1000000,
      description: 'Oxygen infusion solution, 500ml per botol',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'INF-O3-500',
      name: 'O3 (Ozone)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 1000000,
      description: 'Ozone therapy solution, 500ml per botol',
      stock: 80,
      minStock: 15,
    },
    {
      sku: 'INF-GASO-500',
      name: 'GASO (Gas Ozone)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 1000000,
      description: 'Gas Ozone therapy solution, 500ml per botol',
      stock: 60,
      minStock: 10,
    },
    {
      sku: 'INF-EDTA-500',
      name: 'EDTA (Chelation)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 1000000,
      description: 'EDTA chelation therapy solution, 500ml per botol',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'INF-MB-100',
      name: 'MB (Methylene Blue)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      pricePerUnit: 600000,
      description: 'Methylene Blue infusion solution, 100ml per botol',
      stock: 60,
      minStock: 15,
    },
    {
      sku: 'INF-H2S-1',
      name: 'H2S (Hydrogen Sulfide)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'vial',
      usageUnit: 'ml',
      conversionFactor: 1,
      pricePerUnit: 600000,
      description: 'Hydrogen Sulfide therapy solution, 1ml per vial',
      stock: 200,
      minStock: 50,
    },
    {
      sku: 'INF-KCL-500',
      name: 'KCL (Potassium Chloride)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 600000,
      description: 'Potassium Chloride electrolyte solution, 500ml per botol',
      stock: 150,
      minStock: 30,
    },
    {
      sku: 'INF-JML-500',
      name: 'JML/NB (Normal Saline)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 650000,
      description: 'Normal Saline (NaCl 0.9%) carrier solution, 500ml per botol',
      stock: 200,
      minStock: 40,
    },

    // ============================================================
    // AIR NANO - PRODUK ADD-ON (6 produk)
    // Dijual PER BOTOL (tidak perlu konversi ml)
    // ============================================================
    {
      sku: 'ARN-CB-600',
      name: 'Air Nano Biru 600ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'botol',
      conversionFactor: 1,
      pricePerUnit: 650000,
      description: 'Air Nano warna Biru 600ml per botol (dijual per botol)',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'ARN-CK-600',
      name: 'Air Nano Kuning 600ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'botol',
      conversionFactor: 1,
      pricePerUnit: 650000,
      description: 'Air Nano warna Kuning 600ml per botol (dijual per botol)',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'ARN-CH-600',
      name: 'Air Nano Hijau H2S 600ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'botol',
      conversionFactor: 1,
      pricePerUnit: 650000,
      description: 'Air Nano warna Hijau H2S 600ml per botol (dijual per botol)',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'ARN-CB-1500',
      name: 'Air Nano Biru 1500ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'botol',
      conversionFactor: 1,
      pricePerUnit: 650000,
      description: 'Air Nano warna Biru 1500ml per botol (dijual per botol)',
      stock: 60,
      minStock: 15,
    },
    {
      sku: 'ARN-CK-1500',
      name: 'Air Nano Kuning 1500ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'botol',
      conversionFactor: 1,
      pricePerUnit: 650000,
      description: 'Air Nano warna Kuning 1500ml per botol (dijual per botol)',
      stock: 60,
      minStock: 15,
    },
    {
      sku: 'ARN-CH-1500',
      name: 'Air Nano Hijau H2S 1500ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'botol',
      usageUnit: 'botol',
      conversionFactor: 1,
      pricePerUnit: 650000,
      description: 'Air Nano warna Hijau H2S 1500ml per botol (dijual per botol)',
      stock: 60,
      minStock: 15,
    },

    // ============================================================
    // ALAT MEDIS HABIS PAKAI (9 produk)
    // ============================================================
    {
      sku: 'MED-IFS-PC',
      name: 'Infus Set',
      category: ProductCategory.DEVICE,
      baseUnit: 'piece',
      usageUnit: 'piece',
      conversionFactor: 1,
      pricePerUnit: 22500000,
      description: 'Infus Set 1 piece',
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

    // ============================================================
    // ALAT MEDIS PERMANEN (2 produk)
    // ============================================================
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

    // ============================================================
    // OPERASIONAL (11 produk - essentials only)
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
      sku: 'OPS-KSH-MIX',
      name: 'Kantong Sampah Hitam (Mix)',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'pack',
      usageUnit: 'piece',
      conversionFactor: 20,
      pricePerUnit: 65000,
      description: 'Kantong sampah hitam berbagai ukuran (20 kantong per pack)',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'OPS-BAT-AA',
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
      sku: 'OPS-BAT-AAA',
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
        unit: product.usageUnit,
        baseUnit: product.baseUnit,
        usageUnit: product.usageUnit,
        conversionFactor: product.conversionFactor,
        description: product.description,
        isActive: true,
      },
      create: {
        name: product.name,
        category: product.category,
        unit: product.usageUnit,
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
          stockAmount = Math.floor(product.stock * 0.7);
        } else if (branch.branchCode === 'SBY') {
          stockAmount = Math.floor(product.stock * 0.5);
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

  console.log('✅ CONSOLIDATED inventory seeding completed!\n');
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
  
  console.log('\n🔄 MAJOR CONSOLIDATION COMPLETED:');
  console.log('   ✅ Cairan Infus: 12 produk (1 jenis = 1 produk)');
  console.log('   ✅ Air Nano: 6 produk (dijual per botol)');
  console.log('   ✅ Alat Medis: 11 produk');
  console.log('   ✅ Operasional: 11 produk');
  console.log('   ✅ Total: 40 produk (dari 46)');
  console.log('\n💡 Konversi Unit:');
  console.log('   • Cairan Terapi: Stok BOTOL → Pakai ML');
  console.log('   • Air Nano: Stok BOTOL → Jual BOTOL (no conversion)');
  console.log('   • Contoh: IFA 500ml → 1 botol = 500 ml');
  console.log('   • Pakai 450 ml → Stok berkurang 0.9 botol');
  console.log('──────────────────────────────────────────\n');
}

// Standalone execution
if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  async function main() {
    console.log('🌱 Running CONSOLIDATED inventory seeder...\n');
    await seedConsolidatedInventoryItems(prisma);
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
