import { PrismaClient, ProductType, AirNanoColor, AirNanoVolume, AirNanoUnit } from '@prisma/client';

/**
 * NON-THERAPY PRODUCTS SEEDING
 * 
 * SKU Format: PRD-[Kategori]-[Subkategori]-[Nomor]
 * 
 * AIR NANO PRODUCTS (PRD-ANN-xxx):
 * - ANN = Air Nano
 * - KNG = Kuning, BRU = Biru, H2S = Hijau H2S
 * - 3 colors: Kuning (K), Biru (B), Hijau (H)
 * - 2 volumes: 600ml, 1500ml
 * - 2 units: Botol (BL), Dus (DS)
 * 
 * ROKOK KENKOU (PRD-CON-RKK):
 * - CON = Konsumsi
 * - RKK = Rokok Kenkou
 */

export async function seedNonTherapyProducts(prisma: PrismaClient) {
  console.log('🛍️  Seeding non-therapy products...');

  // ============================================================
  // AIR NANO PRODUCTS - SKU: PRD-ANN-[Warna]-[Nomor]
  // ============================================================
  
  const airNanoProducts = [
    // 600ml Botol - Rp 15,000
    {
      productCode: 'PRD-ANN-KNG-001',
      name: 'Air Nano Kuning 600ml 1 Botol',
      color: AirNanoColor.KUNING,
      volume: AirNanoVolume.ML_600,
      unit: AirNanoUnit.BOTOL,
      price: 15_000
    },
    {
      productCode: 'PRD-ANN-BRU-001',
      name: 'Air Nano Biru 600ml 1 Botol',
      color: AirNanoColor.BIRU,
      volume: AirNanoVolume.ML_600,
      unit: AirNanoUnit.BOTOL,
      price: 15_000
    },
    {
      productCode: 'PRD-ANN-H2S-001',
      name: 'Air Nano Hijau H2S 600ml 1 Botol',
      color: AirNanoColor.HIJAU,
      volume: AirNanoVolume.ML_600,
      unit: AirNanoUnit.BOTOL,
      price: 15_000
    },
    
    // 1500ml Botol - Rp 35,000
    {
      productCode: 'PRD-ANN-KNG-002',
      name: 'Air Nano Kuning 1500ml 1 Botol',
      color: AirNanoColor.KUNING,
      volume: AirNanoVolume.ML_1500,
      unit: AirNanoUnit.BOTOL,
      price: 35_000
    },
    {
      productCode: 'PRD-ANN-BRU-002',
      name: 'Air Nano Biru 1500ml 1 Botol',
      color: AirNanoColor.BIRU,
      volume: AirNanoVolume.ML_1500,
      unit: AirNanoUnit.BOTOL,
      price: 35_000
    },
    {
      productCode: 'PRD-ANN-H2S-002',
      name: 'Air Nano Hijau H2S 1500ml 1 Botol',
      color: AirNanoColor.HIJAU,
      volume: AirNanoVolume.ML_1500,
      unit: AirNanoUnit.BOTOL,
      price: 35_000
    },
    
    // 600ml Dus - Rp 360,000
    {
      productCode: 'PRD-ANN-KNG-003',
      name: 'Air Nano Kuning 600ml 1 Dus',
      color: AirNanoColor.KUNING,
      volume: AirNanoVolume.ML_600,
      unit: AirNanoUnit.DUS,
      price: 360_000
    },
    {
      productCode: 'PRD-ANN-BRU-003',
      name: 'Air Nano Biru 600ml 1 Dus',
      color: AirNanoColor.BIRU,
      volume: AirNanoVolume.ML_600,
      unit: AirNanoUnit.DUS,
      price: 360_000
    },
    {
      productCode: 'PRD-ANN-H2S-003',
      name: 'Air Nano Hijau H2S 600ml 1 Dus',
      color: AirNanoColor.HIJAU,
      volume: AirNanoVolume.ML_600,
      unit: AirNanoUnit.DUS,
      price: 360_000
    },
    
    // 1500ml Dus - Rp 420,000
    {
      productCode: 'PRD-ANN-KNG-004',
      name: 'Air Nano Kuning 1500ml 1 Dus',
      color: AirNanoColor.KUNING,
      volume: AirNanoVolume.ML_1500,
      unit: AirNanoUnit.DUS,
      price: 420_000
    },
    {
      productCode: 'PRD-ANN-BRU-004',
      name: 'Air Nano Biru 1500ml 1 Dus',
      color: AirNanoColor.BIRU,
      volume: AirNanoVolume.ML_1500,
      unit: AirNanoUnit.DUS,
      price: 420_000
    },
    {
      productCode: 'PRD-ANN-H2S-004',
      name: 'Air Nano Hijau H2S 1500ml 1 Dus',
      color: AirNanoColor.HIJAU,
      volume: AirNanoVolume.ML_1500,
      unit: AirNanoUnit.DUS,
      price: 420_000
    },
  ];

  for (const product of airNanoProducts) {
    await prisma.nonTherapyProduct.upsert({
      where: { productCode: product.productCode },
      update: {
        name: product.name,
        pricePerUnit: product.price,
      },
      create: {
        productCode: product.productCode,
        productType: ProductType.AIR_NANO,
        name: product.name,
        airNanoColor: product.color,
        airNanoVolume: product.volume,
        airNanoUnit: product.unit,
        pricePerUnit: product.price,
        isActive: true,
      },
    });
    console.log(`    ✅ [${product.productCode}] ${product.name} - Rp ${product.price.toLocaleString('id-ID')}`);
  }

  // ============================================================
  // ROKOK KENKOU - SKU: PRD-CON-RKK-[Nomor]
  // ============================================================
  
  const rokokProducts = [
    {
      productCode: 'PRD-CON-RKK-001',
      name: 'Rokok Kenkou 1 Bungkus',
      price: 20_000
    },
    {
      productCode: 'PRD-CON-RKK-002',
      name: 'Rokok Kenkou 1 Pack',
      price: 200_000
    },
  ];

  for (const product of rokokProducts) {
    await prisma.nonTherapyProduct.upsert({
      where: { productCode: product.productCode },
      update: {
        name: product.name,
        pricePerUnit: product.price,
      },
      create: {
        productCode: product.productCode,
        productType: ProductType.ROKOK_KENKOU,
        name: product.name,
        pricePerUnit: product.price,
        isActive: true,
      },
    });
    console.log(`    ✅ [${product.productCode}] ${product.name} - Rp ${product.price.toLocaleString('id-ID')}`);
  }

  console.log(`\n✅ Non-therapy products: Created ${airNanoProducts.length + rokokProducts.length} products`);
  console.log(`\n📋 PRODUCT SUMMARY (SKU Format: PRD-[Kategori]-[Subkategori]-[Nomor]):`);
  console.log(`\n   AIR NANO (PRD-ANN-xxx) - 12 variants:`);
  console.log(`   - PRD-ANN-KNG-001: Kuning 600ml Botol - Rp 15,000`);
  console.log(`   - PRD-ANN-KNG-002: Kuning 1500ml Botol - Rp 35,000`);
  console.log(`   - PRD-ANN-KNG-003: Kuning 600ml Dus - Rp 360,000`);
  console.log(`   - PRD-ANN-KNG-004: Kuning 1500ml Dus - Rp 420,000`);
  console.log(`   - PRD-ANN-BRU-xxx: Biru (same prices)`);
  console.log(`   - PRD-ANN-H2S-xxx: Hijau H2S (same prices)`);
  console.log(`\n   ROKOK KENKOU (PRD-CON-RKK-xxx) - 2 variants:`);
  console.log(`   - PRD-CON-RKK-001: 1 Bungkus - Rp 20,000`);
  console.log(`   - PRD-CON-RKK-002: 1 Pack - Rp 200,000`);
}
