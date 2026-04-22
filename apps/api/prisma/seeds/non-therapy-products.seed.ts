import { PrismaClient, ProductType, AirNanoColor, AirNanoVolume, AirNanoUnit } from '@prisma/client';

/**
 * NON-THERAPY PRODUCTS SEEDING
 * 
 * AIR NANO PRODUCTS:
 * - 3 colors: Kuning (K), Biru (B), Hijau (H)
 * - 2 volumes: 600ml, 1500ml
 * - 2 units: Botol (BL), Dus (DS)
 * 
 * ROKOK KENKOU:
 * - Single product: 1 Bungkus (BK)
 */

export async function seedNonTherapyProducts(prisma: PrismaClient) {
  console.log('🛍️  Seeding non-therapy products...');

  // ============================================================
  // AIR NANO PRODUCTS
  // ============================================================
  
  const airNanoProducts = [
    // 600ml Botol (BL) - Rp 15,000
    {
      productCode: 'ANK600BL',
      name: 'Air Nano Kuning 600ml 1 Botol',
      color: AirNanoColor.KUNING,
      volume: AirNanoVolume.ML_600,
      unit: AirNanoUnit.BOTOL,
      price: 15_000
    },
    {
      productCode: 'ANB600BL',
      name: 'Air Nano Biru 600ml 1 Botol',
      color: AirNanoColor.BIRU,
      volume: AirNanoVolume.ML_600,
      unit: AirNanoUnit.BOTOL,
      price: 15_000
    },
    {
      productCode: 'ANH600BL',
      name: 'Air Nano Hijau H2S 600ml 1 Botol',
      color: AirNanoColor.HIJAU,
      volume: AirNanoVolume.ML_600,
      unit: AirNanoUnit.BOTOL,
      price: 15_000
    },
    
    // 1500ml Botol (BL) - Rp 35,000
    {
      productCode: 'ANK1500BL',
      name: 'Air Nano Kuning 1500ml 1 Botol',
      color: AirNanoColor.KUNING,
      volume: AirNanoVolume.ML_1500,
      unit: AirNanoUnit.BOTOL,
      price: 35_000
    },
    {
      productCode: 'ANB1500BL',
      name: 'Air Nano Biru 1500ml 1 Botol',
      color: AirNanoColor.BIRU,
      volume: AirNanoVolume.ML_1500,
      unit: AirNanoUnit.BOTOL,
      price: 35_000
    },
    {
      productCode: 'ANH1500BL',
      name: 'Air Nano Hijau H2S 1500ml 1 Botol',
      color: AirNanoColor.HIJAU,
      volume: AirNanoVolume.ML_1500,
      unit: AirNanoUnit.BOTOL,
      price: 35_000
    },
    
    // 600ml Dus (DS) - Rp 360,000
    {
      productCode: 'ANK600DS',
      name: 'Air Nano Kuning 600ml 1 Dus',
      color: AirNanoColor.KUNING,
      volume: AirNanoVolume.ML_600,
      unit: AirNanoUnit.DUS,
      price: 360_000
    },
    {
      productCode: 'ANB600DS',
      name: 'Air Nano Biru 600ml 1 Dus',
      color: AirNanoColor.BIRU,
      volume: AirNanoVolume.ML_600,
      unit: AirNanoUnit.DUS,
      price: 360_000
    },
    {
      productCode: 'ANH600DS',
      name: 'Air Nano Hijau H2S 600ml 1 Dus',
      color: AirNanoColor.HIJAU,
      volume: AirNanoVolume.ML_600,
      unit: AirNanoUnit.DUS,
      price: 360_000
    },
    
    // 1500ml Dus (DS) - Rp 420,000
    {
      productCode: 'ANK1500DS',
      name: 'Air Nano Kuning 1500ml 1 Dus',
      color: AirNanoColor.KUNING,
      volume: AirNanoVolume.ML_1500,
      unit: AirNanoUnit.DUS,
      price: 420_000
    },
    {
      productCode: 'ANB1500DS',
      name: 'Air Nano Biru 1500ml 1 Dus',
      color: AirNanoColor.BIRU,
      volume: AirNanoVolume.ML_1500,
      unit: AirNanoUnit.DUS,
      price: 420_000
    },
    {
      productCode: 'ANH1500DS',
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
    console.log(`    ✅ ${product.name} - Rp ${product.price.toLocaleString('id-ID')}`);
  }

  // ============================================================
  // ROKOK KENKOU
  // ============================================================
  
  await prisma.nonTherapyProduct.upsert({
    where: { productCode: 'RKKKKBK' },
    update: {
      name: 'Rokok Kenkou 1 Bungkus',
      pricePerUnit: 20_000,
    },
    create: {
      productCode: 'RKKKKBK',
      productType: ProductType.ROKOK_KENKOU,
      name: 'Rokok Kenkou 1 Bungkus',
      pricePerUnit: 20_000,
      isActive: true,
    },
  });
  console.log(`    ✅ Rokok Kenkou 1 Bungkus - Rp 20,000`);

  console.log(`\n✅ Non-therapy products: Created ${airNanoProducts.length + 1} products`);
  console.log(`\n📋 PRODUCT SUMMARY:`);
  console.log(`\n   AIR NANO (12 variants):`);
  console.log(`   - 600ml Botol: Rp 15,000`);
  console.log(`   - 1500ml Botol: Rp 35,000`);
  console.log(`   - 600ml Dus: Rp 360,000`);
  console.log(`   - 1500ml Dus: Rp 420,000`);
  console.log(`   - Colors: Kuning, Biru, Hijau (H2S)`);
  console.log(`\n   ROKOK KENKOU (1 variant):`);
  console.log(`   - 1 Bungkus: Rp 20,000`);
}
