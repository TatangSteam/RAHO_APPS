import { PrismaClient, ProductCategory } from '@prisma/client';

/**
 * Backward-compatible seed entry point.
 *
 * "Infus Set + Pelengkap" is a virtual kit definition. This seed keeps the
 * master product available for legacy sessions, but never creates or tops up
 * stock. Current sessions replenish and consume the physical kit components.
 */
const prisma = new PrismaClient();

export async function seedInfusSetStock() {
  const masterProduct = await prisma.masterProduct.upsert({
    where: { sku: 'PRD-INF-SET-002' },
    update: {
      description: 'Kit virtual Infus Set + Pelengkap. Stok dan restock dicatat melalui komponen fisiknya.',
      isAutoUsedPerSession: true,
      isAutoAddedToBranch: false,
      defaultInitialStock: null,
    },
    create: {
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
  });

  // Existing rows are retained for historical postings and legacy-session
  // reversals, but no longer trigger low-stock replenishment.
  await prisma.inventoryItem.updateMany({
    where: { masterProductId: masterProduct.id },
    data: { minThreshold: 0 },
  });

  return { masterProduct, stockCreated: 0 };
}

async function main() {
  try {
    await seedInfusSetStock();
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
