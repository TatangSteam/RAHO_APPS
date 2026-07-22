import {
  AccountType,
  DomainEventStatus,
  PackageRevenueContractStatus,
  Prisma,
  RevenueRecognitionStatus,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds, hasPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { postTreatmentCompletionJournal } from '@modules/accounting/accounting.service';
import { allocateConsideration, calculatePerSessionRevenue, revenueForOrdinal, treatmentCompletedEventPayload } from './revenue.helpers';
import type { ProfitabilityQuery, RevenueListQuery, UpsertRevenuePolicyInput } from './revenue.schema';

type Tx = Prisma.TransactionClient;
const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function upsertRevenuePolicy(actorUserId: string, input: UpsertRevenuePolicyInput) {
  await assertPermission(actorUserId, PERMISSIONS.REVENUE_POLICY_MANAGE);
  const [pricing, deferredAccount, revenueAccount, existing] = await Promise.all([
    prisma.packagePricing.findUnique({ where: { id: input.packagePricingId } }),
    prisma.account.findUnique({ where: { code: input.deferredRevenueAccountCode.toUpperCase() } }),
    prisma.account.findUnique({ where: { code: input.revenueAccountCode.toUpperCase() } }),
    prisma.packageRevenuePolicy.findUnique({ where: { packagePricingId: input.packagePricingId } }),
  ]);
  if (!pricing?.isActive) throw errors.badRequest('PACKAGE_PRICING_INVALID', 'Package pricing tidak aktif atau tidak ditemukan.');
  if (!deferredAccount?.isActive || !deferredAccount.allowPosting || deferredAccount.type !== AccountType.LIABILITY) {
    throw errors.badRequest('DEFERRED_REVENUE_ACCOUNT_INVALID', 'Akun deferred revenue harus liability aktif yang menerima posting.');
  }
  if (!revenueAccount?.isActive || !revenueAccount.allowPosting || revenueAccount.type !== AccountType.REVENUE) {
    throw errors.badRequest('REVENUE_ACCOUNT_INVALID', 'Akun revenue harus revenue aktif yang menerima posting.');
  }
  const policy = await prisma.packageRevenuePolicy.upsert({
    where: { packagePricingId: input.packagePricingId },
    create: { packagePricingId: input.packagePricingId, deferredRevenueAccountId: deferredAccount.id, revenueAccountId: revenueAccount.id, effectiveFrom: input.effectiveFrom, createdBy: actorUserId },
    update: { deferredRevenueAccountId: deferredAccount.id, revenueAccountId: revenueAccount.id, effectiveFrom: input.effectiveFrom, version: { increment: 1 }, isActive: true },
    include: { packagePricing: true, deferredRevenueAccount: true, revenueAccount: true },
  });
  await prisma.auditLog.create({ data: { userId: actorUserId, action: existing ? 'UPDATE' : 'CREATE', module: 'REVENUE', resource: 'PackageRevenuePolicy', resourceId: policy.id, entityType: 'PackageRevenuePolicy', entityId: policy.id, entityCode: pricing.productCode || pricing.name, description: `Revenue policy ${pricing.name} disimpan.`, beforeData: existing ? json({ version: existing.version }) : undefined, afterData: json({ version: policy.version, deferredRevenueAccountCode: deferredAccount.code, revenueAccountCode: revenueAccount.code }) } });
  return policy;
}

export async function listRevenuePolicies(actorUserId: string) {
  await assertPermission(actorUserId, PERMISSIONS.DEFERRED_REVENUE_READ);
  return prisma.packageRevenuePolicy.findMany({ include: { packagePricing: { include: { branch: true } }, deferredRevenueAccount: true, revenueAccount: true }, orderBy: [{ packagePricing: { name: 'asc' } }] });
}

function aggregateInvoiceBenefits(items: Array<{ itemType: string; itemId: string; totalAmount: Prisma.Decimal }>) {
  const all = new Map<string, Prisma.Decimal>();
  const packageKeys = new Map<string, string>();
  items.forEach((item, index) => {
    const key = `${item.itemType}:${item.itemId}`;
    all.set(key, (all.get(key) || new Prisma.Decimal(0)).add(item.totalAmount));
    if (item.itemType === 'PACKAGE') packageKeys.set(item.itemId, key);
    if (!item.itemType) all.set(`UNKNOWN:${index}`, item.totalAmount);
  });
  return { all, packageKeys };
}

/** Called inside payment verification transaction; cash and deferred subledger commit together. */
export async function fundPackageDeferredRevenueInTransaction(input: {
  actorUserId: string; invoicePaymentId: string; invoiceId: string; paymentAmount: Prisma.Decimal;
  journalEntryId: string; occurredAt: Date;
}, tx: Tx) {
  const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId }, include: { items: true } });
  if (!invoice) throw errors.notFound('Invoice untuk deferred revenue tidak ditemukan.');
  const { all, packageKeys } = aggregateInvoiceBenefits(invoice.items);
  if (packageKeys.size === 0) return [];
  const benefitInputs = [...all.entries()].map(([key, standaloneValue]) => ({ key, standaloneValue }));
  const contractConsideration = invoice.totalPurchaseAmount ?? invoice.totalAmount;
  const contractAllocations = new Map(allocateConsideration(contractConsideration, benefitInputs).map((row) => [row.key, row.amount]));
  const paymentAllocations = new Map(allocateConsideration(input.paymentAmount, benefitInputs).map((row) => [row.key, row.amount]));
  const packages = await tx.memberPackage.findMany({
    where: { id: { in: [...packageKeys.keys()] } },
    include: { packagePricing: { include: { revenuePolicy: { include: { deferredRevenueAccount: true, revenueAccount: true } } } }, benefitValuation: true, revenueContract: true },
    orderBy: { id: 'asc' },
  });
  const movements = [];
  for (const pkg of packages) {
    const key = packageKeys.get(pkg.id)!;
    const allocatedConsideration = contractAllocations.get(key) || new Prisma.Decimal(0);
    if (!allocatedConsideration.greaterThan(0)) continue;
    const candidatePolicy = pkg.packagePricing?.revenuePolicy;
    const policy = candidatePolicy?.isActive
      && candidatePolicy.effectiveFrom <= input.occurredAt
      && (!candidatePolicy.effectiveTo || candidatePolicy.effectiveTo > input.occurredAt)
      ? candidatePolicy : null;
    let valuation = pkg.benefitValuation;
    let contract = pkg.revenueContract;
    if (!valuation) {
      const schedule = calculatePerSessionRevenue(allocatedConsideration, pkg.totalSessions);
      valuation = await tx.packageBenefitValuation.create({
        data: {
          memberPackageId: pkg.id, policyId: policy?.id, policyVersion: policy?.version || 1,
          standaloneBenefitValue: all.get(key)!, allocatedConsideration, totalSessions: pkg.totalSessions,
          regularSessionRevenue: schedule.regularSessionRevenue, finalSessionRevenue: schedule.finalSessionRevenue,
          deferredRevenueAccountCode: policy?.deferredRevenueAccount.code || '2200', revenueAccountCode: policy?.revenueAccount.code || '4100',
          allocationSnapshot: json({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, invoiceConsideration: contractConsideration.toFixed(2), standaloneTotal: [...all.values()].reduce((sum, value) => sum.add(value), new Prisma.Decimal(0)).toFixed(2), itemKey: key }),
        },
      });
    }
    if (!contract) {
      contract = await tx.packageRevenueContract.create({ data: { memberPackageId: pkg.id, valuationId: valuation.id, branchId: pkg.branchId, totalConsideration: valuation.allocatedConsideration } });
    }
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "package_revenue_contracts" WHERE "id" = ${contract.id} FOR UPDATE`);
    contract = await tx.packageRevenueContract.findUniqueOrThrow({ where: { id: contract.id } });
    const requestedFunding = paymentAllocations.get(key) || new Prisma.Decimal(0);
    const capacity = contract.totalConsideration.sub(contract.fundedDeferredAmount);
    const fundingAmount = Prisma.Decimal.min(requestedFunding, capacity);
    if (!fundingAmount.greaterThan(0)) continue;
    const movementKey = `INVOICE_PAYMENT:${input.invoicePaymentId}:PACKAGE:${pkg.id}`;
    const replay = await tx.deferredRevenueMovement.findUnique({ where: { movementKey } });
    if (replay) { movements.push(replay); continue; }
    const movement = await tx.deferredRevenueMovement.create({ data: { movementKey, contractId: contract.id, memberPackageId: pkg.id, invoicePaymentId: input.invoicePaymentId, journalEntryId: input.journalEntryId, type: 'FUNDING', amount: fundingAmount, occurredAt: input.occurredAt, metadata: json({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber }) } });
    const funded = contract.fundedDeferredAmount.add(fundingAmount);
    await tx.packageRevenueContract.update({ where: { id: contract.id }, data: { fundedDeferredAmount: funded, remainingDeferredAmount: funded.sub(contract.recognizedAmount), status: funded.greaterThan(0) ? PackageRevenueContractStatus.ACTIVE : PackageRevenueContractStatus.UNFUNDED } });
    movements.push(movement);
  }
  return movements;
}

export async function createTreatmentCompletedEventInTransaction(input: {
  sessionId: string; sessionCode: string; branchId: string; memberId: string; treatmentDate: Date; completedAt: Date; packageIds: string[];
}, tx: Tx) {
  const eventKey = `TREATMENT_COMPLETED:${input.sessionId}`;
  const { payload, payloadHash } = treatmentCompletedEventPayload(input);
  const existing = await tx.domainEvent.findUnique({ where: { eventKey } });
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw errors.conflict('TREATMENT_EVENT_PAYLOAD_CONFLICT', 'Event completion sudah ada dengan payload berbeda.');
    return { event: existing, idempotentReplay: true };
  }
  const event = await tx.domainEvent.create({ data: { eventKey, eventType: 'TREATMENT_COMPLETED', aggregateType: 'TreatmentSession', aggregateId: input.sessionId, branchId: input.branchId, treatmentSessionId: input.sessionId, payloadHash, payload: json(payload), occurredAt: input.completedAt } });
  return { event, idempotentReplay: false };
}

/** Sprint 8 consumer contract. Reservation is idempotent and does not post revenue yet. */
export async function reserveTreatmentCompletedRevenue(eventId: string, tx: Tx) {
  const event = await tx.domainEvent.findUnique({ where: { id: eventId }, include: { treatmentSession: { include: { encounter: true } } } });
  if (!event || event.eventType !== 'TREATMENT_COMPLETED' || !event.treatmentSession) throw errors.badRequest('TREATMENT_EVENT_INVALID', 'Event TREATMENT_COMPLETED tidak valid.');
  const packageIds = [event.treatmentSession.encounter.memberPackageId, event.treatmentSession.boosterPackageId].filter((value): value is string => Boolean(value));
  const contracts = await tx.packageRevenueContract.findMany({ where: { memberPackageId: { in: packageIds }, status: 'ACTIVE' }, include: { valuation: true }, orderBy: { id: 'asc' } });
  const reservations = [];
  for (const contract of contracts) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "package_revenue_contracts" WHERE "id" = ${contract.id} FOR UPDATE`);
    const recognitionKey = `TREATMENT_COMPLETED:${event.treatmentSession.id}:PACKAGE:${contract.memberPackageId}`;
    const existing = await tx.revenueRecognition.findUnique({ where: { recognitionKey } });
    if (existing) { reservations.push(existing); continue; }
    const ordinal = contract.recognizedSessions + 1;
    const scheduled = revenueForOrdinal(contract.valuation.regularSessionRevenue, contract.valuation.finalSessionRevenue, ordinal, contract.valuation.totalSessions);
    const amount = Prisma.Decimal.min(scheduled, contract.remainingDeferredAmount);
    if (!amount.greaterThan(0)) continue;
    reservations.push(await tx.revenueRecognition.create({ data: { recognitionKey, domainEventId: event.id, treatmentSessionId: event.treatmentSession.id, memberPackageId: contract.memberPackageId, contractId: contract.id, branchId: event.branchId, sessionOrdinal: ordinal, amount } }));
  }
  return reservations;
}

type TreatmentRecognitionRow = Prisma.RevenueRecognitionGetPayload<{
  include: { contract: { include: { valuation: true } } };
}>;

export function buildTreatmentCompletionJournalLines(
  recognitions: Array<Pick<TreatmentRecognitionRow, 'amount'> & {
    contract: { valuation: Pick<TreatmentRecognitionRow['contract']['valuation'], 'deferredRevenueAccountCode' | 'revenueAccountCode'> };
  }>,
  hppInput: Prisma.Decimal.Value,
) {
  const debitByAccount = new Map<string, Prisma.Decimal>();
  const creditByAccount = new Map<string, Prisma.Decimal>();
  for (const recognition of recognitions) {
    const deferredCode = recognition.contract.valuation.deferredRevenueAccountCode.toUpperCase();
    const revenueCode = recognition.contract.valuation.revenueAccountCode.toUpperCase();
    debitByAccount.set(deferredCode, (debitByAccount.get(deferredCode) || new Prisma.Decimal(0)).add(recognition.amount));
    creditByAccount.set(revenueCode, (creditByAccount.get(revenueCode) || new Prisma.Decimal(0)).add(recognition.amount));
  }
  const lines = [
    ...[...debitByAccount.entries()].map(([accountCode, debit]) => ({
      accountCode, debit, metadata: { treatmentRole: 'DEFERRED_RELEASE' },
    })),
    ...[...creditByAccount.entries()].map(([accountCode, credit]) => ({
      accountCode, credit, metadata: { treatmentRole: 'REVENUE' },
    })),
  ];
  const hppAmount = new Prisma.Decimal(hppInput).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (hppAmount.greaterThan(0)) {
    lines.push(
      { accountCode: '5100', debit: hppAmount, metadata: { treatmentRole: 'HPP' } },
      { accountCode: '1300', credit: hppAmount, metadata: { treatmentRole: 'INVENTORY' } },
    );
  }
  return lines;
}

/** Posts deferred release, revenue and HPP inside the caller's completion transaction. */
export async function postTreatmentCompletionRevenueInTransaction(input: {
  actorUserId: string;
  eventId: string;
  sessionId: string;
  sessionCode: string;
  branchId: string;
  completedAt: Date;
  hppAmount: Prisma.Decimal;
  inventoryPostingId: string | null;
}, tx: Tx) {
  const event = await tx.domainEvent.findUnique({ where: { id: input.eventId } });
  if (!event || event.status !== DomainEventStatus.PENDING) {
    throw errors.conflict('TREATMENT_REVENUE_EVENT_STATE_INVALID', 'Event revenue treatment tidak berada pada status PENDING.');
  }
  const payload = event.payload as { packageIds?: string[] };
  const packageIds = Array.from(new Set(payload.packageIds || []));
  if (!packageIds.length) {
    throw errors.unprocessable('TREATMENT_PACKAGE_REQUIRED', 'Treatment completion memerlukan paket revenue yang valid.');
  }

  await reserveTreatmentCompletedRevenue(event.id, tx);
  const contracts = await tx.packageRevenueContract.findMany({
    where: { memberPackageId: { in: packageIds }, status: PackageRevenueContractStatus.ACTIVE },
    select: { memberPackageId: true },
  });
  if (new Set(contracts.map((contract) => contract.memberPackageId)).size !== packageIds.length) {
    throw errors.unprocessable(
      'PACKAGE_DEFERRED_REVENUE_NOT_READY',
      'Seluruh paket treatment harus memiliki deferred revenue aktif sebelum sesi diselesaikan.',
    );
  }
  const recognitions = await tx.revenueRecognition.findMany({
    where: { domainEventId: event.id, status: RevenueRecognitionStatus.RESERVED },
    include: { contract: { include: { valuation: true } } },
    orderBy: { id: 'asc' },
  });
  if (recognitions.length !== packageIds.length) {
    throw errors.unprocessable('REVENUE_RECOGNITION_INCOMPLETE', 'Revenue per sesi tidak dapat dialokasikan untuk seluruh paket.');
  }

  const recognizedRevenue = recognitions.reduce(
    (sum, recognition) => sum.add(recognition.amount),
    new Prisma.Decimal(0),
  );
  const hppAmount = input.hppAmount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const grossProfit = recognizedRevenue.sub(hppAmount);
  const posted = await postTreatmentCompletionJournal({
    postingKey: `TREATMENT_COMPLETION:${input.sessionId}`,
    transactionDate: input.completedAt,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    description: `Revenue dan HPP treatment ${input.sessionCode}`,
    costCenterCode: input.branchId,
    lines: buildTreatmentCompletionJournalLines(recognitions, hppAmount),
    sourceLinks: [{
      sourceType: 'TREATMENT_SESSION',
      sourceId: input.sessionId,
      sourceNumber: input.sessionCode,
      relationType: 'PRIMARY',
    }],
    metadata: {
      domainEventId: event.id,
      inventoryPostingId: input.inventoryPostingId,
      recognizedRevenue: recognizedRevenue.toFixed(2),
      hppAmount: hppAmount.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
    },
  }, tx);

  for (const recognition of recognitions) {
    const remaining = recognition.contract.remainingDeferredAmount.sub(recognition.amount);
    if (remaining.isNegative()) {
      throw errors.conflict('DEFERRED_REVENUE_NEGATIVE', 'Recognition melebihi saldo deferred revenue.');
    }
    await tx.deferredRevenueMovement.create({
      data: {
        movementKey: `TREATMENT_COMPLETED:${input.sessionId}:PACKAGE:${recognition.memberPackageId}`,
        contractId: recognition.contractId,
        memberPackageId: recognition.memberPackageId,
        treatmentSessionId: input.sessionId,
        journalEntryId: posted.journal.id,
        type: 'RECOGNITION',
        amount: recognition.amount,
        occurredAt: input.completedAt,
        metadata: json({ domainEventId: event.id, sessionOrdinal: recognition.sessionOrdinal }),
      },
    });
    await tx.packageRevenueContract.update({
      where: { id: recognition.contractId },
      data: {
        recognizedAmount: recognition.contract.recognizedAmount.add(recognition.amount),
        remainingDeferredAmount: remaining,
        recognizedSessions: recognition.contract.recognizedSessions + 1,
        status: remaining.isZero() ? PackageRevenueContractStatus.FULLY_RECOGNIZED : PackageRevenueContractStatus.ACTIVE,
      },
    });
    await tx.revenueRecognition.update({
      where: { id: recognition.id },
      data: { status: RevenueRecognitionStatus.POSTED, journalEntryId: posted.journal.id, recognizedAt: input.completedAt },
    });
  }
  await tx.domainEvent.update({
    where: { id: event.id },
    data: { status: DomainEventStatus.PROCESSED, processedAt: input.completedAt, failureReason: null },
  });
  return { journal: posted.journal, recognizedRevenue, hppAmount, grossProfit, recognitions };
}

async function readableBranches(actorUserId: string) {
  const accessible = await getAccessibleBranchIds(actorUserId);
  const candidates = accessible === null ? (await prisma.branch.findMany({ where: { isActive: true }, select: { id: true } })).map((row) => row.id) : accessible;
  return (await Promise.all(candidates.map(async (branchId) => (await hasPermission(actorUserId, PERMISSIONS.DEFERRED_REVENUE_READ, branchId)) ? branchId : null))).filter((value): value is string => Boolean(value));
}

export async function listRevenueContracts(actorUserId: string, query: RevenueListQuery) {
  const branches = await readableBranches(actorUserId);
  if (query.branchId) { await assertBranchAccess(actorUserId, query.branchId); if (!branches.includes(query.branchId)) throw errors.forbidden('Tidak memiliki akses deferred revenue cabang ini.'); }
  return prisma.packageRevenueContract.findMany({ where: { branchId: query.branchId || { in: branches }, ...(query.status ? { status: query.status } : {}) }, include: { memberPackage: { include: { member: { include: { user: { include: { profile: true } } } } } }, valuation: true, movements: { orderBy: { occurredAt: 'asc' } } }, orderBy: { updatedAt: 'desc' } });
}

export async function listTreatmentEvents(actorUserId: string, branchId?: string) {
  const branches = await readableBranches(actorUserId);
  if (branchId && !branches.includes(branchId)) throw errors.forbidden('Tidak memiliki akses event cabang ini.');
  return prisma.domainEvent.findMany({ where: { eventType: 'TREATMENT_COMPLETED', branchId: branchId || { in: branches } }, include: { recognitions: true }, orderBy: { occurredAt: 'desc' }, take: 100 });
}

export async function getTreatmentProfitability(actorUserId: string, query: ProfitabilityQuery) {
  const branches = await readableBranches(actorUserId);
  if (query.branchId) {
    await assertBranchAccess(actorUserId, query.branchId);
    if (!branches.includes(query.branchId)) throw errors.forbidden('Tidak memiliki akses profitability cabang ini.');
  }
  const rows = await prisma.treatmentSession.findMany({
    where: {
      isCompleted: true,
      completionJournalEntryId: { not: null },
      branchId: query.branchId || { in: branches },
      ...(query.from || query.to ? { completedAt: {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      } } : {}),
    },
    select: {
      id: true,
      sessionCode: true,
      branchId: true,
      treatmentDate: true,
      completedAt: true,
      materialPostingId: true,
      completionJournalEntryId: true,
      recognizedRevenue: true,
      hppAmount: true,
      grossProfit: true,
      branch: { select: { branchCode: true, name: true } },
    },
    orderBy: { completedAt: 'desc' },
    take: 500,
  });
  const totalRevenue = rows.reduce((sum, row) => sum.add(row.recognizedRevenue || 0), new Prisma.Decimal(0));
  const totalHpp = rows.reduce((sum, row) => sum.add(row.hppAmount || 0), new Prisma.Decimal(0));
  const grossProfit = rows.reduce((sum, row) => sum.add(row.grossProfit || 0), new Prisma.Decimal(0));
  return {
    summary: {
      sessionCount: rows.length,
      recognizedRevenue: totalRevenue.toFixed(2),
      hppAmount: totalHpp.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      grossMarginPercent: totalRevenue.greaterThan(0)
        ? grossProfit.div(totalRevenue).mul(100).toDecimalPlaces(2).toFixed(2)
        : '0.00',
    },
    sessions: rows.map((row) => ({
      ...row,
      recognizedRevenue: row.recognizedRevenue?.toFixed(2) || '0.00',
      hppAmount: row.hppAmount?.toFixed(2) || '0.00',
      grossProfit: row.grossProfit?.toFixed(2) || '0.00',
    })),
  };
}
