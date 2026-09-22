import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { physicalAddOnCatalog } from './package-assignment.helpers';

/** Read-only stock preview. Reservation remains the authoritative concurrent check. */
export async function getAddOnAvailability(branchId: string) {
  const catalog = physicalAddOnCatalog();
  const now = new Date();
  const inventorySkus = [...new Set(catalog.flatMap((entry) => entry.inventorySkus))];
  const items = await prisma.inventoryItem.findMany({
    where: { branchId, masterProduct: { sku: { in: inventorySkus }, isActive: true } },
    select: {
      stockLocationId: true,
      masterProduct: { select: { sku: true } },
      balances: {
        where: { onHandQty: { gt: 0 } },
        select: {
          stockLocationId: true, onHandQty: true, reservedQty: true, quarantineQty: true,
          batch: { select: { isBlocked: true, expiryDate: true } },
          costLayers: {
            where: { remainingQty: { gt: 0 }, unitCost: { gt: 0 }, valuationStatus: 'VALUED', isVoided: false, receivedAt: { lte: now } },
            select: { remainingQty: true },
          },
        },
      },
    },
  });
  const bySku = new Map(items.map((item) => [item.masterProduct.sku, item]));
  return catalog.map((entry) => {
    const candidateItems = entry.inventorySkus.map((sku) => bySku.get(sku)).filter(Boolean);
    let bestAvailable = new Prisma.Decimal(0);
    for (const item of candidateItems) {
      if (!item?.stockLocationId) continue;
      let itemAvailable = new Prisma.Decimal(0);
      for (const balance of item.balances) {
        if (balance.stockLocationId !== item.stockLocationId
          || balance.batch?.isBlocked
          || (balance.batch?.expiryDate && balance.batch.expiryDate <= now)) continue;
        const physical = Prisma.Decimal.max(0, balance.onHandQty.sub(balance.reservedQty).sub(balance.quarantineQty));
        const valued = balance.costLayers.reduce((sum, layer) => sum.add(layer.remainingQty), new Prisma.Decimal(0));
        itemAvailable = itemAvailable.add(Prisma.Decimal.min(physical, valued));
      }
      bestAvailable = Prisma.Decimal.max(bestAvailable, itemAvailable);
    }
    const availableUnits = Math.max(0, Math.floor(bestAvailable.div(entry.unitsPerSale).toNumber()));
    const reason = availableUnits > 0 ? null
      : !candidateItems.some((item) => item?.stockLocationId) ? 'Stok cabang belum siap dijual karena lokasi atau harga modal belum tercatat.'
        : 'Stok dengan harga modal belum tersedia di cabang ini.';
    return { code: entry.code, availableUnits, reason };
  });
}
