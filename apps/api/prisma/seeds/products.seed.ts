import { PrismaClient, ProductCategory } from '@prisma/client';
import { backfillProductUoms } from './inventory-uoms.seed';

/**
 * Master Products Seed - Sesuai dengan List Barang RAHO Official
 * 
 * SATUAN SESUAI LIST:
 * - IFA: Botol
 * - Cairan Terapi: gunakan baseUnit stok gudang dan usageUnit pemakaian terapi
 * - Handscoon S/M: Piece
 * - Oneswab: Piece
 * - Ultrafik: Piece
 * - IV Cath, Plesterin: Piece
 * - Kantong Sampah: Pack
 * - Kertas HVS: Rim
 * - Inform Consent: Rangkap
 * - Lainnya: Piece/Unit/Botol sesuai list
 * 
 * NOTE: Air Nano Hijau TIDAK mengandung H2S di nama (agar tidak tertukar dengan Cairan H2S therapy)
 */
export async function seedProducts(prisma: PrismaClient) {
  console.log('💊 Seeding master products...');

  const products = [
    // ==================== INFUS (INF) ====================
    { sku: 'PRD-INF-IFA-001', name: 'IFA 500ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'IFA 500ml' },
    { sku: 'PRD-INF-IFA-002', name: 'IFA + NO 2,5ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'IFA + NO 2,5ml (default per terapi)' },
    { sku: 'PRD-INF-SET-001', name: 'Infus Set', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Set infus standar', isAutoAddedToBranch: true },
    { 
      sku: 'PRD-INF-SET-002', 
      name: 'Infus Set + Pelengkap', 
      category: ProductCategory.DEVICE, 
      unit: 'Piece', 
      baseUnit: 'Piece', 
      usageUnit: 'Piece', 
      conversionFactor: 1, 
      description: 'Kit virtual Infus Set + Pelengkap. Stok dan restock dicatat melalui komponen fisiknya.',
      isAutoUsedPerSession: true,
      isAutoAddedToBranch: false,
      defaultInitialStock: null,
    },

    // ==================== NANOBUBBLE THERAPY (NBT) ====================
    { sku: 'PRD-NBT-HHO-001', name: 'NB-HHO', category: ProductCategory.MEDICINE, unit: 'botol', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 25, description: 'Nano Bubble HHO 25ml per botol - untuk field: hho' },
    { sku: 'PRD-NBT-HHO-002', name: 'HHO Konsentrat', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'HHO Konsentrat' },
    { sku: 'PRD-NBT-CNO-001', name: 'NB NO', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Nano Bubble Nitric Oxide - untuk field: no' },
    { sku: 'PRD-NBT-CGT-001', name: 'NB Gasotransmitter (GT)', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Nano Bubble Gasotransmitter - untuk field: gaso' },
    { sku: 'PRD-NBT-CMB-001', name: 'NB Methyln Blue (MB)', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Nano Bubble Methylene Blue - untuk field: mb' },
    { sku: 'PRD-NBT-H2S-001', name: 'Cairan H2S', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Cairan Hydrogen Sulfide - untuk field: h2s' },
    { sku: 'PRD-NBT-H2S-002', name: 'NB H2S Konsentrat', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Nano Bubble H2S Konsentrat' },
    { sku: 'PRD-NBT-CO3-001', name: 'Ozone (O3)', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Ozone - untuk field: o3' },
    { sku: 'PRD-NBT-CO2-001', name: 'O2 (Oxygen)', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Oxygen - untuk field: o2' },
    { sku: 'PRD-NBT-KCL-001', name: 'KCL', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Kalium Klorida - untuk field: kcl' },
    { sku: 'PRD-NBT-EDT-001', name: 'EDTA', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'EDTA - untuk field: edta' },
    { sku: 'PRD-NBT-CH2-001', name: 'H2', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Hydrogen - untuk field: h2' },
    { sku: 'PRD-NBT-PRP-001', name: 'Cairan PRP', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'ml', usageUnit: 'ml', conversionFactor: 1, description: 'Platelet Rich Plasma' },

    // ==================== MEDICAL SUPPLIES (MED) ====================
    { sku: 'PRD-MED-IVC-001', name: 'IV Cath 24', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'IV Catheter ukuran 24G', isAutoAddedToBranch: true },
    { sku: 'PRD-MED-URF-001', name: 'Ultrafik', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Ultrafik', isAutoAddedToBranch: true },
    { sku: 'PRD-MED-TUB-001', name: 'BD TUBE ACB 8.5ml', category: ProductCategory.DEVICE, unit: 'Unit', baseUnit: 'Unit', usageUnit: 'Unit', conversionFactor: 1, description: 'BD Tube ACB 8.5ml' },
    { sku: 'PRD-MED-SWB-001', name: 'Oneswab', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Oneswab', isAutoAddedToBranch: true },
    { sku: 'PRD-MED-PTR-001', name: 'Plesterin', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Plester', isAutoAddedToBranch: true },
    { sku: 'PRD-MED-SPT-001', name: 'Spuit 20cc', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 20cc' },
    { sku: 'PRD-MED-SPT-002', name: 'Spuit 5cc (3cc)', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 5cc/3cc' },
    { sku: 'PRD-MED-SPT-003', name: 'Spuit 5cc (10cc)', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 5cc/10cc' },
    { sku: 'PRD-MED-NDL-001', name: 'Needle (Salin) (25G)', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Needle Salin 25G' },
    { sku: 'PRD-MED-HDS-001', name: 'Handscoon S', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Sarung tangan medis ukuran S' },
    { sku: 'PRD-MED-HDS-002', name: 'Handscoon M', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Sarung tangan medis ukuran M' },
    { sku: 'PRD-MED-NPS-001', name: 'No Pain Spray', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Spray penghilang nyeri' },
    { sku: 'PRD-MED-HCC-001', name: 'Hot Cold Compress', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Kompres panas dingin' },
    { sku: 'PRD-MED-OXI-001', name: 'Oximeter Fingertip Omicron', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Pulse Oximeter' },
    { sku: 'PRD-MED-SYR-001', name: 'Syringe 50cc Catheher Tip', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 50cc dengan catheter tip' },
    { sku: 'PRD-MED-SYR-002', name: 'Syringe 20cc Catheher Tip', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 20cc dengan catheter tip' },
    { sku: 'PRD-MED-SYR-003', name: 'Syringe 5cc Catheher Tip', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 5cc dengan catheter tip' },
    { sku: 'PRD-MED-SYR-004', name: 'Syringe 1cc Catheher Tip', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Syringe 1cc dengan catheter tip' },
    { sku: 'PRD-MED-RDL-001', name: 'RedLight Therapy', category: ProductCategory.DEVICE, unit: 'Unit', baseUnit: 'Unit', usageUnit: 'Unit', conversionFactor: 1, description: 'Alat terapi cahaya merah' },
    { sku: 'PRD-MED-THB-001', name: 'Thrombophop Gel 20 grab', category: ProductCategory.MEDICINE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Gel Thrombophop 20 gram' },
    { sku: 'PRD-MED-TNS-001', name: 'Tensi Digital Omron', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tensimeter digital Omron' },
    { sku: 'PRD-MED-TNS-002', name: 'Tensi Manual + Stetoskop', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tensimeter manual dengan stetoskop' },
    { sku: 'PRD-MED-TRQ-001', name: 'Tourniquet', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tourniquet untuk pemasangan infus' },

    // ==================== AIR NANO (ANN) ====================
    // NOTE: Air Nano Hijau TIDAK mengandung "H2S" di nama agar tidak tertukar dengan Cairan H2S therapy
    { sku: 'PRD-ANN-KNG-001', name: 'Air Nano Kuning 600ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Kuning 600ml' },
    { sku: 'PRD-ANN-BRU-001', name: 'Air Nano Biru 600ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Biru 600ml' },
    { sku: 'PRD-ANN-HJU-001', name: 'Air Nano Hijau 600ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Hijau 600ml' },
    { sku: 'PRD-ANN-KNG-002', name: 'Air Nano Kuning 1500ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Kuning 1500ml' },
    { sku: 'PRD-ANN-BRU-002', name: 'Air Nano Biru 1500ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Biru 1500ml' },
    { sku: 'PRD-ANN-HJU-002', name: 'Air Nano Hijau 1500ml', category: ProductCategory.MEDICINE, unit: 'Botol', baseUnit: 'Botol', usageUnit: 'Botol', conversionFactor: 1, description: 'Air Nano Hijau 1500ml' },

    // ==================== CONSUMABLES (CON) ====================
    { sku: 'PRD-CON-RKK-001', name: 'Rokok Kenkou', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Rokok Kenkou' },

    // ==================== FURNITURE (FUR) ====================
    { sku: 'PRD-FUR-TIF-001', name: 'Tiang Infus Portable', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tiang infus portable' },
    { sku: 'PRD-FUR-TIF-002', name: 'Tiang Infus Beroda', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tiang infus dengan roda' },
    { sku: 'PRD-FUR-SFR-001', name: 'Sofa Recliner', category: ProductCategory.DEVICE, unit: 'Unit', baseUnit: 'Unit', usageUnit: 'Unit', conversionFactor: 1, description: 'Sofa recliner untuk pasien' },
    { sku: 'PRD-FUR-MJI-001', name: 'Meja dengan Tiang Infus', category: ProductCategory.DEVICE, unit: 'Unit', baseUnit: 'Unit', usageUnit: 'Unit', conversionFactor: 1, description: 'Meja dengan tiang infus terintegrasi' },

    // ==================== DISPOSAL (DIS) ====================
    { sku: 'PRD-DIS-SBX-001', name: 'Safety Box Sampah Medis 2.5L Include Inner & Tali', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Safety Box Sampah Medis 2.5L' },
    { sku: 'PRD-DIS-KSH-001', name: 'Kantong Sampah Hitam 40 x 50', category: ProductCategory.CONSUMABLE, unit: 'Pack', baseUnit: 'Pack', usageUnit: 'Pack', conversionFactor: 1, description: 'Kantong sampah hitam 40x50cm' },
    { sku: 'PRD-DIS-KSH-002', name: 'Kantong Sampah Hitam 60 x 100', category: ProductCategory.CONSUMABLE, unit: 'Pack', baseUnit: 'Pack', usageUnit: 'Pack', conversionFactor: 1, description: 'Kantong sampah hitam 60x100cm' },
    { sku: 'PRD-DIS-KSH-003', name: 'Kantong Sampah Hitam 100 x 120', category: ProductCategory.CONSUMABLE, unit: 'Pack', baseUnit: 'Pack', usageUnit: 'Pack', conversionFactor: 1, description: 'Kantong sampah hitam 100x120cm' },
    { sku: 'PRD-DIS-KSM-001', name: 'Kantong Sampah Medis 40 x 50', category: ProductCategory.CONSUMABLE, unit: 'Pack', baseUnit: 'Pack', usageUnit: 'Pack', conversionFactor: 1, description: 'Kantong sampah medis 40x50cm' },
    { sku: 'PRD-DIS-KSM-002', name: 'Kantong Sampah Medis 60 x 100', category: ProductCategory.CONSUMABLE, unit: 'Pack', baseUnit: 'Pack', usageUnit: 'Pack', conversionFactor: 1, description: 'Kantong sampah medis 60x100cm' },
    { sku: 'PRD-DIS-PLS-001', name: 'Plastik IMI', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Plastik IMI' },

    // ==================== ACCESSORIES (ACC) ====================
    { sku: 'PRD-ACC-BTR-001', name: 'Baterai AA', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Baterai AA' },
    { sku: 'PRD-ACC-BTR-002', name: 'Baterai AAA', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Baterai AAA' },
    { sku: 'PRD-ACC-BTL-001', name: 'Bantal Infus', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Bantal untuk infus' },
    { sku: 'PRD-ACC-SLM-001', name: 'Selimut 120 x 160', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Selimut ukuran 120x160cm' },
    { sku: 'PRD-ACC-TNK-001', name: 'Tas Nakes 40 x 27.3 x 22.3 cm', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Tas nakes' },

    // ==================== DOCUMENTS (DOC) ====================
    { sku: 'PRD-DOC-HVS-001', name: 'Kertas HVS', category: ProductCategory.CONSUMABLE, unit: 'Rim', baseUnit: 'Rim', usageUnit: 'Rim', conversionFactor: 1, description: 'Kertas HVS A4' },
    { sku: 'PRD-DOC-MAP-001', name: 'Map Rekam Medis', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Map untuk rekam medis' },
    { sku: 'PRD-DOC-FRP-001', name: 'Form Pendaftaran', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Form pendaftaran pasien' },
    { sku: 'PRD-DOC-IFC-001', name: 'Inform Consent', category: ProductCategory.CONSUMABLE, unit: 'Rangkap', baseUnit: 'Rangkap', usageUnit: 'Rangkap', conversionFactor: 1, description: 'Form informed consent' },
  ];

  const createdProducts: { id: string; name: string; sku?: string }[] = [];
  
  for (const p of products) {
    const product = await prisma.masterProduct.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        category: p.category,
        unit: p.unit,
        baseUnit: p.baseUnit,
        usageUnit: p.usageUnit,
        conversionFactor: p.conversionFactor,
        description: p.description,
        isAutoUsedPerSession: (p as any).isAutoUsedPerSession ?? false,
        isAutoAddedToBranch: (p as any).isAutoAddedToBranch ?? false,
        defaultInitialStock: (p as any).defaultInitialStock ?? null,
      },
      create: {
        sku: p.sku,
        name: p.name,
        category: p.category,
        unit: p.unit,
        baseUnit: p.baseUnit,
        usageUnit: p.usageUnit,
        conversionFactor: p.conversionFactor,
        description: p.description,
        isAutoUsedPerSession: (p as any).isAutoUsedPerSession ?? false,
        isAutoAddedToBranch: (p as any).isAutoAddedToBranch ?? false,
        defaultInitialStock: (p as any).defaultInitialStock ?? null,
      },
    });
    createdProducts.push({ ...product, sku: p.sku });
  }

  console.log(`✅ Master products: ${products.length} entries`);

  const uomCount = await backfillProductUoms(prisma);
  console.log(`Inventory UOM ensured: ${uomCount} entries`);

  return createdProducts;
}
