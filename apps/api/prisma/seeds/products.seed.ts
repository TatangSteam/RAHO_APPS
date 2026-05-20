import { PrismaClient, ProductCategory } from '@prisma/client';

export async function seedProducts(prisma: PrismaClient) {
  console.log('💊 Seeding master products...');

  const products = [
    // ==================== INFUS (INF) ====================
    // IFA + NO 2,5ml - Wajib tiap terapi 1 botol (250ml)
    { sku: 'PRD-INF-IFA-001', name: 'IFA + NO 2,5ml (250ml)', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'IFA + NO 2,5ml dalam botol 250ml - Wajib 1 botol per terapi' },
    // IFA Biasa 500ml - Special case / alternatif
    { sku: 'PRD-INF-IFA-002', name: 'IFA A + MG 500ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'IFA A + MG 500ml - Alternatif/special case' },
    // Infus Set
    { sku: 'PRD-INF-SET-001', name: 'Infus Set', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Set infus lengkap' },

    // ==================== NANOBUBBLE (NBT) ====================
    { sku: 'PRD-NBT-HHO-001', name: 'NB-HHO', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'Botol', usageUnit: 'ml', conversionFactor: 500, description: 'Nanobubble HHO' },
    { sku: 'PRD-NBT-HHO-002', name: 'HHO Konsentrat', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'Botol', usageUnit: 'ml', conversionFactor: 500, description: 'HHO Konsentrat' },
    { sku: 'PRD-NBT-CNO-001', name: 'NB-NO (25ml)', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'Botol', usageUnit: 'ml', conversionFactor: 25, description: 'Nanobubble NO 25ml' },
    { sku: 'PRD-NBT-CGT-001', name: 'NB Gasotransmitter (GT)', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'Botol', usageUnit: 'ml', conversionFactor: 500, description: 'Nanobubble Gasotransmitter' },
    { sku: 'PRD-NBT-CMB-001', name: 'NB Methyln Blue (MB)', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'Botol', usageUnit: 'ml', conversionFactor: 100, description: 'Nanobubble Methylene Blue' },
    { sku: 'PRD-NBT-H2S-001', name: 'Cairan H2S', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'Botol', usageUnit: 'ml', conversionFactor: 500, description: 'Cairan Hydrogen Sulfide' },
    { sku: 'PRD-NBT-H2S-002', name: 'NB H2S Konsentrat', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'Botol', usageUnit: 'ml', conversionFactor: 500, description: 'Nanobubble H2S Konsentrat' },
    { sku: 'PRD-NBT-CO3-001', name: 'Ozone (O3)', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'Botol', usageUnit: 'ml', conversionFactor: 500, description: 'Ozone O3' },
    { sku: 'PRD-NBT-KCL-001', name: 'KCL', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'Botol', usageUnit: 'ml', conversionFactor: 500, description: 'Kalium Klorida' },
    { sku: 'PRD-NBT-CH2-001', name: 'H2', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'Botol', usageUnit: 'ml', conversionFactor: 500, description: 'Hydrogen H2' },
    { sku: 'PRD-NBT-PRP-001', name: 'Cairan PRP', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'Botol', usageUnit: 'ml', conversionFactor: 500, description: 'Platelet Rich Plasma' },

    // ==================== MEDICAL SUPPLIES (MED) ====================
    { sku: 'PRD-MED-IVC-001', name: 'IV Cath 24', category: ProductCategory.DEVICE, unit: 'Kotak', baseUnit: 'Kotak', usageUnit: 'Piece', conversionFactor: 50, description: 'IV Catheter ukuran 24G' },
    { sku: 'PRD-MED-URF-001', name: 'Ultrafik', category: ProductCategory.DEVICE, unit: 'Kotak', baseUnit: 'Kotak', usageUnit: 'Piece', conversionFactor: 50, description: 'Ultrafik' },
    { sku: 'PRD-MED-TUB-001', name: 'BD TUBE ACB 8.5ml', category: ProductCategory.DEVICE, unit: 'Unit', baseUnit: 'Unit', usageUnit: 'Unit', conversionFactor: 1, description: 'BD Tube ACB 8.5ml' },
    { sku: 'PRD-MED-SWB-001', name: 'Oneswab', category: ProductCategory.CONSUMABLE, unit: 'Kotak', baseUnit: 'Kotak', usageUnit: 'Piece', conversionFactor: 100, description: 'Oneswab steril' },
    { sku: 'PRD-MED-PTR-001', name: 'Plesterin', category: ProductCategory.CONSUMABLE, unit: 'Kotak', baseUnit: 'Kotak', usageUnit: 'Piece', conversionFactor: 100, description: 'Plester' },
    { sku: 'PRD-MED-SPT-001', name: 'Spuit 20cc', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 20cc' },
    { sku: 'PRD-MED-SPT-002', name: 'Spuit 5cc (3cc)', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 5cc/3cc' },
    { sku: 'PRD-MED-SPT-003', name: 'Spuit 5cc (10cc)', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 5cc/10cc' },
    { sku: 'PRD-MED-NDL-001', name: 'Needle (Salin) (25G)', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Needle Salin 25G' },
    { sku: 'PRD-MED-HDS-001', name: 'Handscoon S', category: ProductCategory.CONSUMABLE, unit: 'Kotak', baseUnit: 'Kotak', usageUnit: 'Pasang', conversionFactor: 50, description: 'Sarung tangan ukuran S' },
    { sku: 'PRD-MED-HDS-002', name: 'Handscoon M', category: ProductCategory.CONSUMABLE, unit: 'Kotak', baseUnit: 'Kotak', usageUnit: 'Pasang', conversionFactor: 50, description: 'Sarung tangan ukuran M' },
    { sku: 'PRD-MED-NPS-001', name: 'No Pain Spray', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Spray penghilang nyeri' },
    { sku: 'PRD-MED-HCC-001', name: 'Hot Cold Compress', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Kompres panas dingin' },
    { sku: 'PRD-MED-OXI-001', name: 'Oximeter Fingertip Omicron', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Pulse Oximeter' },
    { sku: 'PRD-MED-SYR-001', name: 'Syringe 50cc Catheter Tip', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 50cc dengan catheter tip' },
    { sku: 'PRD-MED-SYR-002', name: 'Syringe 20cc Catheter Tip', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 20cc dengan catheter tip' },
    { sku: 'PRD-MED-SYR-003', name: 'Syringe 5cc Catheter Tip', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 5cc dengan catheter tip' },
    { sku: 'PRD-MED-SYR-004', name: 'Syringe 1cc Catheter Tip', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 1cc dengan catheter tip' },
    { sku: 'PRD-MED-RDL-001', name: 'RedLight Therapy', category: ProductCategory.DEVICE, unit: 'Unit', baseUnit: 'Unit', usageUnit: 'Unit', conversionFactor: 1, description: 'Alat terapi cahaya merah' },
    { sku: 'PRD-MED-THB-001', name: 'Thrombophop Gel 20 gram', category: ProductCategory.MEDICINE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Gel Thrombophop 20 gram' },
    { sku: 'PRD-MED-TNS-001', name: 'Tensi Digital Omron', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tensimeter digital Omron' },
    { sku: 'PRD-MED-TNS-002', name: 'Tensi Manual + Stetoskop', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tensimeter manual dengan stetoskop' },
    { sku: 'PRD-MED-TRQ-001', name: 'Tourniquet', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tourniquet untuk pemasangan infus' },

    // ==================== AIR NANO (ANN) ====================
    { sku: 'PRD-ANN-KNG-001', name: 'Air Nano Kuning 600ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Kuning 600ml' },
    { sku: 'PRD-ANN-BRU-001', name: 'Air Nano Biru 600ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Biru 600ml' },
    { sku: 'PRD-ANN-H2S-001', name: 'Air Nano Hijau H2S 600ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Hijau H2S 600ml' },
    { sku: 'PRD-ANN-KNG-002', name: 'Air Nano Kuning 1500ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Kuning 1500ml' },
    { sku: 'PRD-ANN-BRU-002', name: 'Air Nano Biru 1500ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Biru 1500ml' },
    { sku: 'PRD-ANN-H2S-002', name: 'Air Nano Hijau H2S 1500ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Hijau H2S 1500ml' },

    // ==================== CONSUMABLES (CON) ====================
    { sku: 'PRD-CON-RKK-001', name: 'Rokok Kenkou', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Rokok Kenkou' },

    // ==================== FURNITURE (FUR) ====================
    { sku: 'PRD-FUR-TIF-001', name: 'Tiang Infus Portable', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tiang infus portable' },
    { sku: 'PRD-FUR-TIF-002', name: 'Tiang Infus Beroda', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tiang infus dengan roda' },
    { sku: 'PRD-FUR-SFR-001', name: 'Sofa Recliner', category: ProductCategory.DEVICE, unit: 'Unit', baseUnit: 'Unit', usageUnit: 'Unit', conversionFactor: 1, description: 'Sofa recliner untuk pasien' },
    { sku: 'PRD-FUR-MJI-001', name: 'Meja dengan Tiang Infus', category: ProductCategory.DEVICE, unit: 'Unit', baseUnit: 'Unit', usageUnit: 'Unit', conversionFactor: 1, description: 'Meja dengan tiang infus terintegrasi' },

    // ==================== DISPOSAL (DIS) ====================
    { sku: 'PRD-DIS-SBX-001', name: 'Safety Box Sampah Medis 2.5L', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Safety Box Sampah Medis 2.5L Include Inner & Tali' },
    { sku: 'PRD-DIS-KSH-001', name: 'Kantong Sampah Hitam 40 x 50', category: ProductCategory.CONSUMABLE, unit: 'Pack', baseUnit: 'Pack', usageUnit: 'Piece', conversionFactor: 50, description: 'Kantong sampah hitam 40x50cm' },
    { sku: 'PRD-DIS-KSH-002', name: 'Kantong Sampah Hitam 60 x 100', category: ProductCategory.CONSUMABLE, unit: 'Pack', baseUnit: 'Pack', usageUnit: 'Piece', conversionFactor: 25, description: 'Kantong sampah hitam 60x100cm' },
    { sku: 'PRD-DIS-KSH-003', name: 'Kantong Sampah Hitam 100 x 120', category: ProductCategory.CONSUMABLE, unit: 'Pack', baseUnit: 'Pack', usageUnit: 'Piece', conversionFactor: 10, description: 'Kantong sampah hitam 100x120cm' },
    { sku: 'PRD-DIS-KSM-001', name: 'Kantong Sampah Medis 40 x 50', category: ProductCategory.CONSUMABLE, unit: 'Pack', baseUnit: 'Pack', usageUnit: 'Piece', conversionFactor: 50, description: 'Kantong sampah medis 40x50cm' },
    { sku: 'PRD-DIS-KSM-002', name: 'Kantong Sampah Medis 60 x 100', category: ProductCategory.CONSUMABLE, unit: 'Pack', baseUnit: 'Pack', usageUnit: 'Piece', conversionFactor: 25, description: 'Kantong sampah medis 60x100cm' },
    { sku: 'PRD-DIS-PLS-001', name: 'Plastik IMI', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Plastik IMI' },

    // ==================== ACCESSORIES (ACC) ====================
    { sku: 'PRD-ACC-BTR-001', name: 'Baterai AA', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Baterai AA' },
    { sku: 'PRD-ACC-BTR-002', name: 'Baterai AAA', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Baterai AAA' },
    { sku: 'PRD-ACC-BTL-001', name: 'Bantal Infus', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Bantal untuk infus' },
    { sku: 'PRD-ACC-SLM-001', name: 'Selimut 120 x 160', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Selimut ukuran 120x160cm' },
    { sku: 'PRD-ACC-TNK-001', name: 'Tas Nakes 40 x 27.3 x 22.3 cm', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tas nakes ukuran 40x27.3x22.3cm' },

    // ==================== DOCUMENTS (DOC) ====================
    { sku: 'PRD-DOC-HVS-001', name: 'Kertas HVS', category: ProductCategory.CONSUMABLE, unit: 'Rim', baseUnit: 'Rim', usageUnit: 'Lembar', conversionFactor: 500, description: 'Kertas HVS A4' },
    { sku: 'PRD-DOC-MAP-001', name: 'Map Rekam Medis', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Map untuk rekam medis' },
    { sku: 'PRD-DOC-FRP-001', name: 'Form Pendaftaran', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Form pendaftaran pasien' },
    { sku: 'PRD-DOC-IFC-001', name: 'Inform Consent', category: ProductCategory.CONSUMABLE, unit: 'Rangkap', baseUnit: 'Rangkap', usageUnit: 'Rangkap', conversionFactor: 1, description: 'Form informed consent' },
  ];

  const createdProducts: { id: string; name: string; sku?: string }[] = [];
  
  for (const p of products) {
    const product = await prisma.masterProduct.upsert({
      where: { name: p.name },
      update: {
        sku: p.sku,
        category: p.category,
        unit: p.unit,
        baseUnit: p.baseUnit,
        usageUnit: p.usageUnit,
        conversionFactor: p.conversionFactor,
        description: p.description,
      },
      create: p,
    });
    createdProducts.push({ ...product, sku: p.sku });
  }

  console.log(`✅ Master products: ${products.length} entries`);

  return createdProducts;
}

export async function seedInventory(prisma: PrismaClient, products: { id: string; name: string; sku?: string }[], branchId: string) {
  console.log(`📦 Seeding inventory for branch...`);

  for (const product of products) {
    // Set different stock levels based on SKU prefix/category
    let initialStock = 100;
    let minThreshold = 20;
    
    const sku = product.sku || '';
    
    // IFA products - high priority for therapy
    if (sku.startsWith('PRD-INF-IFA')) {
      initialStock = 200; // High stock for main IFA
      minThreshold = 50;
    }
    // Infus Set
    else if (sku.startsWith('PRD-INF-SET')) {
      initialStock = 100;
      minThreshold = 30;
    }
    // Nanobubble products
    else if (sku.startsWith('PRD-NBT')) {
      initialStock = 50;
      minThreshold = 15;
    }
    // Medical devices
    else if (sku.startsWith('PRD-MED')) {
      if (sku.includes('HDS')) {
        // Handscoon - boxes
        initialStock = 20;
        minThreshold = 5;
      } else if (sku.includes('SPT') || sku.includes('SYR') || sku.includes('NDL')) {
        // Syringes and needles
        initialStock = 100;
        minThreshold = 30;
      } else {
        initialStock = 10;
        minThreshold = 3;
      }
    }
    // Air Nano
    else if (sku.startsWith('PRD-ANN')) {
      initialStock = 30;
      minThreshold = 10;
    }
    // Furniture - low quantity
    else if (sku.startsWith('PRD-FUR')) {
      initialStock = 5;
      minThreshold = 1;
    }
    // Disposal items
    else if (sku.startsWith('PRD-DIS')) {
      initialStock = 20;
      minThreshold = 5;
    }
    // Accessories
    else if (sku.startsWith('PRD-ACC')) {
      initialStock = 10;
      minThreshold = 3;
    }
    // Documents
    else if (sku.startsWith('PRD-DOC')) {
      initialStock = 50;
      minThreshold = 10;
    }
    // Consumables
    else if (sku.startsWith('PRD-CON')) {
      initialStock = 20;
      minThreshold = 5;
    }
    
    await prisma.inventoryItem.upsert({
      where: {
        masterProductId_branchId: {
          masterProductId: product.id,
          branchId: branchId,
        },
      },
      update: {},
      create: {
        masterProductId: product.id,
        branchId: branchId,
        stock: initialStock,
        minThreshold: minThreshold,
        storageLocation: 'Gudang Utama',
      },
    });
  }

  console.log(`✅ Inventory items created`);
}
