import { createHash } from 'crypto';
import { prisma } from '@lib/prisma';
import { createAccountingPeriodService } from '@modules/accounting/accounting.service';
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

function jakartaMonthRange(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const jakartaOffsetMs = 7 * 60 * 60 * 1000;
  const nextMonthStartUtc = Date.UTC(year, month, 1) - jakartaOffsetMs;
  return {
    year,
    month,
    startDate: new Date(Date.UTC(year, month - 1, 1) - jakartaOffsetMs),
    endDate: new Date(nextMonthStartUtc - 1),
  };
}

async function ensureCurrentAccountingPeriod(branchId: string, actorUserId: string) {
  const now = new Date();
  const current = await prisma.accountingPeriod.findFirst({
    where: {
      scopeKey: { in: [branchId, 'GLOBAL'] },
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });
  if (current) return false;

  const range = jakartaMonthRange(now);
  try {
    await createAccountingPeriodService(actorUserId, {
      name: `Periode Otomatis ${range.year}-${String(range.month).padStart(2, '0')}`,
      fiscalYear: range.year,
      periodNo: range.month,
      startDate: range.startDate,
      endDate: range.endDate,
      branchId: null,
    });
    return true;
  } catch (error) {
    // Another request may have created the same period concurrently. Only
    // suppress the error when a usable period is now present.
    const concurrent = await prisma.accountingPeriod.findFirst({
      where: {
        scopeKey: { in: [branchId, 'GLOBAL'] },
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });
    if (!concurrent) throw error;
    return false;
  }
}

/**
 * Gives existing legacy stock the editable default cost from Master Product.
 * Physical quantity is never changed and normal finance/audit records remain
 * authoritative through the existing direct valuation service.
 */
export async function prepareAddOnInventoryForSale(branchId: string, actorUserId: string) {
  const skus = [...new Set(physicalAddOnCatalog().flatMap((entry) => entry.inventorySkus || [entry.inventorySku]))];
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
  let accountingPeriodChecked = false;
  let accountingPeriodCreated = false;

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
      if (!accountingPeriodChecked) {
        accountingPeriodCreated = await ensureCurrentAccountingPeriod(branchId, actorUserId);
        accountingPeriodChecked = true;
      }
      await directAdjustStock(actorUserId, lookup.inventoryItemId, {
        idempotencyKey,
        adjustment: '0',
        unitCost,
        stockLocationId: lookup.stockLocationId,
        ...(lookup.valuationBatchId ? { batchId: lookup.valuationBatchId } : {}),
        reasonCode: 'LEGACY_OPENING_VALUATION',
        valuationDocumentReference: `AUTO-MASTER-COST:${sku}`,
        notes: `Harga modal otomatis dari Master Produk ${sku}.`,
      }, { automatedDefaultCostValuation: true });
      results.push({ sku, status: 'PREPARED' });
    } catch (error) {
      results.push({ sku, status: 'NEEDS_ATTENTION', message: errorMessage(error) });
    }
  }

  return {
    results,
    prepared: results.filter((result) => result.status === 'PREPARED').length,
    issues: results.filter((result) => result.status === 'NEEDS_ATTENTION'),
    accountingPeriodCreated,
  };
}
