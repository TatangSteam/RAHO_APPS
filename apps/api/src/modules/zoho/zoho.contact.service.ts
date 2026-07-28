import { IntegrationEventStatus, Prisma } from '@prisma/client';
import { env } from '@config/env';
import { logger } from '@lib/logger';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { getActiveZohoClient, ZohoClient } from './zoho.client';
import {
  buildZohoContactPayload,
  ContactEntityType,
  decideContactMatch,
  expectedZohoContactType,
  LocalContactSnapshot,
  ZohoContactCandidate,
} from './zoho.contact.policy';
import { ZohoApiError } from './zoho.error';

export const MEMBER_CONTACT_EVENT = 'MEMBER_CONTACT_UPSERTED';
export const SUPPLIER_CONTACT_EVENT = 'SUPPLIER_CONTACT_UPSERTED';

function assertEntityType(value: string): asserts value is ContactEntityType {
  if (value !== 'MEMBER' && value !== 'SUPPLIER') {
    throw new AppError(400, 'ZOHO_CONTACT_ENTITY_INVALID', 'Entity contact harus MEMBER atau SUPPLIER.');
  }
}

async function localSnapshot(entityType: ContactEntityType, id: string): Promise<LocalContactSnapshot> {
  if (entityType === 'MEMBER') {
    const member = await prisma.member.findUnique({
      where: { id },
      include: { user: { include: { profile: true } } },
    });
    if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member tidak ditemukan.');
    return {
      entityType,
      localEntityId: member.id,
      externalKey: `RAHO:MEMBER:${member.id}`,
      displayName: member.user.profile?.fullName?.trim() || member.memberNo,
      email: member.user.email || null,
      phone: member.user.profile?.phone || null,
      address: member.address || null,
      taxId: null,
      paymentTermsDays: 0,
      isActive: member.isActive && member.user.isActive,
    };
  }
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier tidak ditemukan.');
  return {
    entityType,
    localEntityId: supplier.id,
    externalKey: `RAHO:SUPPLIER:${supplier.id}`,
    displayName: supplier.name,
    email: supplier.email || null,
    phone: supplier.phone || null,
    address: supplier.address || null,
    taxId: supplier.taxId || null,
    paymentTermsDays: supplier.paymentTermsDays,
    isActive: supplier.status === 'ACTIVE',
  };
}

function eventTypeFor(entityType: ContactEntityType): string {
  return entityType === 'MEMBER' ? MEMBER_CONTACT_EVENT : SUPPLIER_CONTACT_EVENT;
}

function zohoEntityTypeFor(entityType: ContactEntityType): string {
  return entityType === 'MEMBER' ? 'CONTACT_CUSTOMER' : 'CONTACT_VENDOR';
}

function externalIdField(connection?: {
  contactExternalIdFieldId: string | null;
  contactExternalIdApiName: string | null;
  contactExternalIdIsUnique: boolean | null;
}) {
  const fieldId = env.ZOHO_CONTACT_RAHO_ID_CUSTOM_FIELD_ID || connection?.contactExternalIdFieldId || null;
  const apiName = env.ZOHO_CONTACT_RAHO_ID_CUSTOM_FIELD_API_NAME || connection?.contactExternalIdApiName || null;
  const isUnique = connection?.contactExternalIdIsUnique === true;
  return { fieldId, apiName, isUnique, ready: Boolean(fieldId && apiName && isUnique) };
}

export async function previewContact(entityTypeValue: string, id: string) {
  assertEntityType(entityTypeValue);
  const snapshot = await localSnapshot(entityTypeValue, id);
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  const [mapping, review] = connection
    ? await Promise.all([
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
    ])
    : [null, null];
  const field = externalIdField(connection);
  return {
    snapshot,
    payload: buildZohoContactPayload(snapshot, field.fieldId || undefined),
    mapping,
    review,
    liveCreateReady: field.ready,
    excludedFields: ['nik', 'dateOfBirth', 'diagnoses', 'therapyPlans', 'medicalRecords', 'emergencyContact'],
  };
}

async function searchCandidates(client: ZohoClient, snapshot: LocalContactSnapshot): Promise<ZohoContactCandidate[]> {
  const queries: Array<Record<string, unknown>> = [
    { contact_type: expectedZohoContactType(snapshot.entityType), contact_name: snapshot.displayName },
    { contact_type: expectedZohoContactType(snapshot.entityType), search_text: snapshot.externalKey },
  ];
  if (snapshot.email) {
    queries.push({ contact_type: expectedZohoContactType(snapshot.entityType), email: snapshot.email });
  }
  const batches = await Promise.all(
    queries.map((query) => client.listAll<ZohoContactCandidate>('/books/v3/contacts', 'contacts', query)),
  );
  return Array.from(
    new Map(batches.flat().map((candidate) => [String(candidate.contact_id), candidate])).values(),
  );
}

async function saveReview(
  connectionId: string,
  snapshot: LocalContactSnapshot,
  candidates: ZohoContactCandidate[],
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
      localDisplayName: snapshot.displayName,
      expectedZohoEntityType: zohoEntityTypeFor(snapshot.entityType),
      candidates: candidates as unknown as Prisma.InputJsonValue,
      reason,
    },
    update: {
      localDisplayName: snapshot.displayName,
      candidates: candidates as unknown as Prisma.InputJsonValue,
      reason,
      status: 'PENDING',
      resolvedZohoEntityId: null,
      resolvedById: null,
      resolvedAt: null,
    },
  });
}

export async function findContactMatch(entityTypeValue: string, id: string) {
  assertEntityType(entityTypeValue);
  const [client, snapshot] = await Promise.all([
    getActiveZohoClient(true),
    localSnapshot(entityTypeValue, id),
  ]);
  const candidates = await searchCandidates(client, snapshot);
  const decision = decideContactMatch(snapshot, candidates);
  if (decision.kind === 'REVIEW') {
    const review = await saveReview(client.connection.id, snapshot, decision.candidates, decision.reason);
    return { decision, review };
  }
  return { decision, review: null };
}

export async function enqueueContact(entityTypeValue: string, id: string) {
  assertEntityType(entityTypeValue);
  const snapshot = await localSnapshot(entityTypeValue, id);
  const payload = {
    externalKey: snapshot.externalKey,
    entityType: snapshot.entityType,
    localEntityId: snapshot.localEntityId,
    contact: buildZohoContactPayload(
      snapshot,
      externalIdField(await prisma.zohoConnection.findFirst({ where: { isActive: true } })).fieldId || undefined,
    ),
    isActive: snapshot.isActive,
  };
  const eventType = eventTypeFor(snapshot.entityType);
  const existing = await prisma.integrationEvent.findUnique({
    where: { eventType_aggregateId: { eventType, aggregateId: snapshot.localEntityId } },
  });
  if (existing?.status === IntegrationEventStatus.PROCESSING) {
    throw new AppError(409, 'ZOHO_CONTACT_SYNC_IN_PROGRESS', 'Contact sedang diproses worker.');
  }
  return prisma.integrationEvent.upsert({
    where: { eventType_aggregateId: { eventType, aggregateId: snapshot.localEntityId } },
    create: {
      eventType,
      eventVersion: 1,
      aggregateType: snapshot.entityType === 'MEMBER' ? 'Member' : 'Supplier',
      aggregateId: snapshot.localEntityId,
      payload: payload as Prisma.InputJsonValue,
      status: 'PENDING',
      occurredAt: new Date(),
    },
    update: {
      payload: payload as Prisma.InputJsonValue,
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

export async function enqueueContactSafely(entityTypeValue: ContactEntityType, id: string): Promise<void> {
  try {
    await enqueueContact(entityTypeValue, id);
  } catch (error) {
    logger.error('[Zoho Contact] Gagal membuat/memperbarui event sinkronisasi', {
      entityType: entityTypeValue,
      localEntityId: id,
      error,
    });
  }
}

async function saveMapping(
  connectionId: string,
  snapshot: LocalContactSnapshot,
  zohoContactId: string,
  metadata?: Prisma.InputJsonValue,
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
      zohoEntityId: zohoContactId,
      externalKey: snapshot.externalKey,
      status: 'ACTIVE',
      metadata,
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityType: zohoEntityTypeFor(snapshot.entityType),
      zohoEntityId: zohoContactId,
      externalKey: snapshot.externalKey,
      status: 'ACTIVE',
      metadata,
      lastSyncedAt: new Date(),
    },
  });
}

export async function handleContactEvent(event: { aggregateId: string; aggregateType: string }) {
  const entityType: ContactEntityType = event.aggregateType === 'Member' ? 'MEMBER' : 'SUPPLIER';
  const [client, snapshot] = await Promise.all([
    getActiveZohoClient(true),
    localSnapshot(entityType, event.aggregateId),
  ]);
  const field = externalIdField(client.connection);
  const payload = buildZohoContactPayload(snapshot, field.fieldId || undefined);
  const mapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType,
        localEntityId: snapshot.localEntityId,
      },
    },
  });
  if (mapping) {
    if (!snapshot.isActive) {
      await client.request(`/books/v3/contacts/${mapping.zohoEntityId}/inactive`, { method: 'POST' });
      await prisma.zohoEntityMapping.update({
        where: { id: mapping.id },
        data: { status: 'INACTIVE', lastSyncedAt: new Date(), metadata: { operation: 'MARK_INACTIVE' } },
      });
      return { operation: 'MARK_INACTIVE', zohoContactId: mapping.zohoEntityId };
    }
    if (mapping.status === 'INACTIVE') {
      await client.request(`/books/v3/contacts/${mapping.zohoEntityId}/active`, { method: 'POST' });
    }
    const response = await client.request<{ contact?: { contact_id?: string } }>(
      `/books/v3/contacts/${mapping.zohoEntityId}`,
      { method: 'PUT', data: payload },
    );
    await prisma.zohoEntityMapping.update({
      where: { id: mapping.id },
      data: { status: 'ACTIVE', lastSyncedAt: new Date(), metadata: { operation: 'UPDATE' } },
    });
    return { operation: 'UPDATE', zohoContactId: mapping.zohoEntityId, response };
  }

  if (!snapshot.isActive) {
    return { operation: 'SKIP_INACTIVE_UNMAPPED', localEntityId: snapshot.localEntityId };
  }

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
    throw new ZohoApiError(
      'Contact memiliki kandidat mapping yang menunggu review manusia.',
      'ZOHO_CONTACT_REVIEW_REQUIRED',
      409,
      false,
    );
  }

  const decision = decideContactMatch(snapshot, await searchCandidates(client, snapshot));
  if (decision.kind === 'REVIEW') {
    await saveReview(client.connection.id, snapshot, decision.candidates, decision.reason);
    throw new ZohoApiError(decision.reason, 'ZOHO_CONTACT_REVIEW_REQUIRED', 409, false);
  }
  if (decision.kind === 'AUTO_MATCH') {
    await saveMapping(client.connection.id, snapshot, String(decision.contact.contact_id), {
      operation: 'AUTO_MATCH',
    });
    await client.request(`/books/v3/contacts/${decision.contact.contact_id}`, {
      method: 'PUT',
      data: payload,
    });
    return { operation: 'AUTO_MATCH_UPDATE', zohoContactId: String(decision.contact.contact_id) };
  }

  if (!field.ready) {
    throw new ZohoApiError(
      'Custom field Zoho untuk RAHO External ID belum dikonfigurasi.',
      'ZOHO_CONTACT_EXTERNAL_ID_FIELD_REQUIRED',
      422,
      false,
    );
  }
  const response = await client.request<{ contact?: { contact_id?: string } }>('/books/v3/contacts', {
    method: 'POST',
    data: payload,
    headers: {
      'X-Unique-Identifier-Key': field.apiName!,
      'X-Unique-Identifier-Value': snapshot.externalKey,
      'X-Upsert': 'true',
    },
  });
  const zohoContactId = response.contact?.contact_id;
  if (!zohoContactId) {
    throw new ZohoApiError('Zoho tidak mengembalikan contact_id.', 'ZOHO_CONTACT_ID_MISSING', 502, true);
  }
  await saveMapping(client.connection.id, snapshot, String(zohoContactId), { operation: 'CREATE' });
  return { operation: 'CREATE', zohoContactId: String(zohoContactId) };
}

export async function listContactMappings(input: {
  entityType: ContactEntityType;
  page: number;
  limit: number;
  search?: string;
}) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const skip = (input.page - 1) * input.limit;
  if (input.entityType === 'MEMBER') {
    const where: Prisma.MemberWhereInput = input.search ? {
      OR: [
        { memberNo: { contains: input.search, mode: 'insensitive' } },
        { user: { email: { contains: input.search, mode: 'insensitive' } } },
        { user: { profile: { fullName: { contains: input.search, mode: 'insensitive' } } } },
      ],
    } : {};
    const [rows, total] = await prisma.$transaction([
      prisma.member.findMany({
        where,
        include: { user: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: input.limit,
      }),
      prisma.member.count({ where }),
    ]);
    const ids = rows.map((row) => row.id);
    const [mappings, reviews] = await Promise.all([
      prisma.zohoEntityMapping.findMany({ where: { zohoConnectionId: connection.id, entityType: 'MEMBER', localEntityId: { in: ids } } }),
      prisma.zohoMappingReview.findMany({ where: { zohoConnectionId: connection.id, entityType: 'MEMBER', localEntityId: { in: ids } } }),
    ]);
    return {
      items: rows.map((row) => ({
        entityType: 'MEMBER',
        id: row.id,
        code: row.memberNo,
        name: row.user.profile?.fullName || row.memberNo,
        email: row.user.email,
        isActive: row.isActive,
        mapping: mappings.find((mapping) => mapping.localEntityId === row.id) || null,
        review: reviews.find((review) => review.localEntityId === row.id) || null,
      })),
      pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) },
    };
  }

  const where: Prisma.SupplierWhereInput = input.search ? {
    OR: [
      { code: { contains: input.search, mode: 'insensitive' } },
      { name: { contains: input.search, mode: 'insensitive' } },
      { email: { contains: input.search, mode: 'insensitive' } },
    ],
  } : {};
  const [rows, total] = await prisma.$transaction([
    prisma.supplier.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: input.limit }),
    prisma.supplier.count({ where }),
  ]);
  const ids = rows.map((row) => row.id);
  const [mappings, reviews] = await Promise.all([
    prisma.zohoEntityMapping.findMany({ where: { zohoConnectionId: connection.id, entityType: 'SUPPLIER', localEntityId: { in: ids } } }),
    prisma.zohoMappingReview.findMany({ where: { zohoConnectionId: connection.id, entityType: 'SUPPLIER', localEntityId: { in: ids } } }),
  ]);
  return {
    items: rows.map((row) => ({
      entityType: 'SUPPLIER',
      id: row.id,
      code: row.code,
      name: row.name,
      email: row.email,
      isActive: row.status === 'ACTIVE',
      mapping: mappings.find((mapping) => mapping.localEntityId === row.id) || null,
      review: reviews.find((review) => review.localEntityId === row.id) || null,
    })),
    pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) },
  };
}

export async function approveContactReview(userId: string, reviewId: string, zohoContactId: string) {
  const review = await prisma.zohoMappingReview.findUnique({ where: { id: reviewId } });
  if (!review || review.status !== 'PENDING') {
    throw new AppError(404, 'ZOHO_MAPPING_REVIEW_NOT_FOUND', 'Review mapping aktif tidak ditemukan.');
  }
  const candidates = review.candidates as unknown as ZohoContactCandidate[];
  if (!candidates.some((candidate) => String(candidate.contact_id) === zohoContactId)) {
    throw new AppError(422, 'ZOHO_MAPPING_CANDIDATE_INVALID', 'Contact yang dipilih bukan kandidat review.');
  }
  const snapshot = await localSnapshot(review.entityType as ContactEntityType, review.localEntityId);
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
        zohoEntityId: zohoContactId,
        externalKey: snapshot.externalKey,
        status: 'ACTIVE',
        metadata: { operation: 'MANUAL_APPROVAL', reviewId },
      },
      update: {
        zohoEntityId: zohoContactId,
        status: 'ACTIVE',
        metadata: { operation: 'MANUAL_APPROVAL', reviewId },
      },
    });
    await tx.zohoMappingReview.update({
      where: { id: reviewId },
      data: {
        status: 'APPROVED',
        resolvedZohoEntityId: zohoContactId,
        resolvedById: userId,
        resolvedAt: new Date(),
      },
    });
  });
  return enqueueContact(review.entityType, review.localEntityId);
}

export async function rejectContactReview(userId: string, reviewId: string) {
  const review = await prisma.zohoMappingReview.findUnique({ where: { id: reviewId } });
  if (!review || review.status !== 'PENDING') {
    throw new AppError(404, 'ZOHO_MAPPING_REVIEW_NOT_FOUND', 'Review mapping aktif tidak ditemukan.');
  }
  return prisma.zohoMappingReview.update({
    where: { id: reviewId },
    data: { status: 'REJECTED', resolvedById: userId, resolvedAt: new Date() },
  });
}
