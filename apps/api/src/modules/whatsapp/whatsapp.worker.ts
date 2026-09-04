import { WhatsAppDeliveryStatus } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { decryptWhatsAppValue } from './whatsapp.crypto';
import { renderSessionReportImage } from './whatsapp-report.renderer';
import { buildSessionReportCaption } from './whatsapp-template.service';
import type { SessionReportSnapshot } from './whatsapp-report.types';
import type { SessionReportBackgroundKey } from './whatsapp-backgrounds';
import type { WhatsAppProvider } from './whatsapp-provider';
import { downloadFile } from '@config/minio';
import { loadSessionPhoto } from './whatsapp-photo.loader';

interface EncryptedDeliveryPayload {
  snapshot: SessionReportSnapshot;
  backgroundKey: SessionReportBackgroundKey;
  backgroundObjectKey?: string;
  photoUrl?: string | null;
}

const LEASE_MS = 60_000;

function retryDelay(attempts: number): number {
  return Math.min(30 * 60_000, 5_000 * (2 ** Math.max(0, attempts - 1)));
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : 'Unknown WhatsApp delivery error';
}

export class WhatsAppDeliveryWorker {
  constructor(private readonly provider: WhatsAppProvider) {}

  async processNext(workerId: string): Promise<boolean> {
    if (!this.provider.isReady()) return false;
    const now = new Date();
    const candidate = await prisma.whatsAppDelivery.findFirst({
      where: {
        status: { in: [WhatsAppDeliveryStatus.PENDING, WhatsAppDeliveryStatus.RETRY] },
        availableAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    if (!candidate) return false;

    const claimed = await prisma.whatsAppDelivery.updateMany({
      where: {
        id: candidate.id,
        status: { in: [WhatsAppDeliveryStatus.PENDING, WhatsAppDeliveryStatus.RETRY] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: {
        status: WhatsAppDeliveryStatus.PROCESSING,
        lockedBy: workerId,
        leaseUntil: new Date(now.getTime() + LEASE_MS),
        attempts: { increment: 1 },
      },
    });
    if (claimed.count !== 1) return true;

    const delivery = await prisma.whatsAppDelivery.findUniqueOrThrow({
      where: { id: candidate.id },
    });

    try {
      const payload = JSON.parse(decryptWhatsAppValue(delivery.payloadEncrypted)) as EncryptedDeliveryPayload;
      const recipient = decryptWhatsAppValue(delivery.recipientEncrypted);
      const photo = await loadSessionPhoto(payload.photoUrl);
      const customBackground = payload.backgroundObjectKey
        ? await downloadFile(payload.backgroundObjectKey, 5 * 1024 * 1024)
        : undefined;
      const image = await renderSessionReportImage(
        payload.snapshot,
        photo,
        payload.backgroundKey,
        customBackground,
      );
      const result = await this.provider.sendImage({
        recipient,
        image,
        caption: buildSessionReportCaption(payload.snapshot),
      });
      await prisma.whatsAppDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WhatsAppDeliveryStatus.SENT,
          providerMessageId: result.messageId,
          sentAt: new Date(),
          lockedBy: null,
          leaseUntil: null,
          lastErrorCode: null,
          lastErrorSanitized: null,
        },
      });
    } catch (error) {
      const terminal = delivery.attempts >= delivery.maxAttempts;
      await prisma.whatsAppDelivery.update({
        where: { id: delivery.id },
        data: {
          status: terminal ? WhatsAppDeliveryStatus.DEAD_LETTER : WhatsAppDeliveryStatus.RETRY,
          availableAt: new Date(Date.now() + retryDelay(delivery.attempts)),
          failedAt: terminal ? new Date() : null,
          lockedBy: null,
          leaseUntil: null,
          lastErrorCode: terminal ? 'MAX_ATTEMPTS_REACHED' : 'PROVIDER_ERROR',
          lastErrorSanitized: safeError(error),
        },
      });
    }
    return true;
  }
}
