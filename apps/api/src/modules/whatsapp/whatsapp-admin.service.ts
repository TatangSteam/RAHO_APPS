import { WhatsAppDeliveryStatus } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { logAudit } from '@utils/auditLog';

const RETRYABLE_STATUSES: WhatsAppDeliveryStatus[] = [
  WhatsAppDeliveryStatus.FAILED,
  WhatsAppDeliveryStatus.RETRY,
  WhatsAppDeliveryStatus.DEAD_LETTER,
];

export async function listDeliveries(input: {
  page: number;
  limit: number;
  status?: WhatsAppDeliveryStatus;
}) {
  const where = input.status ? { status: input.status } : {};
  const [total, deliveries, grouped] = await Promise.all([
    prisma.whatsAppDelivery.count({ where }),
    prisma.whatsAppDelivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      select: {
        id: true,
        status: true,
        trigger: true,
        recipientMasked: true,
        attempts: true,
        maxAttempts: true,
        requestedAt: true,
        sentAt: true,
        failedAt: true,
        lastErrorCode: true,
        lastErrorSanitized: true,
        treatmentSession: { select: { sessionCode: true } },
        branch: { select: { name: true } },
        member: {
          select: { user: { select: { profile: { select: { fullName: true } } } } },
        },
      },
    }),
    prisma.whatsAppDelivery.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  return {
    deliveries: deliveries.map((delivery) => {
      const { member, treatmentSession, branch, ...safeDelivery } = delivery;
      return {
        ...safeDelivery,
        memberName: member.user.profile?.fullName || 'Member RAHO',
        sessionCode: treatmentSession.sessionCode,
        branchName: branch.name,
        canRetry: RETRYABLE_STATUSES.includes(delivery.status),
      };
    }),
    summary: Object.fromEntries(grouped.map((item) => [item.status, item._count._all])),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

export async function retryDelivery(deliveryId: string, actorUserId: string) {
  const before = await prisma.whatsAppDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      status: true,
      attempts: true,
      treatmentSessionId: true,
      branchId: true,
      recipientMasked: true,
    },
  });
  if (!before) throw errors.notFound('Delivery WhatsApp tidak ditemukan.');
  if (!RETRYABLE_STATUSES.includes(before.status)) {
    throw errors.conflict('WHATSAPP_DELIVERY_NOT_RETRYABLE', 'Status delivery ini tidak dapat di-retry.');
  }
  const changed = await prisma.whatsAppDelivery.updateMany({
    where: { id: deliveryId, status: { in: RETRYABLE_STATUSES } },
    data: {
      status: WhatsAppDeliveryStatus.PENDING,
      attempts: 0,
      availableAt: new Date(),
      lockedBy: null,
      leaseUntil: null,
      failedAt: null,
      lastErrorCode: null,
      lastErrorSanitized: null,
    },
  });
  if (changed.count !== 1) {
    throw errors.conflict('WHATSAPP_DELIVERY_CHANGED', 'Status delivery berubah. Muat ulang antrean.');
  }
  await logAudit({
    userId: actorUserId,
    branchId: before.branchId,
    action: 'RETRY',
    module: 'WHATSAPP',
    resource: 'WhatsAppDelivery',
    resourceId: deliveryId,
    beforeData: { status: before.status, attempts: before.attempts },
    afterData: { status: WhatsAppDeliveryStatus.PENDING, attempts: 0 },
    meta: { treatmentSessionId: before.treatmentSessionId, recipientMasked: before.recipientMasked },
    description: 'Super Admin menjalankan retry manual delivery WhatsApp.',
  });
  return { id: deliveryId, status: WhatsAppDeliveryStatus.PENDING };
}
