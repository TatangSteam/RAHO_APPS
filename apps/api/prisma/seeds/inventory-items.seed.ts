import { PrismaClient, ProductCategory } from '@prisma/client';

export async function seedInventoryItems(prisma: PrismaClient) {
  console.log('🔧 Seeding inventory items for all branches...');

  // Get all branches
  const branches = await prisma.branch.findMany();
  if (branches.length === 0) {
    console.log('⚠️  No branches found, skipping inventory items seed');
    return;
  }

  const masterProducts = [
    // ============================================================
    // INFUSION MATERIALS (Bahan Infus) - Category: MEDICINE
    // ============================================================
    { name: 'HHO', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 500, description: 'Gassotraus Hydrogen-Hydrogen-Oxygen infusion solution', stock: 1000, minStock: 100 },
    { name: 'NO', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 500, description: 'Nitric Oxide infusion solution', stock: 800, minStock: 100 },
    { name: 'H2', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 500, description: 'Hydrogen gas infusion solution', stock: 500, minStock: 50 },
    { name: 'O2', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 500, description: 'Oxygen infusion solution', stock: 600, minStock: 100 },
    { name: 'O3', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 500, description: 'Ozone therapy infusion solution', stock: 400, minStock: 50 },
    { name: 'IFA', category: ProductCategory.MEDICINE, unit: 'mg', baseUnit: 'botol', usageUnit: 'mg', conversionFactor: 1000, description: 'Iron and Folic Acid supplement for infusion', stock: 2000, minStock: 200 },
    { name: 'GASO', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 500, description: 'Gas Ozone therapy solution', stock: 300, minStock: 50 },
    { name: 'EDTA', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 500, description: 'EDTA chelation therapy solution', stock: 250, minStock: 30 },
    { name: 'MB', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 100, description: 'Methylene Blue infusion solution', stock: 150, minStock: 20 },
    { name: 'H2S', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 500, description: 'Hydrogen Sulfide therapy solution', stock: 200, minStock: 30 },
    { name: 'KCL', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 500, description: 'Potassium Chloride electrolyte solution', stock: 800, minStock: 100 },
    { name: 'JML_NB', category: ProductCategory.MEDICINE, unit: 'ml', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: 500, description: 'Normal Saline (NaCl 0.9%) carrier solution', stock: 1500, minStock: 200 },

    // ============================================================
    // IV EQUIPMENT (Peralatan IV) - Category: DEVICE
    // ============================================================
    { name: 'IV Catheter 24G', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: '24 Gauge IV catheter', stock: 500, minStock: 50 },
    { name: 'IV Catheter 22G', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: '22 Gauge IV catheter', stock: 500, minStock: 50 },
    { name: 'IV Catheter 20G', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: '20 Gauge IV catheter', stock: 300, minStock: 30 },
    { name: 'IV Set Macro Drip', category: ProductCategory.DEVICE, unit: 'set', baseUnit: 'set', usageUnit: 'set', conversionFactor: 1, description: 'Macro drip IV administration set', stock: 400, minStock: 50 },
    { name: 'IV Set Micro Drip', category: ProductCategory.DEVICE, unit: 'set', baseUnit: 'set', usageUnit: 'set', conversionFactor: 1, description: 'Micro drip IV administration set', stock: 300, minStock: 40 },
    { name: 'Syringe 3ml', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: '3ml disposable syringe', stock: 1000, minStock: 100 },
    { name: 'Syringe 5ml', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: '5ml disposable syringe', stock: 1000, minStock: 100 },
    { name: 'Syringe 10ml', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: '10ml disposable syringe', stock: 800, minStock: 80 },
    { name: 'Needle 23G', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: '23 Gauge needle', stock: 1000, minStock: 100 },
    { name: 'Needle 25G', category: ProductCategory.DEVICE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: '25 Gauge needle', stock: 1000, minStock: 100 },

    // ============================================================
    // WRAPPING & THERAPY SUPPLIES - Category: DEVICE
    // ============================================================
    { name: 'Wrapping Kedua Kaki', category: ProductCategory.DEVICE, unit: 'set', baseUnit: 'set', usageUnit: 'set', conversionFactor: 1, description: 'Leg wrapping therapy set', stock: 100, minStock: 10 },
    { name: 'Wrapping Kedua Tangan', category: ProductCategory.DEVICE, unit: 'set', baseUnit: 'set', usageUnit: 'set', conversionFactor: 1, description: 'Arm wrapping therapy set', stock: 100, minStock: 10 },
    { name: 'Wrapping Satu Kaki', category: ProductCategory.DEVICE, unit: 'set', baseUnit: 'set', usageUnit: 'set', conversionFactor: 1, description: 'Single leg wrapping therapy set', stock: 80, minStock: 10 },
    { name: 'Wrapping Satu Tangan', category: ProductCategory.DEVICE, unit: 'set', baseUnit: 'set', usageUnit: 'set', conversionFactor: 1, description: 'Single arm wrapping therapy set', stock: 80, minStock: 10 },
    { name: 'Kacamata H2 1 Jam', category: ProductCategory.DEVICE, unit: 'set', baseUnit: 'set', usageUnit: 'set', conversionFactor: 1, description: 'H2 therapy glasses for 1 hour session', stock: 50, minStock: 5 },
    { name: 'Terapi Inhalasi', category: ProductCategory.DEVICE, unit: 'set', baseUnit: 'set', usageUnit: 'set', conversionFactor: 1, description: 'Inhalation therapy equipment', stock: 60, minStock: 10 },
    { name: 'Red Light Therapy', category: ProductCategory.DEVICE, unit: 'session', baseUnit: 'session', usageUnit: 'session', conversionFactor: 1, description: 'Red light therapy session', stock: 100, minStock: 20 },

    // ============================================================
    // CONSUMABLES (Bahan Habis Pakai) - Category: CONSUMABLE
    // ============================================================
    { name: 'Alcohol Swab', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Sterile alcohol swab', stock: 2000, minStock: 200 },
    { name: 'Cotton Ball', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'pack', usageUnit: 'Piece', conversionFactor: 100, description: 'Sterile cotton ball', stock: 3000, minStock: 300 },
    { name: 'Gauze Pad 4x4', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'pack', usageUnit: 'Piece', conversionFactor: 50, description: '4x4 inch sterile gauze pad', stock: 1500, minStock: 150 },
    { name: 'Medical Tape', category: ProductCategory.CONSUMABLE, unit: 'roll', baseUnit: 'roll', usageUnit: 'roll', conversionFactor: 1, description: 'Medical adhesive tape', stock: 200, minStock: 20 },
    { name: 'Disposable Gloves (M)', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Medium size disposable gloves', stock: 100, minStock: 10 },
    { name: 'Disposable Gloves (L)', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Large size disposable gloves', stock: 100, minStock: 10 },
    { name: 'Surgical Mask', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Disposable surgical mask', stock: 150, minStock: 15 },
    { name: 'Tourniquet', category: ProductCategory.CONSUMABLE, unit: 'Piece', baseUnit: 'Piece', usageUnit: 'Piece', conversionFactor: 1, description: 'Medical tourniquet for IV insertion', stock: 50, minStock: 10 },
  ];

  let created = 0;
  let skipped = 0;

  for (const product of masterProducts) {
    // Create or get MasterProduct with unit conversion support
    const masterProduct = await prisma.masterProduct.upsert({
      where: { name: product.name },
      update: {
        category: product.category,
        unit: product.unit,
        baseUnit: product.baseUnit,
        usageUnit: product.usageUnit,
        conversionFactor: product.conversionFactor,
        description: product.description,
      },
      create: {
        name: product.name,
        category: product.category,
        unit: product.unit,
        baseUnit: product.baseUnit,
        usageUnit: product.usageUnit,
        conversionFactor: product.conversionFactor,
        description: product.description,
        isActive: true,
      },
    });

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
        // Different stock levels for different branches to test multi-branch
        let stockAmount = product.stock;
        if (branch.branchCode === 'BDG') {
          stockAmount = Math.floor(product.stock * 0.7); // Bandung has 70% stock
        } else if (branch.branchCode === 'SBY') {
          stockAmount = Math.floor(product.stock * 0.5); // Surabaya has 50% stock
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

  console.log(`✅ Seeded ${created} inventory items across ${branches.length} branches (${skipped} already existed)`);
  console.log(`   - ${12} MEDICINE items (infusion materials)`);
  console.log(`   - ${17} DEVICE items (IV equipment & therapy supplies)`);
  console.log(`   - ${9} CONSUMABLE items (disposable supplies)`);
  console.log(`   📦 Stock distribution:`);
  branches.forEach(branch => {
    const percentage = branch.branchCode === 'PST' ? '100%' : 
                       branch.branchCode === 'BDG' ? '70%' : '50%';
    console.log(`      - ${branch.name}: ${percentage} of base stock`);
  });
}
