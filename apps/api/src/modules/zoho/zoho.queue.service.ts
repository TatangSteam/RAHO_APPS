import { IntegrationEventStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { logAudit } from '@utils/auditLog';

export type QueueFilters = {
  page: number;
  limit: number;
  status?: IntegrationEventStatus;
  eventType?: string;
  branchId?: string;
};

async function scopedWhere(userId: string, filters: QueueFilters): Promise<Prisma.IntegrationEventWhereInput> {
  const accessibleBranchIds = await getAccessibleBranchIds(userId);
  if (filters.branchId && accessibleBranchIds !== null && !accessibleBranchIds.includes(filters.branchId)) {
    throw new AppError(403, 'BRANCH_ACCESS_DENIED', 'Cabang berada di luar cakupan Anda.');
  }
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.eventType ? { eventType: { contains: filters.eventType, mode: 'insensitive' } } : {}),
    ...(filters.branchId
      ? { branchId: filters.branchId }
      : accessibleBranchIds === null
        ? {}
        : { branchId: { in: accessibleBranchIds } }),
  };
}

export async function listEvents(userId: string, filters: QueueFilters) {
  const where = await scopedWhere(userId, filters);
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.integrationEvent.findMany({
      where,
      include: {
        syncAttempts: {
          orderBy: { attemptNo: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: filters.limit,
    }),
    prisma.integrationEvent.count({ where }),
  ]);
  return {
    items,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

export async function getEvent(userId: string, id: string) {
  const where = await scopedWhere(userId, { page: 1, limit: 1 });
  const event = await prisma.integrationEvent.findFirst({
    where: { ...where, id },
    include: { syncAttempts: { orderBy: { attemptNo: 'desc' } } },
  });
  if (!event) throw new AppError(404, 'ZOHO_EVENT_NOT_FOUND', 'Event sinkronisasi tidak ditemukan.');
  return event;
}

export async function retryEvent(userId: string, id: string) {
  const event = await getEvent(userId, id);
  if (event.status === 'PROCESSING' || event.status === 'PENDING' || event.status === 'PROCESSED') {
    throw new AppError(409, 'ZOHO_EVENT_NOT_RETRYABLE', `Event berstatus ${event.status} tidak dapat diulang.`);
  }
  const updated = await prisma.integrationEvent.update({
    where: { id },
    data: {
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
    },
  });
  await logAudit({
    userId,
    action: 'UPDATE',
    module: 'ZOHO',
    resource: 'IntegrationEvent',
    resourceId: id,
    description: `Event Zoho ${event.eventType} dimasukkan ulang ke antrean.`,
  });
  return updated;
}

export async function ignoreEvent(userId: string, id: string, reason: string) {
  const event = await getEvent(userId, id);
  if (event.status === 'PROCESSED' || event.status === 'PROCESSING') {
    throw new AppError(409, 'ZOHO_EVENT_NOT_IGNORABLE', `Event berstatus ${event.status} tidak dapat diabaikan.`);
  }
  const updated = await prisma.integrationEvent.update({
    where: { id },
    data: {
      status: 'IGNORED',
      ignoredAt: new Date(),
      ignoredById: userId,
      ignoreReason: reason,
      lockedBy: null,
      leaseUntil: null,
    },
  });
  await logAudit({
    userId,
    action: 'UPDATE',
    module: 'ZOHO',
    resource: 'IntegrationEvent',
    resourceId: id,
    description: `Event Zoho ${event.eventType} diabaikan: ${reason}`,
  });
  return updated;
}
