import { PrismaClient, ProductCategory } from '@prisma/client';

/**
 * Official Inventory Items Seeder
 * Based on "List Barang RAHO.md" - Official RAHO Product List
 * 
 * SATUAN SESUAI LIST:
 * - IFA: Botol
 * - Cairan Terapi: gunakan baseUnit stok gudang dan usageUnit pemakaian terapi
 * - Handscoon: Kotak
 * - Oneswab: Kotak
 * - IV Cath, Ultrafik, Plesterin: Kotak
 * - Kantong Sampah: Pack
 * - Kertas HVS: Rim
 * - Inform Consent: Rangkap
 * - Lainnya: Piece/Unit/Botol sesuai list
 */

export async function seedOfficialInventoryItems(prisma: PrismaClient) {
  console.log('\n📦 Seeding OFFICIAL inventory items from List Barang RAHO...\n');

  // Get all branches
  const branches = await prisma.branch.findMany();
  if (branches.length === 0) {
    console.log('⚠️  No branches found, skipping inventory items seed');
    return;
  }

  const masterProducts = [
    // ==================== INFUS (INF) ====================
    { sku: 'PRD-INF-IFA-001', name: 'IFA 500ml', category: ProductCategory.MEDICINE, baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'IFA 500ml', stock: 50, minStock: 10 },
    { sku: 'PRD-INF-IFA-002', name: 'IFA + NO 2,5ml', category: ProductCategory.MEDICINE, baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'IFA + NO 2,5ml (default per terapi)', stock: 100, minStock: 20 },
    { sku: 'PRD-INF-SET-001', name: 'Infus Set', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Set infus lengkap - WAJIB per sesi terapi', stock: 500, minStock: 100 },

    // ==================== NANOBUBBLE THERAPY (NBT) ====================
    { sku: 'PRD-NBT-HHO-001', name: 'NB-HHO', category: ProductCategory.MEDICINE, baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 25, description: 'Nano Bubble HHO 25ml per botol - untuk field: hho', stock: 1320, minStock: 200 },
    { sku: 'PRD-NBT-HHO-002', name: 'HHO Konsentrat', category: ProductCategory.MEDICINE, baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'HHO Konsentrat', stock: 5000, minStock: 1000 },
    { sku: 'PRD-NBT-CNO-001', name: 'NB-NO (25ml)', category: ProductCategory.MEDICINE, baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Nano Bubble Nitric Oxide - untuk field: no', stock: 3000, minStock: 500 },
    { sku: 'PRD-NBT-CGT-001', name: 'NB Gasotransmitter (GT)', category: ProductCategory.MEDICINE, baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Nano Bubble Gasotransmitter - untuk field: gaso', stock: 17000, minStock: 3000 },
    { sku: 'PRD-NBT-CMB-001', name: 'NB Methyln Blue (MB)', category: ProductCategory.MEDICINE, baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Nano Bubble Methylene Blue - untuk field: mb', stock: 5000, minStock: 1000 },
    { sku: 'PRD-NBT-H2S-001', name: 'Cairan H2S', category: ProductCategory.MEDICINE, baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Cairan Hydrogen Sulfide - untuk field: h2s', stock: 650, minStock: 100 },
    { sku: 'PRD-NBT-H2S-002', name: 'NB H2S Konsentrat', category: ProductCategory.MEDICINE, baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Nano Bubble H2S Konsentrat', stock: 1000, minStock: 200 },
    { sku: 'PRD-NBT-CO3-001', name: 'Ozone (O3)', category: ProductCategory.MEDICINE, baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Ozone - untuk field: o3', stock: 10000, minStock: 2000 },
    { sku: 'PRD-NBT-KCL-001', name: 'KCL', category: ProductCategory.MEDICINE, baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Kalium Klorida - untuk field: kcl', stock: 3750, minStock: 750 },
    { sku: 'PRD-NBT-CH2-001', name: 'H2', category: ProductCategory.MEDICINE, baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Hydrogen - untuk field: h2', stock: 22000, minStock: 4000 },
    { sku: 'PRD-NBT-PRP-001', name: 'Cairan PRP', category: ProductCategory.MEDICINE, baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Platelet Rich Plasma', stock: 1500, minStock: 300 },

    // ==================== MEDICAL SUPPLIES (MED) ====================
    { sku: 'PRD-MED-IVC-001', name: 'IV Cath 24', category: ProductCategory.DEVICE, baseUnit: 'Kotak', usageUnit: 'Kotak', conversionFactor: 1, description: 'IV Catheter ukuran 24G', stock: 50, minStock: 10 },
    { sku: 'PRD-MED-URF-001', name: 'Ultrafik', category: ProductCategory.DEVICE, baseUnit: 'Kotak', usageUnit: 'Kotak', conversionFactor: 1, description: 'Ultrafik', stock: 50, minStock: 10 },
    { sku: 'PRD-MED-TUB-001', name: 'BD TUBE ACB 8.5ml', category: ProductCategory.DEVICE, baseUnit: 'Unit', usageUnit: 'Unit', conversionFactor: 1, description: 'BD Tube ACB 8.5ml', stock: 200, minStock: 50 },
    { sku: 'PRD-MED-SWB-001', name: 'Oneswab', category: ProductCategory.CONSUMABLE, baseUnit: 'Kotak', usageUnit: 'Kotak', conversionFactor: 1, description: 'Oneswab', stock: 100, minStock: 20 },
    { sku: 'PRD-MED-PTR-001', name: 'Plesterin', category: ProductCategory.CONSUMABLE, baseUnit: 'Kotak', usageUnit: 'Kotak', conversionFactor: 1, description: 'Plester', stock: 50, minStock: 10 },
    { sku: 'PRD-MED-SPT-001', name: 'Spuit 20cc', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 20cc', stock: 300, minStock: 75 },
    { sku: 'PRD-MED-SPT-002', name: 'Spuit 5cc (3cc)', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 5cc/3cc', stock: 400, minStock: 100 },
    { sku: 'PRD-MED-SPT-003', name: 'Spuit 5cc (10cc)', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 5cc/10cc', stock: 400, minStock: 100 },
    { sku: 'PRD-MED-NDL-001', name: 'Needle (Salin) (25G)', category: ProductCategory.CONSUMABLE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Needle Salin 25G', stock: 1000, minStock: 200 },
    { sku: 'PRD-MED-HDS-001', name: 'Handscoon S', category: ProductCategory.CONSUMABLE, baseUnit: 'Kotak', usageUnit: 'Kotak', conversionFactor: 1, description: 'Sarung tangan medis ukuran S', stock: 100, minStock: 20 },
    { sku: 'PRD-MED-HDS-002', name: 'Handscoon M', category: ProductCategory.CONSUMABLE, baseUnit: 'Kotak', usageUnit: 'Kotak', conversionFactor: 1, description: 'Sarung tangan medis ukuran M', stock: 100, minStock: 20 },
    { sku: 'PRD-MED-NPS-001', name: 'No Pain Spray', category: ProductCategory.MEDICINE, baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Spray penghilang nyeri', stock: 30, minStock: 10 },
    { sku: 'PRD-MED-HCC-001', name: 'Hot Cold Compress', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Kompres panas dingin', stock: 20, minStock: 5 },
    { sku: 'PRD-MED-OXI-001', name: 'Oximeter Fingertip Omicron', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Pulse Oximeter', stock: 10, minStock: 2 },
    { sku: 'PRD-MED-SYR-001', name: 'Syringe 50cc Catheher Tip', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 50cc dengan catheter tip', stock: 200, minStock: 50 },
    { sku: 'PRD-MED-SYR-002', name: 'Syringe 20cc Catheher Tip', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 20cc dengan catheter tip', stock: 300, minStock: 75 },
    { sku: 'PRD-MED-SYR-003', name: 'Syringe 5cc Catheher Tip', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 5cc dengan catheter tip', stock: 400, minStock: 100 },
    { sku: 'PRD-MED-SYR-004', name: 'Syringe 1cc Catheher Tip', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 1cc dengan catheter tip', stock: 500, minStock: 100 },
    { sku: 'PRD-MED-RDL-001', name: 'RedLight Therapy', category: ProductCategory.DEVICE, baseUnit: 'Unit', usageUnit: 'Unit', conversionFactor: 1, description: 'Alat terapi cahaya merah', stock: 5, minStock: 1 },
    { sku: 'PRD-MED-THB-001', name: 'Thrombophop Gel 20 grab', category: ProductCategory.MEDICINE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Gel Thrombophop 20 gram', stock: 30, minStock: 10 },
    { sku: 'PRD-MED-TNS-001', name: 'Tensi Digital Omron', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tensimeter digital Omron', stock: 8, minStock: 2 },
    { sku: 'PRD-MED-TNS-002', name: 'Tensi Manual + Stetoskop', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tensimeter manual dengan stetoskop', stock: 10, minStock: 2 },
    { sku: 'PRD-MED-TRQ-001', name: 'Tourniquet', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tourniquet untuk pemasangan infus', stock: 25, minStock: 5 },

    // ==================== AIR NANO (ANN) ====================
    { sku: 'PRD-ANN-KNG-001', name: 'Air Nano Kuning 600ml', category: ProductCategory.MEDICINE, baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Kuning 600ml', stock: 100, minStock: 20 },
    { sku: 'PRD-ANN-BRU-001', name: 'Air Nano Biru 600ml', category: ProductCategory.MEDICINE, baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Biru 600ml', stock: 100, minStock: 20 },
    { sku: 'PRD-ANN-H2S-001', name: 'Air Nano Hijau H2S 600ml', category: ProductCategory.MEDICINE, baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Hijau H2S 600ml', stock: 100, minStock: 20 },
    { sku: 'PRD-ANN-KNG-002', name: 'Air Nano Kuning 1500ml', category: ProductCategory.MEDICINE, baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Kuning 1500ml', stock: 60, minStock: 15 },
    { sku: 'PRD-ANN-BRU-002', name: 'Air Nano Biru 1500ml', category: ProductCategory.MEDICINE, baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Biru 1500ml', stock: 60, minStock: 15 },
    { sku: 'PRD-ANN-H2S-002', name: 'Air Nano Hijau H2S 1500ml', category: ProductCategory.MEDICINE, baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Hijau H2S 1500ml', stock: 60, minStock: 15 },

    // ==================== CONSUMABLES (CON) ====================
    { sku: 'PRD-CON-RKK-001', name: 'Rokok Kenkou', category: ProductCategory.CONSUMABLE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Rokok Kenkou', stock: 200, minStock: 50 },

    // ==================== FURNITURE (FUR) ====================
    { sku: 'PRD-FUR-TIF-001', name: 'Tiang Infus Portable', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tiang infus portable', stock: 15, minStock: 3 },
    { sku: 'PRD-FUR-TIF-002', name: 'Tiang Infus Beroda', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tiang infus dengan roda', stock: 10, minStock: 2 },
    { sku: 'PRD-FUR-SFR-001', name: 'Sofa Recliner', category: ProductCategory.DEVICE, baseUnit: 'Unit', usageUnit: 'Unit', conversionFactor: 1, description: 'Sofa recliner untuk pasien', stock: 5, minStock: 1 },
    { sku: 'PRD-FUR-MJI-001', name: 'Meja dengan Tiang Infus', category: ProductCategory.DEVICE, baseUnit: 'Unit', usageUnit: 'Unit', conversionFactor: 1, description: 'Meja dengan tiang infus terintegrasi', stock: 8, minStock: 2 },

    // ==================== DISPOSAL (DIS) ====================
    { sku: 'PRD-DIS-SBX-001', name: 'Safety Box Sampah Medis 2.5L Include Inner & Tali', category: ProductCategory.CONSUMABLE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Safety Box Sampah Medis 2.5L', stock: 100, minStock: 20 },
    { sku: 'PRD-DIS-KSH-001', name: 'Kantong Sampah Hitam 40 x 50', category: ProductCategory.CONSUMABLE, baseUnit: 'Pack', usageUnit: 'Pack', conversionFactor: 1, description: 'Kantong sampah hitam 40x50cm', stock: 50, minStock: 10 },
    { sku: 'PRD-DIS-KSH-002', name: 'Kantong Sampah Hitam 60 x 100', category: ProductCategory.CONSUMABLE, baseUnit: 'Pack', usageUnit: 'Pack', conversionFactor: 1, description: 'Kantong sampah hitam 60x100cm', stock: 40, minStock: 10 },
    { sku: 'PRD-DIS-KSH-003', name: 'Kantong Sampah Hitam 100 x 120', category: ProductCategory.CONSUMABLE, baseUnit: 'Pack', usageUnit: 'Pack', conversionFactor: 1, description: 'Kantong sampah hitam 100x120cm', stock: 30, minStock: 6 },
    { sku: 'PRD-DIS-KSM-001', name: 'Kantong Sampah Medis 40 x 50', category: ProductCategory.CONSUMABLE, baseUnit: 'Pack', usageUnit: 'Pack', conversionFactor: 1, description: 'Kantong sampah medis 40x50cm', stock: 50, minStock: 10 },
    { sku: 'PRD-DIS-KSM-002', name: 'Kantong Sampah Medis 60 x 100', category: ProductCategory.CONSUMABLE, baseUnit: 'Pack', usageUnit: 'Pack', conversionFactor: 1, description: 'Kantong sampah medis 60x100cm', stock: 40, minStock: 10 },
    { sku: 'PRD-DIS-PLS-001', name: 'Plastik IMI', category: ProductCategory.CONSUMABLE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Plastik IMI', stock: 100, minStock: 20 },

    // ==================== ACCESSORIES (ACC) ====================
    { sku: 'PRD-ACC-BTR-001', name: 'Baterai AA', category: ProductCategory.CONSUMABLE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Baterai AA', stock: 160, minStock: 40 },
    { sku: 'PRD-ACC-BTR-002', name: 'Baterai AAA', category: ProductCategory.CONSUMABLE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Baterai AAA', stock: 160, minStock: 40 },
    { sku: 'PRD-ACC-BTL-001', name: 'Bantal Infus', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Bantal untuk infus', stock: 20, minStock: 5 },
    { sku: 'PRD-ACC-SLM-001', name: 'Selimut 120 x 160', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Selimut ukuran 120x160cm', stock: 15, minStock: 5 },
    { sku: 'PRD-ACC-TNK-001', name: 'Tas Nakes 40 x 27.3 x 22.3 cm', category: ProductCategory.DEVICE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tas nakes', stock: 10, minStock: 2 },

    // ==================== DOCUMENTS (DOC) ====================
    { sku: 'PRD-DOC-HVS-001', name: 'Kertas HVS', category: ProductCategory.CONSUMABLE, baseUnit: 'Rim', usageUnit: 'Rim', conversionFactor: 1, description: 'Kertas HVS A4', stock: 20, minStock: 5 },
    { sku: 'PRD-DOC-MAP-001', name: 'Map Rekam Medis', category: ProductCategory.CONSUMABLE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Map untuk rekam medis', stock: 200, minStock: 50 },
    { sku: 'PRD-DOC-FRP-001', name: 'Form Pendaftaran', category: ProductCategory.CONSUMABLE, baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Form pendaftaran pasien', stock: 500, minStock: 100 },
    { sku: 'PRD-DOC-IFC-001', name: 'Inform Consent', category: ProductCategory.CONSUMABLE, baseUnit: 'Rangkap', usageUnit: 'Rangkap', conversionFactor: 1, description: 'Form informed consent', stock: 500, minStock: 100 },
  ];

  let created = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`📋 Processing ${masterProducts.length} products across ${branches.length} branches...\n`);

  for (const product of masterProducts) {
    // Create or update MasterProduct using SKU
    const existingProduct = await prisma.masterProduct.findUnique({
      where: { sku: product.sku },
    });

    const masterProduct = await prisma.masterProduct.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        category: product.category,
        unit: product.usageUnit,
        baseUnit: product.baseUnit,
        usageUnit: product.usageUnit,
        conversionFactor: product.conversionFactor,
        description: product.description,
        isActive: true,
      },
      create: {
        sku: product.sku,
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
  
  console.log('\n💡 SATUAN SESUAI LIST BARANG RAHO:');
  console.log('   • IFA: Botol');
  console.log('   • Cairan Terapi: baseUnit stok gudang, usageUnit pemakaian terapi');
  console.log('   • Handscoon S/M: Kotak');
  console.log('   • Oneswab: Kotak');
  console.log('   • IV Cath, Ultrafik, Plesterin: Kotak');
  console.log('   • Kantong Sampah: Pack');
  console.log('   • Kertas HVS: Rim');
  console.log('   • Inform Consent: Rangkap');
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
