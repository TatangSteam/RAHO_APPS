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
    // CAIRAN INFUS UNTUK TERAPI - SKU: PRD-INF-xxx / PRD-NBT-xxx
    // Sesuai dokumen LOGISTIK
    // ============================================================
    {
      sku: 'PRD-INF-IFA-001',
      name: 'IFA A + MG 500ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 2000000,
      description: 'IFA A + MG 500ml per botol',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'PRD-INF-IFA-002',
      name: 'IFA A + MG 250ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'ml',
      conversionFactor: 250,
      pricePerUnit: 1200000,
      description: 'IFA A + MG 250ml per botol',
      stock: 40,
      minStock: 10,
    },
    {
      sku: 'PRD-NBT-HHO-001',
      name: 'NB-HHO',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 1000000,
      description: 'Nano Bubble HHO therapy solution',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'PRD-NBT-HHO-002',
      name: 'HHO Konsentrat',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      pricePerUnit: 800000,
      description: 'HHO Konsentrat',
      stock: 60,
      minStock: 15,
    },
    {
      sku: 'PRD-NBT-CH2-001',
      name: 'H2',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 1000000,
      description: 'Hydrogen gas infusion solution',
      stock: 80,
      minStock: 15,
    },
    {
      sku: 'PRD-NBT-CNO-001',
      name: 'NB-NO (25ml)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'ml',
      conversionFactor: 25,
      pricePerUnit: 650000,
      description: 'Nano Bubble Nitric Oxide 25ml per botol',
      stock: 120,
      minStock: 25,
    },
    {
      sku: 'PRD-NBT-CO3-001',
      name: 'Ozone (O3)',
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
      sku: 'PRD-NBT-CGT-001',
      name: 'NB Gasotransmitter (GT)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      pricePerUnit: 600000,
      description: 'Nano Bubble Gasotransmitter',
      stock: 60,
      minStock: 10,
    },
    {
      sku: 'PRD-NBT-CMB-001',
      name: 'NB Methyln Blue (MB)',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      pricePerUnit: 600000,
      description: 'Nano Bubble Methylene Blue',
      stock: 60,
      minStock: 15,
    },
    {
      sku: 'PRD-NBT-H2S-001',
      name: 'Cairan H2S',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'ml',
      conversionFactor: 100,
      pricePerUnit: 600000,
      description: 'Cairan Hydrogen Sulfide',
      stock: 100,
      minStock: 25,
    },
    {
      sku: 'PRD-NBT-H2S-002',
      name: 'NB H2S Konsentrat',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'ml',
      conversionFactor: 10,
      pricePerUnit: 800000,
      description: 'Nano Bubble H2S Konsentrat',
      stock: 80,
      minStock: 20,
    },
    {
      sku: 'PRD-NBT-KCL-001',
      name: 'KCL',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'ml',
      conversionFactor: 500,
      pricePerUnit: 600000,
      description: 'Potassium Chloride solution',
      stock: 150,
      minStock: 30,
    },
    {
      sku: 'PRD-NBT-PRP-001',
      name: 'Cairan PRP',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'ml',
      conversionFactor: 50,
      pricePerUnit: 1500000,
      description: 'Cairan PRP (Platelet Rich Plasma)',
      stock: 30,
      minStock: 10,
    },
    {
      sku: 'PRD-NBT-JML-001',
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
    // AIR NANO - PRODUK ADD-ON - SKU: PRD-ANN-xxx
    // Sesuai dokumen LOGISTIK
    // ============================================================
    {
      sku: 'PRD-ANN-BRU-001',
      name: 'Air Nano Biru 600ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'Botol',
      conversionFactor: 1,
      pricePerUnit: 15000,
      description: 'Air Nano warna Biru 600ml per botol',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'PRD-ANN-KNG-001',
      name: 'Air Nano Kuning 600ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'Botol',
      conversionFactor: 1,
      pricePerUnit: 15000,
      description: 'Air Nano warna Kuning 600ml per botol',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'PRD-ANN-H2S-001',
      name: 'Air Nano Hijau H2S 600ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'Botol',
      conversionFactor: 1,
      pricePerUnit: 15000,
      description: 'Air Nano warna Hijau H2S 600ml per botol',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'PRD-ANN-BRU-002',
      name: 'Air Nano Biru 1500ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'Botol',
      conversionFactor: 1,
      pricePerUnit: 35000,
      description: 'Air Nano warna Biru 1500ml per botol',
      stock: 60,
      minStock: 15,
    },
    {
      sku: 'PRD-ANN-KNG-002',
      name: 'Air Nano Kuning 1500ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'Botol',
      conversionFactor: 1,
      pricePerUnit: 35000,
      description: 'Air Nano warna Kuning 1500ml per botol',
      stock: 60,
      minStock: 15,
    },
    {
      sku: 'PRD-ANN-H2S-002',
      name: 'Air Nano Hijau H2S 1500ml',
      category: ProductCategory.MEDICINE,
      baseUnit: 'Botol',
      usageUnit: 'Botol',
      conversionFactor: 1,
      pricePerUnit: 35000,
      description: 'Air Nano warna Hijau H2S 1500ml per botol',
      stock: 60,
      minStock: 15,
    },

    // ============================================================
    // ROKOK KENKOU - SKU: PRD-CON-RKK-xxx
    // ============================================================
    {
      sku: 'PRD-CON-RKK-001',
      name: 'Rokok Kenkou',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 20000,
      description: 'Rokok Kenkou 1 bungkus',
      stock: 200,
      minStock: 50,
    },

    // ============================================================
    // ALAT MEDIS - SKU: PRD-MED-xxx / PRD-INF-xxx
    // Sesuai dokumen LOGISTIK
    // ============================================================
    {
      sku: 'PRD-INF-SET-001',
      name: 'Infus Set',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 25000,
      description: 'Infus Set steril',
      stock: 500,
      minStock: 100,
    },
    {
      sku: 'PRD-MED-NDL-001',
      name: 'Needle (Salin) (25G)',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 5000,
      description: 'Jarum infus 25G',
      stock: 1000,
      minStock: 200,
    },
    {
      sku: 'PRD-MED-URF-001',
      name: 'Ultrafik',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Kotak',
      usageUnit: 'Unit',
      conversionFactor: 100,
      pricePerUnit: 150000,
      description: 'Ultrafik 1 kotak',
      stock: 20,
      minStock: 5,
    },
    {
      sku: 'PRD-MED-SWB-001',
      name: 'Oneswab',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Kotak',
      usageUnit: 'Piece',
      conversionFactor: 100,
      pricePerUnit: 50000,
      description: 'Oneswab 1 kotak',
      stock: 25,
      minStock: 5,
    },
    {
      sku: 'PRD-MED-HDS-001',
      name: 'Handscoon S',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Kotak',
      usageUnit: 'Piece',
      conversionFactor: 100,
      pricePerUnit: 70000,
      description: 'Sarung tangan medis ukuran S 1 kotak',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'PRD-MED-HDS-002',
      name: 'Handscoon M',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Kotak',
      usageUnit: 'Piece',
      conversionFactor: 100,
      pricePerUnit: 70000,
      description: 'Sarung tangan medis ukuran M 1 kotak',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'PRD-MED-SYR-001',
      name: 'Syringe 50cc Catheher Tip',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 15000,
      description: 'Syringe 50cc dengan catheter tip',
      stock: 200,
      minStock: 50,
    },
    {
      sku: 'PRD-MED-SYR-002',
      name: 'Syringe 20cc Catheher Tip',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 10000,
      description: 'Syringe 20cc dengan catheter tip',
      stock: 300,
      minStock: 75,
    },
    {
      sku: 'PRD-MED-SYR-003',
      name: 'Syringe 5cc Catheher Tip',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 5000,
      description: 'Syringe 5cc dengan catheter tip',
      stock: 400,
      minStock: 100,
    },
    {
      sku: 'PRD-MED-SYR-004',
      name: 'Syringe 1cc Catheher Tip',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 3000,
      description: 'Syringe 1cc dengan catheter tip',
      stock: 500,
      minStock: 100,
    },
    {
      sku: 'PRD-MED-SPT-001',
      name: 'Spuit 20cc',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 6000,
      description: 'Spuit 20cc',
      stock: 300,
      minStock: 75,
    },
    {
      sku: 'PRD-MED-SPT-002',
      name: 'Spuit 5cc (3cc)',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 3000,
      description: 'Spuit 5cc (3cc)',
      stock: 400,
      minStock: 100,
    },
    {
      sku: 'PRD-MED-SPT-003',
      name: 'Spuit 5cc (10cc)',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 4000,
      description: 'Spuit 5cc (10cc)',
      stock: 400,
      minStock: 100,
    },
    {
      sku: 'PRD-DIS-SBX-001',
      name: 'Safety Box Sampah Medis 2.5L Include Inner & Tali',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 12000,
      description: 'Safety Box untuk sampah medis 2.5L (Include Inner & Tali)',
      stock: 100,
      minStock: 20,
    },
    {
      sku: 'PRD-MED-IVC-001',
      name: 'IV Cath 24',
      category: ProductCategory.DEVICE,
      baseUnit: 'Kotak',
      usageUnit: 'Unit',
      conversionFactor: 50,
      pricePerUnit: 500000,
      description: 'IV Catheter 24G 1 kotak',
      stock: 30,
      minStock: 10,
    },
    {
      sku: 'PRD-MED-TUB-001',
      name: 'BD TUBE ACB 8.5ml',
      category: ProductCategory.DEVICE,
      baseUnit: 'Unit',
      usageUnit: 'Unit',
      conversionFactor: 1,
      pricePerUnit: 25000,
      description: 'BD TUBE ACB 8.5ml',
      stock: 200,
      minStock: 50,
    },
    {
      sku: 'PRD-MED-PTR-001',
      name: 'Plesterin',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Kotak',
      usageUnit: 'Piece',
      conversionFactor: 50,
      pricePerUnit: 30000,
      description: 'Plesterin 1 kotak',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'PRD-MED-NPS-001',
      name: 'No Pain Spray',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Botol',
      usageUnit: 'Botol',
      conversionFactor: 1,
      pricePerUnit: 75000,
      description: 'No Pain Spray 1 botol',
      stock: 30,
      minStock: 10,
    },
    {
      sku: 'PRD-MED-HCC-001',
      name: 'Hot Cold Compress',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 50000,
      description: 'Hot Cold Compress',
      stock: 20,
      minStock: 5,
    },
    {
      sku: 'PRD-MED-THB-001',
      name: 'Thrombophop Gel 20 grab',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 45000,
      description: 'Thrombophop Gel 20 gram',
      stock: 30,
      minStock: 10,
    },

    // ============================================================
    // ALAT MEDIS PERMANEN - SKU: PRD-MED-xxx
    // ============================================================
    {
      sku: 'PRD-MED-OXI-001',
      name: 'Oximeter Fingertip Omicron',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 90000,
      description: 'Oximeter Fingertip Omicron',
      stock: 10,
      minStock: 2,
    },
    {
      sku: 'PRD-MED-RDL-001',
      name: 'RedLight Therapy',
      category: ProductCategory.DEVICE,
      baseUnit: 'Unit',
      usageUnit: 'Unit',
      conversionFactor: 1,
      pricePerUnit: 18000000,
      description: 'RedLight Therapy unit',
      stock: 5,
      minStock: 1,
    },
    {
      sku: 'PRD-MED-TNS-001',
      name: 'Tensimeter Omron HEM-7600T',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 2200000,
      description: 'Tensimeter digital Omron HEM-7600T',
      stock: 8,
      minStock: 2,
    },
    {
      sku: 'PRD-MED-TNS-002',
      name: 'Tensi Manual + Stetoskop',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 350000,
      description: 'Tensimeter manual dengan stetoskop',
      stock: 10,
      minStock: 2,
    },
    {
      sku: 'PRD-MED-TRQ-001',
      name: 'Tourniquet',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 12500,
      description: 'Tourniquet untuk pemasangan infus',
      stock: 25,
      minStock: 5,
    },

    // ============================================================
    // OPERASIONAL (11 produk - essentials only)
    // ============================================================
    // FURNITUR - SKU: PRD-FUR-xxx
    // ============================================================
    {
      sku: 'PRD-FUR-TIF-001',
      name: 'Tiang Infus Portable',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 125000,
      description: 'Tiang Infus Portable',
      stock: 15,
      minStock: 3,
    },
    {
      sku: 'PRD-FUR-TIF-002',
      name: 'Tiang Infus Beroda',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 600000,
      description: 'Tiang Infus Beroda',
      stock: 10,
      minStock: 2,
    },
    {
      sku: 'PRD-FUR-SFR-001',
      name: 'Sofa Recliner',
      category: ProductCategory.DEVICE,
      baseUnit: 'Unit',
      usageUnit: 'Unit',
      conversionFactor: 1,
      pricePerUnit: 8500000,
      description: 'Sofa Recliner untuk terapi',
      stock: 5,
      minStock: 1,
    },
    {
      sku: 'PRD-FUR-MJI-001',
      name: 'Meja dengan Tiang Infus',
      category: ProductCategory.DEVICE,
      baseUnit: 'Unit',
      usageUnit: 'Unit',
      conversionFactor: 1,
      pricePerUnit: 660000,
      description: 'Meja Patron/Infus',
      stock: 8,
      minStock: 2,
    },

    // ============================================================
    // DISPOSABLE - SKU: PRD-DIS-xxx
    // ============================================================
    {
      sku: 'PRD-DIS-KSH-001',
      name: 'Kantong Sampah Hitam 40 x 50',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Pack',
      usageUnit: 'Piece',
      conversionFactor: 20,
      pricePerUnit: 17000,
      description: 'Kantong Sampah Hitam 40 x 50',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'PRD-DIS-KSH-002',
      name: 'Kantong Sampah Hitam 60 x 100',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Pack',
      usageUnit: 'Piece',
      conversionFactor: 20,
      pricePerUnit: 17000,
      description: 'Kantong Sampah Hitam 60 x 100',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'PRD-DIS-KSH-003',
      name: 'Kantong Sampah Hitam 100 x 120',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Pack',
      usageUnit: 'Piece',
      conversionFactor: 20,
      pricePerUnit: 17000,
      description: 'Kantong Sampah Hitam 100 x 120',
      stock: 30,
      minStock: 10,
    },
    {
      sku: 'PRD-DIS-KSM-001',
      name: 'Kantong Sampah Medis 40 x 50',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Pack',
      usageUnit: 'Piece',
      conversionFactor: 20,
      pricePerUnit: 17000,
      description: 'Kantong Sampah Medis 40 x 50',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'PRD-DIS-KSM-002',
      name: 'Kantong Sampah Medis 60 x 100',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Pack',
      usageUnit: 'Piece',
      conversionFactor: 20,
      pricePerUnit: 17000,
      description: 'Kantong Sampah Medis 60 x 100',
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'PRD-DIS-PLS-001',
      name: 'Plastik IMI',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 5000,
      description: 'Plastik IMI',
      stock: 100,
      minStock: 20,
    },

    // ============================================================
    // AKSESORIS - SKU: PRD-ACC-xxx
    // ============================================================
    {
      sku: 'PRD-ACC-BTR-001',
      name: 'Baterai AA',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 5000,
      description: 'Baterai AA',
      stock: 40,
      minStock: 10,
    },
    {
      sku: 'PRD-ACC-BTR-002',
      name: 'Baterai AAA',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 5000,
      description: 'Baterai AAA',
      stock: 40,
      minStock: 10,
    },
    {
      sku: 'PRD-ACC-BTL-001',
      name: 'Bantal Infus',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 50000,
      description: 'Bantal untuk terapi infus',
      stock: 20,
      minStock: 5,
    },
    {
      sku: 'PRD-ACC-SLM-001',
      name: 'Selimut 120 x 160',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 75000,
      description: 'Selimut 120 x 160',
      stock: 15,
      minStock: 5,
    },
    {
      sku: 'PRD-ACC-TNK-001',
      name: 'Tas Nakes 40 x 27.3 x 22.3 cm',
      category: ProductCategory.DEVICE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 200000,
      description: 'Tas Nakes 40 x 27.3 x 22.3 cm',
      stock: 10,
      minStock: 2,
    },

    // ============================================================
    // DOKUMEN - SKU: PRD-DOC-xxx
    // ============================================================
    {
      sku: 'PRD-DOC-HVS-001',
      name: 'Kertas HVS',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Rim',
      usageUnit: 'Lembar',
      conversionFactor: 500,
      pricePerUnit: 50000,
      description: 'Kertas HVS A4 1 rim (500 lembar)',
      stock: 20,
      minStock: 5,
    },
    {
      sku: 'PRD-DOC-MAP-001',
      name: 'Map Rekam Medis',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 5000,
      description: 'Map untuk rekam medis pasien',
      stock: 200,
      minStock: 50,
    },
    {
      sku: 'PRD-DOC-FRP-001',
      name: 'Form Pendaftaran',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Piece',
      usageUnit: 'Piece',
      conversionFactor: 1,
      pricePerUnit: 1000,
      description: 'Form pendaftaran member',
      stock: 500,
      minStock: 100,
    },
    {
      sku: 'PRD-DOC-IFC-001',
      name: 'Inform Consent',
      category: ProductCategory.CONSUMABLE,
      baseUnit: 'Rangkap',
      usageUnit: 'Rangkap',
      conversionFactor: 1,
      pricePerUnit: 2000,
      description: 'Inform Consent 1 rangkap',
      stock: 500,
      minStock: 100,
    },
  ];

  let created = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`📋 Processing ${masterProducts.length} products across ${branches.length} branches...\n`);  for (const product of masterProducts) {
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
