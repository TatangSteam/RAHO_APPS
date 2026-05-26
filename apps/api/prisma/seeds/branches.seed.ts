import { PrismaClient, BranchType, ProductCategory } from '@prisma/client';

// Infus Set + Pelengkap configuration - WAJIB untuk setiap cabang
const INFUS_SET_PELENGKAP = {
  sku: 'PRD-INF-SET-002',
  name: 'Infus Set + Pelengkap',
  category: ProductCategory.DEVICE,
  unit: 'Piece',
  baseUnit: 'Piece',
  usageUnit: 'Piece',
  conversionFactor: 1,
  description: 'Set infus lengkap dengan pelengkap - WAJIB otomatis digunakan per sesi terapi',
  isAutoUsedPerSession: true,
  isAutoAddedToBranch: true,
  defaultInitialStock: 100,
};

const DEFAULT_INFUS_SET_STOCK = 100;
const DEFAULT_MIN_THRESHOLD = 20;

/**
 * Ensure Infus Set + Pelengkap master product exists and is configured for auto-add
 */
async function ensureInfusSetMasterProduct(prisma: PrismaClient) {
  console.log('💉 Ensuring Infus Set + Pelengkap master product exists...');
  
  const masterProduct = await prisma.masterProduct.upsert({
    where: { sku: INFUS_SET_PELENGKAP.sku },
    update: {
      isAutoAddedToBranch: true,
      defaultInitialStock: INFUS_SET_PELENGKAP.defaultInitialStock,
      isAutoUsedPerSession: true,
    },
    create: INFUS_SET_PELENGKAP,
  });
  
  console.log(`  ✅ Master product: ${masterProduct.name} (${masterProduct.sku})`);
  return masterProduct;
}

/**
 * Add Infus Set + Pelengkap inventory to a branch
 */
async function addInfusSetToBranch(prisma: PrismaClient, branchId: string, branchCode: string, masterProductId: string) {
  const existing = await prisma.inventoryItem.findUnique({
    where: {
      masterProductId_branchId: {
        masterProductId,
        branchId,
      },
    },
  });

  if (existing) {
    // Update stock if it's too low
    if (Number(existing.stock) < 10) {
      await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: { 
          stock: DEFAULT_INFUS_SET_STOCK,
          minThreshold: DEFAULT_MIN_THRESHOLD,
        },
      });
      console.log(`  🔄 ${branchCode}: Updated Infus Set stock to ${DEFAULT_INFUS_SET_STOCK}`);
    } else {
      console.log(`  ⏭️  ${branchCode}: Already has ${existing.stock} Infus Set stock`);
    }
  } else {
    await prisma.inventoryItem.create({
      data: {
        masterProductId,
        branchId,
        stock: DEFAULT_INFUS_SET_STOCK,
        minThreshold: DEFAULT_MIN_THRESHOLD,
      },
    });
    console.log(`  ✅ ${branchCode}: Added ${DEFAULT_INFUS_SET_STOCK} Infus Set stock`);
  }
}

export async function seedBranches(prisma: PrismaClient) {
  console.log('🏢 Seeding branches...');

  // First, ensure Infus Set + Pelengkap master product exists
  const infusSetProduct = await ensureInfusSetMasterProduct(prisma);

  const branchPusat = await prisma.branch.upsert({
    where: { branchCode: 'PST' },
    update: {},
    create: {
      branchCode: 'PST',
      name: 'RAHO Premier Jakarta',
      address: 'Jl. Sudirman Kav. 52-53, Jakarta Selatan',
      city: 'Jakarta',
      phone: '021-12345678',
      type: BranchType.PREMIER,
      operatingHours: '24 Jam',
    },
  });

  const branchBandung = await prisma.branch.upsert({
    where: { branchCode: 'BDG' },
    update: {},
    create: {
      branchCode: 'BDG',
      name: 'RAHO Partnership Bandung',
      address: 'Jl. Asia Afrika No. 10, Bandung',
      city: 'Bandung',
      phone: '022-87654321',
      type: BranchType.PARTNERSHIP,
      operatingHours: '08:00 - 20:00',
    },
  });

  const branchSurabaya = await prisma.branch.upsert({
    where: { branchCode: 'SBY' },
    update: {},
    create: {
      branchCode: 'SBY',
      name: 'RAHO Premier Surabaya',
      address: 'Jl. Tunjungan No. 25, Surabaya',
      city: 'Surabaya',
      phone: '031-55667788',
      type: BranchType.PREMIER,
      operatingHours: '08:00 - 22:00',
    },
  });

  console.log(`✅ Branches: ${branchPusat.name}, ${branchBandung.name}, ${branchSurabaya.name}`);

  // Add Infus Set + Pelengkap to all branches
  console.log('\n💉 Adding Infus Set + Pelengkap to all branches...');
  await addInfusSetToBranch(prisma, branchPusat.id, branchPusat.branchCode, infusSetProduct.id);
  await addInfusSetToBranch(prisma, branchBandung.id, branchBandung.branchCode, infusSetProduct.id);
  await addInfusSetToBranch(prisma, branchSurabaya.id, branchSurabaya.branchCode, infusSetProduct.id);

  return { branchPusat, branchBandung, branchSurabaya };
}

// Helper function to assign branches to Admin Manager (called after users are seeded)
export async function assignBranchesToManager(prisma: PrismaClient) {
  console.log('🔗 Assigning branches to Admin Manager...');

  const adminManager = await prisma.user.findUnique({
    where: { email: 'manager@raho.id' },
  });

  if (!adminManager) {
    console.log('⚠️  Admin Manager not found, skipping branch assignment');
    return;
  }

  const result = await prisma.branch.updateMany({
    where: {
      createdBy: null,
    },
    data: {
      createdBy: adminManager.id,
    },
  });

  console.log(`✅ Assigned ${result.count} branches to Admin Manager`);
}
