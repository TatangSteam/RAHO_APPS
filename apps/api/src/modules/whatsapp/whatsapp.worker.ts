import { WhatsAppDeliveryStatus } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { decryptWhatsAppValue } from './whatsapp.crypto';
import { renderSessionReportImage } from './whatsapp-report.renderer';
import { buildSessionReportCaption } from './whatsapp-template.service';
import type { SessionReportSnapshot } from './whatsapp-report.types';
import type { SessionReportBackgroundKey } from './whatsapp-backgrounds';
import type { WhatsAppProvider } from './whatsapp-provider';
import axios from 'axios';
import { env } from '@config/env';

interface EncryptedDeliveryPayload {
  snapshot: SessionReportSnapshot;
  backgroundKey: SessionReportBackgroundKey;
  photoUrl?: string | null;
}

const LEASE_MS = 60_000;

function retryDelay(attempts: number): number {
  return Math.min(30 * 60_000, 5_000 * (2 ** Math.max(0, attempts - 1)));
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : 'Unknown WhatsApp delivery error';
}

async function loadPhoto(url?: string | null): Promise<Buffer | undefined> {
  if (!url) return undefined;
  const target = new URL(url);
  if (target.origin !== new URL(env.MINIO_PUBLIC_URL).origin) return undefined;
  const response = await axios.get<ArrayBuffer>(target.toString(), {
    responseType: 'arraybuffer',
    timeout: 8_000,
    maxContentLength: 12 * 1024 * 1024,
  });
  return Buffer.from(response.data);
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
      include: {
        member: { select: { communicationConsent: true } },
      },
    });

    if (
      delivery.member.communicationConsent?.whatsappTreatmentReport !== true
      || delivery.member.communicationConsent.revokedAt !== null
    ) {
      await prisma.whatsAppDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WhatsAppDeliveryStatus.CANCELLED,
          lockedBy: null,
          leaseUntil: null,
          lastErrorCode: 'CONSENT_REVOKED',
          lastErrorSanitized: 'Consent WhatsApp tidak aktif saat delivery diproses.',
        },
      });
      return true;
    }

    try {
      const payload = JSON.parse(decryptWhatsAppValue(delivery.payloadEncrypted)) as EncryptedDeliveryPayload;
      const recipient = decryptWhatsAppValue(delivery.recipientEncrypted);
      const photo = await loadPhoto(payload.photoUrl);
      const image = await renderSessionReportImage(payload.snapshot, photo, payload.backgroundKey);
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
