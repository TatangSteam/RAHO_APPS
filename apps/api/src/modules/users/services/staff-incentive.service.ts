import {
  AddOnType,
  BranchType,
  HomecareTeamIncentiveType,
  HomecareTeamMemberRole,
  InvoiceStatus,
  PackageStatus,
  PaymentVerificationStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { getAccessibleBranchIds } from '@modules/iam/authorization.service';

export const NAKES_RATE_PER_INFUSION = 10_000;
export const NAKES_MONTHLY_TARGET = 100;
export const NAKES_TARGET_BONUS = 2_000_000;
export const MSO_MONTHLY_VISIT_TARGET = 100;
export const MSO_MINIMUM_PAID_AIR_NANO_BOXES = 5;
export const MSO_VISIT_BONUS = 2_000_000;
export const MSO_RATE_PER_PAID_AIR_NANO_BOX = 90_000;
export const CHS_RATE_PER_ELIGIBLE_PAID_INFUSION = 1_000;
export const CHS_RATE_PER_PERSONAL_INFUSION = 10_000;
export const CHS_PERSONAL_TARGET = 100;
export const CHS_PERSONAL_TARGET_BONUS = 2_000_000;
export const CHS_HOMECARE_TEAM_TARGET = 100;
export const CHS_BRANCH_WITHOUT_HOMECARE_TARGET = 200;
export const CHS_BRANCH_WITH_HOMECARE_TARGET = 300;
export const CHS_HOMECARE_TEAM_TARGET_BONUS = 500_000;
export const CHS_BRANCH_TARGET_BONUS = 250_000;
export const CHS_HO_RATE_PER_PAID_INFUSION = 10_000;
export const DOCTOR_HEAD_HOMECARE_TEAM_TARGET_BONUS = 500_000;
export const DOCTOR_HEAD_BRANCH_TARGET_BONUS = 500_000;
export const DOCTOR_HEAD_HOMECARE_DOCTOR_RATE = 5_000;
export const DOCTOR_HEAD_PARTNERSHIP_TARGET = 1_500;
export const DOCTOR_HEAD_PARTNERSHIP_RATE = 2_000;

const INCENTIVE_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.DOCTOR,
  Role.NURSE,
  Role.FINANCE_LOGISTICS_CONTROLLER,
]);

export function calculateNakesMonthlyIncentive(infusionCount: number) {
  const safeCount = Math.max(0, Math.trunc(infusionCount));
  const baseAmount = safeCount * NAKES_RATE_PER_INFUSION;
  const targetReached = safeCount >= NAKES_MONTHLY_TARGET;
  const targetBonus = targetReached ? NAKES_TARGET_BONUS : 0;

  return {
    infusionCount: safeCount,
    ratePerInfusion: NAKES_RATE_PER_INFUSION,
    baseAmount,
    target: NAKES_MONTHLY_TARGET,
    targetReached,
    targetBonus,
    totalAmount: baseAmount + targetBonus,
  };
}

export function calculateMsoMonthlyIncentive(visitCount: number, paidAirNanoBoxes: number) {
  const safeVisits = Math.max(0, Math.trunc(visitCount));
  const safeBoxes = Math.max(0, Math.trunc(paidAirNanoBoxes));
  const visitTargetReached = safeVisits >= MSO_MONTHLY_VISIT_TARGET;
  const airNanoRequirementReached = safeBoxes >= MSO_MINIMUM_PAID_AIR_NANO_BOXES;
  const visitBonusEligible = visitTargetReached && airNanoRequirementReached;
  const visitBonus = visitBonusEligible ? MSO_VISIT_BONUS : 0;
  const airNanoAmount = safeBoxes * MSO_RATE_PER_PAID_AIR_NANO_BOX;

  return {
    visitCount: safeVisits,
    visitTarget: MSO_MONTHLY_VISIT_TARGET,
    visitTargetReached,
    paidAirNanoBoxes: safeBoxes,
    minimumPaidAirNanoBoxes: MSO_MINIMUM_PAID_AIR_NANO_BOXES,
    airNanoRequirementReached,
    visitBonusEligible,
    visitBonus,
    ratePerPaidAirNanoBox: MSO_RATE_PER_PAID_AIR_NANO_BOX,
    airNanoAmount,
    totalAmount: visitBonus + airNanoAmount,
  };
}

export function calculateChsCoordinatorMonthlyIncentive(
  eligiblePaidInfusions: number,
  personalInfusions: number,
  components: {
    qualifiedHomecareTeams?: number;
    qualifiedBranches?: number;
    hoPaidInfusions?: number;
  } = {},
) {
  const safePaidInfusions = Math.max(0, Math.trunc(eligiblePaidInfusions));
  const safePersonalInfusions = Math.max(0, Math.trunc(personalInfusions));
  const paidInfusionAmount = safePaidInfusions * CHS_RATE_PER_ELIGIBLE_PAID_INFUSION;
  const personalInfusionAmount = safePersonalInfusions * CHS_RATE_PER_PERSONAL_INFUSION;
  const personalTargetReached = safePersonalInfusions >= CHS_PERSONAL_TARGET;
  const personalTargetBonus = personalTargetReached ? CHS_PERSONAL_TARGET_BONUS : 0;
  const qualifiedHomecareTeams = Math.max(0, Math.trunc(components.qualifiedHomecareTeams || 0));
  const qualifiedBranches = Math.max(0, Math.trunc(components.qualifiedBranches || 0));
  const hoPaidInfusions = Math.max(0, Math.trunc(components.hoPaidInfusions || 0));
  const homecareTeamTargetBonus = qualifiedHomecareTeams * CHS_HOMECARE_TEAM_TARGET_BONUS;
  const branchTargetBonus = qualifiedBranches * CHS_BRANCH_TARGET_BONUS;
  const hoInfusionAmount = hoPaidInfusions * CHS_HO_RATE_PER_PAID_INFUSION;
  return {
    eligiblePaidInfusions: safePaidInfusions,
    ratePerEligiblePaidInfusion: CHS_RATE_PER_ELIGIBLE_PAID_INFUSION,
    paidInfusionAmount,
    personalInfusions: safePersonalInfusions,
    ratePerPersonalInfusion: CHS_RATE_PER_PERSONAL_INFUSION,
    personalInfusionAmount,
    personalTarget: CHS_PERSONAL_TARGET,
    personalTargetReached,
    personalTargetBonus,
    qualifiedHomecareTeams,
    homecareTeamTargetBonus,
    qualifiedBranches,
    branchTargetBonus,
    hoPaidInfusions,
    ratePerHoPaidInfusion: CHS_HO_RATE_PER_PAID_INFUSION,
    hoInfusionAmount,
    totalAmount: paidInfusionAmount + personalInfusionAmount + personalTargetBonus
      + homecareTeamTargetBonus + branchTargetBonus + hoInfusionAmount,
  };
}

export function calculateDoctorHeadMonthlyIncentive(components: {
  qualifiedHomecareTeams?: number;
  qualifiedBranches?: number;
  homecareDoctorPaidInfusions?: number;
  partnershipTotalInfusions?: number;
  partnershipPaidInfusions?: number;
  treatmentReviewAmount?: number;
}) {
  const qualifiedHomecareTeams = Math.max(0, Math.trunc(components.qualifiedHomecareTeams || 0));
  const qualifiedBranches = Math.max(0, Math.trunc(components.qualifiedBranches || 0));
  const homecareDoctorPaidInfusions = Math.max(0, Math.trunc(components.homecareDoctorPaidInfusions || 0));
  const partnershipTotalInfusions = Math.max(0, Math.trunc(components.partnershipTotalInfusions || 0));
  const partnershipPaidInfusions = Math.max(0, Math.trunc(components.partnershipPaidInfusions || 0));
  const treatmentReviewAmount = Math.max(0, Math.trunc(components.treatmentReviewAmount || 0));
  const homecareTeamTargetBonus = qualifiedHomecareTeams * DOCTOR_HEAD_HOMECARE_TEAM_TARGET_BONUS;
  const branchTargetBonus = qualifiedBranches * DOCTOR_HEAD_BRANCH_TARGET_BONUS;
  const homecareDoctorAmount = homecareDoctorPaidInfusions * DOCTOR_HEAD_HOMECARE_DOCTOR_RATE;
  const partnershipTargetReached = partnershipTotalInfusions >= DOCTOR_HEAD_PARTNERSHIP_TARGET;
  const partnershipAmount = partnershipTargetReached
    ? partnershipPaidInfusions * DOCTOR_HEAD_PARTNERSHIP_RATE
    : 0;
  return {
    qualifiedHomecareTeams,
    homecareTeamTargetBonus,
    qualifiedBranches,
    branchTargetBonus,
    homecareDoctorPaidInfusions,
    ratePerHomecareDoctorPaidInfusion: DOCTOR_HEAD_HOMECARE_DOCTOR_RATE,
    homecareDoctorAmount,
    partnershipTotalInfusions,
    partnershipTarget: DOCTOR_HEAD_PARTNERSHIP_TARGET,
    partnershipTargetReached,
    partnershipPaidInfusions,
    ratePerPartnershipPaidInfusion: DOCTOR_HEAD_PARTNERSHIP_RATE,
    partnershipAmount,
    treatmentReviewAmount,
    treatmentReviewStatus: 'PENDING_RULE_CONFIGURATION' as const,
    totalAmount: homecareTeamTargetBonus + branchTargetBonus + homecareDoctorAmount
      + partnershipAmount + treatmentReviewAmount,
  };
}

export function getChsQualifierTarget(scope: 'TEAM' | 'BRANCH', branchHasHomecare: boolean) {
  if (scope === 'TEAM') return CHS_HOMECARE_TEAM_TARGET;
  return branchHasHomecare ? CHS_BRANCH_WITH_HOMECARE_TARGET : CHS_BRANCH_WITHOUT_HOMECARE_TARGET;
}

function currentJakartaMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

export function getJakartaMonthRange(month = currentJakartaMonth()) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw errors.badRequest('INVALID_INCENTIVE_MONTH', 'Periode harus menggunakan format YYYY-MM.');

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    throw errors.badRequest('INVALID_INCENTIVE_MONTH', 'Bulan insentif tidak valid.');
  }

  // Jakarta is UTC+7 and does not observe daylight-saving time.
  const start = new Date(Date.UTC(year, monthIndex, 1, -7));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, -7));
  return { month, start, end };
}

export function isAirNanoBoxSale(productCode: string | null, notes: string | null) {
  const normalizedCode = productCode?.trim().toUpperCase() || '';
  return /^PRD-ANN-(?:KNG|BRU|HJU|H2S)-00[34]$/.test(normalizedCode)
    || /(?:^|-)DS$/.test(normalizedCode)
    || /\b(?:1\s*)?DUS\b/i.test(notes || '');
}

export function areAllPurchaseInvoicesPaid(invoices: Array<{
  status: InvoiceStatus;
  paymentVerificationStatus: PaymentVerificationStatus;
}>) {
  const activeInvoices = invoices.filter((invoice) => invoice.status !== InvoiceStatus.CANCELLED);
  return activeInvoices.length > 0 && activeInvoices.every((invoice) => (
    invoice.status === InvoiceStatus.PAID
    && invoice.paymentVerificationStatus === PaymentVerificationStatus.VERIFIED
  ));
}

export async function resolveBranchScope(
  callerRole: Role,
  callerUserId: string,
  callerBranchId: string | null,
  requestedBranchId?: string,
) {
  if (!INCENTIVE_ROLES.has(callerRole)) throw errors.forbidden('Anda tidak memiliki akses ke laporan insentif.');

  if (callerRole === Role.SUPER_ADMIN || callerRole === Role.FINANCE_LOGISTICS_CONTROLLER) {
    return requestedBranchId && requestedBranchId !== 'all' ? [requestedBranchId] : undefined;
  }

  if (callerRole === Role.ADMIN_MANAGER) {
    const assignments = await prisma.managerBranch.findMany({
      where: { userId: callerUserId },
      select: { branchId: true },
    });
    const branchIds = assignments.map((assignment) => assignment.branchId);
    if (requestedBranchId && requestedBranchId !== 'all') {
      if (!branchIds.includes(requestedBranchId)) throw errors.forbidden('Anda tidak memiliki akses ke cabang ini.');
      return [requestedBranchId];
    }
    return branchIds;
  }

  if (callerRole === Role.ADMIN_CABANG) {
    if (!callerBranchId) throw errors.badRequest('BRANCH_REQUIRED', 'Cabang akun belum ditentukan.');
    if (requestedBranchId && requestedBranchId !== callerBranchId) throw errors.forbidden('Anda tidak memiliki akses ke cabang ini.');
    return [callerBranchId];
  }

  const accessibleBranchIds = await getAccessibleBranchIds(callerUserId);
  if (requestedBranchId && requestedBranchId !== 'all' && accessibleBranchIds !== null && !accessibleBranchIds.includes(requestedBranchId)) {
    throw errors.forbidden('Anda tidak memiliki akses ke cabang ini.');
  }
  return requestedBranchId && requestedBranchId !== 'all'
    ? [requestedBranchId]
    : accessibleBranchIds ?? (callerBranchId ? [callerBranchId] : undefined);
}

function branchWhere(branchIds?: string[]): Prisma.TreatmentSessionWhereInput {
  if (!branchIds) return {};
  if (branchIds.length === 0) return { branchId: { in: [] } };
  return { branchId: { in: branchIds } };
}

function jakartaDateKey(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function assignmentAppliesOn(
  treatmentDate: Date,
  effectiveFrom: Date,
  effectiveUntil: Date | null,
) {
  const date = jakartaDateKey(treatmentDate);
  const from = effectiveFrom.toISOString().slice(0, 10);
  const until = effectiveUntil?.toISOString().slice(0, 10);
  return date >= from && (!until || date <= until);
}

function membershipAppliesOn(treatmentDate: Date, joinedAt: Date, leftAt: Date | null) {
  const date = jakartaDateKey(treatmentDate);
  const from = jakartaDateKey(joinedAt);
  const until = leftAt ? jakartaDateKey(leftAt) : null;
  return date >= from && (!until || date <= until);
}

export function isEligiblePaidChsInfusion(input: {
  finalPrice: number;
  discountPercent: number | null;
  socialProgramRequestId: string | null;
  paymentPlanStatus: string | null;
  refundedAt: Date | null;
  invoices: Array<{ status: InvoiceStatus; paymentVerificationStatus: PaymentVerificationStatus }>;
}) {
  return isPaidInfusion(input)
    && (input.discountPercent ?? 0) <= 40;
}

export function isPaidInfusion(input: {
  finalPrice: number;
  socialProgramRequestId: string | null;
  paymentPlanStatus: string | null;
  refundedAt: Date | null;
  invoices: Array<{ status: InvoiceStatus; paymentVerificationStatus: PaymentVerificationStatus }>;
}) {
  return input.finalPrice > 0
    && input.socialProgramRequestId === null
    && input.paymentPlanStatus === 'PAID'
    && input.refundedAt === null
    && areAllPurchaseInvoicesPaid(input.invoices);
}

export async function getMonthlyStaffIncentivesService(
  query: { month?: string; branchId?: string },
  callerRole: Role,
  callerUserId: string,
  callerBranchId: string | null,
) {
  const period = getJakartaMonthRange(query.month);
  const branchIds = await resolveBranchScope(callerRole, callerUserId, callerBranchId, query.branchId);
  const selfOnly = callerRole === Role.NURSE || callerRole === Role.DOCTOR || callerRole === Role.ADMIN_LAYANAN;

  const sessionWhere: Prisma.TreatmentSessionWhereInput = {
    isCompleted: true,
    cancelledAt: null,
    treatmentDate: { gte: period.start, lt: period.end },
    ...branchWhere(branchIds),
  };
  const addOnWhere: Prisma.MemberAddOnWhereInput = {
    addOnType: AddOnType.AIR_NANO,
    status: PackageStatus.ACTIVE,
    verifiedAt: { not: null },
    paymentPlanStatus: 'PAID',
    transactionDate: { gte: period.start, lt: period.end },
    sellerMsoId: { not: null },
    ...(branchIds ? { branchId: { in: branchIds } } : {}),
    ...(selfOnly ? { sellerMsoId: callerUserId } : {}),
  };

  const [sessions, airNanoSales] = await Promise.all([
    prisma.treatmentSession.findMany({
      where: sessionWhere,
      select: {
        id: true,
        branchId: true,
        treatmentDate: true,
        nurseId: true,
        adminLayananId: true,
        revenuePackage: {
          select: {
            id: true,
            finalPrice: true,
            discountPercent: true,
            socialProgramRequestId: true,
            paymentPlanStatus: true,
            refundedAt: true,
          },
        },
      },
    }),
    prisma.memberAddOn.findMany({
      where: addOnWhere,
      select: { id: true, sellerMsoId: true, quantity: true, productCode: true, notes: true },
    }),
  ]);

  const revenuePackageIds = sessions.flatMap((session) => (
    session.revenuePackage ? [session.revenuePackage.id] : []
  ));
  const [
    invoiceItems,
    packageInvoiceItems,
    multiBagUsages,
    homecareTeams,
    coordinatorAssignments,
    doctorHeadAssignments,
    homecareDoctorMemberships,
  ] = await Promise.all([
    airNanoSales.length > 0
      ? prisma.invoiceItem.findMany({
        where: {
          itemType: 'ADDON',
          itemId: { in: airNanoSales.map((sale) => sale.id) },
        },
        select: {
          itemId: true,
          invoice: {
            select: { status: true, paymentVerificationStatus: true },
          },
        },
      })
      : [],
    revenuePackageIds.length > 0
      ? prisma.invoiceItem.findMany({
          where: { itemType: 'PACKAGE', itemId: { in: revenuePackageIds } },
          select: {
            itemId: true,
            invoice: { select: { status: true, paymentVerificationStatus: true } },
          },
        })
      : [],
    sessions.length > 0
      ? prisma.homecareMultiBagUsage.findMany({
          where: { treatmentSessionId: { in: sessions.map((session) => session.id) }, status: 'COMPLETED' },
          select: { treatmentSessionId: true, teamId: true },
        })
      : [],
    prisma.homecareTeam.findMany({
      where: {
        isActive: true,
        createdAt: { lt: period.end },
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
      select: { id: true, name: true, branchId: true, incentiveType: true },
    }),
    prisma.chsCoordinatorAssignment.findMany({
      where: {
        effectiveFrom: { lt: period.end },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: period.start } }],
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        ...(selfOnly ? { coordinatorUserId: callerUserId } : {}),
      },
      select: {
        id: true,
        scope: true,
        coordinatorUserId: true,
        branchId: true,
        homecareTeamId: true,
        effectiveFrom: true,
        effectiveUntil: true,
        coordinator: {
          select: {
            id: true,
            email: true,
            staffCode: true,
            role: true,
            profile: { select: { fullName: true } },
          },
        },
        branch: { select: { name: true } },
        homecareTeam: { select: { name: true, incentiveType: true } },
      },
    }),
    prisma.doctorHeadAssignment.findMany({
      where: {
        effectiveFrom: { lt: period.end },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: period.start } }],
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        ...(selfOnly ? { doctorHeadUserId: callerUserId } : {}),
      },
      select: {
        id: true,
        doctorHeadUserId: true,
        branchId: true,
        effectiveFrom: true,
        effectiveUntil: true,
        doctorHead: {
          select: {
            id: true,
            email: true,
            staffCode: true,
            role: true,
            profile: { select: { fullName: true } },
          },
        },
        branch: { select: { name: true, type: true } },
      },
    }),
    prisma.homecareTeamMember.findMany({
      where: {
        role: HomecareTeamMemberRole.DOCTOR,
        joinedAt: { lt: period.end },
        OR: [{ leftAt: null }, { leftAt: { gte: period.start } }],
        ...(branchIds ? { team: { branchId: { in: branchIds } } } : {}),
      },
      select: { userId: true, teamId: true, joinedAt: true, leftAt: true },
    }),
  ]);
  const invoicesByAddOn = new Map<string, Array<{
    status: InvoiceStatus;
    paymentVerificationStatus: PaymentVerificationStatus;
  }>>();
  invoiceItems.forEach((item) => {
    const invoices = invoicesByAddOn.get(item.itemId) || [];
    invoices.push(item.invoice);
    invoicesByAddOn.set(item.itemId, invoices);
  });
  const invoicesByPackage = new Map<string, Array<{
    status: InvoiceStatus;
    paymentVerificationStatus: PaymentVerificationStatus;
  }>>();
  packageInvoiceItems.forEach((item) => {
    const invoices = invoicesByPackage.get(item.itemId) || [];
    invoices.push(item.invoice);
    invoicesByPackage.set(item.itemId, invoices);
  });
  const teamBySession = new Map(multiBagUsages.map((usage) => (
    [usage.treatmentSessionId, usage.teamId] as const
  )));
  const branchesWithHomecare = new Set(homecareTeams
    .filter((team) => team.incentiveType === HomecareTeamIncentiveType.HOMECARE)
    .map((team) => team.branchId));

  const infusionCounts = new Map<string, number>();
  const visitCounts = new Map<string, number>();
  const paidBoxCounts = new Map<string, number>();

  sessions.forEach((session) => {
    infusionCounts.set(session.nurseId, (infusionCounts.get(session.nurseId) || 0) + 1);
    visitCounts.set(session.adminLayananId, (visitCounts.get(session.adminLayananId) || 0) + 1);
  });
  airNanoSales.forEach((sale) => {
    if (
      !sale.sellerMsoId
      || !isAirNanoBoxSale(sale.productCode, sale.notes)
      || !areAllPurchaseInvoicesPaid(invoicesByAddOn.get(sale.id) || [])
    ) return;
    paidBoxCounts.set(sale.sellerMsoId, (paidBoxCounts.get(sale.sellerMsoId) || 0) + sale.quantity);
  });

  const userIds = Array.from(new Set([
    ...infusionCounts.keys(),
    ...visitCounts.keys(),
    ...paidBoxCounts.keys(),
  ])).filter((userId) => !selfOnly || userId === callerUserId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      email: true,
      staffCode: true,
      role: true,
      profile: { select: { fullName: true } },
    },
  });
  const people = new Map(users.map((user) => [user.id, {
    id: user.id,
    fullName: user.profile?.fullName || user.email,
    email: user.email,
    staffCode: user.staffCode,
    role: user.role,
  }]));

  const nakes = Array.from(infusionCounts.entries())
    .filter(([userId]) => people.has(userId))
    .map(([userId, count]) => ({ ...people.get(userId)!, ...calculateNakesMonthlyIncentive(count) }))
    .sort((a, b) => b.totalAmount - a.totalAmount || a.fullName.localeCompare(b.fullName));
  const msoIds = new Set([...visitCounts.keys(), ...paidBoxCounts.keys()]);
  const mso = Array.from(msoIds)
    .filter((userId) => people.has(userId))
    .map((userId) => ({
      ...people.get(userId)!,
      ...calculateMsoMonthlyIncentive(visitCounts.get(userId) || 0, paidBoxCounts.get(userId) || 0),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount || a.fullName.localeCompare(b.fullName));

  const isEligiblePaidSession = (session: typeof sessions[number]) => {
    const pkg = session.revenuePackage;
    return Boolean(pkg && isEligiblePaidChsInfusion({
      finalPrice: Number(pkg!.finalPrice),
      discountPercent: pkg!.discountPercent === null ? null : Number(pkg!.discountPercent),
      socialProgramRequestId: pkg!.socialProgramRequestId,
      paymentPlanStatus: pkg!.paymentPlanStatus,
      refundedAt: pkg!.refundedAt,
      invoices: invoicesByPackage.get(pkg!.id) || [],
    }));
  };
  const isPaidSession = (session: typeof sessions[number]) => {
    const pkg = session.revenuePackage;
    return Boolean(pkg && isPaidInfusion({
      finalPrice: Number(pkg!.finalPrice),
      socialProgramRequestId: pkg!.socialProgramRequestId,
      paymentPlanStatus: pkg!.paymentPlanStatus,
      refundedAt: pkg!.refundedAt,
      invoices: invoicesByPackage.get(pkg!.id) || [],
    }));
  };
  const teamById = new Map(homecareTeams.map((team) => [team.id, team]));

  type CoordinatorAggregate = {
    id: string;
    fullName: string;
    email: string;
    staffCode: string | null;
    role: Role;
    eligibleSessionIds: Set<string>;
    personalSessionIds: Set<string>;
    hoPaidSessionIds: Set<string>;
    qualifiedHomecareTeamIds: Set<string>;
    qualifiedBranchIds: Set<string>;
    scopes: Array<{
      assignmentId: string;
      scope: string;
      scopeId: string;
      scopeName: string;
      branchId: string;
      branchName: string;
      qualifierTarget: number;
      totalInfusions: number;
      qualifierPassed: boolean;
      eligiblePaidInfusions: number;
      targetBonus: number;
      incentiveType: HomecareTeamIncentiveType | 'BRANCH';
    }>;
  };
  const coordinatorMap = new Map<string, CoordinatorAggregate>();

  coordinatorAssignments.forEach((assignment) => {
    const isTeamScope = assignment.scope === 'TEAM' && assignment.homecareTeamId;
    const scopeSessions = sessions.filter((session) => (
      assignmentAppliesOn(session.treatmentDate, assignment.effectiveFrom, assignment.effectiveUntil)
      && (isTeamScope
        ? teamBySession.get(session.id) === assignment.homecareTeamId
        : session.branchId === assignment.branchId)
    ));
    const teamType = isTeamScope
      ? assignment.homecareTeam?.incentiveType || HomecareTeamIncentiveType.HOMECARE
      : null;
    const isHoScope = teamType === HomecareTeamIncentiveType.HO;
    const qualifierTarget = isHoScope ? 0 : getChsQualifierTarget(
      isTeamScope ? 'TEAM' : 'BRANCH',
      branchesWithHomecare.has(assignment.branchId),
    );
    const qualifierPassed = isHoScope || scopeSessions.length >= qualifierTarget;
    const eligibleScopeSessions = scopeSessions.filter(isHoScope ? isPaidSession : isEligiblePaidSession);
    const existing = coordinatorMap.get(assignment.coordinatorUserId) || {
      id: assignment.coordinator.id,
      fullName: assignment.coordinator.profile?.fullName || assignment.coordinator.email,
      email: assignment.coordinator.email,
      staffCode: assignment.coordinator.staffCode,
      role: assignment.coordinator.role,
      eligibleSessionIds: new Set<string>(),
      personalSessionIds: new Set<string>(),
      hoPaidSessionIds: new Set<string>(),
      qualifiedHomecareTeamIds: new Set<string>(),
      qualifiedBranchIds: new Set<string>(),
      scopes: [],
    };

    if (isTeamScope) {
      if (isHoScope) {
        eligibleScopeSessions.forEach((session) => existing.hoPaidSessionIds.add(session.id));
      } else {
        eligibleScopeSessions.forEach((session) => existing.eligibleSessionIds.add(session.id));
        if (qualifierPassed) existing.qualifiedHomecareTeamIds.add(assignment.homecareTeamId!);
      }
    } else {
      eligibleScopeSessions.forEach((session) => {
        const team = teamById.get(teamBySession.get(session.id) || '');
        if (team?.incentiveType === HomecareTeamIncentiveType.HO) {
          existing.hoPaidSessionIds.add(session.id);
        } else {
          existing.eligibleSessionIds.add(session.id);
        }
      });
      if (qualifierPassed) existing.qualifiedBranchIds.add(assignment.branchId);
      homecareTeams
        .filter((team) => team.branchId === assignment.branchId && team.incentiveType === HomecareTeamIncentiveType.HOMECARE)
        .forEach((team) => {
          const teamTotal = scopeSessions.filter((session) => teamBySession.get(session.id) === team.id).length;
          if (teamTotal >= CHS_HOMECARE_TEAM_TARGET) existing.qualifiedHomecareTeamIds.add(team.id);
        });
    }
    scopeSessions
      .filter((session) => session.nurseId === assignment.coordinatorUserId)
      .forEach((session) => existing.personalSessionIds.add(session.id));
    existing.scopes.push({
      assignmentId: assignment.id,
      scope: isTeamScope ? 'TEAM' : 'BRANCH',
      scopeId: isTeamScope ? assignment.homecareTeamId! : assignment.branchId,
      scopeName: isTeamScope ? assignment.homecareTeam?.name || 'Tim Homecare' : assignment.branch.name,
      branchId: assignment.branchId,
      branchName: assignment.branch.name,
      qualifierTarget,
      totalInfusions: scopeSessions.length,
      qualifierPassed,
      eligiblePaidInfusions: eligibleScopeSessions.length,
      targetBonus: isHoScope
        ? 0
        : qualifierPassed
          ? (isTeamScope ? CHS_HOMECARE_TEAM_TARGET_BONUS : CHS_BRANCH_TARGET_BONUS)
          : 0,
      incentiveType: isTeamScope ? teamType! : 'BRANCH',
    });
    coordinatorMap.set(assignment.coordinatorUserId, existing);
  });

  const coordinators = Array.from(coordinatorMap.values())
    .map(({
      eligibleSessionIds,
      personalSessionIds,
      hoPaidSessionIds,
      qualifiedHomecareTeamIds,
      qualifiedBranchIds,
      ...coordinator
    }) => ({
      ...coordinator,
      ...calculateChsCoordinatorMonthlyIncentive(eligibleSessionIds.size, personalSessionIds.size, {
        qualifiedHomecareTeams: qualifiedHomecareTeamIds.size,
        qualifiedBranches: qualifiedBranchIds.size,
        hoPaidInfusions: hoPaidSessionIds.size,
      }),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount || a.fullName.localeCompare(b.fullName));

  type DoctorHeadAggregate = {
    id: string;
    fullName: string;
    email: string;
    staffCode: string | null;
    role: Role;
    qualifiedHomecareTeamIds: Set<string>;
    qualifiedBranchIds: Set<string>;
    homecareDoctorPaidSessionIds: Set<string>;
    partnershipSessionIds: Set<string>;
    partnershipPaidSessionIds: Set<string>;
    scopes: Array<{
      assignmentId: string;
      branchId: string;
      branchName: string;
      branchType: BranchType;
      qualifierTarget: number;
      totalInfusions: number;
      qualifierPassed: boolean;
      targetBonus: number;
      qualifiedHomecareTeams: number;
    }>;
  };
  const doctorHeadMap = new Map<string, DoctorHeadAggregate>();

  doctorHeadAssignments.forEach((assignment) => {
    const branchSessions = sessions.filter((session) => (
      session.branchId === assignment.branchId
      && assignmentAppliesOn(session.treatmentDate, assignment.effectiveFrom, assignment.effectiveUntil)
    ));
    const branchTarget = branchesWithHomecare.has(assignment.branchId)
      ? CHS_BRANCH_WITH_HOMECARE_TARGET
      : CHS_BRANCH_WITHOUT_HOMECARE_TARGET;
    const branchPassed = branchSessions.length >= branchTarget;
    const existing = doctorHeadMap.get(assignment.doctorHeadUserId) || {
      id: assignment.doctorHead.id,
      fullName: assignment.doctorHead.profile?.fullName || assignment.doctorHead.email,
      email: assignment.doctorHead.email,
      staffCode: assignment.doctorHead.staffCode,
      role: assignment.doctorHead.role,
      qualifiedHomecareTeamIds: new Set<string>(),
      qualifiedBranchIds: new Set<string>(),
      homecareDoctorPaidSessionIds: new Set<string>(),
      partnershipSessionIds: new Set<string>(),
      partnershipPaidSessionIds: new Set<string>(),
      scopes: [],
    };
    if (branchPassed) existing.qualifiedBranchIds.add(assignment.branchId);

    let qualifiedHomecareTeams = 0;
    homecareTeams
      .filter((team) => team.branchId === assignment.branchId && team.incentiveType === HomecareTeamIncentiveType.HOMECARE)
      .forEach((team) => {
        const teamSessions = branchSessions.filter((session) => teamBySession.get(session.id) === team.id);
        if (teamSessions.length < CHS_HOMECARE_TEAM_TARGET) return;
        qualifiedHomecareTeams += 1;
        existing.qualifiedHomecareTeamIds.add(team.id);
        const doctorMemberships = homecareDoctorMemberships.filter((member) => (
          member.userId === assignment.doctorHeadUserId && member.teamId === team.id
        ));
        teamSessions
          .filter((session) => doctorMemberships.some((membership) => (
            membershipAppliesOn(session.treatmentDate, membership.joinedAt, membership.leftAt)
          )))
          .filter(isPaidSession)
          .forEach((session) => existing.homecareDoctorPaidSessionIds.add(session.id));
      });

    if (assignment.branch.type === BranchType.PARTNERSHIP) {
      branchSessions.forEach((session) => {
        existing.partnershipSessionIds.add(session.id);
        if (isPaidSession(session)) existing.partnershipPaidSessionIds.add(session.id);
      });
    }
    existing.scopes.push({
      assignmentId: assignment.id,
      branchId: assignment.branchId,
      branchName: assignment.branch.name,
      branchType: assignment.branch.type,
      qualifierTarget: branchTarget,
      totalInfusions: branchSessions.length,
      qualifierPassed: branchPassed,
      targetBonus: branchPassed ? DOCTOR_HEAD_BRANCH_TARGET_BONUS : 0,
      qualifiedHomecareTeams,
    });
    doctorHeadMap.set(assignment.doctorHeadUserId, existing);
  });

  const doctorHeads = Array.from(doctorHeadMap.values())
    .map(({
      qualifiedHomecareTeamIds,
      qualifiedBranchIds,
      homecareDoctorPaidSessionIds,
      partnershipSessionIds,
      partnershipPaidSessionIds,
      ...doctorHead
    }) => ({
      ...doctorHead,
      ...calculateDoctorHeadMonthlyIncentive({
        qualifiedHomecareTeams: qualifiedHomecareTeamIds.size,
        qualifiedBranches: qualifiedBranchIds.size,
        homecareDoctorPaidInfusions: homecareDoctorPaidSessionIds.size,
        partnershipTotalInfusions: partnershipSessionIds.size,
        partnershipPaidInfusions: partnershipPaidSessionIds.size,
      }),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount || a.fullName.localeCompare(b.fullName));

  const nakesTotalAmount = nakes.reduce((sum, row) => sum + row.totalAmount, 0);
  const msoTotalAmount = mso.reduce((sum, row) => sum + row.totalAmount, 0);
  const coordinatorTotalAmount = coordinators.reduce((sum, row) => sum + row.totalAmount, 0);
  const doctorHeadTotalAmount = doctorHeads.reduce((sum, row) => sum + row.totalAmount, 0);

  return {
    period: { month: period.month, timezone: 'Asia/Jakarta', start: period.start, endExclusive: period.end },
    rules: {
      nakes: { ratePerInfusion: NAKES_RATE_PER_INFUSION, target: NAKES_MONTHLY_TARGET, bonus: NAKES_TARGET_BONUS },
      mso: {
        visitTarget: MSO_MONTHLY_VISIT_TARGET,
        minimumPaidAirNanoBoxes: MSO_MINIMUM_PAID_AIR_NANO_BOXES,
        visitBonus: MSO_VISIT_BONUS,
        ratePerPaidAirNanoBox: MSO_RATE_PER_PAID_AIR_NANO_BOX,
      },
      coordinator: {
        ratePerEligiblePaidInfusion: CHS_RATE_PER_ELIGIBLE_PAID_INFUSION,
        homecareTeamTarget: CHS_HOMECARE_TEAM_TARGET,
        branchWithoutHomecareTarget: CHS_BRANCH_WITHOUT_HOMECARE_TARGET,
        branchWithHomecareTarget: CHS_BRANCH_WITH_HOMECARE_TARGET,
        ratePerPersonalInfusion: CHS_RATE_PER_PERSONAL_INFUSION,
        personalTarget: CHS_PERSONAL_TARGET,
        personalTargetBonus: CHS_PERSONAL_TARGET_BONUS,
        homecareTeamTargetBonus: CHS_HOMECARE_TEAM_TARGET_BONUS,
        branchTargetBonus: CHS_BRANCH_TARGET_BONUS,
        ratePerHoPaidInfusion: CHS_HO_RATE_PER_PAID_INFUSION,
      },
      doctorHead: {
        homecareTeamTarget: CHS_HOMECARE_TEAM_TARGET,
        homecareTeamTargetBonus: DOCTOR_HEAD_HOMECARE_TEAM_TARGET_BONUS,
        branchWithoutHomecareTarget: CHS_BRANCH_WITHOUT_HOMECARE_TARGET,
        branchWithHomecareTarget: CHS_BRANCH_WITH_HOMECARE_TARGET,
        branchTargetBonus: DOCTOR_HEAD_BRANCH_TARGET_BONUS,
        ratePerHomecareDoctorPaidInfusion: DOCTOR_HEAD_HOMECARE_DOCTOR_RATE,
        partnershipTarget: DOCTOR_HEAD_PARTNERSHIP_TARGET,
        ratePerPartnershipPaidInfusion: DOCTOR_HEAD_PARTNERSHIP_RATE,
      },
    },
    nakes,
    mso,
    coordinators,
    doctorHeads,
    summary: {
      nakesRecipients: nakes.length,
      nakesTotalAmount,
      msoRecipients: mso.length,
      msoTotalAmount,
      coordinatorRecipients: coordinators.length,
      coordinatorTotalAmount,
      doctorHeadRecipients: doctorHeads.length,
      doctorHeadTotalAmount,
      grandTotalAmount: nakesTotalAmount + msoTotalAmount + coordinatorTotalAmount + doctorHeadTotalAmount,
    },
  };
}
