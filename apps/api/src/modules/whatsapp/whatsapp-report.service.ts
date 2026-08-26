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
