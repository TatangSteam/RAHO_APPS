import axios from 'axios';
import { env } from '@config/env';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess } from '@modules/iam/authorization.service';
import { renderSessionReportImage } from './whatsapp-report.renderer';
import { buildSessionReportSnapshot } from './whatsapp-snapshot.service';
import { buildSessionReportCaption } from './whatsapp-template.service';
import { maskWhatsAppNumber, normalizeIndonesianWhatsAppNumber } from './whatsapp-phone.util';
import {
  getSessionReportBackground,
  listSessionReportBackgrounds,
  type SessionReportBackgroundKey,
} from './whatsapp-backgrounds';
import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { encryptWhatsAppValue } from './whatsapp.crypto';

const SAFE_DELIVERY_SELECT = {
  id: true,
  treatmentSessionId: true,
  trigger: true,
  status: true,
  recipientMasked: true,
  templateKey: true,
  templateVersion: true,
  attempts: true,
  maxAttempts: true,
  requestedAt: true,
  sentAt: true,
  failedAt: true,
  lastErrorCode: true,
  lastErrorSanitized: true,
} satisfies Prisma.WhatsAppDeliverySelect;

async function loadTrustedSessionPhoto(url: string | null): Promise<Buffer | undefined> {
  if (!url) return undefined;
  const allowedOrigin = new URL(env.MINIO_PUBLIC_URL).origin;
  const target = new URL(url);
  if (target.origin !== allowedOrigin) return undefined;

  const response = await axios.get<ArrayBuffer>(target.toString(), {
    responseType: 'arraybuffer',
    timeout: 8_000,
    maxContentLength: 12 * 1024 * 1024,
  });
  return Buffer.from(response.data);
}

export async function previewSessionReport(
  sessionId: string,
  actorUserId: string,
  backgroundKey?: SessionReportBackgroundKey,
) {
  const report = await buildSessionReportSnapshot(sessionId);
  await assertBranchAccess(actorUserId, report.branchId);

  const normalized = report.recipientPhone
    ? normalizeIndonesianWhatsAppNumber(report.recipientPhone)
    : null;
  let photo: Buffer | undefined;
  try {
    photo = await loadTrustedSessionPhoto(report.photoUrl);
  } catch {
    // Preview remains available with the explicit no-photo layout.
  }
  const selectedBackground = getSessionReportBackground(backgroundKey);
  const image = await renderSessionReportImage(report.snapshot, photo, selectedBackground.key);

  return {
    recipientMasked: normalized ? maskWhatsAppNumber(normalized) : null,
    consentActive: report.consentActive,
    phoneValid: normalized !== null,
    readyToQueue: env.WHATSAPP_ENABLED && report.consentActive && normalized !== null,
    provider: env.WHATSAPP_PROVIDER,
    caption: buildSessionReportCaption(report.snapshot),
    imageDataUrl: `data:image/png;base64,${image.toString('base64')}`,
    templateKey: 'SESSION_COMPLETED_V1',
    templateVersion: report.snapshot.templateVersion,
    background: { key: selectedBackground.key, name: selectedBackground.name },
    availableBackgrounds: listSessionReportBackgrounds(),
  };
}

export async function assertSessionReportCanQueue(sessionId: string, actorUserId: string) {
  if (!env.WHATSAPP_ENABLED) {
    throw errors.badRequest('WHATSAPP_DISABLED', 'Fitur laporan WhatsApp belum diaktifkan.');
  }
  const report = await buildSessionReportSnapshot(sessionId);
  await assertBranchAccess(actorUserId, report.branchId);
  if (!report.consentActive) {
    throw errors.badRequest('WHATSAPP_CONSENT_REQUIRED', 'Consent laporan WhatsApp belum aktif.');
  }
  const recipient = report.recipientPhone
    ? normalizeIndonesianWhatsAppNumber(report.recipientPhone)
    : null;
  if (!recipient) {
    throw errors.badRequest('WHATSAPP_PHONE_INVALID', 'Nomor WhatsApp member belum valid.');
  }
  return { report, recipient };
}

export async function queueManualSessionReport(input: {
  sessionId: string;
  actorUserId: string;
  idempotencyKey: string;
  backgroundKey?: SessionReportBackgroundKey;
}) {
  const { report, recipient } = await assertSessionReportCanQueue(input.sessionId, input.actorUserId);
  const session = await prisma.treatmentSession.findUnique({
    where: { id: input.sessionId },
    select: { isCompleted: true, completionStatus: true },
  });
  if (!session?.isCompleted || session.completionStatus !== 'COMPLETED') {
    throw errors.badRequest(
      'WHATSAPP_SESSION_NOT_COMPLETED',
      'Laporan WhatsApp hanya dapat diantrekan setelah sesi selesai.',
    );
  }

  const background = getSessionReportBackground(input.backgroundKey);
  const encryptedPayload = encryptWhatsAppValue(JSON.stringify({
    snapshot: report.snapshot,
    photoUrl: report.photoUrl,
    backgroundKey: background.key,
  }));
  const existing = await prisma.whatsAppDelivery.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: SAFE_DELIVERY_SELECT,
  });
  if (existing) {
    if (existing.treatmentSessionId !== input.sessionId) {
      throw errors.conflict(
        'WHATSAPP_IDEMPOTENCY_CONFLICT',
        'Idempotency key sudah digunakan untuk sesi lain.',
      );
    }
    return { delivery: existing, idempotentReplay: true };
  }

  try {
    const delivery = await prisma.whatsAppDelivery.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        treatmentSessionId: input.sessionId,
        memberId: report.memberId,
        branchId: report.branchId,
        trigger: 'MANUAL',
        recipientEncrypted: encryptWhatsAppValue(recipient),
        recipientMasked: maskWhatsAppNumber(recipient),
        payloadEncrypted: encryptedPayload,
        requestedBy: input.actorUserId,
      },
      select: SAFE_DELIVERY_SELECT,
    });
    return { delivery, idempotentReplay: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const replay = await prisma.whatsAppDelivery.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: SAFE_DELIVERY_SELECT,
      });
      if (replay?.treatmentSessionId === input.sessionId) {
        return { delivery: replay, idempotentReplay: true };
      }
    }
    throw error;
  }
}

export async function listSessionReportDeliveries(sessionId: string, actorUserId: string) {
  const report = await buildSessionReportSnapshot(sessionId);
  await assertBranchAccess(actorUserId, report.branchId);
  return prisma.whatsAppDelivery.findMany({
    where: { treatmentSessionId: sessionId },
    select: SAFE_DELIVERY_SELECT,
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateSessionReportConsent(input: {
  sessionId: string;
  actorUserId: string;
  enabled: boolean;
  source?: string;
}) {
  const report = await buildSessionReportSnapshot(input.sessionId);
  await assertBranchAccess(input.actorUserId, report.branchId);
  const now = new Date();
  return prisma.memberCommunicationConsent.upsert({
    where: { memberId: report.memberId },
    create: {
      memberId: report.memberId,
      whatsappTreatmentReport: input.enabled,
      consentedAt: input.enabled ? now : null,
      consentedBy: input.enabled ? input.actorUserId : null,
      revokedAt: input.enabled ? null : now,
      revokedBy: input.enabled ? null : input.actorUserId,
      consentSource: input.source || 'SESSION_WORKFLOW',
    },
    update: {
      whatsappTreatmentReport: input.enabled,
      consentedAt: input.enabled ? now : undefined,
      consentedBy: input.enabled ? input.actorUserId : undefined,
      revokedAt: input.enabled ? null : now,
      revokedBy: input.enabled ? null : input.actorUserId,
      consentSource: input.source || 'SESSION_WORKFLOW',
    },
    select: {
      whatsappTreatmentReport: true,
      consentedAt: true,
      revokedAt: true,
      consentSource: true,
    },
  });
}
