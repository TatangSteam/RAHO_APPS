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
import { GLOBAL_WHATSAPP_CONNECTION_ID } from './whatsapp-auth-state.repository';
import { downloadFile } from '@config/minio';
import { loadSessionPhoto } from './whatsapp-photo.loader';

type ConfiguredBackground = {
  key: SessionReportBackgroundKey;
  objectKey?: string;
};

async function configuredBackground(): Promise<ConfiguredBackground> {
  const connection = await prisma.whatsAppConnection.findUnique({
    where: { id: GLOBAL_WHATSAPP_CONNECTION_ID },
    select: { defaultBackgroundKey: true, customBackgroundObjectKey: true },
  });
  const key = getSessionReportBackground(connection?.defaultBackgroundKey).key;
  if (key === 'CUSTOM' && connection?.customBackgroundObjectKey) {
    return { key, objectKey: connection.customBackgroundObjectKey };
  }
  return { key: key === 'CUSTOM' ? 'RAHO_RED' : key };
}

async function loadCustomBackground(objectKey?: string): Promise<Buffer | undefined> {
  if (!objectKey) return undefined;
  try {
    return await downloadFile(objectKey, 5 * 1024 * 1024);
  } catch {
    return undefined;
  }
}

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

export async function previewSessionReport(
  sessionId: string,
  actorUserId: string,
) {
  const report = await buildSessionReportSnapshot(sessionId);
  await assertBranchAccess(actorUserId, report.branchId);

  const normalized = report.recipientPhone
    ? normalizeIndonesianWhatsAppNumber(report.recipientPhone)
    : null;
  let photo: Buffer | undefined;
  try {
    photo = await loadSessionPhoto(report.photoUrl);
  } catch {
    // Preview remains available with the explicit no-photo layout.
  }
  // Preview and delivery always use the centrally approved Super Admin
  // setting; staff cannot override branding per session.
  const configured = await configuredBackground();
  const selectedBackground = getSessionReportBackground(configured.key);
  const customBackground = await loadCustomBackground(configured.objectKey);
  const image = await renderSessionReportImage(report.snapshot, photo, selectedBackground.key, customBackground);

  return {
    recipientMasked: normalized ? maskWhatsAppNumber(normalized) : null,
    phoneValid: normalized !== null,
    readyToQueue: env.WHATSAPP_ENABLED
      && normalized !== null
      && report.operationalReportReady,
    provider: env.WHATSAPP_PROVIDER,
    caption: buildSessionReportCaption(report.snapshot),
    imageDataUrl: `data:image/png;base64,${image.toString('base64')}`,
    templateKey: 'SESSION_COMPLETED_V1',
    templateVersion: report.snapshot.templateVersion,
    background: { key: selectedBackground.key, name: selectedBackground.name },
    availableBackgrounds: listSessionReportBackgrounds(),
    doctorEvaluationIncluded: report.doctorEvaluationIncluded,
    evaluationRequired: false,
  };
}

export async function assertSessionReportCanQueue(sessionId: string, actorUserId: string) {
  if (!env.WHATSAPP_ENABLED) {
    throw errors.badRequest('WHATSAPP_DISABLED', 'Fitur laporan WhatsApp belum diaktifkan.');
  }
  const report = await buildSessionReportSnapshot(sessionId);
  await assertBranchAccess(actorUserId, report.branchId);
  const recipient = report.recipientPhone
    ? normalizeIndonesianWhatsAppNumber(report.recipientPhone)
    : null;
  if (!recipient) {
    throw errors.badRequest('WHATSAPP_PHONE_INVALID', 'Nomor WhatsApp member belum valid.');
  }
  if (!report.operationalReportReady) {
    throw errors.badRequest(
      'WHATSAPP_REPORT_NOT_READY',
      'Laporan WhatsApp dapat dikirim setelah data infus dan tanda vital sebelum/sesudah tersedia.',
    );
  }
  return { report, recipient };
}

export async function queueManualSessionReport(input: {
  sessionId: string;
  actorUserId: string;
  idempotencyKey: string;
}) {
  const { report, recipient } = await assertSessionReportCanQueue(input.sessionId, input.actorUserId);
  // The approved background is centrally governed by Super Admin. Ignore a
  // stale client's selection when creating the immutable delivery payload.
  const configured = await configuredBackground();
  const background = getSessionReportBackground(configured.key);
  const encryptedPayload = encryptWhatsAppValue(JSON.stringify({
    snapshot: report.snapshot,
    photoUrl: report.photoUrl,
    backgroundKey: background.key,
    backgroundObjectKey: configured.objectKey,
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
