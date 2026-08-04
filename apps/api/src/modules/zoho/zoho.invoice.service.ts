import { IntegrationEvent, IntegrationEventStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { getActiveZohoClient, ZohoClient } from './zoho.client';
import { ZohoApiError } from './zoho.error';
import {
  buildZohoInvoicePayload,
  invoiceLineMappingKey,
  invoiceTaxMappingKey,
  validateInvoiceSnapshot,
  validateRecoveredInvoice,
  ZohoExistingInvoice,
  ZohoInvoiceDependencies,
  ZohoInvoiceLineSnapshot,
  ZohoInvoiceSnapshot,
} from './zoho.invoice.policy';

export const INVOICE_FINALIZED_EVENT = 'INVOICE_FINALIZED';
export const INVOICE_VOIDED_EVENT = 'INVOICE_VOIDED';
type Tx = Prisma.TransactionClient;

type InvoiceForSnapshot = Prisma.InvoiceGetPayload<{
  include: {
    member: { include: { user: { include: { profile: true } } } };
    branch: true;
    items: true;
  };
}>;

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function resolveLineSources(tx: Tx, invoice: InvoiceForSnapshot): Promise<ZohoInvoiceLineSnapshot[]> {
  const packageIds = invoice.items.filter((line) => line.itemType === 'PACKAGE').map((line) => line.itemId);
  const purchaseIds = invoice.items.filter((line) => line.itemType === 'NON_THERAPY').map((line) => line.itemId);
  const [packages, purchases] = await Promise.all([
    packageIds.length
      ? tx.memberPackage.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, packagePricingId: true, productCode: true },
      })
      : [],
    purchaseIds.length
      ? tx.memberNonTherapyPurchase.findMany({
        where: { id: { in: purchaseIds } },
        include: { product: { select: { productCode: true } } },
      })
      : [],
  ]);
  const productCodes = purchases.map((purchase) => purchase.product.productCode).filter(Boolean);
  const masterProducts = productCodes.length
    ? await tx.masterProduct.findMany({ where: { sku: { in: productCodes, mode: 'insensitive' } } })
    : [];

  return invoice.items.map((line) => {
    let mappingEntityType: ZohoInvoiceLineSnapshot['mappingEntityType'] = null;
    let mappingLocalEntityId: string | null = null;
    if (line.itemType === 'PACKAGE') {
      const source = packages.find((entry) => entry.id === line.itemId);
      if (source?.packagePricingId) {
        mappingEntityType = 'PACKAGE_PRICING';
        mappingLocalEntityId = source.packagePricingId;
      }
    } else if (line.itemType === 'NON_THERAPY') {
      const purchase = purchases.find((entry) => entry.id === line.itemId);
      const source = masterProducts.filter(
        (entry) => entry.sku?.toLowerCase() === purchase?.product.productCode.toLowerCase(),
      );
      if (source.length === 1) {
        mappingEntityType = 'MASTER_PRODUCT';
        mappingLocalEntityId = source[0].id;
      }
    }
    return {
      id: line.id,
      itemType: line.itemType,
      itemId: line.itemId,
      code: line.code,
      description: line.description,
      quantity: line.quantity,
      rate: line.pricePerUnit.toFixed(2),
      subtotal: line.subtotal.toFixed(2),
      discountAmount: line.discountAmount?.toFixed(2) || '0.00',
      totalAmount: line.totalAmount.toFixed(2),
      mappingEntityType,
      mappingLocalEntityId,
    };
  });
}

export async function buildFinalizedInvoiceSnapshot(
  tx: Tx,
  invoice: InvoiceForSnapshot,
  finalizedAt: Date,
  dueDate?: Date | null,
): Promise<ZohoInvoiceSnapshot> {
  const lines = await resolveLineSources(tx, invoice);
  const classification = invoice.items.some((line) => line.itemType === 'PACKAGE')
    ? 'THERAPY_ADVANCE'
    : 'NORMAL_SALE';
  const partnership = invoice.branch.type === 'PARTNERSHIP';
  const eligible = !partnership && classification === 'NORMAL_SALE';
  const excludedReason = partnership
    ? 'Invoice member cabang Partnership tidak dikirim sebagai omzet per terapi. Omzet Partnership berasal dari shipment barang.'
    : classification === 'THERAPY_ADVANCE'
      ? 'Pembelian paket terapi adalah uang muka/deferred revenue dan akan diproses oleh flow retainer, bukan Sales Invoice biasa.'
      : null;
  return {
    localEntityId: invoice.id,
    externalKey: `RAHO:INVOICE:${invoice.id}`,
    invoiceNumber: invoice.invoiceNumber,
    branchId: invoice.branchId,
    branchType: invoice.branch.type,
    memberId: invoice.memberId,
    date: day(finalizedAt),
    dueDate: dueDate ? day(dueDate) : null,
    currency: invoice.currency,
    classification,
    eligible,
    excludedReason,
    subtotal: invoice.subtotal.toFixed(2),
    discountAmount: invoice.discountAmount?.toFixed(2) || '0.00',
    taxPercent: invoice.taxPercent?.toFixed(4) || '0',
    taxAmount: invoice.taxAmount?.toFixed(2) || '0.00',
    totalAmount: invoice.totalAmount.toFixed(2),
    notes: invoice.notes,
    customer: {
      memberNo: invoice.member.memberNo,
      name: invoice.member.user.profile?.fullName || invoice.member.user.email,
      email: invoice.member.user.email,
    },
    branch: {
      branchCode: invoice.branch.branchCode,
      name: invoice.branch.name,
    },
    lines,
  };
}

export function finalizedTermsSnapshot(snapshot: ZohoInvoiceSnapshot, paymentPlanType: string, settlementAccountCode: string) {
  return {
    currency: snapshot.currency,
    paymentPlanType,
    dueDate: snapshot.dueDate,
    settlementAccountCode,
    finalizedAt: `${snapshot.date}T00:00:00.000Z`,
    classification: snapshot.classification,
    zoho: {
      externalKey: snapshot.externalKey,
      eligible: snapshot.eligible,
      excludedReason: snapshot.excludedReason,
    },
    items: snapshot.lines.map((line) => ({
      id: line.id,
      itemType: line.itemType,
      itemId: line.itemId,
      code: line.code,
      description: line.description,
      quantity: line.quantity,
      pricePerUnit: line.rate,
      subtotal: line.subtotal,
      discountAmount: line.discountAmount,
      totalAmount: line.totalAmount,
      mappingEntityType: line.mappingEntityType,
      mappingLocalEntityId: line.mappingLocalEntityId,
    })),
  };
}

export async function enqueueFinalizedInvoiceTx(tx: Tx, snapshot: ZohoInvoiceSnapshot) {
  return tx.integrationEvent.upsert({
    where: {
      eventType_aggregateId: {
        eventType: INVOICE_FINALIZED_EVENT,
        aggregateId: snapshot.localEntityId,
      },
    },
    create: {
      eventType: INVOICE_FINALIZED_EVENT,
      eventVersion: 1,
      aggregateType: 'Invoice',
      aggregateId: snapshot.localEntityId,
      branchId: snapshot.branchId,
      payload: json(snapshot),
      status: 'PENDING',
      occurredAt: new Date(),
    },
    update: {
      payload: json(snapshot),
      branchId: snapshot.branchId,
      status: 'PENDING',
      attempts: 0,
      availableAt: new Date(),
      processedAt: null,
      deadLetteredAt: null,
      lockedBy: null,
      leaseUntil: null,
      lastError: null,
      occurredAt: new Date(),
    },
  });
}

export async function enqueueVoidedInvoiceTx(
  tx: Tx,
  input: { invoiceId: string; invoiceNumber: string; branchId: string; eligible: boolean; excludedReason: string | null },
) {
  return tx.integrationEvent.upsert({
    where: {
      eventType_aggregateId: {
        eventType: INVOICE_VOIDED_EVENT,
        aggregateId: input.invoiceId,
      },
    },
    create: {
      eventType: INVOICE_VOIDED_EVENT,
      eventVersion: 1,
      aggregateType: 'Invoice',
      aggregateId: input.invoiceId,
      branchId: input.branchId,
      payload: json(input),
      status: 'PENDING',
      occurredAt: new Date(),
    },
    update: {
      payload: json(input),
      status: 'PENDING',
      attempts: 0,
      availableAt: new Date(),
      processedAt: null,
      deadLetteredAt: null,
      lockedBy: null,
      leaseUntil: null,
      lastError: null,
      occurredAt: new Date(),
    },
  });
}

async function dependencies(
  connectionId: string,
  snapshot: ZohoInvoiceSnapshot,
): Promise<Partial<ZohoInvoiceDependencies>> {
  const itemRefs = snapshot.lines
    .map((line) => ({
      line,
      key: invoiceLineMappingKey(line),
    }))
    .filter((entry): entry is { line: ZohoInvoiceLineSnapshot; key: string } => Boolean(entry.key));
  const lookups = [
    { entityType: 'MEMBER', localEntityId: snapshot.memberId },
    { entityType: 'BRANCH_LOCATION', localEntityId: snapshot.branchId },
    ...itemRefs.map(({ line }) => ({
      entityType: line.mappingEntityType!,
      localEntityId: line.mappingLocalEntityId!,
    })),
    ...(new Prisma.Decimal(snapshot.taxPercent).greaterThan(0)
      ? [{ entityType: 'TAX_RATE', localEntityId: invoiceTaxMappingKey(snapshot.taxPercent) }]
      : []),
  ];
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: connectionId,
      status: 'ACTIVE',
      OR: lookups,
    },
  });
  const find = (entityType: string, localEntityId: string) =>
    mappings.find((mapping) => mapping.entityType === entityType && mapping.localEntityId === localEntityId)?.zohoEntityId;
  return {
    customerId: find('MEMBER', snapshot.memberId),
    locationId: find('BRANCH_LOCATION', snapshot.branchId),
    taxId: new Prisma.Decimal(snapshot.taxPercent).greaterThan(0)
      ? find('TAX_RATE', invoiceTaxMappingKey(snapshot.taxPercent))
      : undefined,
    itemIds: Object.fromEntries(itemRefs.flatMap(({ line, key }) => {
      const id = find(line.mappingEntityType!, line.mappingLocalEntityId!);
      return id ? [[key, id]] : [];
    })),
  };
}

type ZohoInvoiceCandidate = ZohoExistingInvoice;

async function findExisting(client: ZohoClient, invoiceNumber: string): Promise<ZohoInvoiceCandidate[]> {
  const candidates = await client.listAll<ZohoInvoiceCandidate>(
    '/books/v3/invoices',
    'invoices',
    { reference_number: invoiceNumber },
  );
  return candidates.filter((candidate) =>
    candidate.reference_number === invoiceNumber || candidate.invoice_number === invoiceNumber);
}

async function saveInvoiceMapping(
  connectionId: string,
  snapshot: ZohoInvoiceSnapshot,
  zohoInvoiceId: string,
  operation: string,
) {
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: connectionId,
        entityType: 'INVOICE',
        localEntityId: snapshot.localEntityId,
      },
    },
    create: {
      zohoConnectionId: connectionId,
      entityType: 'INVOICE',
      localEntityId: snapshot.localEntityId,
      zohoEntityType: 'INVOICE',
      zohoEntityId: zohoInvoiceId,
      externalKey: snapshot.externalKey,
      status: 'ACTIVE',
      metadata: json({ operation, invoiceNumber: snapshot.invoiceNumber, totalAmount: snapshot.totalAmount }),
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityId: zohoInvoiceId,
      status: 'ACTIVE',
      metadata: json({ operation, invoiceNumber: snapshot.invoiceNumber, totalAmount: snapshot.totalAmount }),
      lastSyncedAt: new Date(),
    },
  });
}

export async function handleInvoiceEvent(event: IntegrationEvent) {
  if (event.eventType === INVOICE_VOIDED_EVENT) return handleInvoiceVoided(event);
  const snapshot = event.payload as unknown as ZohoInvoiceSnapshot;
  if (!snapshot.eligible) {
    return { operation: 'SKIP_POLICY', reason: snapshot.excludedReason, classification: snapshot.classification };
  }
  const client = await getActiveZohoClient(true);
  const existingMapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'INVOICE',
        localEntityId: snapshot.localEntityId,
      },
    },
  });
  if (existingMapping) return { operation: 'ALREADY_MAPPED', zohoId: existingMapping.zohoEntityId };

  const resolved = await dependencies(client.connection.id, snapshot);
  const issues = validateInvoiceSnapshot(snapshot, resolved);
  if (issues.length) throw new ZohoApiError(issues.join(' '), 'ZOHO_INVOICE_NEEDS_ACTION', 422, false);
  const matches = await findExisting(client, snapshot.invoiceNumber);
  if (matches.length > 1) {
    throw new ZohoApiError(
      `Lebih dari satu invoice Zoho memakai referensi ${snapshot.invoiceNumber}.`,
      'ZOHO_INVOICE_AMBIGUOUS',
      409,
      false,
    );
  }
  let zohoId = matches[0]?.invoice_id == null ? null : String(matches[0].invoice_id);
  let zohoStatus = matches[0]?.status?.toLowerCase();
  let operation = 'RECOVER_EXISTING';
  if (zohoId) {
    const detail = await client.request<{ invoice?: ZohoInvoiceCandidate }>(`/books/v3/invoices/${zohoId}`);
    const candidate = { ...matches[0], ...detail.invoice };
    const recoveryIssues = validateRecoveredInvoice(
      snapshot,
      resolved as ZohoInvoiceDependencies,
      candidate,
    );
    if (recoveryIssues.length) {
      throw new ZohoApiError(
        recoveryIssues.join(' '),
        'ZOHO_INVOICE_RECOVERY_MISMATCH',
        409,
        false,
      );
    }
    zohoStatus = candidate.status?.toLowerCase();
  }
  if (!zohoId) {
    const response = await client.request<{ invoice?: { invoice_id?: string | number; status?: string } }>(
      '/books/v3/invoices',
      {
        method: 'POST',
        params: { ignore_auto_number_generation: true },
        data: buildZohoInvoicePayload(snapshot, resolved as ZohoInvoiceDependencies),
      },
    );
    zohoId = response.invoice?.invoice_id == null ? null : String(response.invoice.invoice_id);
    zohoStatus = response.invoice?.status?.toLowerCase();
    operation = 'CREATE';
  }
  if (!zohoId) throw new ZohoApiError('Zoho tidak mengembalikan invoice ID.', 'ZOHO_INVOICE_ID_MISSING', 502, true);
  if (!zohoStatus || zohoStatus === 'draft') {
    await client.request(`/books/v3/invoices/${zohoId}/status/sent`, { method: 'POST' });
  }
  await saveInvoiceMapping(client.connection.id, snapshot, zohoId, operation);
  return { operation, zohoId };
}

async function handleInvoiceVoided(event: IntegrationEvent) {
  const payload = event.payload as unknown as {
    invoiceId: string;
    invoiceNumber: string;
    eligible: boolean;
    excludedReason: string | null;
  };
  if (!payload.eligible) return { operation: 'SKIP_POLICY', reason: payload.excludedReason };
  const client = await getActiveZohoClient(true);
  const mapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'INVOICE',
        localEntityId: payload.invoiceId,
      },
    },
  });
  if (mapping?.status === 'INACTIVE') return { operation: 'ALREADY_VOID', zohoId: mapping.zohoEntityId };
  let zohoId = mapping?.zohoEntityId || null;
  if (!zohoId) {
    const matches = await findExisting(client, payload.invoiceNumber);
    if (matches.length > 1) {
      throw new ZohoApiError('Invoice Zoho untuk void ambigu.', 'ZOHO_INVOICE_AMBIGUOUS', 409, false);
    }
    zohoId = matches[0]?.invoice_id == null ? null : String(matches[0].invoice_id);
  }
  if (!zohoId) {
    const finalized = await prisma.integrationEvent.findUnique({
      where: {
        eventType_aggregateId: {
          eventType: INVOICE_FINALIZED_EVENT,
          aggregateId: payload.invoiceId,
        },
      },
    });
    const waiting = Boolean(
      finalized
      && (finalized.status === IntegrationEventStatus.PENDING
        || finalized.status === IntegrationEventStatus.PROCESSING),
    );
    throw new ZohoApiError(
      waiting ? 'Menunggu invoice selesai dibuat sebelum void.' : 'Invoice Zoho belum ditemukan untuk void.',
      waiting ? 'ZOHO_INVOICE_VOID_WAITING' : 'ZOHO_INVOICE_VOID_NOT_FOUND',
      waiting ? 409 : 404,
      Boolean(waiting),
      waiting ? 5_000 : undefined,
    );
  }
  const detail = await client.request<{ invoice?: { status?: string } }>(`/books/v3/invoices/${zohoId}`);
  const alreadyVoid = detail.invoice?.status?.toLowerCase() === 'void';
  if (!alreadyVoid) {
    await client.request(`/books/v3/invoices/${zohoId}/status/void`, { method: 'POST' });
  }
  await prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'INVOICE',
        localEntityId: payload.invoiceId,
      },
    },
    create: {
      zohoConnectionId: client.connection.id,
      entityType: 'INVOICE',
      localEntityId: payload.invoiceId,
      zohoEntityType: 'INVOICE',
      zohoEntityId: zohoId,
      externalKey: `RAHO:INVOICE:${payload.invoiceId}`,
      status: 'INACTIVE',
      metadata: json({
        operation: alreadyVoid ? 'VOID_RECOVER_EXISTING' : 'VOID',
        invoiceNumber: payload.invoiceNumber,
      }),
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityId: zohoId,
      status: 'INACTIVE',
      metadata: json({
        operation: alreadyVoid ? 'ALREADY_VOID' : 'VOID',
        invoiceNumber: payload.invoiceNumber,
      }),
      lastSyncedAt: new Date(),
    },
  });
  return { operation: alreadyVoid ? 'ALREADY_VOID' : 'VOID', zohoId };
}

async function persistedSnapshot(invoiceId: string): Promise<ZohoInvoiceSnapshot> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      member: { include: { user: { include: { profile: true } } } },
      branch: true,
      items: true,
    },
  });
  if (!invoice) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice tidak ditemukan.');
  if (!invoice.finalizedAt || invoice.status === 'DRAFT') {
    throw new AppError(422, 'INVOICE_NOT_FINALIZED', 'Hanya invoice yang sudah difinalisasi dapat disinkronkan.');
  }
  const event = await prisma.integrationEvent.findUnique({
    where: {
      eventType_aggregateId: {
        eventType: INVOICE_FINALIZED_EVENT,
        aggregateId: invoice.id,
      },
    },
  });
  if (event) return event.payload as unknown as ZohoInvoiceSnapshot;
  return prisma.$transaction((tx) =>
    buildFinalizedInvoiceSnapshot(tx, invoice, invoice.finalizedAt!, invoice.dueDate));
}

export async function previewInvoice(invoiceId: string) {
  const snapshot = await persistedSnapshot(invoiceId);
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  const resolved = connection ? await dependencies(connection.id, snapshot) : {};
  const issues = validateInvoiceSnapshot(snapshot, resolved);
  return {
    snapshot,
    issues,
    payload: snapshot.eligible && !issues.length
      ? buildZohoInvoicePayload(snapshot, resolved as ZohoInvoiceDependencies)
      : null,
    liveReady: snapshot.eligible && !issues.length,
    excludedFields: ['diagnosis', 'therapy_plan', 'medical_record', 'treatment_bom', 'payment_proof'],
  };
}

export async function enqueueInvoice(invoiceId: string) {
  const snapshot = await persistedSnapshot(invoiceId);
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true },
  });
  if (invoice?.status === 'CANCELLED') {
    return prisma.$transaction((tx) => enqueueVoidedInvoiceTx(tx, {
      invoiceId,
      invoiceNumber: snapshot.invoiceNumber,
      branchId: snapshot.branchId,
      eligible: snapshot.eligible,
      excludedReason: snapshot.excludedReason,
    }));
  }
  const existing = await prisma.integrationEvent.findUnique({
    where: {
      eventType_aggregateId: {
        eventType: INVOICE_FINALIZED_EVENT,
        aggregateId: invoiceId,
      },
    },
  });
  if (existing?.status === IntegrationEventStatus.PROCESSING) {
    throw new AppError(409, 'ZOHO_INVOICE_SYNC_IN_PROGRESS', 'Invoice sedang diproses worker.');
  }
  return prisma.$transaction((tx) => enqueueFinalizedInvoiceTx(tx, snapshot));
}

export async function listInvoiceMappings(input: { page: number; limit: number; search?: string }) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const where: Prisma.InvoiceWhereInput = {
    status: { not: 'DRAFT' },
    ...(input.search ? {
      OR: [
        { invoiceNumber: { contains: input.search, mode: 'insensitive' } },
        { member: { memberNo: { contains: input.search, mode: 'insensitive' } } },
        { member: { user: { profile: { fullName: { contains: input.search, mode: 'insensitive' } } } } },
      ],
    } : {}),
  };
  const skip = (input.page - 1) * input.limit;
  const [rows, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      include: {
        member: { include: { user: { include: { profile: true } } } },
        branch: true,
        items: true,
      },
      orderBy: { finalizedAt: 'desc' },
      skip,
      take: input.limit,
    }),
    prisma.invoice.count({ where }),
  ]);
  const ids = rows.map((row) => row.id);
  const [mappings, events] = await Promise.all([
    prisma.zohoEntityMapping.findMany({
      where: { zohoConnectionId: connection.id, entityType: 'INVOICE', localEntityId: { in: ids } },
    }),
    prisma.integrationEvent.findMany({
      where: { aggregateId: { in: ids }, eventType: { in: [INVOICE_FINALIZED_EVENT, INVOICE_VOIDED_EVENT] } },
    }),
  ]);
  return {
    items: rows.map((row) => {
      const classification = row.items.some((line) => line.itemType === 'PACKAGE') ? 'THERAPY_ADVANCE' : 'NORMAL_SALE';
      return {
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        memberNo: row.member.memberNo,
        memberName: row.member.user.profile?.fullName || row.member.user.email,
        branchCode: row.branch.branchCode,
        branchType: row.branch.type,
        classification,
        eligible: row.branch.type !== 'PARTNERSHIP' && classification === 'NORMAL_SALE',
        status: row.status,
        totalAmount: row.totalAmount.toFixed(2),
        finalizedAt: row.finalizedAt,
        mapping: mappings.find((mapping) => mapping.localEntityId === row.id) || null,
        events: events.filter((event) => event.aggregateId === row.id),
      };
    }),
    pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) },
  };
}

export async function getInvoiceConfig() {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const [taxes, mappings] = await Promise.all([
    prisma.zohoDiscoveryCache.findMany({
      where: { zohoConnectionId: connection.id, resourceType: 'TAX', isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.zohoEntityMapping.findMany({
      where: { zohoConnectionId: connection.id, entityType: 'TAX_RATE' },
    }),
  ]);
  return { taxes, mappings };
}

export async function saveTaxMapping(percent: number, zohoTaxId: string) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const tax = await prisma.zohoDiscoveryCache.findFirst({
    where: {
      zohoConnectionId: connection.id,
      resourceType: 'TAX',
      zohoId: zohoTaxId,
      isActive: true,
    },
  });
  if (!tax) throw new AppError(422, 'ZOHO_TAX_INVALID', 'Pajak Zoho tidak ditemukan pada discovery aktif.');
  const key = invoiceTaxMappingKey(percent);
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: connection.id,
        entityType: 'TAX_RATE',
        localEntityId: key,
      },
    },
    create: {
      zohoConnectionId: connection.id,
      entityType: 'TAX_RATE',
      localEntityId: key,
      zohoEntityType: `TAX_RATE:${key}`,
      zohoEntityId: zohoTaxId,
      externalKey: `${key}%`,
      metadata: json({ taxName: tax.name }),
    },
    update: {
      zohoEntityType: `TAX_RATE:${key}`,
      zohoEntityId: zohoTaxId,
      status: 'ACTIVE',
      metadata: json({ taxName: tax.name }),
    },
  });
}
