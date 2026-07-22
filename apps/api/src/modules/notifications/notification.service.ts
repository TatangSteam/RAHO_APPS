import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { hasPermission } from '@modules/iam/authorization.service';

type Tx = Prisma.TransactionClient;

export async function createNotification(tx: Tx, input: {
  userId: string;
  title: string;
  body: string;
  deepLink?: string;
  type?: NotificationType;
}) {
  return tx.notification.create({ data: { ...input, type: input.type || NotificationType.INFO } });
}

export async function notifyApprovers(tx: Tx, input: {
  permissionCode: string;
  branchId: string;
  makerUserId: string;
  entityNumber: string;
  stepName: string;
}) {
  const candidates = await tx.user.findMany({ where: { isActive: true, role: { not: 'MEMBER' }, id: { not: input.makerUserId } }, select: { id: true } });
  const recipientIds: string[] = [];
  for (const candidate of candidates) {
    if (await hasPermission(candidate.id, input.permissionCode, input.branchId)) recipientIds.push(candidate.id);
  }
  if (!recipientIds.length) return 0;
  const result = await tx.notification.createMany({ data: recipientIds.map((userId) => ({
    userId,
    type: NotificationType.INFO,
    title: 'Approval menunggu keputusan',
    body: `${input.entityNumber} menunggu ${input.stepName}.`,
    deepLink: '/approvals',
  })) });
  return result.count;
}

export async function listMyNotifications(userId: string, query: { page: number; limit: number; status?: 'UNREAD' | 'READ' }) {
  const where = { userId, ...(query.status ? { status: query.status } : {}) };
  const [data, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, status: 'UNREAD' } }),
  ]);
  return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit), unread } };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({ where: { id: notificationId, userId } });
  if (!notification) throw errors.notFound('Notifikasi tidak ditemukan.');
  if (notification.status === 'READ') return notification;
  return prisma.notification.update({ where: { id: notificationId }, data: { status: 'READ', readAt: new Date() } });
}

export async function markAllNotificationsRead(userId: string) {
  const now = new Date();
  const result = await prisma.notification.updateMany({ where: { userId, status: 'UNREAD' }, data: { status: 'READ', readAt: now } });
  return { updated: result.count, readAt: now };
}
