import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import {
  AuditAction,
  CampaignVoucherStatus,
  Prisma,
  Role,
  VoucherCampaignStatus,
  VoucherClaimAttemptResult,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError, errors } from '@middleware/errorHandler';
import { logAudit } from '@utils/auditLog';
import type {
  ClaimVoucherInput,
  CreateVoucherOperatorInput,
  IssueVoucherInput,
  UpdateVoucherOperatorInput,
  ExportVoucherCodesInput,
  GenerateVoucherCodesInput,
} from './voucher.schema';
import { decryptVoucherCode, encryptVoucherCode, hashVoucherIdentity } from './voucher.crypto';

const HASH_ROUNDS = 12;
const CLAIM_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const CLAIM_RATE_LIMIT_FAILURE_CODES = [
  'VOUCHER_NOT_FOUND',
  'VOUCHER_IDENTITY_MISMATCH',
];

export function normalizeVoucherCode(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function codeHash(value: string): string {
  return createHash('sha256').update(normalizeVoucherCode(value), 'utf8').digest('hex');
}

function generateVoucherCode(campaignCode: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  const token = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `RAHO-${campaignCode.replace(/[^A-Z0-9]/g, '').slice(0, 6)}-${token}`;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
}

function parseDateOnly(value: string, field: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw errors.badRequest('VOUCHER_INVALID_DATE', `${field} tidak valid.`);
  }
  return parsed;
}

function sameDate(value: Date | null, expected: string): boolean {
  return Boolean(value && value.toISOString().slice(0, 10) === expected);
}

function maskCode(last4: string): string {
  return `RAHO-****-${last4}`;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let stringValue = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(stringValue)) stringValue = `'${stringValue}`;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function assertSuperAdmin(role: Role): void {
  if (role !== Role.SUPER_ADMIN) throw errors.forbidden('Hanya Super Admin yang dapat melakukan aksi ini.');
}

async function getAllowedLocations(userId: string, role: Role) {
  if (role === Role.SUPER_ADMIN) {
    return prisma.voucherClaimLocation.findMany({
      where: { isActive: true },
      orderBy: [{ city: 'asc' }, { displayName: 'asc' }],
    });
  }
  return prisma.voucherClaimLocation.findMany({
    where: {
      isActive: true,
      operatorAssignments: {
        some: {
          userId,
          OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
        },
      },
    },
    orderBy: [{ city: 'asc' }, { displayName: 'asc' }],
  });
}

function presentVoucher(voucher: {
  id: string;
  codeLast4: string;
  status: CampaignVoucherStatus;
  recipientNameSnapshot: string | null;
  nikLast4: string | null;
  issuedAt: Date;
  claimedAt: Date | null;
  campaign: { code: string; title: string; basicSessions: number; boosterSessions: number };
  allowedLocation?: { id: string; displayName: string; city: string } | null;
  claimedLocation?: { id: string; displayName: string; city: string } | null;
}) {
  return {
    id: voucher.id,
    maskedCode: maskCode(voucher.codeLast4),
    status: voucher.status,
    recipientName: voucher.recipientNameSnapshot ?? 'Belum ditetapkan',
    maskedNik: voucher.nikLast4 ? `************${voucher.nikLast4}` : '-',
    issuedAt: voucher.issuedAt,
    claimedAt: voucher.claimedAt,
    campaign: voucher.campaign,
    allowedLocation: voucher.allowedLocation ?? null,
    claimedLocation: voucher.claimedLocation ?? null,
  };
}

export async function getVoucherDashboard(userId: string, role: Role) {
  const locations = await getAllowedLocations(userId, role);
  const locationIds = locations.map((location) => location.id);
  const voucherScope = role === Role.SUPER_ADMIN
    ? {}
    : { claimedLocationId: { in: locationIds } };

  const [campaigns, voucherCounts, recentVouchers, operators] = await Promise.all([
    prisma.voucherCampaign.findMany({ include: { _count: { select: { vouchers: true } } }, orderBy: [{ status: 'asc' }, { createdAt: 'asc' }] }),
    prisma.campaignVoucher.groupBy({ by: ['campaignId', 'status'], _count: { _all: true } }),
    prisma.campaignVoucher.findMany({
      where: voucherScope,
      include: {
        campaign: { select: { code: true, title: true, basicSessions: true, boosterSessions: true } },
        allowedLocation: { select: { id: true, displayName: true, city: true } },
        claimedLocation: { select: { id: true, displayName: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    }),
    role === Role.SUPER_ADMIN
      ? prisma.user.findMany({
          where: { role: Role.VOUCHER_OPERATOR },
          select: {
            id: true,
            email: true,
            isActive: true,
            lastLoginAt: true,
            profile: { select: { fullName: true } },
            voucherOperatorLocations: {
              include: { location: { select: { id: true, code: true, displayName: true, city: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  return {
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      unitPrice: campaign.unitPrice?.toNumber() ?? null,
      totalPrice: campaign.totalPrice?.toNumber() ?? null,
      remainingQuota: Math.max(0, campaign.quota - campaign.issuedCount),
      generatedCount: campaign._count.vouchers,
      availableCount: voucherCounts.find((item) => item.campaignId === campaign.id && item.status === CampaignVoucherStatus.AVAILABLE)?._count._all ?? 0,
      remainingToGenerate: Math.max(0, campaign.quota - campaign._count.vouchers),
    })),
    locations,
    recentVouchers: recentVouchers.map(presentVoucher),
    operators: operators.map((operator) => ({
      id: operator.id,
      username: operator.email,
      fullName: operator.profile?.fullName ?? operator.email,
      isActive: operator.isActive,
      lastLoginAt: operator.lastLoginAt,
      locations: operator.voucherOperatorLocations.map((assignment) => assignment.location),
    })),
  };
}

export async function issueVoucher(actorId: string, actorRole: Role, input: IssueVoucherInput) {
  assertSuperAdmin(actorRole);
  const birthDate = parseDateOnly(input.dateOfBirth, 'Tanggal lahir');
  if (birthDate > new Date()) throw errors.badRequest('VOUCHER_INVALID_DATE', 'Tanggal lahir tidak boleh di masa depan.');
  const recipientName = input.recipientName.trim().replace(/\s+/g, ' ');

  const issuedResult = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`VOUCHER_CAMPAIGN:${input.campaignId}`}))`;
    const campaign = await tx.voucherCampaign.findUnique({ where: { id: input.campaignId } });
    if (!campaign || campaign.status !== VoucherCampaignStatus.ACTIVE) {
      throw errors.badRequest('VOUCHER_CAMPAIGN_NOT_ACTIVE', 'Campaign tidak aktif.');
    }
    const now = new Date();
    if ((campaign.issueStartAt && campaign.issueStartAt > now) || (campaign.issueEndAt && campaign.issueEndAt < now)) {
      throw errors.badRequest('VOUCHER_CAMPAIGN_NOT_ACTIVE', 'Periode penerbitan campaign tidak aktif.');
    }
    if (campaign.issuedCount >= campaign.quota) {
      throw errors.conflict('VOUCHER_CAMPAIGN_QUOTA_EXCEEDED', 'Kuota campaign telah habis.');
    }
    if (input.allowedLocationId) {
      const location = await tx.voucherClaimLocation.findFirst({ where: { id: input.allowedLocationId, isActive: true } });
      if (!location) throw errors.badRequest('VOUCHER_LOCATION_NOT_FOUND', 'Lokasi klaim tidak aktif atau tidak ditemukan.');
    }
    const claimDeadline = input.claimDeadline
      ? parseDateOnly(input.claimDeadline, 'Batas klaim')
      : campaign.claimEndAt;
    const requestedCode = input.code ? normalizeVoucherCode(input.code) : null;
    const existingAvailable = requestedCode
      ? await tx.campaignVoucher.findUnique({ where: { codeHash: codeHash(requestedCode) } })
      : await tx.campaignVoucher.findFirst({
          where: { campaignId: campaign.id, status: CampaignVoucherStatus.AVAILABLE },
          orderBy: { createdAt: 'asc' },
        });
    if (existingAvailable && (existingAvailable.campaignId !== campaign.id || existingAvailable.status !== CampaignVoucherStatus.AVAILABLE)) {
      throw errors.conflict('VOUCHER_CODE_DUPLICATE', 'Kode voucher sudah digunakan atau berasal dari campaign lain.');
    }
    const totalCodes = await tx.campaignVoucher.count({ where: { campaignId: campaign.id } });
    if (!existingAvailable && totalCodes >= campaign.quota) {
      throw errors.conflict('VOUCHER_CAMPAIGN_QUOTA_EXCEEDED', 'Semua kode campaign sudah dibuat. Pilih kode AVAILABLE dari hasil export.');
    }
    const rawCode = existingAvailable?.codeEncrypted
      ? decryptVoucherCode(existingAvailable.codeEncrypted)
      : requestedCode || generateVoucherCode(campaign.code);
    const recipientData = {
        recipientMemberId: null,
        recipientNameSnapshot: recipientName,
        recipientNikHash: hashVoucherIdentity(input.nik),
        recipientDateOfBirth: birthDate,
        nikLast4: input.nik.slice(-4),
        allowedLocationId: input.allowedLocationId ?? null,
        claimDeadline,
        status: CampaignVoucherStatus.ISSUED,
        issuedAt: new Date(),
        updatedBy: actorId,
    };
    const voucher = existingAvailable
      ? await tx.campaignVoucher.update({
          where: { id: existingAvailable.id },
          data: recipientData,
          include: {
            campaign: { select: { code: true, title: true, basicSessions: true, boosterSessions: true } },
            allowedLocation: { select: { id: true, displayName: true, city: true } },
            claimedLocation: { select: { id: true, displayName: true, city: true } },
          },
        })
      : await tx.campaignVoucher.create({
          data: {
            campaignId: campaign.id,
            codeHash: codeHash(rawCode),
            codeEncrypted: encryptVoucherCode(rawCode),
            codeLast4: rawCode.slice(-4),
            ...recipientData,
        createdBy: actorId,
          },
          include: {
            campaign: { select: { code: true, title: true, basicSessions: true, boosterSessions: true } },
            allowedLocation: { select: { id: true, displayName: true, city: true } },
            claimedLocation: { select: { id: true, displayName: true, city: true } },
          },
        });
    await tx.voucherCampaign.update({ where: { id: campaign.id }, data: { issuedCount: { increment: 1 }, updatedBy: actorId } });
    return { voucher, rawCode };
  });
  const issued = issuedResult.voucher;

  await logAudit({
    userId: actorId,
    action: AuditAction.CREATE,
    module: 'VOUCHER',
    resource: 'CampaignVoucher',
    resourceId: issued.id,
    entityCode: maskCode(issued.codeLast4),
    meta: { campaignCode: issued.campaign.code, maskedNik: `************${issued.nikLast4}` },
  });
  return { ...presentVoucher(issued), code: issuedResult.rawCode };
}

export async function generateVoucherCodes(actorId: string, actorRole: Role, campaignId: string, input: GenerateVoucherCodesInput) {
  assertSuperAdmin(actorRole);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`VOUCHER_CAMPAIGN:${campaignId}`}))`;
    const campaign = await tx.voucherCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.status === VoucherCampaignStatus.CLOSED) {
      throw errors.badRequest('VOUCHER_CAMPAIGN_NOT_ACTIVE', 'Campaign tidak ditemukan atau sudah ditutup.');
    }
    const existingCount = await tx.campaignVoucher.count({ where: { campaignId } });
    const remaining = Math.max(0, campaign.quota - existingCount);
    const count = input.count ?? remaining;
    if (remaining === 0) throw errors.conflict('VOUCHER_CAMPAIGN_QUOTA_EXCEEDED', 'Seluruh kuota kode campaign sudah dibuat.');
    if (count > remaining) throw errors.badRequest('VOUCHER_GENERATE_COUNT_EXCEEDED', `Maksimal ${remaining} kode lagi yang dapat dibuat.`);

    const values: Prisma.CampaignVoucherCreateManyInput[] = [];
    const hashes = new Set<string>();
    while (values.length < count) {
      const code = generateVoucherCode(campaign.code);
      const hash = codeHash(code);
      if (hashes.has(hash)) continue;
      hashes.add(hash);
      values.push({
        campaignId,
        codeHash: hash,
        codeEncrypted: encryptVoucherCode(code),
        codeLast4: code.slice(-4),
        status: CampaignVoucherStatus.AVAILABLE,
        createdBy: actorId,
        updatedBy: actorId,
      });
    }
    await tx.campaignVoucher.createMany({ data: values });
    return { campaign, generated: count, totalGenerated: existingCount + count };
  });
  await logAudit({
    userId: actorId,
    action: AuditAction.CREATE,
    module: 'VOUCHER',
    resource: 'CampaignVoucher',
    resourceId: campaignId,
    description: `Super Admin membuat ${result.generated} kode voucher AVAILABLE untuk campaign ${result.campaign.code}.`,
    meta: { campaignCode: result.campaign.code, generated: result.generated, totalGenerated: result.totalGenerated },
  });
  return { campaignId, campaignCode: result.campaign.code, generated: result.generated, totalGenerated: result.totalGenerated };
}

export async function exportVoucherCodes(actorId: string, actorRole: Role, input: ExportVoucherCodesInput) {
  assertSuperAdmin(actorRole);
  const vouchers = await prisma.campaignVoucher.findMany({
    where: {
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    include: {
      campaign: true,
      allowedLocation: { select: { code: true, displayName: true, city: true } },
      claimedLocation: { select: { code: true, displayName: true, city: true } },
    },
    orderBy: [{ campaign: { code: 'asc' } }, { issuedAt: 'asc' }],
  });

  const missingEncryptedCodes = vouchers.filter((voucher) => !voucher.codeEncrypted);
  if (missingEncryptedCodes.length > 0) {
    throw errors.unprocessable(
      'VOUCHER_CODE_EXPORT_UNAVAILABLE',
      `${missingEncryptedCodes.length} voucher lama tidak mempunyai kode terenkripsi dan tidak dapat diexport ulang.`,
    );
  }

  const headers = [
    'Kode Voucher',
    'Campaign',
    'Judul',
    'Deskripsi',
    'Sesi BASIC',
    'Sesi BOOSTER',
    'Nama Penerima',
    'NIK Tersamarkan',
    'Status',
    'Lokasi Berlaku',
    'Batas Klaim',
    'Tanggal Terbit',
  ];
  const rows = vouchers.map((voucher) => {
    let code: string;
    try {
      code = decryptVoucherCode(voucher.codeEncrypted!);
    } catch {
      throw errors.unprocessable(
        'VOUCHER_CODE_DECRYPTION_FAILED',
        `Kode ${maskCode(voucher.codeLast4)} tidak dapat dibuka. Pastikan kunci enkripsi voucher tidak berubah.`,
      );
    }
    const location = voucher.allowedLocation
      ? `${voucher.allowedLocation.displayName} - ${voucher.allowedLocation.city}`
      : 'Semua lokasi aktif';
    return [
      code,
      voucher.campaign.code,
      voucher.campaign.title,
      voucher.campaign.description,
      voucher.campaign.basicSessions,
      voucher.campaign.boosterSessions,
      voucher.recipientNameSnapshot,
      voucher.nikLast4 ? `************${voucher.nikLast4}` : '',
      voucher.status,
      location,
      voucher.claimDeadline,
      voucher.issuedAt,
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
  const campaignLabel = input.campaignId
    ? vouchers[0]?.campaign.code.toLowerCase() || 'campaign'
    : 'semua-campaign';
  const filename = `voucher-codes-${campaignLabel}-${new Date().toISOString().slice(0, 10)}.csv`;

  await logAudit({
    userId: actorId,
    action: 'EXPORT',
    module: 'VOUCHER',
    resource: 'CampaignVoucher',
    resourceId: input.campaignId || 'ALL',
    description: `Super Admin mengekspor ${vouchers.length} kode voucher untuk kebutuhan pencetakan.`,
    meta: { campaignId: input.campaignId ?? null, status: input.status ?? null, exportedCount: vouchers.length },
  });
  return { filename, csv, total: vouchers.length };
}

async function assertClaimLocation(userId: string, role: Role, locationId: string) {
  const allowed = await getAllowedLocations(userId, role);
  const location = allowed.find((item) => item.id === locationId);
  if (!location) throw errors.forbidden('Lokasi klaim tidak termasuk assignment aktif akun ini.');
  return location;
}

async function recordFailedAttempt(operatorId: string, locationId: string, requestId: string, failureCode: string, voucherId?: string) {
  await prisma.voucherClaimAttempt.upsert({
    where: { operatorId_requestId: { operatorId, requestId } },
    update: {},
    create: { operatorId, locationId, requestId, voucherId, result: VoucherClaimAttemptResult.FAILURE, failureCode },
  }).catch(() => void 0);
}

export async function claimVoucher(actorId: string, actorRole: Role, input: ClaimVoucherInput) {
  const birthDate = parseDateOnly(input.dateOfBirth, 'Tanggal lahir');
  if (birthDate > new Date()) {
    throw errors.badRequest('VOUCHER_INVALID_DATE', 'Tanggal lahir tidak boleh di masa depan.');
  }

  const location = await assertClaimLocation(actorId, actorRole, input.locationId);
  const recentFailures = await prisma.voucherClaimAttempt.count({
    where: {
      operatorId: actorId,
      result: VoucherClaimAttemptResult.FAILURE,
      failureCode: { in: CLAIM_RATE_LIMIT_FAILURE_CODES },
      attemptedAt: { gte: new Date(Date.now() - CLAIM_WINDOW_MS) },
    },
  });
  if (recentFailures >= MAX_FAILED_ATTEMPTS) {
    throw new AppError(429, 'VOUCHER_CLAIM_RATE_LIMITED', 'Terlalu banyak percobaan gagal. Coba lagi setelah 15 menit.');
  }

  const replay = await prisma.voucherClaimAttempt.findUnique({
    where: { operatorId_requestId: { operatorId: actorId, requestId: input.requestId } },
    include: {
      voucher: {
        include: {
          campaign: { select: { code: true, title: true, basicSessions: true, boosterSessions: true } },
          allowedLocation: { select: { id: true, displayName: true, city: true } },
          claimedLocation: { select: { id: true, displayName: true, city: true } },
        },
      },
    },
  });
  if (replay?.result === VoucherClaimAttemptResult.SUCCESS && replay.voucher) {
    return { ...presentVoucher(replay.voucher), idempotentReplay: true };
  }
  if (replay) throw errors.conflict('VOUCHER_REQUEST_ALREADY_USED', 'Request ID ini sudah pernah digunakan untuk klaim yang gagal.');

  const hashedCode = codeHash(input.code);
  const initial = await prisma.campaignVoucher.findUnique({ where: { codeHash: hashedCode } });
  if (!initial) {
    await recordFailedAttempt(actorId, location.id, input.requestId, 'VOUCHER_NOT_FOUND');
    throw errors.notFound('Voucher tidak ditemukan atau identitas tidak sesuai.');
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`VOUCHER_CLAIM:${initial.id}`}))`;
      const voucher = await tx.campaignVoucher.findUnique({
        where: { id: initial.id },
        include: {
          campaign: true,
          recipientMember: { include: { user: { include: { profile: true } } } },
        },
      });
      if (!voucher) throw errors.notFound('Voucher tidak ditemukan atau identitas tidak sesuai.');
      if (voucher.status === CampaignVoucherStatus.CLAIMED) throw errors.conflict('VOUCHER_ALREADY_CLAIMED', 'Voucher sudah pernah diklaim.');
      if (voucher.status === CampaignVoucherStatus.CANCELLED) throw errors.conflict('VOUCHER_CANCELLED', 'Voucher telah dibatalkan.');
      const isFirstUseActivation = voucher.status === CampaignVoucherStatus.AVAILABLE;
      if (!isFirstUseActivation && voucher.status !== CampaignVoucherStatus.ISSUED) {
        throw errors.conflict('VOUCHER_NOT_ISSUED', 'Voucher belum dapat diklaim.');
      }
      const now = new Date();
      if (voucher.campaign.claimStartAt && voucher.campaign.claimStartAt > now) {
        throw errors.conflict('VOUCHER_NOT_ISSUED', 'Periode klaim voucher belum dimulai.');
      }
      const deadline = voucher.claimDeadline ?? voucher.campaign.claimEndAt;
      if (deadline && deadline < now) throw errors.conflict('VOUCHER_EXPIRED', 'Masa klaim voucher telah berakhir.');
      if (voucher.allowedLocationId && voucher.allowedLocationId !== location.id) {
        throw errors.forbidden('Voucher tidak berlaku di lokasi ini.');
      }

      const submittedNikHash = hashVoucherIdentity(input.nik);
      const registeredName = isFirstUseActivation
        ? input.recipientName.trim().replace(/\s+/g, ' ')
        : voucher.recipientNameSnapshot;
      const registeredNikHash = voucher.recipientNikHash
        ?? (voucher.recipientMember?.nik ? hashVoucherIdentity(voucher.recipientMember.nik) : null);
      const registeredDateOfBirth = voucher.recipientDateOfBirth ?? voucher.recipientMember?.dateOfBirth ?? null;
      if (!isFirstUseActivation && (
        !registeredName ||
        normalizeName(registeredName) !== normalizeName(input.recipientName) ||
        registeredNikHash !== submittedNikHash ||
        !sameDate(registeredDateOfBirth, input.dateOfBirth)
      )) {
        throw errors.unprocessable('VOUCHER_IDENTITY_MISMATCH', 'Voucher tidak ditemukan atau identitas tidak sesuai.');
      }

      const claimed = await tx.campaignVoucher.update({
        where: { id: voucher.id },
        data: {
          ...(isFirstUseActivation
            ? {
                recipientNameSnapshot: registeredName,
                recipientNikHash: submittedNikHash,
                recipientDateOfBirth: birthDate,
                nikLast4: input.nik.slice(-4),
                issuedAt: now,
              }
            : {
                recipientNikHash: registeredNikHash,
                recipientDateOfBirth: registeredDateOfBirth,
              }),
          status: CampaignVoucherStatus.CLAIMED,
          claimedAt: now,
          claimedLocationId: location.id,
          claimedBy: actorId,
          updatedBy: actorId,
        },
        include: {
          campaign: { select: { code: true, title: true, basicSessions: true, boosterSessions: true } },
          allowedLocation: { select: { id: true, displayName: true, city: true } },
          claimedLocation: { select: { id: true, displayName: true, city: true } },
        },
      });
      await tx.voucherCampaign.update({
        where: { id: voucher.campaignId },
        data: {
          ...(isFirstUseActivation ? { issuedCount: { increment: 1 } } : {}),
          claimedCount: { increment: 1 },
          updatedBy: actorId,
        },
      });
      await tx.voucherClaimAttempt.create({
        data: { voucherId: voucher.id, operatorId: actorId, locationId: location.id, result: VoucherClaimAttemptResult.SUCCESS, requestId: input.requestId },
      });
      return claimed;
    });

    await logAudit({
      userId: actorId,
      action: AuditAction.UPDATE,
      module: 'VOUCHER',
      resource: 'CampaignVoucher',
      resourceId: result.id,
      entityCode: maskCode(result.codeLast4),
      meta: { result: 'CLAIMED', locationId: location.id, fulfillmentMode: 'STANDALONE' },
    });
    return { ...presentVoucher(result), idempotentReplay: false };
  } catch (error) {
    const failureCode = error instanceof AppError ? error.code : 'VOUCHER_CLAIM_FAILED';
    await recordFailedAttempt(actorId, location.id, input.requestId, failureCode, initial.id);
    throw error;
  }
}

export async function createVoucherOperator(actorId: string, actorRole: Role, input: CreateVoucherOperatorInput) {
  assertSuperAdmin(actorRole);
  const locationIds = [...new Set(input.locationIds)];
  const locations = await prisma.voucherClaimLocation.findMany({ where: { id: { in: locationIds }, isActive: true } });
  if (locations.length !== locationIds.length) throw errors.badRequest('VOUCHER_LOCATION_NOT_FOUND', 'Satu atau beberapa lokasi tidak aktif.');
  if (await prisma.user.findUnique({ where: { email: input.username } })) {
    throw errors.conflict('VOUCHER_OPERATOR_USERNAME_DUPLICATE', 'Username sudah digunakan.');
  }
  const validUntil = input.validUntil ? parseDateOnly(input.validUntil, 'Batas akses') : null;
  const hashedPassword = await bcrypt.hash(input.password, HASH_ROUNDS);
  const operator = await prisma.user.create({
    data: {
      email: input.username,
      password: hashedPassword,
      role: Role.VOUCHER_OPERATOR,
      profile: { create: { fullName: input.fullName } },
      voucherOperatorLocations: {
        create: locationIds.map((locationId) => ({ locationId, assignedBy: actorId, validUntil })),
      },
    },
    select: {
      id: true,
      email: true,
      isActive: true,
      profile: { select: { fullName: true } },
      voucherOperatorLocations: { include: { location: true } },
    },
  });
  await logAudit({ userId: actorId, action: AuditAction.CREATE, module: 'VOUCHER', resource: 'VoucherOperator', resourceId: operator.id, meta: { username: operator.email, locationIds } });
  return operator;
}

export async function updateVoucherOperator(actorId: string, actorRole: Role, operatorId: string, input: UpdateVoucherOperatorInput) {
  assertSuperAdmin(actorRole);
  const existing = await prisma.user.findFirst({ where: { id: operatorId, role: Role.VOUCHER_OPERATOR } });
  if (!existing) throw errors.notFound('Akun Pengelola Voucher tidak ditemukan.');
  const locationIds = input.locationIds ? [...new Set(input.locationIds)] : null;
  if (locationIds) {
    const count = await prisma.voucherClaimLocation.count({ where: { id: { in: locationIds }, isActive: true } });
    if (count !== locationIds.length) throw errors.badRequest('VOUCHER_LOCATION_NOT_FOUND', 'Satu atau beberapa lokasi tidak aktif.');
  }
  const password = input.password ? await bcrypt.hash(input.password, HASH_ROUNDS) : undefined;
  const validUntil = input.validUntil === undefined ? undefined : input.validUntil ? parseDateOnly(input.validUntil, 'Batas akses') : null;
  const operator = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: operatorId }, data: { isActive: input.isActive, password } });
    if (locationIds) {
      await tx.voucherOperatorLocation.deleteMany({ where: { userId: operatorId } });
      await tx.voucherOperatorLocation.createMany({ data: locationIds.map((locationId) => ({ userId: operatorId, locationId, assignedBy: actorId, validUntil: validUntil ?? null })) });
    } else if (validUntil !== undefined) {
      await tx.voucherOperatorLocation.updateMany({ where: { userId: operatorId }, data: { validUntil } });
    }
    return tx.user.findUnique({
      where: { id: operatorId },
      select: { id: true, email: true, isActive: true, profile: { select: { fullName: true } }, voucherOperatorLocations: { include: { location: true } } },
    });
  });
  await logAudit({ userId: actorId, action: AuditAction.UPDATE, module: 'VOUCHER', resource: 'VoucherOperator', resourceId: operatorId, meta: { isActive: input.isActive, locationIds, passwordReset: Boolean(input.password) } });
  return operator;
}
