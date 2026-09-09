import {
  AddOnType,
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
) {
  const safePaidInfusions = Math.max(0, Math.trunc(eligiblePaidInfusions));
  const safePersonalInfusions = Math.max(0, Math.trunc(personalInfusions));
  const paidInfusionAmount = safePaidInfusions * CHS_RATE_PER_ELIGIBLE_PAID_INFUSION;
  const personalInfusionAmount = safePersonalInfusions * CHS_RATE_PER_PERSONAL_INFUSION;
  const personalTargetReached = safePersonalInfusions >= CHS_PERSONAL_TARGET;
  const personalTargetBonus = personalTargetReached ? CHS_PERSONAL_TARGET_BONUS : 0;
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
    totalAmount: paidInfusionAmount + personalInfusionAmount + personalTargetBonus,
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

export function isEligiblePaidChsInfusion(input: {
  finalPrice: number;
  discountPercent: number | null;
  socialProgramRequestId: string | null;
  paymentPlanStatus: string | null;
  refundedAt: Date | null;
  invoices: Array<{ status: InvoiceStatus; paymentVerificationStatus: PaymentVerificationStatus }>;
}) {
  return input.finalPrice > 0
    && input.socialProgramRequestId === null
    && (input.discountPercent ?? 0) <= 40
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
  const [invoiceItems, packageInvoiceItems, multiBagUsages, homecareTeams, coordinatorAssignments] = await Promise.all([
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
      select: { id: true, branchId: true },
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
        homecareTeam: { select: { name: true } },
      },
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
  const branchesWithHomecare = new Set(homecareTeams.map((team) => team.branchId));

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

  type CoordinatorAggregate = {
    id: string;
    fullName: string;
    email: string;
    staffCode: string | null;
    role: Role;
    eligibleSessionIds: Set<string>;
    personalSessionIds: Set<string>;
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
    const qualifierTarget = getChsQualifierTarget(
      isTeamScope ? 'TEAM' : 'BRANCH',
      branchesWithHomecare.has(assignment.branchId),
    );
    const qualifierPassed = scopeSessions.length >= qualifierTarget;
    const eligibleScopeSessions = scopeSessions.filter((session) => {
      const pkg = session.revenuePackage;
      return Boolean(pkg && isEligiblePaidChsInfusion({
        finalPrice: Number(pkg!.finalPrice),
        discountPercent: pkg!.discountPercent === null ? null : Number(pkg!.discountPercent),
        socialProgramRequestId: pkg!.socialProgramRequestId,
        paymentPlanStatus: pkg!.paymentPlanStatus,
        refundedAt: pkg!.refundedAt,
        invoices: invoicesByPackage.get(pkg!.id) || [],
      }));
    });
    const existing = coordinatorMap.get(assignment.coordinatorUserId) || {
      id: assignment.coordinator.id,
      fullName: assignment.coordinator.profile?.fullName || assignment.coordinator.email,
      email: assignment.coordinator.email,
      staffCode: assignment.coordinator.staffCode,
      role: assignment.coordinator.role,
      eligibleSessionIds: new Set<string>(),
      personalSessionIds: new Set<string>(),
      scopes: [],
    };

    if (qualifierPassed) {
      eligibleScopeSessions.forEach((session) => existing.eligibleSessionIds.add(session.id));
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
    });
    coordinatorMap.set(assignment.coordinatorUserId, existing);
  });

  const coordinators = Array.from(coordinatorMap.values())
    .map(({ eligibleSessionIds, personalSessionIds, ...coordinator }) => ({
      ...coordinator,
      ...calculateChsCoordinatorMonthlyIncentive(eligibleSessionIds.size, personalSessionIds.size),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount || a.fullName.localeCompare(b.fullName));

  const nakesTotalAmount = nakes.reduce((sum, row) => sum + row.totalAmount, 0);
  const msoTotalAmount = mso.reduce((sum, row) => sum + row.totalAmount, 0);
  const coordinatorTotalAmount = coordinators.reduce((sum, row) => sum + row.totalAmount, 0);

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
      },
    },
    nakes,
    mso,
    coordinators,
    summary: {
      nakesRecipients: nakes.length,
      nakesTotalAmount,
      msoRecipients: mso.length,
      msoTotalAmount,
      coordinatorRecipients: coordinators.length,
      coordinatorTotalAmount,
      grandTotalAmount: nakesTotalAmount + msoTotalAmount + coordinatorTotalAmount,
    },
  };
}
