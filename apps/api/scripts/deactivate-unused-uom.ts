import { prisma } from '../src/lib/prisma';

async function main(): Promise<void> {
  const uomId = process.argv[2];
  if (!uomId) throw new Error('UOM_ID_REQUIRED');

  const uom = await prisma.unitOfMeasure.findUnique({
    where: { id: uomId },
    include: {
      _count: {
        select: {
          baseProducts: true,
          usageProducts: true,
          purchaseOrderItems: true,
          fromConversions: true,
          toConversions: true,
        },
      },
    },
  });
  if (!uom) throw new Error('UOM_NOT_FOUND');

  const references = Object.values(uom._count).reduce((total, count) => total + count, 0);
  if (references > 0) {
    throw new Error(`UOM_IN_USE:${references}`);
  }

  const connection = await prisma.zohoConnection.findFirst({
    where: { isActive: true },
    select: { id: true, organizationName: true },
  });

  const [, mappingResult] = await prisma.$transaction([
    prisma.unitOfMeasure.update({
      where: { id: uom.id },
      data: { isActive: false },
    }),
    prisma.zohoEntityMapping.updateMany({
      where: {
        ...(connection ? { zohoConnectionId: connection.id } : {}),
        entityType: 'UOM',
        localEntityId: uom.id,
      },
      data: { status: 'INACTIVE' },
    }),
  ]);

  console.log(JSON.stringify({
    deactivated: true,
    organizationName: connection?.organizationName ?? null,
    uom: { id: uom.id, code: uom.code, name: uom.name },
    references,
    mappingsDeactivated: mappingResult.count,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      deactivated: false,
      reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
