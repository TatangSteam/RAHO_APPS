import {
  IntegrationEvent,
  IntegrationEventStatus,
  Prisma,
  ShipmentStatus,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import {
  assertBranchAccess,
  getAccessibleBranchIds,
} from '@modules/iam/authorization.service';
import { enqueueContact } from './zoho.contact.service';
import { getActiveZohoClient, ZohoClient } from './zoho.client';
import { ZohoApiError } from './zoho.error';
import { paymentMethodMappingKey } from './zoho.payment.policy';
import {
  buildPartnershipCustomerPaymentPayload,
  buildPartnershipPaymentApplicationPayload,
  buildPartnershipSalesInvoicePayload,
  PartnershipGoodsShippedSnapshot,
  PartnershipPaymentDependencies,
  PartnershipPaymentSnapshot,
  PartnershipShipmentDependencies,
  partnershipItemMappingKey,
  PARTNERSHIP_PAYMENT_VERIFIED_EVENT,
  reconcilePartnershipInvoice,
  validatePartnershipPaymentSnapshot,
  validatePartnershipShipmentSnapshot,
  ZohoPartnershipInvoiceRemote,
} from './zoho.partnership.policy';
import { PARTNERSHIP_GOODS_SHIPPED_EVENT } from './zoho-routing.policy';

const PARTNERSHIP_INVOICE_MAPPING = 'PARTNERSHIP_SALES_INVOICE';
const PARTNERSHIP_PAYMENT_MAPPING = 'PARTNERSHIP_PAYMENT';
type JsonRecord = Record<string, unknown>;

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function metadata(value: Prisma.JsonValue | null): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function decimalString(value: unknown, places: number): string {
  return new Prisma.Decimal(String(value)).toDecimalPlaces(places).toFixed(places);
}

async function shipmentSnapshot(event: IntegrationEvent): Promise<PartnershipGoodsShippedSnapshot> {
  if (
    event.eventType !== PARTNERSHIP_GOODS_SHIPPED_EVENT
    || event.eventVersion !== 1
    || event.aggregateType !== 'Shipment'
  ) {
    throw new ZohoApiError(
      'Kontrak event shipment Partnership tidak didukung.',
      'ZOHO_PARTNERSHIP_EVENT_VERSION_UNSUPPORTED',
      422,
      false,
    );
  }
  const raw = event.payload as unknown as Partial<PartnershipGoodsShippedSnapshot>;
  const shipment = await prisma.shipment.findUnique({
    where: { id: event.aggregateId },
    select: {
      fromBranchId: true,
      toBranchId: true,
      status: true,
      items: {
        select: {
          masterProductId: true,
          masterProduct: { select: { name: true } },
        },
      },
    },
  });
  if (!shipment || shipment.status !== ShipmentStatus.SHIPPED) {
    throw new ZohoApiError(
      'Shipment Partnership belum berstatus SHIPPED.',
      'ZOHO_PARTNERSHIP_SHIPMENT_NOT_FINAL',
      409,
      false,
    );
  }
  const names = new Map(
    shipment.items.map((item) => [item.masterProductId, item.masterProduct.name]),
  );
  return {
    sourceBranchId: raw.sourceBranchId || shipment.fromBranchId,
    partnershipBranchId: raw.partnershipBranchId || shipment.toBranchId,
    stockRequestId: String(raw.stockRequestId || ''),
    stockRequestInvoiceId: String(raw.stockRequestInvoiceId || ''),
    shipmentCode: String(raw.shipmentCode || ''),
    invoiceNumber: String(raw.invoiceNumber || ''),
    revenueAmount: decimalString(raw.revenueAmount || 0, 2),
    costAmount: decimalString(raw.costAmount || 0, 4),
    grossProfit: decimalString(raw.grossProfit || 0, 4),
    items: Array.isArray(raw.items)
      ? raw.items.map((item) => ({
        masterProductId: String(item.masterProductId || ''),
        sku: item.sku == null ? null : String(item.sku),
        productName: String(item.productName || names.get(String(item.masterProductId)) || item.sku || 'Barang'),
        quantity: decimalString(item.quantity || 0, 4),
        unitPrice: decimalString(item.unitPrice || 0, 2),
        unitCost: decimalString(item.unitCost || 0, 4),
        totalCost: decimalString(item.totalCost || new Prisma.Decimal(String(item.quantity || 0))
          .mul(String(item.unitCost || 0)), 4),
      }))
      : [],
  };
}

async function shipmentDependencies(
  connectionId: string,
  snapshot: PartnershipGoodsShippedSnapshot,
): Promise<Partial<PartnershipShipmentDependencies>> {
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: connectionId,
      status: 'ACTIVE',
      OR: [
        {
          entityType: 'PARTNERSHIP_BRANCH',
          localEntityId: snapshot.partnershipBranchId,
        },
        {
          entityType: 'BRANCH_LOCATION',
          localEntityId: snapshot.sourceBranchId,
        },
        ...snapshot.items.map((item) => ({
          entityType: 'MASTER_PRODUCT',
          localEntityId: item.masterProductId,
        })),
      ],
    },
  });
  const find = (entityType: string, localEntityId: string) =>
    mappings.find((entry) =>
      entry.entityType === entityType && entry.localEntityId === localEntityId)?.zohoEntityId;
  return {
    customerId: find('PARTNERSHIP_BRANCH', snapshot.partnershipBranchId),
    sourceLocationId: find('BRANCH_LOCATION', snapshot.sourceBranchId),
    itemIds: Object.fromEntries(snapshot.items.flatMap((item) => {
      const id = find('MASTER_PRODUCT', item.masterProductId);
      return id ? [[partnershipItemMappingKey(item.masterProductId), id]] : [];
    })),
  };
}

async function findPartnershipInvoice(
  client: ZohoClient,
  snapshot: PartnershipGoodsShippedSnapshot,
): Promise<ZohoPartnershipInvoiceRemote[]> {
  const rows = await client.listAll<ZohoPartnershipInvoiceRemote>(
    '/books/v3/invoices',
    'invoices',
    { reference_number: snapshot.shipmentCode },
  );
  return rows.filter((row) =>
    row.reference_number === snapshot.shipmentCode
    || row.invoice_number === snapshot.invoiceNumber);
}

async function saveInvoiceMapping(input: {
  connectionId: string;
  shipmentId: string;
  snapshot: PartnershipGoodsShippedSnapshot;
  zohoInvoiceId: string;
  operation: string;
}) {
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: input.connectionId,
        entityType: PARTNERSHIP_INVOICE_MAPPING,
        localEntityId: input.shipmentId,
      },
    },
    create: {
      zohoConnectionId: input.connectionId,
      entityType: PARTNERSHIP_INVOICE_MAPPING,
      localEntityId: input.shipmentId,
      zohoEntityType: PARTNERSHIP_INVOICE_MAPPING,
      zohoEntityId: input.zohoInvoiceId,
      externalKey: `RAHO:PARTNERSHIP_SHIPMENT:${input.shipmentId}`,
      status: 'ACTIVE',
      metadata: json({
        operation: input.operation,
        stockRequestId: input.snapshot.stockRequestId,
        stockRequestInvoiceId: input.snapshot.stockRequestInvoiceId,
        shipmentCode: input.snapshot.shipmentCode,
        invoiceNumber: input.snapshot.invoiceNumber,
        revenueAmount: input.snapshot.revenueAmount,
        costAmount: input.snapshot.costAmount,
        grossProfit: input.snapshot.grossProfit,
        accountingPolicy: 'ZOHO_INVENTORY_ITEM_INVOICE',
      }),
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityId: input.zohoInvoiceId,
      status: 'ACTIVE',
      metadata: json({
        operation: input.operation,
        stockRequestId: input.snapshot.stockRequestId,
        stockRequestInvoiceId: input.snapshot.stockRequestInvoiceId,
        shipmentCode: input.snapshot.shipmentCode,
        invoiceNumber: input.snapshot.invoiceNumber,
        revenueAmount: input.snapshot.revenueAmount,
        costAmount: input.snapshot.costAmount,
        grossProfit: input.snapshot.grossProfit,
        accountingPolicy: 'ZOHO_INVENTORY_ITEM_INVOICE',
      }),
      lastSyncedAt: new Date(),
    },
  });
}

async function applyPartnershipAdvance(
  client: ZohoClient,
  shipmentId: string,
  snapshot: PartnershipGoodsShippedSnapshot,
  zohoInvoiceId: string,
) {
  const paymentMapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: PARTNERSHIP_PAYMENT_MAPPING,
        localEntityId: snapshot.stockRequestInvoiceId,
      },
    },
  });
  if (!paymentMapping?.zohoEntityId) return { status: 'NO_VERIFIED_ADVANCE' as const };
  const payment = await client.request<{
    payment?: {
      amount?: number;
      unused_amount?: number;
      invoices?: Array<{ invoice_id?: string | number; amount_applied?: number }>;
    };
  }>(`/books/v3/customerpayments/${paymentMapping.zohoEntityId}`);
  const applied = new Prisma.Decimal(
    payment.payment?.invoices?.find((entry) =>
      String(entry.invoice_id) === zohoInvoiceId)?.amount_applied || 0,
  );
  const expected = Prisma.Decimal.min(
    new Prisma.Decimal(snapshot.revenueAmount),
    new Prisma.Decimal(String(metadata(paymentMapping.metadata).amount || payment.payment?.amount || 0)),
  ).toDecimalPlaces(2);
  if (applied.equals(expected)) return { status: 'ALREADY_APPLIED' as const, amount: expected.toFixed(2) };
  if (!applied.isZero()) {
    throw new ZohoApiError(
      `Pembayaran Partnership sudah diterapkan ${applied.toFixed(2)}, target ERP ${expected.toFixed(2)}.`,
      'ZOHO_PARTNERSHIP_PAYMENT_APPLICATION_MISMATCH',
      409,
      false,
    );
  }
  if (!expected.greaterThan(0)) return { status: 'NO_APPLICABLE_AMOUNT' as const };
  await client.request(`/books/v3/invoices/${zohoInvoiceId}/credits`, {
    method: 'POST',
    data: buildPartnershipPaymentApplicationPayload(
      paymentMapping.zohoEntityId,
      expected.toFixed(2),
    ),
  });
  await prisma.zohoEntityMapping.update({
    where: { id: paymentMapping.id },
    data: {
      metadata: json({
        ...metadata(paymentMapping.metadata),
        appliedShipmentId: shipmentId,
        appliedInvoiceId: zohoInvoiceId,
        appliedAmount: expected.toFixed(2),
        appliedAt: new Date().toISOString(),
      }),
      lastSyncedAt: new Date(),
    },
  });
  return { status: 'APPLIED' as const, amount: expected.toFixed(2) };
}

export async function handlePartnershipGoodsShipped(event: IntegrationEvent) {
  const snapshot = await shipmentSnapshot(event);
  const client = await getActiveZohoClient(true);
  const resolved = await shipmentDependencies(client.connection.id, snapshot);
  const issues = validatePartnershipShipmentSnapshot(snapshot, resolved);
  if (issues.length) {
    throw new ZohoApiError(
      issues.join(' '),
      'ZOHO_PARTNERSHIP_SALE_NEEDS_ACTION',
      422,
      false,
    );
  }
  let mapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: PARTNERSHIP_INVOICE_MAPPING,
        localEntityId: event.aggregateId,
      },
    },
  });
  let operation = 'ALREADY_MAPPED';
  if (!mapping) {
    const matches = await findPartnershipInvoice(client, snapshot);
    if (matches.length > 1) {
      throw new ZohoApiError(
        `Lebih dari satu invoice Zoho memakai shipment ${snapshot.shipmentCode}.`,
        'ZOHO_PARTNERSHIP_INVOICE_AMBIGUOUS',
        409,
        false,
      );
    }
    let remote = matches[0];
    operation = remote ? 'RECOVER_EXISTING' : 'CREATE';
    if (!remote) {
      const response = await client.request<{ invoice?: ZohoPartnershipInvoiceRemote }>(
        '/books/v3/invoices',
        {
          method: 'POST',
          params: { ignore_auto_number_generation: true },
          data: buildPartnershipSalesInvoicePayload({
            shipmentId: event.aggregateId,
            shippedAt: event.occurredAt,
            snapshot,
            dependencies: resolved as PartnershipShipmentDependencies,
          }),
        },
      );
      remote = response.invoice;
    }
    const zohoInvoiceId = remote?.invoice_id == null ? null : String(remote.invoice_id);
    if (!zohoInvoiceId) {
      throw new ZohoApiError(
        'Zoho tidak mengembalikan invoice_id untuk shipment Partnership.',
        'ZOHO_PARTNERSHIP_INVOICE_ID_MISSING',
        502,
        true,
      );
    }
    if (!remote?.status || remote.status.toLowerCase() === 'draft') {
      await client.request(`/books/v3/invoices/${zohoInvoiceId}/status/sent`, { method: 'POST' });
    }
    mapping = await saveInvoiceMapping({
      connectionId: client.connection.id,
      shipmentId: event.aggregateId,
      snapshot,
      zohoInvoiceId,
      operation,
    });
  }
  const payment = await applyPartnershipAdvance(
    client,
    event.aggregateId,
    snapshot,
    mapping.zohoEntityId,
  );
  return {
    operation,
    zohoInvoiceId: mapping.zohoEntityId,
    shipmentCode: snapshot.shipmentCode,
    revenueAmount: snapshot.revenueAmount,
    costAmount: snapshot.costAmount,
    grossProfit: snapshot.grossProfit,
    payment,
  };
}

async function paymentDependencies(
  connectionId: string,
  snapshot: PartnershipPaymentSnapshot,
): Promise<Partial<PartnershipPaymentDependencies> & { cashBankAccountId?: string }> {
  const accounts = snapshot.paymentAccountNumber
    ? await prisma.cashBankAccount.findMany({
      where: {
        isActive: true,
        accountNumber: snapshot.paymentAccountNumber,
      },
      select: { id: true },
      take: 2,
    })
    : [];
  if (accounts.length > 1) {
    throw new ZohoApiError(
      'Lebih dari satu rekening ERP memakai nomor rekening penerima yang sama.',
      'ZOHO_PARTNERSHIP_PAYMENT_ACCOUNT_AMBIGUOUS',
      409,
      false,
    );
  }
  const invoiceMapping = await prisma.zohoEntityMapping.findFirst({
    where: {
      zohoConnectionId: connectionId,
      entityType: PARTNERSHIP_INVOICE_MAPPING,
      metadata: {
        path: ['stockRequestInvoiceId'],
        equals: snapshot.stockRequestInvoiceId,
      },
      status: 'ACTIVE',
    },
  });
  const lookup = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: connectionId,
      status: 'ACTIVE',
      OR: [
        { entityType: 'PARTNERSHIP_BRANCH', localEntityId: snapshot.partnershipBranchId },
        ...(accounts[0] ? [{ entityType: 'CASH_BANK_ACCOUNT', localEntityId: accounts[0].id }] : []),
        { entityType: 'PAYMENT_METHOD', localEntityId: paymentMethodMappingKey('TRANSFER') },
      ],
    },
  });
  const find = (entityType: string, localEntityId: string) =>
    lookup.find((entry) =>
      entry.entityType === entityType && entry.localEntityId === localEntityId)?.zohoEntityId;
  return {
    customerId: find('PARTNERSHIP_BRANCH', snapshot.partnershipBranchId),
    accountId: accounts[0] ? find('CASH_BANK_ACCOUNT', accounts[0].id) : undefined,
    cashBankAccountId: accounts[0]?.id,
    paymentMode: find('PAYMENT_METHOD', paymentMethodMappingKey('TRANSFER')),
    invoiceId: invoiceMapping?.zohoEntityId,
  };
}

async function findPartnershipPayment(client: ZohoClient, referenceNumber: string) {
  const rows = await client.listAll<{
    payment_id?: string | number;
    reference_number?: string;
  }>('/books/v3/customerpayments', 'customerpayments', { reference_number: referenceNumber });
  return rows.filter((row) => row.reference_number === referenceNumber);
}

export async function handlePartnershipPaymentVerified(event: IntegrationEvent) {
  if (event.eventVersion !== 1 || event.aggregateType !== 'StockRequestInvoice') {
    throw new ZohoApiError(
      'Kontrak event pembayaran Partnership tidak didukung.',
      'ZOHO_PARTNERSHIP_PAYMENT_EVENT_UNSUPPORTED',
      422,
      false,
    );
  }
  const snapshot = event.payload as unknown as PartnershipPaymentSnapshot;
  const client = await getActiveZohoClient(true);
  const resolved = await paymentDependencies(client.connection.id, snapshot);
  const issues = validatePartnershipPaymentSnapshot(snapshot, resolved);
  if (issues.length) {
    throw new ZohoApiError(
      issues.join(' '),
      'ZOHO_PARTNERSHIP_PAYMENT_NEEDS_ACTION',
      422,
      false,
    );
  }
  const existingMapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: PARTNERSHIP_PAYMENT_MAPPING,
        localEntityId: snapshot.stockRequestInvoiceId,
      },
    },
  });
  if (existingMapping) {
    return {
      operation: 'ALREADY_MAPPED',
      zohoPaymentId: existingMapping.zohoEntityId,
    };
  }
  const matches = await findPartnershipPayment(client, snapshot.referenceNumber);
  if (matches.length > 1) {
    throw new ZohoApiError(
      'Lebih dari satu pembayaran Zoho memakai reference Partnership yang sama.',
      'ZOHO_PARTNERSHIP_PAYMENT_AMBIGUOUS',
      409,
      false,
    );
  }
  let candidate = matches[0];
  const operation = candidate ? 'RECOVER_EXISTING' : 'CREATE';
  if (!candidate) {
    const response = await client.request<{
      payment?: { payment_id?: string | number; reference_number?: string };
    }>('/books/v3/customerpayments', {
      method: 'POST',
      data: buildPartnershipCustomerPaymentPayload(
        snapshot,
        resolved as PartnershipPaymentDependencies,
      ),
    });
    candidate = response.payment;
  }
  const zohoPaymentId = candidate?.payment_id == null ? null : String(candidate.payment_id);
  if (!zohoPaymentId) {
    throw new ZohoApiError(
      'Zoho tidak mengembalikan payment_id Partnership.',
      'ZOHO_PARTNERSHIP_PAYMENT_ID_MISSING',
      502,
      true,
    );
  }
  await prisma.zohoEntityMapping.create({
    data: {
      zohoConnectionId: client.connection.id,
      entityType: PARTNERSHIP_PAYMENT_MAPPING,
      localEntityId: snapshot.stockRequestInvoiceId,
      zohoEntityType: 'CUSTOMER_PAYMENT',
      zohoEntityId: zohoPaymentId,
      externalKey: snapshot.referenceNumber,
      status: 'ACTIVE',
      metadata: json({
        operation,
        amount: snapshot.amount,
        invoiceNumber: snapshot.invoiceNumber,
        cashBankAccountId: resolved.cashBankAccountId,
        createdAs: resolved.invoiceId ? 'INVOICE_PAYMENT' : 'CUSTOMER_ADVANCE',
        appliedInvoiceId: resolved.invoiceId || null,
      }),
      lastSyncedAt: new Date(),
    },
  });
  return {
    operation,
    zohoPaymentId,
    accounting: resolved.invoiceId ? 'INVOICE_PAYMENT' : 'CUSTOMER_ADVANCE',
  };
}

async function eventForShipment(id: string) {
  const event = await prisma.integrationEvent.findUnique({
    where: {
      eventType_aggregateId: {
        eventType: PARTNERSHIP_GOODS_SHIPPED_EVENT,
        aggregateId: id,
      },
    },
  });
  if (!event) {
    throw new AppError(
      409,
      'PARTNERSHIP_SHIPMENT_EVENT_MISSING',
      'Event atomik shipment Partnership tidak ditemukan. Jangan membangun ulang dari harga yang dapat berubah.',
    );
  }
  return event;
}

async function assertPartnershipShipmentAccess(actorUserId: string, shipmentId: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { toBranch: { select: { type: true } } },
  });
  if (!shipment || shipment.toBranch.type !== 'PARTNERSHIP') {
    throw new AppError(
      404,
      'PARTNERSHIP_SHIPMENT_NOT_FOUND',
      'Shipment Partnership tidak ditemukan.',
    );
  }
  await assertBranchAccess(actorUserId, shipment.toBranchId);
  return shipment;
}

export async function previewPartnershipSale(actorUserId: string, shipmentId: string) {
  await assertPartnershipShipmentAccess(actorUserId, shipmentId);
  const event = await eventForShipment(shipmentId);
  const snapshot = await shipmentSnapshot(event);
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  const resolved = connection ? await shipmentDependencies(connection.id, snapshot) : {};
  const issues = validatePartnershipShipmentSnapshot(snapshot, resolved);
  return {
    snapshot,
    payload: connection && !issues.length
      ? buildPartnershipSalesInvoicePayload({
        shipmentId,
        shippedAt: event.occurredAt,
        snapshot,
        dependencies: resolved as PartnershipShipmentDependencies,
      })
      : null,
    issues: connection ? issues : ['Zoho Books belum terhubung.'],
    liveReady: Boolean(connection) && issues.length === 0,
    accounting: {
      revenue: snapshot.revenueAmount,
      fifoCost: snapshot.costAmount,
      grossProfit: snapshot.grossProfit,
      policy: 'Invoice inventory item Zoho mencatat omzet dan HPP; ERP tidak membuat journal HPP Zoho kedua.',
    },
    excludedFields: [
      'diagnosis',
      'therapy_plan',
      'medical_record',
      'treatment_session',
      'payment_proof',
      'batch',
      'expiry',
    ],
  };
}

export async function enqueuePartnershipSale(actorUserId: string, shipmentId: string) {
  await assertPartnershipShipmentAccess(actorUserId, shipmentId);
  const event = await eventForShipment(shipmentId);
  if (event.status === IntegrationEventStatus.PROCESSING) {
    throw new AppError(409, 'ZOHO_EVENT_PROCESSING', 'Shipment sedang diproses worker Zoho.');
  }
  return prisma.integrationEvent.update({
    where: { id: event.id },
    data: {
      status: IntegrationEventStatus.PENDING,
      attempts: 0,
      availableAt: new Date(),
      processedAt: null,
      deadLetteredAt: null,
      ignoredAt: null,
      ignoredById: null,
      ignoreReason: null,
      lockedBy: null,
      leaseUntil: null,
      lastError: null,
    },
  });
}

export async function enqueuePartnershipCustomer(actorUserId: string, branchId: string) {
  await assertBranchAccess(actorUserId, branchId);
  return enqueueContact('PARTNERSHIP_BRANCH', branchId);
}

export async function listPartnershipSales(
  actorUserId: string,
  input: { page: number; limit: number; search?: string },
) {
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const where: Prisma.ShipmentWhereInput = {
    toBranch: { type: 'PARTNERSHIP' },
    ...(branchIds === null ? {} : { toBranchId: { in: branchIds } }),
    ...(input.search ? {
      OR: [
        { shipmentCode: { contains: input.search, mode: 'insensitive' } },
        { stockRequest: { requestCode: { contains: input.search, mode: 'insensitive' } } },
        { stockRequest: { invoice: { invoiceNumber: { contains: input.search, mode: 'insensitive' } } } },
        { toBranch: { name: { contains: input.search, mode: 'insensitive' } } },
      ],
    } : {}),
  };
  const [rows, total, connection] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: {
        fromBranch: { select: { id: true, branchCode: true, name: true } },
        toBranch: { select: { id: true, branchCode: true, name: true, type: true } },
        stockRequest: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, status: true } },
          },
        },
      },
      orderBy: [{ shippedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.shipment.count({ where }),
    prisma.zohoConnection.findFirst({ where: { isActive: true }, select: { id: true } }),
  ]);
  const shipmentIds = rows.map((row) => row.id);
  const invoiceIds = rows.flatMap((row) => row.stockRequest.invoice?.id
    ? [row.stockRequest.invoice.id]
    : []);
  const [events, invoiceMappings, paymentMappings, customerMappings] = connection
    ? await Promise.all([
      prisma.integrationEvent.findMany({
        where: {
          eventType: PARTNERSHIP_GOODS_SHIPPED_EVENT,
          aggregateId: { in: shipmentIds },
        },
      }),
      prisma.zohoEntityMapping.findMany({
        where: {
          zohoConnectionId: connection.id,
          entityType: PARTNERSHIP_INVOICE_MAPPING,
          localEntityId: { in: shipmentIds },
        },
      }),
      prisma.zohoEntityMapping.findMany({
        where: {
          zohoConnectionId: connection.id,
          entityType: PARTNERSHIP_PAYMENT_MAPPING,
          localEntityId: { in: invoiceIds },
        },
      }),
      prisma.zohoEntityMapping.findMany({
        where: {
          zohoConnectionId: connection.id,
          entityType: 'PARTNERSHIP_BRANCH',
          localEntityId: { in: rows.map((row) => row.toBranchId) },
        },
      }),
    ])
    : [[], [], [], []];
  return {
    items: rows.map((row) => {
      const event = events.find((entry) => entry.aggregateId === row.id);
      const snapshot = event?.payload as unknown as Partial<PartnershipGoodsShippedSnapshot> | undefined;
      return {
        id: row.id,
        shipmentCode: row.shipmentCode,
        status: row.status,
        shippedAt: row.shippedAt,
        fromBranch: row.fromBranch,
        partnershipBranch: row.toBranch,
        stockRequest: {
          id: row.stockRequest.id,
          requestCode: row.stockRequest.requestCode,
        },
        invoice: row.stockRequest.invoice,
        amounts: event ? {
          revenue: snapshot?.revenueAmount,
          fifoCost: snapshot?.costAmount,
          grossProfit: snapshot?.grossProfit,
        } : null,
        customerMapping: customerMappings.find((entry) =>
          entry.localEntityId === row.toBranchId) || null,
        invoiceMapping: invoiceMappings.find((entry) =>
          entry.localEntityId === row.id) || null,
        paymentMapping: paymentMappings.find((entry) =>
          entry.localEntityId === row.stockRequest.invoice?.id) || null,
        event: event || null,
      };
    }),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

export async function reconcilePartnershipSales(actorUserId: string) {
  const client = await getActiveZohoClient(true);
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const events = await prisma.integrationEvent.findMany({
    where: {
      eventType: PARTNERSHIP_GOODS_SHIPPED_EVENT,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    },
    orderBy: { occurredAt: 'desc' },
    take: 100,
  });
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: client.connection.id,
      entityType: PARTNERSHIP_INVOICE_MAPPING,
      localEntityId: { in: events.map((event) => event.aggregateId) },
      status: 'ACTIVE',
    },
  });
  const rows = await Promise.all(events.map(async (event) => {
    const snapshot = await shipmentSnapshot(event);
    const mapping = mappings.find((entry) => entry.localEntityId === event.aggregateId);
    if (!mapping) {
      return {
        shipmentId: event.aggregateId,
        shipmentCode: snapshot.shipmentCode,
        result: reconcilePartnershipInvoice(snapshot),
      };
    }
    const response = await client.request<{ invoice?: ZohoPartnershipInvoiceRemote }>(
      `/books/v3/invoices/${mapping.zohoEntityId}`,
    );
    return {
      shipmentId: event.aggregateId,
      shipmentCode: snapshot.shipmentCode,
      result: reconcilePartnershipInvoice(snapshot, response.invoice),
    };
  }));
  return {
    checked: rows.length,
    matched: rows.filter((row) => row.result.status === 'MATCHED').length,
    mismatched: rows.filter((row) => row.result.status === 'MISMATCH').length,
    missing: rows.filter((row) => row.result.status === 'MISSING').length,
    rows,
  };
}

export function buildPartnershipPaymentVerifiedEventData(input: {
  invoiceId: string;
  branchId: string;
  stockRequestId: string;
  invoiceNumber: string;
  amount: Prisma.Decimal;
  verifiedAt: Date;
  paymentAccountNumber: string | null;
}) {
  const snapshot: PartnershipPaymentSnapshot = {
    localEntityId: input.invoiceId,
    partnershipBranchId: input.branchId,
    stockRequestId: input.stockRequestId,
    stockRequestInvoiceId: input.invoiceId,
    invoiceNumber: input.invoiceNumber,
    amount: input.amount.toFixed(2),
    paymentDate: input.verifiedAt.toISOString().slice(0, 10),
    referenceNumber: `RAHO-PARTNER-ADV:${input.invoiceId}`,
    paymentAccountNumber: input.paymentAccountNumber,
  };
  return {
    eventType: PARTNERSHIP_PAYMENT_VERIFIED_EVENT,
    eventVersion: 1,
    aggregateType: 'StockRequestInvoice',
    aggregateId: input.invoiceId,
    branchId: input.branchId,
    payload: json(snapshot),
    occurredAt: input.verifiedAt,
  };
}
