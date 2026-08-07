import { prisma } from '../src/lib/prisma';
import { ensureDefaultUomMappings } from '../src/modules/zoho/zoho.master.service';
import { getStatus } from '../src/modules/zoho/zoho.service';

async function main(): Promise<void> {
  const mappings = await ensureDefaultUomMappings();
  const [status, uoms] = await Promise.all([
    getStatus(),
    prisma.unitOfMeasure.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
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
    }),
  ]);
  const active = status.connections.find((connection) => connection.isActive);

  console.log(JSON.stringify({
    organizationName: active?.organizationName ?? null,
    total: mappings.length,
    mapped: mappings.filter((mapping) => mapping.status === 'MAPPED').length,
    preserved: mappings.filter((mapping) => mapping.status === 'PRESERVED').length,
    uomSyncReady: active?.uomSyncReady ?? false,
    itemSyncReady: active?.itemSyncReady ?? false,
    mappings: mappings.map((mapping) => ({
      ...mapping,
      uom: uoms.find((uom) => uom.id === mapping.uomId) ?? null,
    })),
  }, null, 2));

  if (!active?.uomSyncReady) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      mapped: false,
      reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
