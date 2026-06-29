import { inventoryApi, type Shipment, type StockRequest } from './inventoryApi';

export type ManagerNotificationType =
  | 'STOCK_REQUEST_PENDING'
  | 'STOCK_PAYMENT_UPLOADED'
  | 'SHIPMENT_ISSUE';

export type ManagerNotificationSeverity = 'warning' | 'info' | 'danger';

export interface ManagerNotificationItem {
  id: string;
  type: ManagerNotificationType;
  severity: ManagerNotificationSeverity;
  title: string;
  message: string;
  sourceId: string;
  sourceCode: string;
  branchName?: string;
  status: string;
  createdAt: string;
  href: string;
  actionLabel: string;
}

export interface ManagerNotificationCounts {
  total: number;
  stockRequests: number;
  pendingStockRequests: number;
  uploadedPaymentRequests: number;
  issueShipments: number;
}

export interface ManagerInventoryNotifications {
  counts: ManagerNotificationCounts;
  items: ManagerNotificationItem[];
}

export const emptyManagerNotificationCounts: ManagerNotificationCounts = {
  total: 0,
  stockRequests: 0,
  pendingStockRequests: 0,
  uploadedPaymentRequests: 0,
  issueShipments: 0,
};

type CollectionPayload<T> = {
  data?: T[] | { data?: T[]; pagination?: { total?: number } };
  pagination?: { total?: number };
  meta?: { total?: number };
};

function extractCollection<T>(payload: CollectionPayload<T> | T[] | unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  const body = payload as CollectionPayload<T> | undefined;
  if (!body) return [];

  if (Array.isArray(body.data)) return body.data;
  if (body.data && !Array.isArray(body.data) && Array.isArray(body.data.data)) {
    return body.data.data;
  }

  return [];
}

function extractTotal<T>(payload: CollectionPayload<T> | T[] | unknown, fallback: number): number {
  if (!payload || Array.isArray(payload)) return fallback;

  const body = payload as CollectionPayload<T>;
  const nestedData = body.data && !Array.isArray(body.data) ? body.data : undefined;
  const total = nestedData?.pagination?.total ?? body.pagination?.total ?? body.meta?.total;

  return typeof total === 'number' ? total : fallback;
}

function getRequestItemCount(request: StockRequest): number {
  return request.itemCount ?? request.totalItems ?? request.items?.length ?? 0;
}

function formatItemCount(count: number): string {
  return `${count} item`;
}

function toStockRequestNotification(
  request: StockRequest,
  type: Extract<ManagerNotificationType, 'STOCK_REQUEST_PENDING' | 'STOCK_PAYMENT_UPLOADED'>,
): ManagerNotificationItem {
  const isPaymentUploaded = type === 'STOCK_PAYMENT_UPLOADED';
  const itemCount = getRequestItemCount(request);

  return {
    id: `${type}-${request.id}`,
    type,
    severity: isPaymentUploaded ? 'info' : 'warning',
    title: isPaymentUploaded
      ? 'Bukti pembayaran stok perlu dicek'
      : 'Request stok menunggu review',
    message: `${request.branchName || 'Cabang'} memiliki request ${request.requestCode} berisi ${formatItemCount(itemCount)}.`,
    sourceId: request.id,
    sourceCode: request.requestCode,
    branchName: request.branchName,
    status: request.status,
    createdAt: isPaymentUploaded
      ? request.paymentUploadedAt || request.updatedAt || request.createdAt
      : request.createdAt,
    href: '/inventory/stock-requests',
    actionLabel: isPaymentUploaded ? 'Konfirmasi pembayaran' : 'Review request',
  };
}

function toShipmentIssueNotification(shipment: Shipment): ManagerNotificationItem {
  const issueCount = shipment.discrepancyCount ?? shipment.discrepancies?.length ?? 0;
  const branchName = shipment.toBranchName || shipment.stockRequest?.branchName;

  return {
    id: `SHIPMENT_ISSUE-${shipment.id}`,
    type: 'SHIPMENT_ISSUE',
    severity: 'danger',
    title: 'Pengiriman diterima dengan masalah',
    message: `${branchName || 'Cabang'} melaporkan ${formatItemCount(issueCount)} bermasalah pada pengiriman ${shipment.shipmentCode}.`,
    sourceId: shipment.id,
    sourceCode: shipment.shipmentCode,
    branchName,
    status: shipment.status,
    createdAt: shipment.receivedAt || shipment.updatedAt || shipment.createdAt,
    href: '/inventory/shipments',
    actionLabel: 'Review pengiriman',
  };
}

export function formatNotificationBadge(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export async function fetchManagerInventoryNotifications(): Promise<ManagerInventoryNotifications> {
  const [pendingResponse, paymentUploadedResponse, issueShipmentResponse] = await Promise.all([
    inventoryApi.getStockRequests({ status: 'PENDING', limit: 50 }),
    inventoryApi.getStockRequests({ status: 'PAYMENT_UPLOADED', limit: 50 }),
    inventoryApi.getShipments({ status: 'RECEIVED_WITH_ISSUE' }),
  ]);

  const pendingRequests = extractCollection<StockRequest>(pendingResponse.data);
  const uploadedPaymentRequests = extractCollection<StockRequest>(paymentUploadedResponse.data);
  const issueShipments = extractCollection<Shipment>(issueShipmentResponse.data)
    .filter((shipment) => shipment.status === 'RECEIVED_WITH_ISSUE' && !shipment.approvedAt);

  const pendingStockRequests = extractTotal<StockRequest>(pendingResponse.data, pendingRequests.length);
  const uploadedPaymentRequestCount = extractTotal<StockRequest>(
    paymentUploadedResponse.data,
    uploadedPaymentRequests.length,
  );

  const items = [
    ...pendingRequests.map((request) => toStockRequestNotification(request, 'STOCK_REQUEST_PENDING')),
    ...uploadedPaymentRequests.map((request) => toStockRequestNotification(request, 'STOCK_PAYMENT_UPLOADED')),
    ...issueShipments.map(toShipmentIssueNotification),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const stockRequests = pendingStockRequests + uploadedPaymentRequestCount;
  const issueShipmentCount = issueShipments.length;

  return {
    counts: {
      total: stockRequests + issueShipmentCount,
      stockRequests,
      pendingStockRequests,
      uploadedPaymentRequests: uploadedPaymentRequestCount,
      issueShipments: issueShipmentCount,
    },
    items,
  };
}
