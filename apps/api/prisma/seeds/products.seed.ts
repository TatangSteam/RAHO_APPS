import { PrismaClient, ProductCategory } from '@prisma/client';

export async function seedProducts(prisma: PrismaClient) {
  console.log('💊 Seeding master products...');

  const products = [
    // Medicines for Infusion
    { name: 'IFA (Infus)', category: ProductCategory.MEDICINE, unit: 'mg', description: 'Iron Folate Acid untuk infus' },
    { name: 'HHO (Liquid)', category: ProductCategory.MEDICINE, unit: 'ml', description: 'Hydrogen Hydroxide liquid' },
    { name: 'H2 (Hidrogen)', category: ProductCategory.MEDICINE, unit: 'ml', description: 'Hydrogen gas terlarut' },
    { name: 'NO (Nitric Oxide)', category: ProductCategory.MEDICINE, unit: 'ml', description: 'Nitric Oxide terlarut' },
    { name: 'GASO (Gas Ozon)', category: ProductCategory.MEDICINE, unit: 'ml', description: 'Gas Ozon terlarut' },
    { name: 'O2 (Oksigen)', category: ProductCategory.MEDICINE, unit: 'ml', description: 'Oksigen terlarut' },
    { name: 'O3 (Ozon)', category: ProductCategory.MEDICINE, unit: 'ml', description: 'Ozon terlarut' },
    { name: 'EDTA', category: ProductCategory.MEDICINE, unit: 'ml', description: 'Ethylenediaminetetraacetic acid' },
    { name: 'MB (Methylene Blue)', category: ProductCategory.MEDICINE, unit: 'ml', description: 'Methylene Blue solution' },
    { name: 'H2S (Hydrogen Sulfide)', category: ProductCategory.MEDICINE, unit: 'ml', description: 'Hydrogen Sulfide terlarut' },
    { name: 'KCL (Kalium Klorida)', category: ProductCategory.MEDICINE, unit: 'ml', description: 'Potassium Chloride solution' },
    { name: 'JML NB', category: ProductCategory.MEDICINE, unit: 'ml', description: 'Jumlah NB solution' },
    
    // Carrier Solutions
    { name: 'NaCl 0.9% 500ml', category: ProductCategory.MEDICINE, unit: 'botol', description: 'Normal Saline 500ml' },
    { name: 'NaCl 0.9% 1000ml', category: ProductCategory.MEDICINE, unit: 'botol', description: 'Normal Saline 1000ml' },
    { name: 'Dextrose 5% 500ml', category: ProductCategory.MEDICINE, unit: 'botol', description: 'Dextrose 5% 500ml' },
    { name: 'Ringer Laktat 500ml', category: ProductCategory.MEDICINE, unit: 'botol', description: 'Ringer Lactate 500ml' },
    
    // Devices
    { name: 'Botol IFA', category: ProductCategory.DEVICE, unit: 'pcs', description: 'Botol khusus untuk IFA' },
    { name: 'Botol EDTA', category: ProductCategory.DEVICE, unit: 'pcs', description: 'Botol khusus untuk EDTA' },
    { name: 'Infusion Set', category: ProductCategory.DEVICE, unit: 'set', description: 'Set infus lengkap' },
    { name: 'IV Catheter 18G', category: ProductCategory.DEVICE, unit: 'pcs', description: 'IV Catheter ukuran 18G' },
    { name: 'IV Catheter 20G', category: ProductCategory.DEVICE, unit: 'pcs', description: 'IV Catheter ukuran 20G' },
    { name: 'IV Catheter 22G', category: ProductCategory.DEVICE, unit: 'pcs', description: 'IV Catheter ukuran 22G' },
    { name: 'Spuit 3ml', category: ProductCategory.DEVICE, unit: 'pcs', description: 'Syringe 3ml' },
    { name: 'Spuit 5ml', category: ProductCategory.DEVICE, unit: 'pcs', description: 'Syringe 5ml' },
    { name: 'Spuit 10ml', category: ProductCategory.DEVICE, unit: 'pcs', description: 'Syringe 10ml' },
    
    // Consumables
    { name: 'Jarum Infus 18G', category: ProductCategory.CONSUMABLE, unit: 'pcs', description: 'Jarum infus ukuran 18G' },
    { name: 'Jarum Infus 20G', category: ProductCategory.CONSUMABLE, unit: 'pcs', description: 'Jarum infus ukuran 20G' },
    { name: 'Jarum Infus 22G', category: ProductCategory.CONSUMABLE, unit: 'pcs', description: 'Jarum infus ukuran 22G' },
    { name: 'Plester Transparan 5cm', category: ProductCategory.CONSUMABLE, unit: 'roll', description: 'Plester transparan lebar 5cm' },
    { name: 'Plester Transparan 10cm', category: ProductCategory.CONSUMABLE, unit: 'roll', description: 'Plester transparan lebar 10cm' },
    { name: 'Kapas Alkohol', category: ProductCategory.CONSUMABLE, unit: 'pack', description: 'Kapas alkohol steril' },
    { name: 'Kasa Steril 10x10cm', category: ProductCategory.CONSUMABLE, unit: 'pack', description: 'Kasa steril ukuran 10x10cm' },
    { name: 'Sarung Tangan Steril S', category: ProductCategory.CONSUMABLE, unit: 'pasang', description: 'Gloves steril ukuran S' },
    { name: 'Sarung Tangan Steril M', category: ProductCategory.CONSUMABLE, unit: 'pasang', description: 'Gloves steril ukuran M' },
    { name: 'Sarung Tangan Steril L', category: ProductCategory.CONSUMABLE, unit: 'pasang', description: 'Gloves steril ukuran L' },
    { name: 'Masker Medis', category: ProductCategory.CONSUMABLE, unit: 'box', description: 'Masker medis 3 ply (50pcs/box)' },
    { name: 'Handscoon Non-Steril', category: ProductCategory.CONSUMABLE, unit: 'box', description: 'Sarung tangan non-steril (100pcs/box)' },
    { name: 'Alkohol 70%', category: ProductCategory.CONSUMABLE, unit: 'botol', description: 'Alkohol 70% 500ml' },
    { name: 'Betadine Solution', category: ProductCategory.CONSUMABLE, unit: 'botol', description: 'Povidone Iodine 10% 60ml' },
    { name: 'Tourniquet', category: ProductCategory.CONSUMABLE, unit: 'pcs', description: 'Tourniquet untuk pemasangan infus' },
  ];

  const createdProducts: { id: string; name: string }[] = [];
  
  for (const p of products) {
    const product = await prisma.masterProduct.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
    createdProducts.push(product);
  }

  console.log(`✅ Master products: ${products.length} entries`);

  return createdProducts;
}

export async function seedInventory(prisma: PrismaClient, products: { id: string; name: string }[], branchId: string) {
  console.log(`📦 Seeding inventory for branch...`);

  for (const product of products) {
    // Set different stock levels based on category
    let initialStock = 100;
    let minThreshold = 20;
    
    if (product.name.includes('Infus') || product.name.includes('IFA') || product.name.includes('EDTA')) {
      initialStock = 500; // High stock for main medicines
      minThreshold = 100;
    } else if (product.name.includes('NaCl') || product.name.includes('Dextrose') || product.name.includes('Ringer')) {
      initialStock = 200; // Medium stock for carrier solutions
      minThreshold = 50;
    } else if (product.name.includes('Sarung Tangan') || product.name.includes('Masker')) {
      initialStock = 50; // Lower stock for consumables (counted in boxes/packs)
      minThreshold = 10;
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
