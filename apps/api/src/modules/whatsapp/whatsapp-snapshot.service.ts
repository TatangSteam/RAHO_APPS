import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import type { SessionReportSnapshot } from './whatsapp-report.types';

const INFUSION_UNITS: Record<string, string> = {
  ifa250: 'botol', ifa500: 'botol', jumlahJarum: 'buah', volumeCarrier: 'ml',
};

function decimalRecord(value: Record<string, unknown> | null): Record<string, string> {
  if (!value) return {};
  const allowed = ['ifa250', 'ifa500', 'hho', 'hhoKonsentrat', 'h2', 'no', 'gaso', 'o2', 'o3', 'edta', 'mb', 'h2s', 'kcl', 'jmlNb'];
  return Object.fromEntries(allowed.flatMap((key) => {
    const raw = value[key];
    if (raw === null || raw === undefined || Number(raw) === 0) return [];
    return [[key, `${String(raw)} ${INFUSION_UNITS[key] || 'ml'}`]];
  }));
}

export async function buildSessionReportSnapshot(sessionId: string): Promise<{
  snapshot: SessionReportSnapshot;
  recipientPhone: string | null;
  branchId: string;
  consentActive: boolean;
  photoUrl: string | null;
}> {
  const session = await prisma.treatmentSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      sessionCode: true,
      branchId: true,
      branchInfusKe: true,
      treatmentDate: true,
      branch: { select: { name: true } },
      encounter: {
        select: {
          member: {
            select: {
              id: true,
              isConsentToPhoto: true,
              communicationConsent: { select: { whatsappTreatmentReport: true, revokedAt: true } },
              user: { select: { profile: { select: { fullName: true, phone: true } } } },
            },
          },
        },
      },
      infusion: true,
      vitalSigns: { select: { pencatatan: true, waktuCatat: true, value: true, unit: true } },
      evaluation: { select: { rekomendasi: true, plan: true, generalNotes: true } },
      photo: { select: { id: true, fileUrl: true } },
    },
  });
  if (!session) throw errors.notFound('Sesi terapi tidak ditemukan.');

  const member = session.encounter.member;
  const before: Record<string, string> = {};
  const after: Record<string, string> = {};
  session.vitalSigns.forEach((vital) => {
    const target = vital.waktuCatat === 'SEBELUM' ? before : after;
    target[vital.pencatatan] = `${String(vital.value)}${vital.unit ? ` ${vital.unit}` : ''}`;
  });
  const photoAllowed = member.isConsentToPhoto && Boolean(session.photo);

  return {
    branchId: session.branchId,
    recipientPhone: member.user.profile?.phone || null,
    consentActive: member.communicationConsent?.whatsappTreatmentReport === true
      && member.communicationConsent.revokedAt === null,
    photoUrl: photoAllowed ? session.photo?.fileUrl || null : null,
    snapshot: {
      templateVersion: 1,
      sessionId: session.id,
      sessionCode: session.sessionCode,
      member: { displayName: member.user.profile?.fullName || 'Member RAHO' },
      session: {
        infusionNumber: session.branchInfusKe,
        date: session.treatmentDate.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }),
        branchName: session.branch.name,
      },
      infusion: decimalRecord(session.infusion as unknown as Record<string, unknown> | null),
      vitals: { before, after },
      recommendation: session.evaluation?.rekomendasi || session.evaluation?.plan || undefined,
      notes: session.evaluation?.generalNotes || undefined,
      photo: {
        allowed: photoAllowed,
        sourcePhotoId: photoAllowed ? session.photo?.id : undefined,
      },
    },
  };
}
