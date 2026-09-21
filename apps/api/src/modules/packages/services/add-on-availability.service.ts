import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { physicalAddOnCatalog } from './package-assignment.helpers';

/** Read-only stock preview. Reservation remains the authoritative concurrent check. */
export async function getAddOnAvailability(branchId: string) {
  const catalog = physicalAddOnCatalog();
  const now = new Date();
  const items = await prisma.inventoryItem.findMany({
    where: { branchId, masterProduct: { sku: { in: [...new Set(catalog.map((entry) => entry.inventorySku))] }, isActive: true } },
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
    const item = bySku.get(entry.inventorySku);
    let available = new Prisma.Decimal(0);
    if (item?.stockLocationId) {
      for (const balance of item.balances) {
        if (balance.stockLocationId !== item.stockLocationId
          || balance.batch?.isBlocked
          || (balance.batch?.expiryDate && balance.batch.expiryDate <= now)) continue;
        const physical = Prisma.Decimal.max(0, balance.onHandQty.sub(balance.reservedQty).sub(balance.quarantineQty));
        const valued = balance.costLayers.reduce((sum, layer) => sum.add(layer.remainingQty), new Prisma.Decimal(0));
        available = available.add(Prisma.Decimal.min(physical, valued));
      }
    }
    const availableUnits = Math.max(0, Math.floor(available.div(entry.unitsPerSale).toNumber()));
    const reason = availableUnits > 0 ? null
      : !item?.stockLocationId ? 'Stok cabang belum siap dijual: lokasi dan HPP belum tercatat. Hubungi tim Logistik.'
        : 'Stok dengan HPP valid belum tersedia di cabang ini. Periksa Dashboard Logistik → Nilai Stok.';
    return { code: entry.code, availableUnits, reason };
  });
}
