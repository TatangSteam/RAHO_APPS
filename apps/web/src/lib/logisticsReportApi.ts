import { api } from './api';

export type LogisticsReportFilter = {
  branchId?: string;
  startDate?: string;
  endDate?: string;
};

type CountByStatus = Record<string, number>;

export type LogisticsDashboard = {
  generatedAt: string;
  filter: { branchId: string | null; startDate: string; endDate: string; timeZone: string };
  stockSnapshot: {
    onHandQty: string; availableQty: string; reservedQty: string; quarantineQty: string; inTransitQty: string;
    lowStockItems: number; outOfStockItems: number; expiringBatchCount: number;
  };
  valuation: {
    layerValue: string; inTransitValue: string; totalAssetValue: string;
    valuedLayerQty: string; pendingValuationQty: string; layerMismatchCount: number;
  };
  movements: {
    postingCount: number;
    byType: Record<string, { count: number; quantity: string; value: string }>;
    trend: Array<{ date: string; inboundQty: string; outboundQty: string; movementValue: string }>;
  };
  usage: {
    usageLines: number; actualCost: string;
    topProducts: Array<{ masterProductId: string; sku: string; productName: string; quantity: string; actualCost: string; usageLines: number }>;
  };
  requests: { total: number; byStatus: CountByStatus };
  shipments: {
    total: number; byStatus: CountByStatus; sentQty: string; receivedQty: string;
    quarantineQty: string; averageLeadTimeHours: number | null;
  };
  discrepancies: { total: number; open: number; resolved: number; quarantineQty: string; byType: CountByStatus };
  opnames: { total: number; byStatus: CountByStatus; absoluteDifferenceQty: string; differenceValue: string };
};

export type StockCard = {
  filter: LogisticsReportFilter & { inventoryItemId: string; stockLocationId: string | null; batchId: string | null; timeZone: string };
  item: {
    id: string; branchId: string;
    masterProduct: { id: string; sku: string; name: string; baseUnit?: string; unit: string };
    branch: { branchCode: string; name: string };
  };
  summary: { openingQty: string; totalInQty: string; totalOutQty: string; closingQty: string; movementCount: number; actualCost: string };
  data: Array<{
    id: string; type: string; quantity: string; inboundQty: string; outboundQty: string; signedQty: string;
    runningQty: string; actualCost: string | null; unitCost: string | null; occurredAt: string;
    referenceType: string | null; referenceId: string | null; notes: string | null;
    batch: { id: string; batchNumber: string; expiryDate: string | null } | null;
    inventoryBalance: { stockLocation: { id: string; code: string; name: string; warehouse: { code: string; name: string } } } | null;
    inventoryPosting: { postingNumber: string; type: string; status: string; sourceType: string; sourceId: string; sourceNumber: string | null; occurredAt: string } | null;
  }>;
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type InventoryValuation = {
  generatedAt: string;
  filter: { branchId: string | null; masterProductId: string | null; stockLocationId: string | null };
  summary: {
    onHandQty: string; reservedQty: string; quarantineQty: string; inTransitQty: string;
    valuedQty: string; pendingValuationQty: string; layerValue: string; inTransitValue: string;
    totalAssetValue: string; inTransitValueIncluded: boolean;
  };
  data: Array<{
    id: string; onHandQty: string; reservedQty: string; quarantineQty: string; inTransitQty: string;
    valuedQty: string; pendingValuationQty: string; inventoryValue: string; averageUnitCost: string | null;
    quantityReconciled: boolean;
    branch: { id: string; branchCode: string; name: string };
    masterProduct: { id: string; sku: string; name: string; baseUnit?: string; unit: string };
    stockLocation: { id: string; code: string; name: string; warehouse: { id: string; code: string; name: string } };
    batch: { id: string; batchNumber: string; expiryDate: string | null } | null;
    costLayers: Array<{ id: string; sourceType: string; sourceId: string; remainingQty: string; unitCost: string | null; valuationStatus: string; receivedAt: string }>;
  }>;
  meta: { page: number; limit: number; total: number; totalPages: number };
};

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

export const logisticsReportApi = {
  dashboard: async (params: LogisticsReportFilter) => unwrap<LogisticsDashboard>(
    await api.get('/inventory/reports/logistics-dashboard', { params }),
  ),
  stockCard: async (params: LogisticsReportFilter & {
    inventoryItemId: string;
    stockLocationId?: string;
    batchId?: string;
    page?: number;
    limit?: number;
  }) => unwrap<StockCard>(await api.get('/inventory/reports/stock-card', { params })),
  valuation: async (params: {
    branchId?: string;
    masterProductId?: string;
    stockLocationId?: string;
    page?: number;
    limit?: number;
  }) => unwrap<InventoryValuation>(await api.get('/inventory/reports/valuation', { params })),
};
