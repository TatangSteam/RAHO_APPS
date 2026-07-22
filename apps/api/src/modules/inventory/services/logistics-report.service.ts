import {
  InventoryPostingType,
  InventoryValuationStatus,
  Prisma,
  ShipmentDiscrepancyStatus,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import type {
  InventoryValuationQuery,
  LogisticsDashboardQuery,
  StockCardQuery,
} from '../logistics-report.schema';
import {
  buildLogisticsReportRange,
  createDailyTrend,
  decimalSum,
  incrementCount,
  reportDateKey,
  signedMutationQuantity,
} from './logistics-report.helpers';

type BranchScope = string | Prisma.StringFilter | undefined;

async function resolveBranchScope(actorUserId: string, branchId?: string): Promise<BranchScope> {
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_READ, branchId);
  if (branchId) {
    await assertBranchAccess(actorUserId, branchId);
    return branchId;
  }
  const accessible = await getAccessibleBranchIds(actorUserId);
  return accessible === null ? undefined : { in: accessible };
}

function reportRange(startDate?: string, endDate?: string) {
  try {
    return buildLogisticsReportRange(startDate, endDate);
  } catch {
    throw errors.badRequest('REPORT_DATE_RANGE_INVALID', 'Rentang laporan harus 1 sampai 366 hari.');
  }
}

function positive(value: Prisma.Decimal) {
  return value.isPositive() ? value : new Prisma.Decimal(0);
}

export async function getLogisticsDashboard(actorUserId: string, query: LogisticsDashboardQuery) {
  const branchScope = await resolveBranchScope(actorUserId, query.branchId);
  const range = reportRange(query.startDate, query.endDate);
  const branchWhere = branchScope === undefined ? {} : { branchId: branchScope };
  const shipmentScope = branchScope === undefined
    ? {}
    : { OR: [{ fromBranchId: branchScope }, { toBranchId: branchScope }] };
  const dateWhere = { gte: range.start, lt: range.endExclusive };

  const [balances, transfers, postings, usages, requests, shipments, discrepancies, opnames] = await Promise.all([
    prisma.inventoryBalance.findMany({
      where: branchWhere,
      select: {
        id: true,
        inventoryItemId: true,
        onHandQty: true,
        reservedQty: true,
        quarantineQty: true,
        inTransitQty: true,
        inventoryItem: { select: { minThreshold: true } },
        batch: { select: { id: true, expiryDate: true } },
        costLayers: {
          where: { remainingQty: { gt: 0 }, isVoided: false },
          select: { remainingQty: true, unitCost: true, valuationStatus: true },
        },
      },
    }),
    prisma.internalTransferLedger.findMany({
      where: { ...(branchScope === undefined ? {} : { fromBranchId: branchScope }), status: { in: ['IN_TRANSIT', 'DISCREPANCY'] } },
      select: { totalValue: true, receivedValue: true },
    }),
    prisma.inventoryPosting.findMany({
      where: { ...branchWhere, occurredAt: dateWhere },
      select: {
        type: true,
        status: true,
        occurredAt: true,
        totalCost: true,
        stockMutations: { select: { stockBefore: true, stockAfter: true } },
      },
    }),
    prisma.materialUsage.findMany({
      where: { status: 'CONSUMED', consumedAt: dateWhere, ...(branchScope === undefined ? {} : { session: { branchId: branchScope } }) },
      select: {
        baseQuantity: true,
        quantity: true,
        totalActualCost: true,
        inventoryItem: { select: { masterProduct: { select: { id: true, sku: true, name: true } } } },
      },
    }),
    prisma.stockRequest.findMany({
      where: { ...branchWhere, createdAt: dateWhere },
      select: { status: true },
    }),
    prisma.shipment.findMany({
      where: { ...shipmentScope, createdAt: dateWhere },
      select: {
        status: true,
        shippedAt: true,
        receivedAt: true,
        items: { select: { sentQty: true, receivedQty: true, quarantineQty: true } },
      },
    }),
    prisma.shipmentDiscrepancy.findMany({
      where: { createdAt: dateWhere, ...(branchScope === undefined ? {} : { shipment: shipmentScope }) },
      select: { status: true, discrepancyType: true, quarantinedQty: true, resolutionQty: true },
    }),
    prisma.stockOpname.findMany({
      where: { ...branchWhere, createdAt: dateWhere },
      select: {
        status: true,
        lines: {
          where: { differenceQty: { not: 0 } },
          select: { differenceQty: true, resolvedUnitCost: true, systemUnitCost: true },
        },
      },
    }),
  ]);

  const quantity = balances.reduce((totals, balance) => ({
    onHand: totals.onHand.add(balance.onHandQty),
    reserved: totals.reserved.add(balance.reservedQty),
    quarantine: totals.quarantine.add(balance.quarantineQty),
    inTransit: totals.inTransit.add(balance.inTransitQty),
  }), {
    onHand: new Prisma.Decimal(0),
    reserved: new Prisma.Decimal(0),
    quarantine: new Prisma.Decimal(0),
    inTransit: new Prisma.Decimal(0),
  });

  let layerValue = new Prisma.Decimal(0);
  let valuedLayerQty = new Prisma.Decimal(0);
  let pendingValuationQty = new Prisma.Decimal(0);
  let layerMismatchCount = 0;
  const itemStocks = new Map<string, { onHand: Prisma.Decimal; minThreshold: Prisma.Decimal }>();
  const expiringBatches = new Set<string>();
  const expiryLimit = new Date();
  expiryLimit.setUTCDate(expiryLimit.getUTCDate() + 30);

  for (const balance of balances) {
    let layerQty = new Prisma.Decimal(0);
    for (const layer of balance.costLayers) {
      layerQty = layerQty.add(layer.remainingQty);
      if (layer.valuationStatus === InventoryValuationStatus.PENDING_VALUATION || layer.unitCost === null) {
        pendingValuationQty = pendingValuationQty.add(layer.remainingQty);
      } else {
        valuedLayerQty = valuedLayerQty.add(layer.remainingQty);
        layerValue = layerValue.add(layer.remainingQty.mul(layer.unitCost));
      }
    }
    if (!layerQty.equals(balance.onHandQty)) layerMismatchCount += 1;
    const item = itemStocks.get(balance.inventoryItemId) || {
      onHand: new Prisma.Decimal(0),
      minThreshold: balance.inventoryItem.minThreshold,
    };
    item.onHand = item.onHand.add(balance.onHandQty);
    itemStocks.set(balance.inventoryItemId, item);
    if (balance.batch?.expiryDate && balance.onHandQty.isPositive()
      && balance.batch.expiryDate >= new Date() && balance.batch.expiryDate <= expiryLimit) {
      expiringBatches.add(balance.batch.id);
    }
  }

  const inTransitValue = transfers.reduce(
    (total, transfer) => total.add(positive(transfer.totalValue.sub(transfer.receivedValue))),
    new Prisma.Decimal(0),
  );
  const lowStockItems = [...itemStocks.values()].filter((item) => item.onHand.lessThanOrEqualTo(item.minThreshold)).length;
  const outOfStockItems = [...itemStocks.values()].filter((item) => !item.onHand.isPositive()).length;

  const trend = createDailyTrend(range.startDate, range.days);
  const trendByDate = new Map(trend.map((row) => [row.date, row]));
  const movementByType: Record<string, { count: number; quantity: Prisma.Decimal; value: Prisma.Decimal }> = {};
  for (const posting of postings) {
    const signedQty = decimalSum(posting.stockMutations.map(signedMutationQuantity));
    const day = trendByDate.get(reportDateKey(posting.occurredAt));
    if (day) {
      if (signedQty.isPositive()) day.inboundQty = day.inboundQty.add(signedQty);
      if (signedQty.isNegative()) day.outboundQty = day.outboundQty.add(signedQty.abs());
      day.movementValue = day.movementValue.add(posting.totalCost.abs());
    }
    const current = movementByType[posting.type] || { count: 0, quantity: new Prisma.Decimal(0), value: new Prisma.Decimal(0) };
    current.count += 1;
    current.quantity = current.quantity.add(signedQty.abs());
    current.value = current.value.add(posting.totalCost.abs());
    movementByType[posting.type] = current;
  }

  const usageByProduct = new Map<string, {
    masterProductId: string;
    sku: string;
    productName: string;
    quantity: Prisma.Decimal;
    actualCost: Prisma.Decimal;
    usageLines: number;
  }>();
  let usageCost = new Prisma.Decimal(0);
  for (const usage of usages) {
    const product = usage.inventoryItem.masterProduct;
    const current = usageByProduct.get(product.id) || {
      masterProductId: product.id,
      sku: product.sku,
      productName: product.name,
      quantity: new Prisma.Decimal(0),
      actualCost: new Prisma.Decimal(0),
      usageLines: 0,
    };
    current.quantity = current.quantity.add(usage.baseQuantity.isPositive() ? usage.baseQuantity : usage.quantity);
    current.actualCost = current.actualCost.add(usage.totalActualCost || 0);
    current.usageLines += 1;
    usageCost = usageCost.add(usage.totalActualCost || 0);
    usageByProduct.set(product.id, current);
  }

  const requestByStatus: Record<string, number> = {};
  requests.forEach((request) => incrementCount(requestByStatus, request.status));
  const shipmentByStatus: Record<string, number> = {};
  let sentQty = new Prisma.Decimal(0);
  let receivedQty = new Prisma.Decimal(0);
  let shipmentQuarantineQty = new Prisma.Decimal(0);
  let leadTimeHours = 0;
  let receivedShipments = 0;
  for (const shipment of shipments) {
    incrementCount(shipmentByStatus, shipment.status);
    sentQty = sentQty.add(decimalSum(shipment.items.map((item) => item.sentQty)));
    receivedQty = receivedQty.add(decimalSum(shipment.items.map((item) => item.receivedQty)));
    shipmentQuarantineQty = shipmentQuarantineQty.add(decimalSum(shipment.items.map((item) => item.quarantineQty)));
    if (shipment.shippedAt && shipment.receivedAt) {
      leadTimeHours += (shipment.receivedAt.getTime() - shipment.shippedAt.getTime()) / 3_600_000;
      receivedShipments += 1;
    }
  }

  const discrepancyByType: Record<string, number> = {};
  discrepancies.forEach((row) => incrementCount(discrepancyByType, row.discrepancyType));
  const openDiscrepancies = discrepancies.filter((row) => row.status === ShipmentDiscrepancyStatus.OPEN).length;
  const discrepancyQuarantineQty = decimalSum(discrepancies.map((row) => row.quarantinedQty));

  const opnameByStatus: Record<string, number> = {};
  let opnameDifferenceQty = new Prisma.Decimal(0);
  let opnameDifferenceValue = new Prisma.Decimal(0);
  for (const opname of opnames) {
    incrementCount(opnameByStatus, opname.status);
    for (const line of opname.lines) {
      const difference = line.differenceQty.abs();
      opnameDifferenceQty = opnameDifferenceQty.add(difference);
      const unitCost = line.resolvedUnitCost || line.systemUnitCost;
      opnameDifferenceValue = opnameDifferenceValue.add(difference.mul(unitCost));
    }
  }

  return {
    generatedAt: new Date(),
    filter: { branchId: query.branchId || null, startDate: range.startDate, endDate: range.endDate, timeZone: 'Asia/Jakarta' },
    stockSnapshot: {
      onHandQty: quantity.onHand,
      availableQty: quantity.onHand.sub(quantity.reserved).sub(quantity.quarantine),
      reservedQty: quantity.reserved,
      quarantineQty: quantity.quarantine,
      inTransitQty: quantity.inTransit,
      lowStockItems,
      outOfStockItems,
      expiringBatchCount: expiringBatches.size,
    },
    valuation: {
      layerValue,
      inTransitValue,
      totalAssetValue: layerValue.add(inTransitValue),
      valuedLayerQty,
      pendingValuationQty,
      layerMismatchCount,
    },
    movements: {
      postingCount: postings.length,
      byType: movementByType,
      trend,
    },
    usage: {
      usageLines: usages.length,
      actualCost: usageCost,
      topProducts: [...usageByProduct.values()]
        .sort((left, right) => right.actualCost.comparedTo(left.actualCost))
        .slice(0, 8),
    },
    requests: { total: requests.length, byStatus: requestByStatus },
    shipments: {
      total: shipments.length,
      byStatus: shipmentByStatus,
      sentQty,
      receivedQty,
      quarantineQty: shipmentQuarantineQty,
      averageLeadTimeHours: receivedShipments ? Number((leadTimeHours / receivedShipments).toFixed(2)) : null,
    },
    discrepancies: {
      total: discrepancies.length,
      open: openDiscrepancies,
      resolved: discrepancies.length - openDiscrepancies,
      quarantineQty: discrepancyQuarantineQty,
      byType: discrepancyByType,
    },
    opnames: {
      total: opnames.length,
      byStatus: opnameByStatus,
      absoluteDifferenceQty: opnameDifferenceQty,
      differenceValue: opnameDifferenceValue,
    },
  };
}

export async function getStockCard(actorUserId: string, query: StockCardQuery) {
  const range = reportRange(query.startDate, query.endDate);
  const item = await prisma.inventoryItem.findUnique({
    where: { id: query.inventoryItemId },
    select: {
      id: true,
      branchId: true,
      masterProduct: { select: { id: true, sku: true, name: true, baseUnit: true, unit: true } },
      branch: { select: { branchCode: true, name: true } },
    },
  });
  if (!item) throw errors.notFound('Inventory item tidak ditemukan.');
  if (query.branchId && item.branchId !== query.branchId) {
    throw errors.badRequest('STOCK_CARD_BRANCH_MISMATCH', 'Inventory item tidak berada pada cabang yang dipilih.');
  }
  await assertBranchAccess(actorUserId, item.branchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_READ, item.branchId);

  const dimensionWhere: Prisma.StockMutationWhereInput = {
    inventoryItemId: item.id,
    ...(query.stockLocationId ? { inventoryBalance: { is: { stockLocationId: query.stockLocationId } } } : {}),
    ...(query.batchId ? { batchId: query.batchId } : {}),
  };
  const beforeWhere: Prisma.StockMutationWhereInput = {
    ...dimensionWhere,
    OR: [
      { inventoryPosting: { is: { occurredAt: { lt: range.start } } } },
      { inventoryPostingId: null, createdAt: { lt: range.start } },
    ],
  };
  const periodWhere: Prisma.StockMutationWhereInput = {
    ...dimensionWhere,
    OR: [
      { inventoryPosting: { is: { occurredAt: { gte: range.start, lt: range.endExclusive } } } },
      { inventoryPostingId: null, createdAt: { gte: range.start, lt: range.endExclusive } },
    ],
  };
  const mutationSelect = {
    id: true,
    type: true,
    quantity: true,
    stockBefore: true,
    stockAfter: true,
    actualCost: true,
    referenceType: true,
    referenceId: true,
    notes: true,
    createdAt: true,
    batch: { select: { id: true, batchNumber: true, expiryDate: true } },
    inventoryBalance: { select: { stockLocation: { select: { id: true, code: true, name: true, warehouse: { select: { code: true, name: true } } } } } },
    inventoryPosting: { select: { postingNumber: true, type: true, status: true, sourceType: true, sourceId: true, sourceNumber: true, occurredAt: true } },
  } satisfies Prisma.StockMutationSelect;

  const [before, period] = await Promise.all([
    prisma.stockMutation.findMany({ where: beforeWhere, select: { stockBefore: true, stockAfter: true } }),
    prisma.stockMutation.findMany({ where: periodWhere, select: mutationSelect }),
  ]);
  period.sort((left, right) => {
    const leftDate = left.inventoryPosting?.occurredAt || left.createdAt;
    const rightDate = right.inventoryPosting?.occurredAt || right.createdAt;
    return leftDate.getTime() - rightDate.getTime() || left.id.localeCompare(right.id);
  });
  const openingQty = decimalSum(before.map(signedMutationQuantity));
  const signedPeriod = period.map(signedMutationQuantity);
  const totalInQty = decimalSum(signedPeriod.filter((value) => value.isPositive()));
  const totalOutQty = decimalSum(signedPeriod.filter((value) => value.isNegative()).map((value) => value.abs()));
  const skip = (query.page - 1) * query.limit;
  let runningQty = openingQty.add(decimalSum(signedPeriod.slice(0, skip)));
  const rows = period.slice(skip, skip + query.limit).map((mutation) => {
    const signedQty = signedMutationQuantity(mutation);
    runningQty = runningQty.add(signedQty);
    return {
      ...mutation,
      occurredAt: mutation.inventoryPosting?.occurredAt || mutation.createdAt,
      inboundQty: signedQty.isPositive() ? signedQty : new Prisma.Decimal(0),
      outboundQty: signedQty.isNegative() ? signedQty.abs() : new Prisma.Decimal(0),
      signedQty,
      runningQty,
      unitCost: mutation.actualCost && !signedQty.isZero() ? mutation.actualCost.abs().div(signedQty.abs()) : null,
    };
  });

  return {
    filter: {
      branchId: item.branchId,
      inventoryItemId: item.id,
      stockLocationId: query.stockLocationId || null,
      batchId: query.batchId || null,
      startDate: range.startDate,
      endDate: range.endDate,
      timeZone: 'Asia/Jakarta',
    },
    item,
    summary: {
      openingQty,
      totalInQty,
      totalOutQty,
      closingQty: openingQty.add(totalInQty).sub(totalOutQty),
      movementCount: period.length,
      actualCost: decimalSum(period.map((mutation) => mutation.actualCost?.abs())),
    },
    data: rows,
    meta: { page: query.page, limit: query.limit, total: period.length, totalPages: Math.ceil(period.length / query.limit) },
  };
}

export async function getInventoryValuation(actorUserId: string, query: InventoryValuationQuery) {
  const branchScope = await resolveBranchScope(actorUserId, query.branchId);
  const balanceWhere: Prisma.InventoryBalanceWhereInput = {
    ...(branchScope === undefined ? {} : { branchId: branchScope }),
    ...(query.masterProductId ? { masterProductId: query.masterProductId } : {}),
    ...(query.stockLocationId ? { stockLocationId: query.stockLocationId } : {}),
  };
  const [total, aggregate, rows, layers, transfers] = await Promise.all([
    prisma.inventoryBalance.count({ where: balanceWhere }),
    prisma.inventoryBalance.aggregate({
      where: balanceWhere,
      _sum: { onHandQty: true, reservedQty: true, quarantineQty: true, inTransitQty: true },
    }),
    prisma.inventoryBalance.findMany({
      where: balanceWhere,
      include: {
        branch: { select: { id: true, branchCode: true, name: true } },
        masterProduct: { select: { id: true, sku: true, name: true, baseUnit: true, unit: true } },
        stockLocation: { include: { warehouse: { select: { id: true, code: true, name: true } } } },
        batch: { select: { id: true, batchNumber: true, expiryDate: true } },
        costLayers: { where: { remainingQty: { gt: 0 }, isVoided: false }, orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }] },
      },
      orderBy: [{ branchId: 'asc' }, { masterProductId: 'asc' }, { batchKey: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.inventoryCostLayer.findMany({
      where: { inventoryBalance: balanceWhere, remainingQty: { gt: 0 }, isVoided: false },
      select: { remainingQty: true, unitCost: true, valuationStatus: true },
    }),
    prisma.internalTransferLedger.findMany({
      where: {
        ...(branchScope === undefined ? {} : { fromBranchId: branchScope }),
        status: { in: ['IN_TRANSIT', 'DISCREPANCY'] },
      },
      select: { totalValue: true, receivedValue: true },
    }),
  ]);

  const layerValue = layers.reduce((sum, layer) => (
    layer.valuationStatus === InventoryValuationStatus.VALUED && layer.unitCost !== null
      ? sum.add(layer.remainingQty.mul(layer.unitCost))
      : sum
  ), new Prisma.Decimal(0));
  const valuedQty = decimalSum(layers
    .filter((layer) => layer.valuationStatus === InventoryValuationStatus.VALUED && layer.unitCost !== null)
    .map((layer) => layer.remainingQty));
  const pendingValuationQty = decimalSum(layers
    .filter((layer) => layer.valuationStatus === InventoryValuationStatus.PENDING_VALUATION || layer.unitCost === null)
    .map((layer) => layer.remainingQty));
  const includeInTransitValue = !query.masterProductId && !query.stockLocationId;
  const inTransitValue = includeInTransitValue
    ? transfers.reduce((sum, transfer) => sum.add(positive(transfer.totalValue.sub(transfer.receivedValue))), new Prisma.Decimal(0))
    : new Prisma.Decimal(0);

  return {
    generatedAt: new Date(),
    filter: { branchId: query.branchId || null, masterProductId: query.masterProductId || null, stockLocationId: query.stockLocationId || null },
    summary: {
      onHandQty: aggregate._sum.onHandQty || new Prisma.Decimal(0),
      reservedQty: aggregate._sum.reservedQty || new Prisma.Decimal(0),
      quarantineQty: aggregate._sum.quarantineQty || new Prisma.Decimal(0),
      inTransitQty: aggregate._sum.inTransitQty || new Prisma.Decimal(0),
      valuedQty,
      pendingValuationQty,
      layerValue,
      inTransitValue,
      totalAssetValue: layerValue.add(inTransitValue),
      inTransitValueIncluded: includeInTransitValue,
    },
    data: rows.map((balance) => {
      const valuedLayers = balance.costLayers.filter((layer) => layer.valuationStatus === InventoryValuationStatus.VALUED && layer.unitCost !== null);
      const balanceValuedQty = decimalSum(valuedLayers.map((layer) => layer.remainingQty));
      const balanceValue = valuedLayers.reduce((sum, layer) => sum.add(layer.remainingQty.mul(layer.unitCost!)), new Prisma.Decimal(0));
      const balancePendingQty = decimalSum(balance.costLayers
        .filter((layer) => layer.valuationStatus === InventoryValuationStatus.PENDING_VALUATION || layer.unitCost === null)
        .map((layer) => layer.remainingQty));
      return {
        ...balance,
        valuedQty: balanceValuedQty,
        pendingValuationQty: balancePendingQty,
        inventoryValue: balanceValue,
        averageUnitCost: balanceValuedQty.isPositive() ? balanceValue.div(balanceValuedQty).toDecimalPlaces(4) : null,
        quantityReconciled: balanceValuedQty.add(balancePendingQty).equals(balance.onHandQty),
      };
    }),
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}
