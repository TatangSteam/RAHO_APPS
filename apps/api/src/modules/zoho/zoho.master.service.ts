import { IntegrationEventStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { getActiveZohoClient, ZohoClient } from './zoho.client';
import { ZohoApiError } from './zoho.error';
import { assertErpManaged } from './zoho.origin';
import { logZohoErrorThrottled } from './zoho.logging';
import {
  buildZohoItemPayload,
  buildZohoLocationPayload,
  decideItemMatch,
  decideLocationMatch,
  findDefaultItemAccount,
  ITEM_ACCOUNT_ROLES,
  ItemAccountConfig,
  ItemAccountRole,
  LocalItemSnapshot,
  LocalLocationSnapshot,
  MasterMatchDecision,
  validateItemSnapshot,
  isValidItemAccount,
  ZohoItemCandidate,
  ZohoLocationCandidate,
  ZohoMasterEntityType,
} from './zoho.master.policy';

export const MASTER_PRODUCT_ITEM_EVENT = 'MASTER_PRODUCT_ITEM_UPSERTED';
export const PACKAGE_PRICING_ITEM_EVENT = 'PACKAGE_PRICING_ITEM_UPSERTED';
export const BRANCH_LOCATION_EVENT = 'BRANCH_LOCATION_UPSERTED';
export const STOCK_LOCATION_EVENT = 'STOCK_LOCATION_UPSERTED';

type MasterSnapshot = LocalItemSnapshot | LocalLocationSnapshot;
type Candidate = ZohoItemCandidate | ZohoLocationCandidate;

function assertEntityType(value: string): asserts value is ZohoMasterEntityType {
  if (!['MASTER_PRODUCT', 'PACKAGE_PRICING', 'BRANCH_LOCATION', 'STOCK_LOCATION'].includes(value)) {
    throw new AppError(400, 'ZOHO_MASTER_ENTITY_INVALID', 'Entity master Zoho tidak valid.');
  }
}

function isItemSnapshot(snapshot: MasterSnapshot): snapshot is LocalItemSnapshot {
  return snapshot.entityType === 'MASTER_PRODUCT' || snapshot.entityType === 'PACKAGE_PRICING';
}

function eventTypeFor(entityType: ZohoMasterEntityType): string {
  return {
    MASTER_PRODUCT: MASTER_PRODUCT_ITEM_EVENT,
    PACKAGE_PRICING: PACKAGE_PRICING_ITEM_EVENT,
    BRANCH_LOCATION: BRANCH_LOCATION_EVENT,
    STOCK_LOCATION: STOCK_LOCATION_EVENT,
  }[entityType];
}

function aggregateTypeFor(entityType: ZohoMasterEntityType): string {
  return {
    MASTER_PRODUCT: 'MasterProduct',
    PACKAGE_PRICING: 'PackagePricing',
    BRANCH_LOCATION: 'Branch',
    STOCK_LOCATION: 'StockLocation',
  }[entityType];
}

function zohoEntityTypeFor(entityType: ZohoMasterEntityType): 'ITEM' | 'LOCATION' {
  return entityType === 'MASTER_PRODUCT' || entityType === 'PACKAGE_PRICING' ? 'ITEM' : 'LOCATION';
}

async function duplicateSkuCount(sku: string | null): Promise<number> {
  if (!sku) return 0;
  const [products, packages] = await Promise.all([
    prisma.masterProduct.count({ where: { sku: { equals: sku, mode: 'insensitive' }, isActive: true } }),
    prisma.packagePricing.count({ where: { productCode: { equals: sku, mode: 'insensitive' }, isActive: true } }),
  ]);
  return products + packages;
}

async function accountConfig(connectionId: string): Promise<ItemAccountConfig> {
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: connectionId,
      entityType: 'ACCOUNT_ROLE',
      localEntityId: { in: [...ITEM_ACCOUNT_ROLES] },
      status: 'ACTIVE',
    },
  });
  const value = (role: ItemAccountRole) => mappings.find((mapping) => mapping.localEntityId === role)?.zohoEntityId;
  return {
    salesAccountId: value('ITEM_SALES'),
    purchaseAccountId: value('ITEM_PURCHASE'),
    inventoryAccountId: value('ITEM_INVENTORY'),
  };
}

async function uomValue(connectionId: string, uomId: string | null): Promise<string | null> {
  if (!uomId) return null;
  const mapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: connectionId,
        entityType: 'UOM',
        localEntityId: uomId,
      },
    },
  });
  return mapping?.status === 'ACTIVE' ? mapping.zohoEntityId : null;
}

async function localSnapshot(
  connectionId: string,
  entityType: ZohoMasterEntityType,
  id: string,
): Promise<MasterSnapshot> {
  if (entityType === 'MASTER_PRODUCT') {
    const product = await prisma.masterProduct.findUnique({ where: { id } });
    if (!product) throw new AppError(404, 'MASTER_PRODUCT_NOT_FOUND', 'Master product tidak ditemukan.');
    const fallbackUom = product.baseUomId ? null : await prisma.unitOfMeasure.findFirst({
      where: {
        isActive: true,
        OR: [
          { code: { equals: product.baseUnit, mode: 'insensitive' } },
          { name: { equals: product.baseUnit, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    return {
      entityType,
      localEntityId: product.id,
      externalKey: `RAHO:ITEM:${product.id}`,
      sku: product.sku?.trim() || null,
      name: product.name,
      description: product.description,
      unit: await uomValue(connectionId, product.baseUomId || fallbackUom?.id || null),
      rate: null,
      isActive: product.isActive,
      duplicateSkuCount: await duplicateSkuCount(product.sku),
    };
  }
  if (entityType === 'PACKAGE_PRICING') {
    const pricing = await prisma.packagePricing.findUnique({ where: { id }, include: { branch: true } });
    if (!pricing) throw new AppError(404, 'PACKAGE_PRICING_NOT_FOUND', 'Harga paket tidak ditemukan.');
    return {
      entityType,
      localEntityId: pricing.id,
      externalKey: `RAHO:SERVICE:${pricing.id}`,
      sku: pricing.productCode?.trim() || null,
      name: pricing.name,
      description: [
        pricing.packageType,
        pricing.boosterType,
        pricing.serviceType,
        `${pricing.totalSessions} sesi`,
        pricing.branch ? `Cabang ${pricing.branch.branchCode}` : 'Global',
      ].filter(Boolean).join(' · '),
      unit: 'paket',
      rate: Number(pricing.price),
      isActive: pricing.isActive,
      duplicateSkuCount: await duplicateSkuCount(pricing.productCode),
    };
  }
  if (entityType === 'BRANCH_LOCATION') {
    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Cabang tidak ditemukan.');
    const eligible = branch.type !== 'PARTNERSHIP';
    return {
      entityType,
      localEntityId: branch.id,
      externalKey: `RAHO:BRANCH:${branch.branchCode}`,
      code: branch.branchCode,
      name: `[${branch.branchCode}] ${branch.name}`,
      address: branch.address,
      city: branch.city,
      phone: branch.phone,
      isActive: branch.isActive,
      eligible,
      excludedReason: eligible ? null : 'Cabang Partnership adalah customer pembeli barang, bukan Location internal.',
    };
  }
  const location = await prisma.stockLocation.findUnique({
    where: { id },
    include: { warehouse: { include: { branch: true } } },
  });
  if (!location) throw new AppError(404, 'STOCK_LOCATION_NOT_FOUND', 'Stock location tidak ditemukan.');
  const { warehouse } = location;
  const eligible = warehouse.branch.type !== 'PARTNERSHIP';
  const code = `${warehouse.branch.branchCode}:${warehouse.code}:${location.code}`;
  return {
    entityType,
    localEntityId: location.id,
    externalKey: `RAHO:STOCK_LOCATION:${code}`,
    code,
    name: `[${code}] ${warehouse.branch.name} - ${warehouse.name} - ${location.name}`,
    address: warehouse.branch.address,
    city: warehouse.branch.city,
    phone: warehouse.branch.phone,
    isActive: location.isActive && warehouse.isActive && warehouse.branch.isActive,
    eligible,
    excludedReason: eligible ? null : 'Stock location Partnership tidak boleh menjadi Location internal Zoho.',
  };
}

async function findCandidates(client: ZohoClient, snapshot: MasterSnapshot): Promise<Candidate[]> {
  if (isItemSnapshot(snapshot)) {
    const queries: Array<Record<string, unknown>> = [];
    if (snapshot.sku) queries.push({ sku: snapshot.sku });
    queries.push({ name: snapshot.name });
    const batches = await Promise.all(
      queries.map((query) => client.listAll<ZohoItemCandidate>('/books/v3/items', 'items', query)),
    );
    const candidates = Array.from(
      new Map(batches.flat().map((candidate) => [String(candidate.item_id), candidate])).values(),
    );
    return Promise.all(candidates.map(async (candidate) => {
      const detail = await client.request<{ item?: ZohoItemCandidate }>(
        `/books/v3/items/${candidate.item_id}`,
      );
      return { ...candidate, ...detail.item };
    }));
  }
  return client.listAll<ZohoLocationCandidate>('/books/v3/locations', 'locations');
}

function decideMatch(snapshot: MasterSnapshot, candidates: Candidate[]): MasterMatchDecision<Candidate> {
  return isItemSnapshot(snapshot)
    ? decideItemMatch(snapshot, candidates as ZohoItemCandidate[])
    : decideLocationMatch(snapshot, candidates as ZohoLocationCandidate[]);
}

function candidateId(entityType: ZohoMasterEntityType, candidate: Candidate): string {
  return entityType === 'MASTER_PRODUCT' || entityType === 'PACKAGE_PRICING'
    ? String((candidate as ZohoItemCandidate).item_id)
    : String((candidate as ZohoLocationCandidate).location_id);
}

async function saveReview(
  connectionId: string,
  snapshot: MasterSnapshot,
  candidates: Candidate[],
  reason: string,
) {
  return prisma.zohoMappingReview.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: connectionId,
        entityType: snapshot.entityType,
        localEntityId: snapshot.localEntityId,
      },
    },
    create: {
      zohoConnectionId: connectionId,
      entityType: snapshot.entityType,
      localEntityId: snapshot.localEntityId,
      localDisplayName: snapshot.name,
      expectedZohoEntityType: zohoEntityTypeFor(snapshot.entityType),
      candidates: candidates as unknown as Prisma.InputJsonValue,
      reason,
    },
    update: {
      localDisplayName: snapshot.name,
      expectedZohoEntityType: zohoEntityTypeFor(snapshot.entityType),
      candidates: candidates as unknown as Prisma.InputJsonValue,
      reason,
      status: 'PENDING',
      resolvedZohoEntityId: null,
      resolvedById: null,
      resolvedAt: null,
    },
  });
}

async function saveMapping(
  connectionId: string,
  snapshot: MasterSnapshot,
  zohoId: string,
  operation: string,
) {
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: connectionId,
        entityType: snapshot.entityType,
        localEntityId: snapshot.localEntityId,
      },
    },
    create: {
      zohoConnectionId: connectionId,
      entityType: snapshot.entityType,
      localEntityId: snapshot.localEntityId,
      zohoEntityType: zohoEntityTypeFor(snapshot.entityType),
      zohoEntityId: zohoId,
      externalKey: snapshot.externalKey,
      dataOrigin: 'ERP',
      managementMode: 'ERP_MANAGED',
      originVerifiedAt: new Date(),
      status: 'ACTIVE',
      metadata: { operation },
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityType: zohoEntityTypeFor(snapshot.entityType),
      zohoEntityId: zohoId,
      externalKey: snapshot.externalKey,
      dataOrigin: 'ERP',
      managementMode: 'ERP_MANAGED',
      originVerifiedAt: new Date(),
      status: 'ACTIVE',
      metadata: { operation },
      lastSyncedAt: new Date(),
    },
  });
}

async function validation(
  connectionId: string,
  snapshot: MasterSnapshot,
): Promise<{ issues: string[]; accounts: ItemAccountConfig; parentLocationId?: string }> {
  if (isItemSnapshot(snapshot)) {
    const accounts = await accountConfig(connectionId);
    return { issues: validateItemSnapshot(snapshot, accounts), accounts };
  }
  const issues: string[] = [];
  if (!snapshot.eligible && snapshot.excludedReason) issues.push(snapshot.excludedReason);
  if (snapshot.entityType === 'STOCK_LOCATION' && snapshot.eligible) {
    const location = await prisma.stockLocation.findUnique({
      where: { id: snapshot.localEntityId },
      include: { warehouse: true },
    });
    const parent = location
      ? await prisma.zohoEntityMapping.findUnique({
        where: {
          zohoConnectionId_entityType_localEntityId: {
            zohoConnectionId: connectionId,
            entityType: 'BRANCH_LOCATION',
            localEntityId: location.warehouse.branchId,
          },
        },
      })
      : null;
    if (!parent || parent.status !== 'ACTIVE') issues.push('Zoho Location induk untuk cabang belum dipetakan.');
    return { issues, accounts: {}, parentLocationId: parent?.zohoEntityId };
  }
  return { issues, accounts: {} };
}

export async function previewMaster(entityTypeValue: string, id: string) {
  assertEntityType(entityTypeValue);
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const snapshot = await localSnapshot(connection.id, entityTypeValue, id);
  const [mapping, review, checked] = await Promise.all([
    prisma.zohoEntityMapping.findUnique({
      where: {
        zohoConnectionId_entityType_localEntityId: {
          zohoConnectionId: connection.id,
          entityType: entityTypeValue,
          localEntityId: id,
        },
      },
    }),
    prisma.zohoMappingReview.findUnique({
      where: {
        zohoConnectionId_entityType_localEntityId: {
          zohoConnectionId: connection.id,
          entityType: entityTypeValue,
          localEntityId: id,
        },
      },
    }),
    validation(connection.id, snapshot),
  ]);
  const payload = isItemSnapshot(snapshot)
    ? buildZohoItemPayload(snapshot, checked.accounts)
    : {
      ...buildZohoLocationPayload(snapshot),
      ...(checked.parentLocationId ? { parent_location_id: checked.parentLocationId } : {}),
    };
  return {
    snapshot,
    payload,
    mapping,
    review,
    issues: checked.issues,
    liveReady: checked.issues.length === 0
      && (isItemSnapshot(snapshot) || connection.locationsSupported === true),
    excludedFields: isItemSnapshot(snapshot)
      ? ['opening_stock', 'initial_stock', 'batch', 'expiry', 'treatment_bom', 'medical_data']
      : [],
    locationCapability: {
      supported: connection.locationsSupported,
      error: connection.locationsCapabilityError,
    },
  };
}

export async function findMasterMatch(entityTypeValue: string, id: string) {
  assertEntityType(entityTypeValue);
  const client = await getActiveZohoClient(true);
  const snapshot = await localSnapshot(client.connection.id, entityTypeValue, id);
  if (!isItemSnapshot(snapshot) && client.connection.locationsSupported !== true) {
    throw new AppError(422, 'ZOHO_LOCATIONS_UNSUPPORTED', 'Capability Zoho Location belum terbukti. Jalankan discovery.');
  }
  const decision = decideMatch(snapshot, await findCandidates(client, snapshot));
  if (decision.kind === 'REVIEW') {
    return { decision, review: await saveReview(client.connection.id, snapshot, decision.candidates, decision.reason) };
  }
  return { decision, review: null };
}

export async function enqueueMaster(entityTypeValue: string, id: string) {
  assertEntityType(entityTypeValue);
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const snapshot = await localSnapshot(connection.id, entityTypeValue, id);
  if (!isItemSnapshot(snapshot) && !snapshot.eligible) {
    return {
      skipped: true,
      reason: snapshot.excludedReason,
      entityType: snapshot.entityType,
      localEntityId: snapshot.localEntityId,
    };
  }
  const checked = await validation(connection.id, snapshot);
  const eventType = eventTypeFor(entityTypeValue);
  const payload = {
    snapshot,
    issues: checked.issues,
    safePayload: isItemSnapshot(snapshot)
      ? buildZohoItemPayload(snapshot, checked.accounts)
      : buildZohoLocationPayload(snapshot),
  };
  const existing = await prisma.integrationEvent.findUnique({
    where: { eventType_aggregateId: { eventType, aggregateId: id } },
  });
  if (existing?.status === IntegrationEventStatus.PROCESSING) {
    throw new AppError(409, 'ZOHO_MASTER_SYNC_IN_PROGRESS', 'Master sedang diproses worker.');
  }
  return prisma.integrationEvent.upsert({
    where: { eventType_aggregateId: { eventType, aggregateId: id } },
    create: {
      eventType,
      eventVersion: 1,
      aggregateType: aggregateTypeFor(entityTypeValue),
      aggregateId: id,
      payload: payload as unknown as Prisma.InputJsonValue,
      status: 'PENDING',
      occurredAt: new Date(),
    },
    update: {
      payload: payload as unknown as Prisma.InputJsonValue,
      status: 'PENDING',
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
      occurredAt: new Date(),
    },
  });
}

export async function enqueueMasterSafely(entityType: ZohoMasterEntityType, id: string): Promise<void> {
  try {
    await enqueueMaster(entityType, id);
  } catch (error) {
    logZohoErrorThrottled(
      `master-enqueue:${entityType}`,
      '[Zoho Master] Gagal membuat/memperbarui event sinkronisasi',
      error,
      { entityType, localEntityId: id },
    );
  }
}

export async function enqueueBranchMasterChildrenSafely(branchId: string): Promise<void> {
  try {
    const connection = await prisma.zohoConnection.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!connection) return;

    const [locations, pricings] = await Promise.all([
      prisma.stockLocation.findMany({
        where: { warehouse: { branchId } },
        select: { id: true },
      }),
      prisma.packagePricing.findMany({
        where: { branchId, isActive: true },
        select: { id: true },
      }),
    ]);
    await Promise.all([
      ...locations.map((location) => enqueueMasterSafely('STOCK_LOCATION', location.id)),
      ...pricings.map((pricing) => enqueueMasterSafely('PACKAGE_PRICING', pricing.id)),
    ]);
  } catch (error) {
    logZohoErrorThrottled(
      'branch-master-children',
      '[Zoho Master] Gagal membuat event turunan cabang',
      error,
      { branchId },
    );
  }
}

export async function enqueueWarehouseLocationsSafely(warehouseId: string): Promise<void> {
  try {
    const connection = await prisma.zohoConnection.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!connection) return;

    const locations = await prisma.stockLocation.findMany({
      where: { warehouseId },
      select: { id: true },
    });
    await Promise.all(locations.map((location) => enqueueMasterSafely('STOCK_LOCATION', location.id)));
  } catch (error) {
    logZohoErrorThrottled(
      'warehouse-stock-locations',
      '[Zoho Master] Gagal membuat event stock location',
      error,
      { warehouseId },
    );
  }
}

function responseId(entityType: ZohoMasterEntityType, response: Record<string, unknown>): string | null {
  if (entityType === 'MASTER_PRODUCT' || entityType === 'PACKAGE_PRICING') {
    const item = response.item as { item_id?: string | number } | undefined;
    return item?.item_id == null ? null : String(item.item_id);
  }
  const location = (response.location || response.locations) as { location_id?: string | number } | undefined;
  return location?.location_id == null ? null : String(location.location_id);
}

export async function handleMasterEvent(event: { aggregateId: string; aggregateType: string }) {
  const entityType = ({
    MasterProduct: 'MASTER_PRODUCT',
    PackagePricing: 'PACKAGE_PRICING',
    Branch: 'BRANCH_LOCATION',
    StockLocation: 'STOCK_LOCATION',
  } as const)[event.aggregateType];
  if (!entityType) throw new ZohoApiError('Aggregate master tidak didukung.', 'ZOHO_MASTER_AGGREGATE_INVALID', 422, false);

  const client = await getActiveZohoClient(true);
  const snapshot = await localSnapshot(client.connection.id, entityType, event.aggregateId);
  const checked = await validation(client.connection.id, snapshot);
  if (checked.issues.length) {
    throw new ZohoApiError(checked.issues.join(' '), 'ZOHO_MASTER_NEEDS_ACTION', 422, false);
  }
  if (!isItemSnapshot(snapshot) && client.connection.locationsSupported !== true) {
    throw new ZohoApiError(
      client.connection.locationsCapabilityError || 'Zoho Location belum didukung atau belum diverifikasi.',
      'ZOHO_LOCATIONS_UNSUPPORTED',
      422,
      false,
    );
  }
  const payload = isItemSnapshot(snapshot)
    ? buildZohoItemPayload(snapshot, checked.accounts)
    : {
      ...buildZohoLocationPayload(snapshot),
      ...(checked.parentLocationId ? { parent_location_id: checked.parentLocationId } : {}),
    };
  const mapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType,
        localEntityId: snapshot.localEntityId,
      },
    },
  });
  const basePath = isItemSnapshot(snapshot) ? '/books/v3/items' : '/books/v3/locations';
  if (mapping) {
    assertErpManaged(mapping, 'Master Zoho');
    if (!snapshot.isActive) {
      await client.request(`${basePath}/${mapping.zohoEntityId}/inactive`, { method: 'POST' });
      await prisma.zohoEntityMapping.update({
        where: { id: mapping.id },
        data: { status: 'INACTIVE', lastSyncedAt: new Date(), metadata: { operation: 'MARK_INACTIVE' } },
      });
      return { operation: 'MARK_INACTIVE', zohoId: mapping.zohoEntityId };
    }
    if (mapping.status === 'INACTIVE') {
      await client.request(`${basePath}/${mapping.zohoEntityId}/active`, { method: 'POST' });
    }
    await client.request(`${basePath}/${mapping.zohoEntityId}`, { method: 'PUT', data: payload });
    await prisma.zohoEntityMapping.update({
      where: { id: mapping.id },
      data: { status: 'ACTIVE', lastSyncedAt: new Date(), metadata: { operation: 'UPDATE' } },
    });
    return { operation: 'UPDATE', zohoId: mapping.zohoEntityId };
  }
  if (!snapshot.isActive) return { operation: 'SKIP_INACTIVE_UNMAPPED' };

  const pendingReview = await prisma.zohoMappingReview.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType,
        localEntityId: snapshot.localEntityId,
      },
    },
  });
  if (pendingReview?.status === 'PENDING') {
    throw new ZohoApiError('Mapping master menunggu review manusia.', 'ZOHO_MASTER_REVIEW_REQUIRED', 409, false);
  }
  const decision = decideMatch(snapshot, await findCandidates(client, snapshot));
  if (decision.kind === 'REVIEW') {
    await saveReview(client.connection.id, snapshot, decision.candidates, decision.reason);
    throw new ZohoApiError(decision.reason, 'ZOHO_MASTER_REVIEW_REQUIRED', 409, false);
  }
  if (decision.kind === 'AUTO_MATCH') {
    const zohoId = candidateId(entityType, decision.candidate);
    await saveMapping(client.connection.id, snapshot, zohoId, 'AUTO_MATCH');
    await client.request(`${basePath}/${zohoId}`, { method: 'PUT', data: payload });
    return { operation: 'AUTO_MATCH_UPDATE', zohoId };
  }
  const response = await client.request<Record<string, unknown>>(basePath, { method: 'POST', data: payload });
  const zohoId = responseId(entityType, response);
  if (!zohoId) {
    throw new ZohoApiError('Zoho tidak mengembalikan ID master.', 'ZOHO_MASTER_ID_MISSING', 502, true);
  }
  await saveMapping(client.connection.id, snapshot, zohoId, 'CREATE');
  return { operation: 'CREATE', zohoId };
}

export async function listMasterMappings(input: {
  entityType: ZohoMasterEntityType;
  page: number;
  limit: number;
  search?: string;
}) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const skip = (input.page - 1) * input.limit;
  let rows: Array<{ id: string; code: string; name: string; isActive: boolean; subtype?: string; eligible?: boolean }> = [];
  let total = 0;
  if (input.entityType === 'MASTER_PRODUCT') {
    const where: Prisma.MasterProductWhereInput = input.search ? {
      OR: [
        { sku: { contains: input.search, mode: 'insensitive' } },
        { name: { contains: input.search, mode: 'insensitive' } },
      ],
    } : {};
    const [products, count] = await prisma.$transaction([
      prisma.masterProduct.findMany({ where, orderBy: { name: 'asc' }, skip, take: input.limit }),
      prisma.masterProduct.count({ where }),
    ]);
    rows = products.map((row) => ({ id: row.id, code: row.sku || '', name: row.name, isActive: row.isActive, subtype: row.category }));
    total = count;
  } else if (input.entityType === 'PACKAGE_PRICING') {
    const where: Prisma.PackagePricingWhereInput = input.search ? {
      OR: [
        { productCode: { contains: input.search, mode: 'insensitive' } },
        { name: { contains: input.search, mode: 'insensitive' } },
      ],
    } : {};
    const [pricings, count] = await prisma.$transaction([
      prisma.packagePricing.findMany({ where, include: { branch: true }, orderBy: { name: 'asc' }, skip, take: input.limit }),
      prisma.packagePricing.count({ where }),
    ]);
    rows = pricings.map((row) => ({
      id: row.id,
      code: row.productCode || '',
      name: row.name,
      isActive: row.isActive,
      subtype: `${row.packageType}${row.boosterType ? ` · ${row.boosterType}` : ''}${row.branch ? ` · ${row.branch.branchCode}` : ' · GLOBAL'}`,
    }));
    total = count;
  } else if (input.entityType === 'BRANCH_LOCATION') {
    const where: Prisma.BranchWhereInput = input.search ? {
      OR: [
        { branchCode: { contains: input.search, mode: 'insensitive' } },
        { name: { contains: input.search, mode: 'insensitive' } },
      ],
    } : {};
    const [branches, count] = await prisma.$transaction([
      prisma.branch.findMany({ where, orderBy: { branchCode: 'asc' }, skip, take: input.limit }),
      prisma.branch.count({ where }),
    ]);
    rows = branches.map((row) => ({
      id: row.id,
      code: row.branchCode,
      name: row.name,
      isActive: row.isActive,
      subtype: row.type,
      eligible: row.type !== 'PARTNERSHIP',
    }));
    total = count;
  } else {
    const where: Prisma.StockLocationWhereInput = input.search ? {
      OR: [
        { code: { contains: input.search, mode: 'insensitive' } },
        { name: { contains: input.search, mode: 'insensitive' } },
        { warehouse: { branch: { branchCode: { contains: input.search, mode: 'insensitive' } } } },
      ],
    } : {};
    const [locations, count] = await prisma.$transaction([
      prisma.stockLocation.findMany({
        where,
        include: { warehouse: { include: { branch: true } } },
        orderBy: { code: 'asc' },
        skip,
        take: input.limit,
      }),
      prisma.stockLocation.count({ where }),
    ]);
    rows = locations.map((row) => ({
      id: row.id,
      code: `${row.warehouse.branch.branchCode}:${row.warehouse.code}:${row.code}`,
      name: row.name,
      isActive: row.isActive && row.warehouse.isActive && row.warehouse.branch.isActive,
      subtype: row.warehouse.name,
      eligible: row.warehouse.branch.type !== 'PARTNERSHIP',
    }));
    total = count;
  }
  const ids = rows.map((row) => row.id);
  const [mappings, reviews] = await Promise.all([
    prisma.zohoEntityMapping.findMany({
      where: { zohoConnectionId: connection.id, entityType: input.entityType, localEntityId: { in: ids } },
    }),
    prisma.zohoMappingReview.findMany({
      where: { zohoConnectionId: connection.id, entityType: input.entityType, localEntityId: { in: ids } },
    }),
  ]);
  return {
    items: rows.map((row) => ({
      entityType: input.entityType,
      ...row,
      mapping: mappings.find((mapping) => mapping.localEntityId === row.id) || null,
      review: reviews.find((review) => review.localEntityId === row.id) || null,
    })),
    pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) },
  };
}

export async function getMasterConfig() {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const [accounts, accountMappings, uoms, uomMappings] = await Promise.all([
    prisma.zohoDiscoveryCache.findMany({
      where: { zohoConnectionId: connection.id, resourceType: 'ACCOUNT', isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.zohoEntityMapping.findMany({
      where: { zohoConnectionId: connection.id, entityType: 'ACCOUNT_ROLE', localEntityId: { in: [...ITEM_ACCOUNT_ROLES] } },
    }),
    prisma.unitOfMeasure.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    prisma.zohoEntityMapping.findMany({ where: { zohoConnectionId: connection.id, entityType: 'UOM' } }),
  ]);
  return {
    accountRoles: ITEM_ACCOUNT_ROLES.map((role) => ({
      role,
      mapping: accountMappings.find((mapping) => mapping.localEntityId === role) || null,
    })),
    accounts,
    uoms: uoms.map((uom) => ({
      ...uom,
      mapping: uomMappings.find((mapping) => mapping.localEntityId === uom.id) || null,
    })),
    locationCapability: {
      supported: connection.locationsSupported,
      error: connection.locationsCapabilityError,
    },
  };
}

export async function saveAccountRoleMapping(role: string, zohoAccountId: string) {
  if (!ITEM_ACCOUNT_ROLES.includes(role as ItemAccountRole)) {
    throw new AppError(400, 'ZOHO_ACCOUNT_ROLE_INVALID', 'Peran account Item tidak valid.');
  }
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const account = await prisma.zohoDiscoveryCache.findFirst({
    where: {
      zohoConnectionId: connection.id,
      resourceType: 'ACCOUNT',
      zohoId: zohoAccountId,
      isActive: true,
    },
  });
  if (!account) throw new AppError(422, 'ZOHO_ACCOUNT_INVALID', 'Account Zoho tidak ditemukan pada discovery aktif.');
  if (!isValidItemAccount(role as ItemAccountRole, account)) {
    throw new AppError(
      422,
      'ZOHO_ITEM_ACCOUNT_TYPE_INVALID',
      `Tipe account ${account.name} tidak sesuai untuk peran ${role}.`,
    );
  }
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: connection.id,
        entityType: 'ACCOUNT_ROLE',
        localEntityId: role,
      },
    },
    create: {
      zohoConnectionId: connection.id,
      entityType: 'ACCOUNT_ROLE',
      localEntityId: role,
      zohoEntityType: `ACCOUNT_ROLE:${role}`,
      zohoEntityId: zohoAccountId,
      externalKey: role,
      dataOrigin: 'MANUAL_ZOHO',
      managementMode: 'MANUAL_ONLY',
      originVerifiedAt: new Date(),
      status: 'ACTIVE',
      metadata: { accountName: account.name, accountCode: account.code },
    },
    update: {
      zohoEntityType: `ACCOUNT_ROLE:${role}`,
      zohoEntityId: zohoAccountId,
      dataOrigin: 'MANUAL_ZOHO',
      managementMode: 'MANUAL_ONLY',
      originVerifiedAt: new Date(),
      status: 'ACTIVE',
      metadata: { accountName: account.name, accountCode: account.code },
    },
  });
}

export async function ensureDefaultItemAccountMappings() {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const [accounts, existingMappings] = await Promise.all([
    prisma.zohoDiscoveryCache.findMany({
      where: { zohoConnectionId: connection.id, resourceType: 'ACCOUNT', isActive: true },
      select: { zohoId: true, name: true, payload: true },
    }),
    prisma.zohoEntityMapping.findMany({
      where: {
        zohoConnectionId: connection.id,
        entityType: 'ACCOUNT_ROLE',
        localEntityId: { in: [...ITEM_ACCOUNT_ROLES] },
        status: 'ACTIVE',
      },
    }),
  ]);

  const results = [];
  for (const role of ITEM_ACCOUNT_ROLES) {
    const existing = existingMappings.find((mapping) => mapping.localEntityId === role);
    if (existing) {
      results.push({ role, zohoAccountId: existing.zohoEntityId, status: 'PRESERVED' as const });
      continue;
    }
    const account = findDefaultItemAccount(role, accounts);
    if (!account) {
      results.push({ role, zohoAccountId: null, status: 'REVIEW_REQUIRED' as const });
      continue;
    }
    await saveAccountRoleMapping(role, account.zohoId);
    results.push({ role, zohoAccountId: account.zohoId, status: 'MAPPED' as const });
  }
  return results;
}

export async function saveUomMapping(uomId: string, zohoUnit: string) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const uom = await prisma.unitOfMeasure.findUnique({ where: { id: uomId } });
  if (!uom?.isActive) throw new AppError(422, 'UOM_INVALID', 'UOM ERP tidak aktif atau tidak ditemukan.');
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: connection.id,
        entityType: 'UOM',
        localEntityId: uomId,
      },
    },
    create: {
      zohoConnectionId: connection.id,
      entityType: 'UOM',
      localEntityId: uomId,
      zohoEntityType: 'UOM',
      zohoEntityId: zohoUnit,
      externalKey: uom.code,
      dataOrigin: 'MANUAL_ZOHO',
      managementMode: 'MANUAL_ONLY',
      originVerifiedAt: new Date(),
      status: 'ACTIVE',
      metadata: { localName: uom.name },
    },
    update: {
      zohoEntityId: zohoUnit,
      dataOrigin: 'MANUAL_ZOHO',
      managementMode: 'MANUAL_ONLY',
      originVerifiedAt: new Date(),
      status: 'ACTIVE',
      metadata: { localName: uom.name },
    },
  });
}

export async function ensureDefaultUomMappings() {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const [uoms, existingMappings] = await Promise.all([
    prisma.unitOfMeasure.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    prisma.zohoEntityMapping.findMany({
      where: { zohoConnectionId: connection.id, entityType: 'UOM', status: 'ACTIVE' },
    }),
  ]);
  const results = [];
  for (const uom of uoms) {
    const existing = existingMappings.find((mapping) => mapping.localEntityId === uom.id);
    if (existing) {
      results.push({ uomId: uom.id, zohoUnit: existing.zohoEntityId, status: 'PRESERVED' as const });
      continue;
    }
    const mapping = await saveUomMapping(uom.id, uom.name.trim());
    results.push({ uomId: uom.id, zohoUnit: mapping.zohoEntityId, status: 'MAPPED' as const });
  }
  return results;
}

export async function approveMasterReview(
  userId: string,
  reviewId: string,
  zohoEntityId: string,
) {
  const review = await prisma.zohoMappingReview.findUnique({ where: { id: reviewId } });
  if (!review || review.status !== 'PENDING') {
    throw new AppError(404, 'ZOHO_MAPPING_REVIEW_NOT_FOUND', 'Review mapping aktif tidak ditemukan.');
  }
  assertEntityType(review.entityType);
  const candidates = review.candidates as unknown as Candidate[];
  if (!candidates.some((candidate) => candidateId(review.entityType as ZohoMasterEntityType, candidate) === zohoEntityId)) {
    throw new AppError(422, 'ZOHO_MAPPING_CANDIDATE_INVALID', 'Master yang dipilih bukan kandidat review.');
  }
  const snapshot = await localSnapshot(review.zohoConnectionId, review.entityType, review.localEntityId);
  await prisma.$transaction(async (tx) => {
    await tx.zohoEntityMapping.upsert({
      where: {
        zohoConnectionId_entityType_localEntityId: {
          zohoConnectionId: review.zohoConnectionId,
          entityType: review.entityType,
          localEntityId: review.localEntityId,
        },
      },
      create: {
        zohoConnectionId: review.zohoConnectionId,
        entityType: review.entityType,
        localEntityId: review.localEntityId,
        zohoEntityType: review.expectedZohoEntityType,
        zohoEntityId,
        externalKey: snapshot.externalKey,
        dataOrigin: 'MANUAL_ZOHO',
        managementMode: 'ERP_MANAGED',
        originVerifiedAt: new Date(),
        status: 'ACTIVE',
        metadata: { operation: 'MANUAL_APPROVAL', reviewId },
      },
      update: {
        zohoEntityId,
        dataOrigin: 'MANUAL_ZOHO',
        managementMode: 'ERP_MANAGED',
        originVerifiedAt: new Date(),
        status: 'ACTIVE',
        metadata: { operation: 'MANUAL_APPROVAL', reviewId },
      },
    });
    await tx.zohoMappingReview.update({
      where: { id: reviewId },
      data: {
        status: 'APPROVED',
        resolvedZohoEntityId: zohoEntityId,
        resolvedById: userId,
        resolvedAt: new Date(),
      },
    });
  });
  return enqueueMaster(review.entityType, review.localEntityId);
}

export async function rejectMasterReview(userId: string, reviewId: string) {
  const review = await prisma.zohoMappingReview.findUnique({ where: { id: reviewId } });
  if (!review || review.status !== 'PENDING') {
    throw new AppError(404, 'ZOHO_MAPPING_REVIEW_NOT_FOUND', 'Review mapping aktif tidak ditemukan.');
  }
  assertEntityType(review.entityType);
  return prisma.zohoMappingReview.update({
    where: { id: reviewId },
    data: { status: 'REJECTED', resolvedById: userId, resolvedAt: new Date() },
  });
}
