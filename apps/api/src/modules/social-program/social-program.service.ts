import { randomUUID } from 'crypto';
import {
  ApprovalDecisionType,
  PackageType,
  Prisma,
  SocialProgramStatus,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import {
  assertBranchAccess,
  assertPermission,
  getAccessibleBranchIds,
} from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import {
  decideApprovalInTransaction,
  startApprovalInTransaction,
} from '@modules/workflow/approval.service';
import {
  PackageAssignmentService,
  SOCIAL_PROGRAM_PRODUCT_CODE,
} from '@modules/packages/services/package-assignment.service';
import { logAudit } from '@utils/auditLog';
import type {
  CreateSocialProgramInput,
  ListSocialProgramsInput,
  SocialProgramDecisionInput,
} from './social-program.schema';

export const SOCIAL_BASIC_LIST_PRICE = 2_000_000;
export const SOCIAL_BASIC_PRICE = 500_000;
export const SOCIAL_BOOSTER_LIST_PRICE = 1_000_000;

const packageAssignmentService = new PackageAssignmentService();
const detailInclude = {
  member: { include: { user: { include: { profile: true } } } },
  branch: { select: { id: true, branchCode: true, name: true } },
  requester: { select: { id: true, email: true, profile: true } },
  approvalInstance: {
    include: {
      rule: { include: { steps: { orderBy: { stepNo: 'asc' as const } } } },
      decisions: { orderBy: { decidedAt: 'asc' as const } },
      auditLogs: { orderBy: { createdAt: 'asc' as const } },
    },
  },
  memberPackages: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.SocialProgramRequestInclude;

function money(value: Prisma.Decimal | number) {
  return Number(value);
}

export function calculateSocialProgramTotals(row: {
  basicSessions: number;
  basicListUnitPrice: Prisma.Decimal;
  basicSocialUnitPrice: Prisma.Decimal;
  freeBoosterSessions: number;
  boosterListUnitPrice: Prisma.Decimal;
}) {
  const basicListTotal = money(row.basicListUnitPrice) * row.basicSessions;
  const payableTotal = money(row.basicSocialUnitPrice) * row.basicSessions;
  const boosterSubsidy = money(row.boosterListUnitPrice) * row.freeBoosterSessions;
  return {
    basicListTotal,
    payableTotal,
    basicSubsidy: basicListTotal - payableTotal,
    boosterSubsidy,
    totalSubsidy: basicListTotal - payableTotal + boosterSubsidy,
  };
}

function present<T extends {
  basicSessions: number;
  basicListUnitPrice: Prisma.Decimal;
  basicSocialUnitPrice: Prisma.Decimal;
  freeBoosterSessions: number;
  boosterListUnitPrice: Prisma.Decimal;
}>(row: T) {
  return { ...row, totals: calculateSocialProgramTotals(row) };
}

async function load(id: string) {
  const row = await prisma.socialProgramRequest.findUnique({ where: { id }, include: detailInclude });
  if (!row) throw errors.notFound('Pengajuan Program Sosial tidak ditemukan.');
  return row;
}

export async function createSocialProgram(actorUserId: string, input: CreateSocialProgramInput) {
  await assertBranchAccess(actorUserId, input.branchId);
  await assertPermission(actorUserId, PERMISSIONS.SOCIAL_PROGRAM_CREATE, input.branchId);

  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    include: { branchAccesses: true },
  });
  if (!member) throw errors.notFound('Member tidak ditemukan.');
  if (member.registrationBranchId !== input.branchId && !member.branchAccesses.some((row) => row.branchId === input.branchId)) {
    throw errors.forbidden('Member tidak dapat diakses dari cabang ini.');
  }

  const pending = await prisma.socialProgramRequest.findFirst({
    where: {
      memberId: input.memberId,
      status: { in: [SocialProgramStatus.PENDING_APPROVAL, SocialProgramStatus.APPROVED, SocialProgramStatus.ACTIVATION_FAILED] },
    },
    select: { requestNumber: true },
  });
  if (pending) {
    throw errors.conflict('SOCIAL_PROGRAM_PENDING_EXISTS', `Selesaikan pengajuan ${pending.requestNumber} terlebih dahulu.`);
  }

  const normalized = {
    ...input,
    boosterType: input.freeBooster ? input.boosterType : undefined,
    freeBoosterSessions: input.freeBooster ? input.freeBoosterSessions : 0,
  };
  const requestNumber = `SOC-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const calculation = {
    basicSessions: normalized.basicSessions,
    basicListUnitPrice: new Prisma.Decimal(SOCIAL_BASIC_LIST_PRICE),
    basicSocialUnitPrice: new Prisma.Decimal(SOCIAL_BASIC_PRICE),
    freeBoosterSessions: normalized.freeBoosterSessions,
    boosterListUnitPrice: new Prisma.Decimal(SOCIAL_BOOSTER_LIST_PRICE),
  };
  const subsidy = calculateSocialProgramTotals(calculation).totalSubsidy;

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.socialProgramRequest.create({
      data: {
        requestNumber,
        memberId: input.memberId,
        branchId: input.branchId,
        requestedBy: actorUserId,
        basicSessions: normalized.basicSessions,
        basicListUnitPrice: SOCIAL_BASIC_LIST_PRICE,
        basicSocialUnitPrice: SOCIAL_BASIC_PRICE,
        freeBooster: normalized.freeBooster,
        boosterType: normalized.boosterType,
        freeBoosterSessions: normalized.freeBoosterSessions,
        boosterListUnitPrice: SOCIAL_BOOSTER_LIST_PRICE,
        reason: normalized.reason,
      },
    });
    const approval = await startApprovalInTransaction({
      module: 'SOCIAL_PROGRAM',
      entityType: 'SocialProgramRequest',
      entityId: request.id,
      entityNumber: request.requestNumber,
      branchId: request.branchId,
      makerUserId: actorUserId,
      amount: subsidy,
      category: normalized.boosterType || 'BASIC_ONLY',
      transactionType: 'SOCIAL_TREATMENT',
      payload: {
        memberId: request.memberId,
        basicSessions: request.basicSessions,
        basicListUnitPrice: SOCIAL_BASIC_LIST_PRICE,
        basicSocialUnitPrice: SOCIAL_BASIC_PRICE,
        boosterType: request.boosterType,
        freeBoosterSessions: request.freeBoosterSessions,
        totalSubsidy: subsidy,
        reason: request.reason,
      },
    }, tx);
    await tx.socialProgramRequest.update({
      where: { id: request.id },
      data: { approvalInstanceId: approval.instance.id },
    });
    return request;
  });

  await logAudit({
    userId: actorUserId,
    branchId: input.branchId,
    action: 'CREATE',
    resource: 'SocialProgramRequest',
    resourceId: created.id,
    entityCode: created.requestNumber,
    afterData: { status: created.status, totalSubsidy: subsidy, productCode: SOCIAL_PROGRAM_PRODUCT_CODE },
  });
  return getSocialProgram(actorUserId, created.id);
}

export async function getSocialProgram(actorUserId: string, id: string) {
  const row = await load(id);
  await assertBranchAccess(actorUserId, row.branchId);
  await assertPermission(actorUserId, PERMISSIONS.SOCIAL_PROGRAM_READ, row.branchId);
  return present(row);
}

export async function listSocialPrograms(actorUserId: string, query: ListSocialProgramsInput) {
  await assertPermission(actorUserId, PERMISSIONS.SOCIAL_PROGRAM_READ, query.branchId);
  if (query.branchId) await assertBranchAccess(actorUserId, query.branchId);
  const accessible = await getAccessibleBranchIds(actorUserId);
  const rows = await prisma.socialProgramRequest.findMany({
    where: {
      ...(query.branchId ? { branchId: query.branchId } : accessible === null ? {} : { branchId: { in: accessible } }),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    include: detailInclude,
    orderBy: { submittedAt: 'desc' },
  });
  return rows.map(present);
}

async function claimActivation(id: string) {
  const token = `ACTIVATING:${new Date().toISOString()}:${randomUUID()}`;
  const claimed = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    UPDATE "social_program_requests"
    SET "activationError" = ${token}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
      AND "status" IN ('APPROVED'::"SocialProgramStatus", 'ACTIVATION_FAILED'::"SocialProgramStatus")
      AND (
        "activationError" IS NULL
        OR "activationError" NOT LIKE 'ACTIVATING:%'
        OR "updatedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
      )
    RETURNING "id"
  `);
  return claimed.length === 1;
}

async function activateApprovedSocialProgram(id: string, actorUserId: string) {
  const existingPackages = await prisma.memberPackage.findMany({ where: { socialProgramRequestId: id } });
  if (existingPackages.length > 0) {
    const purchaseGroupId = existingPackages.find((pkg) => pkg.purchaseGroupId)?.purchaseGroupId || existingPackages[0].id;
    await prisma.socialProgramRequest.update({
      where: { id },
      data: { status: SocialProgramStatus.ACTIVE, purchaseGroupId, activatedAt: new Date(), activationError: null },
    });
    return { activated: true, idempotentReplay: true };
  }
  if (!await claimActivation(id)) return { activated: false, inProgress: true };

  const request = await load(id);
  try {
    const socialPricing = await prisma.packagePricing.findFirst({
      where: { branchId: request.branchId, productCode: SOCIAL_PROGRAM_PRODUCT_CODE, packageType: PackageType.BASIC, isActive: true },
    });
    if (!socialPricing) throw errors.unprocessable('SOCIAL_PROGRAM_PRICING_MISSING', `Master harga ${SOCIAL_PROGRAM_PRODUCT_CODE} belum tersedia di cabang.`);

    const boosterPricing = request.freeBooster
      ? await prisma.packagePricing.findFirst({
          where: {
            branchId: request.branchId,
            packageType: PackageType.BOOSTER,
            boosterType: request.boosterType as never,
            serviceType: 'PM',
            isActive: true,
          },
        })
      : null;
    if (request.freeBooster && !boosterPricing) {
      throw errors.unprocessable('SOCIAL_PROGRAM_BOOSTER_PRICING_MISSING', `Master Booster ${request.boosterType} Premier belum tersedia.`);
    }

    const packages = [
      { pricingId: socialPricing.id, quantity: request.basicSessions, serviceType: 'PS' as const },
      ...(boosterPricing ? [{
        pricingId: boosterPricing.id,
        quantity: request.freeBoosterSessions,
        boosterType: request.boosterType as 'NO' | 'GT' | 'MB' | 'KCL' | 'H2S' | 'HK' | 'O3',
        serviceType: 'PM' as const,
      }] : []),
    ];
    const priceOverrides = {
      [socialPricing.id]: {
        listPrice: SOCIAL_BASIC_LIST_PRICE,
        finalPrice: SOCIAL_BASIC_PRICE,
        discountNote: `Subsidi Program Sosial ${request.requestNumber}`,
      },
      ...(boosterPricing ? {
        [boosterPricing.id]: {
          listPrice: SOCIAL_BOOSTER_LIST_PRICE,
          finalPrice: 0,
          discountNote: `Booster gratis Program Sosial ${request.requestNumber}`,
        },
      } : {}),
    };
    const assigned = await packageAssignmentService.assignPackage(
      request.memberId,
      {
        packages,
        addOns: [],
        notes: `Program Sosial ${request.requestNumber}. ${request.reason}`,
        paymentPlan: { type: 'FULL_PAYMENT' },
      },
      request.branchId,
      actorUserId,
      { requestId: request.id, priceOverrides },
    );

    const purchaseGroupId = assigned.purchaseGroupId || assigned.packages[0]?.id;
    await prisma.socialProgramRequest.update({
      where: { id: request.id },
      data: {
        status: SocialProgramStatus.ACTIVE,
        purchaseGroupId,
        activatedAt: new Date(),
        activationError: null,
      },
    });
    return { activated: true, idempotentReplay: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : (error as { message?: string })?.message || 'Aktivasi paket gagal.';
    await prisma.socialProgramRequest.update({
      where: { id },
      data: { status: SocialProgramStatus.ACTIVATION_FAILED, activationError: message.slice(0, 500) },
    });
    return { activated: false, error: message };
  }
}

export async function decideSocialProgram(actorUserId: string, id: string, input: SocialProgramDecisionInput) {
  const current = await load(id);
  if (current.status !== SocialProgramStatus.PENDING_APPROVAL || !current.approvalInstanceId) {
    throw errors.conflict('SOCIAL_PROGRAM_NOT_PENDING', 'Program Sosial tidak sedang menunggu approval.');
  }
  const decision = await prisma.$transaction(async (tx) => {
    const result = await decideApprovalInTransaction({
      instanceId: current.approvalInstanceId!,
      actorUserId,
      decision: input.decision as ApprovalDecisionType,
      note: input.note,
    }, tx);
    if (result.isFinal) {
      await tx.socialProgramRequest.update({
        where: { id },
        data: result.approved
          ? { status: SocialProgramStatus.APPROVED, approvedAt: new Date(), activationError: null }
          : { status: SocialProgramStatus.REJECTED },
      });
    }
    return result;
  });

  const activation = decision.approved
    ? await activateApprovedSocialProgram(id, actorUserId)
    : undefined;
  await logAudit({
    userId: actorUserId,
    branchId: current.branchId,
    action: 'STATUS_CHANGE',
    resource: 'SocialProgramRequest',
    resourceId: id,
    entityCode: current.requestNumber,
    beforeData: { status: current.status },
    afterData: { decision: input.decision, final: decision.isFinal, activation },
  });
  return { request: await getSocialProgram(actorUserId, id), activation };
}

export async function retrySocialProgramActivation(actorUserId: string, id: string) {
  const current = await load(id);
  await assertBranchAccess(actorUserId, current.branchId);
  await assertPermission(actorUserId, PERMISSIONS.SOCIAL_PROGRAM_FINANCE_APPROVE, current.branchId);
  if (current.status !== SocialProgramStatus.APPROVED && current.status !== SocialProgramStatus.ACTIVATION_FAILED) {
    throw errors.conflict('SOCIAL_PROGRAM_ACTIVATION_STATUS_INVALID', 'Hanya pengajuan approved/gagal aktivasi yang dapat dicoba ulang.');
  }
  const activation = await activateApprovedSocialProgram(id, actorUserId);
  return { request: await getSocialProgram(actorUserId, id), activation };
}
