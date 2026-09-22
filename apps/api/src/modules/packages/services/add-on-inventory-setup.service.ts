import { createHash } from 'crypto';
import { prisma } from '@lib/prisma';
import { directAdjustStock } from '@modules/inventory/services/inventory-control.service';
import { getSkuValuationLookup } from '@modules/inventory/services/logistics-report.service';
import { physicalAddOnCatalog } from './package-assignment.helpers';

const ACTIONABLE_STATUSES = new Set([
  'NO_STOCK_LOCATION',
  'NO_LEDGER_BALANCE',
  'NO_COST_LAYER',
  'PENDING_VALUATION',
]);

const setupKey = (parts: string[]) => `AUTO-ADDON-COST:${createHash('sha256')
  .update(parts.join('|'))
  .digest('hex')
  .slice(0, 40)}`;

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Harga modal stok belum dapat disiapkan otomatis.';
}

/**
 * Gives existing legacy stock the editable default cost from Master Product.
 * Physical quantity is never changed and normal finance/audit records remain
 * authoritative through the existing direct valuation service.
 */
export async function prepareAddOnInventoryForSale(branchId: string, actorUserId: string) {
  const skus = [...new Set(physicalAddOnCatalog().map((entry) => entry.inventorySku))];
  const products = await prisma.masterProduct.findMany({
    where: { sku: { in: skus }, isActive: true },
    select: { sku: true, defaultUnitCost: true },
  });
  const costs = new Map(products.map((product) => [product.sku, product.defaultUnitCost]));
  const results: Array<{
    sku: string;
    status: 'READY' | 'PREPARED' | 'SKIPPED' | 'NEEDS_ATTENTION';
    message?: string;
  }> = [];

  for (const sku of skus) {
    const lookup = await getSkuValuationLookup(branchId, sku);
    if (lookup.status === 'READY') {
      results.push({ sku, status: 'READY' });
      continue;
    }
    if (!ACTIONABLE_STATUSES.has(lookup.status)) {
      results.push({ sku, status: 'SKIPPED' });
      continue;
    }

    const defaultUnitCost = costs.get(sku);
    if (!defaultUnitCost || !defaultUnitCost.greaterThan(0)) {
      results.push({
        sku,
        status: 'NEEDS_ATTENTION',
        message: 'Harga modal bawaan belum diatur pada Master Inventori.',
      });
      continue;
    }
    if (!lookup.inventoryItemId || !lookup.stockLocationId || lookup.tracksBatch) {
      results.push({
        sku,
        status: 'NEEDS_ATTENTION',
        message: lookup.tracksBatch
          ? 'Produk memakai batch dan harus disiapkan melalui Logistik.'
          : 'Lokasi stok aktif belum tersedia pada cabang.',
      });
      continue;
    }

    const unitCost = defaultUnitCost.toFixed(4);
    const idempotencyKey = setupKey([
      branchId,
      lookup.inventoryItemId,
      lookup.stockLocationId,
      lookup.valuationBatchId || 'NO_BATCH',
      unitCost,
      lookup.mirrorQty.toString(),
      lookup.pendingQty.toString(),
      lookup.missingLayerQty.toString(),
    ]);

    try {
      await directAdjustStock(actorUserId, lookup.inventoryItemId, {
        idempotencyKey,
        adjustment: '0',
        unitCost,
        stockLocationId: lookup.stockLocationId,
        ...(lookup.valuationBatchId ? { batchId: lookup.valuationBatchId } : {}),
        reasonCode: 'LEGACY_OPENING_VALUATION',
        valuationDocumentReference: `AUTO-MASTER-COST:${sku}`,
        notes: `Harga modal otomatis dari Master Produk ${sku}.`,
      });
      results.push({ sku, status: 'PREPARED' });
    } catch (error) {
      results.push({ sku, status: 'NEEDS_ATTENTION', message: errorMessage(error) });
    }
  }

  return {
    results,
    prepared: results.filter((result) => result.status === 'PREPARED').length,
    issues: results.filter((result) => result.status === 'NEEDS_ATTENTION'),
  };
}
