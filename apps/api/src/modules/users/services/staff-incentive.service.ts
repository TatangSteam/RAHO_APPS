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

const INCENTIVE_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
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

async function resolveBranchScope(
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

export async function getMonthlyStaffIncentivesService(
  query: { month?: string; branchId?: string },
  callerRole: Role,
  callerUserId: string,
  callerBranchId: string | null,
) {
  const period = getJakartaMonthRange(query.month);
  const branchIds = await resolveBranchScope(callerRole, callerUserId, callerBranchId, query.branchId);
  const selfOnly = callerRole === Role.NURSE || callerRole === Role.ADMIN_LAYANAN;

  const sessionWhere: Prisma.TreatmentSessionWhereInput = {
    isCompleted: true,
    cancelledAt: null,
    treatmentDate: { gte: period.start, lt: period.end },
    ...branchWhere(branchIds),
    ...(selfOnly ? {
      OR: [{ nurseId: callerUserId }, { adminLayananId: callerUserId }],
    } : {}),
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
      select: { nurseId: true, adminLayananId: true },
    }),
    prisma.memberAddOn.findMany({
      where: addOnWhere,
      select: { id: true, sellerMsoId: true, quantity: true, productCode: true, notes: true },
    }),
  ]);

  const invoiceItems = airNanoSales.length > 0
    ? await prisma.invoiceItem.findMany({
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
    : [];
  const invoicesByAddOn = new Map<string, Array<{
    status: InvoiceStatus;
    paymentVerificationStatus: PaymentVerificationStatus;
  }>>();
  invoiceItems.forEach((item) => {
    const invoices = invoicesByAddOn.get(item.itemId) || [];
    invoices.push(item.invoice);
    invoicesByAddOn.set(item.itemId, invoices);
  });

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
    },
    nakes,
    mso,
    summary: {
      nakesRecipients: nakes.length,
      nakesTotalAmount: nakes.reduce((sum, row) => sum + row.totalAmount, 0),
      msoRecipients: mso.length,
      msoTotalAmount: mso.reduce((sum, row) => sum + row.totalAmount, 0),
      grandTotalAmount: [...nakes, ...mso].reduce((sum, row) => sum + row.totalAmount, 0),
    },
  };
}
