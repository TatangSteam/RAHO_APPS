import { AccountType, PackageRevenueContractStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import {
  postTreatmentCompletionDerivedJournal,
  reverseTreatmentCompletionJournalInTransaction,
} from '@modules/accounting/accounting.service';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds, hasPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { allocateConsideration, calculatePerSessionRevenue, revenueForOrdinal, treatmentCompletedEventPayload } from './revenue.helpers';
import type { ProfitabilityQuery, RevenueListQuery, UpsertRevenuePolicyInput } from './revenue.schema';

type Tx = Prisma.TransactionClient;
const json = (value: unknown) => value as Prisma.InputJsonValue;

export const LEGACY_REVENUE_FLOW_VERSION = 1;
export const CURRENT_REVENUE_FLOW_VERSION = 2;

export function requiresDeferredRevenueContract(pkg: {
  finalPrice: Prisma.Decimal;
  revenueFlowVersion: number;
}) {
  return pkg.revenueFlowVersion >= CURRENT_REVENUE_FLOW_VERSION
    && pkg.finalPrice.greaterThan(0);
}

/**
 * Legacy behavior is explicit and fail-closed. Historical rows are backfilled
 * to version 1 by migration, while the old payment endpoint also writes version
 * 1. Never infer legacy mode from ACTIVE/EXPIRED status or missing references:
 * doing so could let a damaged current-flow package bypass deferred revenue.
 */
export function usesLegacyRevenueCompatibility(pkg: {
  revenueFlowVersion: number;
}) {
  return pkg.revenueFlowVersion === LEGACY_REVENUE_FLOW_VERSION;
}

export function revenueCompatibilityModeForPackages(
  packageCount: number,
  legacyPackageCount: number,
) {
  return packageCount > 0 && legacyPackageCount === packageCount
    ? 'LEGACY' as const
    : 'CURRENT' as const;
}

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
  const event = await tx.domainEvent.findUnique({
    where: { id: eventId },
    include: { treatmentSession: { include: { encounter: true } } },
  });
  if (!event || event.eventType !== 'TREATMENT_COMPLETED' || !event.treatmentSession) throw errors.badRequest('TREATMENT_EVENT_INVALID', 'Event TREATMENT_COMPLETED tidak valid.');
  const basicPackageId = event.treatmentSession.encounter.memberPackageId;
  const packageIds = [...new Set([
    basicPackageId,
    ...(event.treatmentSession.boosterPackageId ? [event.treatmentSession.boosterPackageId] : []),
  ])];
  if (!basicPackageId || !event.treatmentSession.revenueSourceType) {
    throw errors.unprocessable(
      'TREATMENT_REVENUE_SOURCE_MISSING',
      'Sumber omzet sesi belum lengkap. Paket Basic wajib dan Booster ditambahkan bila dipakai.',
    );
  }
  const [packages, contracts] = await Promise.all([
    tx.memberPackage.findMany({
      where: { id: { in: packageIds } },
      select: {
        id: true,
        packageCode: true,
        finalPrice: true,
        revenueFlowVersion: true,
        status: true,
        usedSessions: true,
        verifiedAt: true,
        activatedAt: true,
      },
    }),
    tx.packageRevenueContract.findMany({
      where: { memberPackageId: { in: packageIds } },
      include: { valuation: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  const contractByPackage = new Map(contracts.map((contract) => [contract.memberPackageId, contract]));
  const legacyPackageIds = new Set(
    packages
      .filter((pkg) => usesLegacyRevenueCompatibility(pkg))
      .map((pkg) => pkg.id),
  );
  const missingFundedContract = packages.find((pkg) =>
    requiresDeferredRevenueContract(pkg)
      && !legacyPackageIds.has(pkg.id)
      && !contractByPackage.has(pkg.id)
  );
  if (missingFundedContract) {
    if (missingFundedContract.status === 'PENDING_PAYMENT' || missingFundedContract.status === 'WAITING_VERIFICATION') {
      throw errors.unprocessable(
        'TREATMENT_PAYMENT_NOT_VERIFIED',
        `Paket ${missingFundedContract.packageCode} belum dibayar atau pembayarannya belum diverifikasi. Selesaikan verifikasi pembayaran sebelum menyelesaikan treatment.`,
      );
    }
    throw errors.unprocessable(
      'TREATMENT_REVENUE_CONTRACT_MISSING',
      `Paket ${missingFundedContract.packageCode} sudah aktif tetapi kontrak deferred revenue belum terbentuk. Jalankan rekonsiliasi pembayaran sebelum menyelesaikan treatment.`,
    );
  }
  // A mixed Basic/Booster session may contain one legacy package and one
  // current package. Ignore only the legacy-compatible package; the current
  // package must keep its normal revenue/HPP posting.
  const revenueCompatibilityMode = revenueCompatibilityModeForPackages(
    packages.length,
    legacyPackageIds.size,
  );
  const reservations = [];
  for (const candidate of contracts.filter((contract) =>
    !legacyPackageIds.has(contract.memberPackageId)
  )) {
    if (candidate.totalConsideration.isZero()) continue;
    if (candidate.status !== PackageRevenueContractStatus.ACTIVE) {
      throw errors.unprocessable(
        'TREATMENT_DEFERRED_REVENUE_UNAVAILABLE',
        'Deferred revenue paket belum aktif atau sudah habis. Completion treatment tidak dapat diposting.',
      );
    }
    const contractId = candidate.id;
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "package_revenue_contracts" WHERE "id" = ${contractId} FOR UPDATE`);
    const contract = await tx.packageRevenueContract.findUniqueOrThrow({
      where: { id: contractId },
      include: { valuation: true },
    });
    if (contract.status !== PackageRevenueContractStatus.ACTIVE) {
      throw errors.unprocessable(
        'TREATMENT_DEFERRED_REVENUE_UNAVAILABLE',
        'Deferred revenue paket berubah saat completion diproses. Silakan ulangi setelah rekonsiliasi pembayaran.',
      );
    }
    const recognitionKey = `TREATMENT_COMPLETED:${event.treatmentSession.id}:PACKAGE:${contract.memberPackageId}`;
    const existing = await tx.revenueRecognition.findUnique({ where: { recognitionKey } });
    if (existing) { reservations.push(existing); continue; }
    const ordinal = contract.recognizedSessions + 1;
    const scheduled = revenueForOrdinal(contract.valuation.regularSessionRevenue, contract.valuation.finalSessionRevenue, ordinal, contract.valuation.totalSessions);
    if (contract.remainingDeferredAmount.lessThan(scheduled)) {
      throw errors.unprocessable(
        'TREATMENT_DEFERRED_REVENUE_INSUFFICIENT',
        `Deferred revenue paket tidak cukup untuk revenue sesi ke-${ordinal}.`,
      );
    }
    const amount = scheduled;
    if (!amount.greaterThan(0)) continue;
    reservations.push(await tx.revenueRecognition.create({ data: { recognitionKey, domainEventId: event.id, treatmentSessionId: event.treatmentSession.id, memberPackageId: contract.memberPackageId, contractId: contract.id, branchId: event.branchId, sessionOrdinal: ordinal, amount } }));
  }
  return { reservations, revenueCompatibilityMode };
}

function addAmount(target: Map<string, Prisma.Decimal>, accountCode: string, amount: Prisma.Decimal) {
  target.set(accountCode, (target.get(accountCode) || new Prisma.Decimal(0)).add(amount));
}

export function buildTreatmentCompletionJournalLines(
  recognitions: Array<{
    amount: Prisma.Decimal;
    contract: {
      valuation: {
        deferredRevenueAccountCode: string;
        revenueAccountCode: string;
      };
    };
  }>,
  materialCostInput: Prisma.Decimal.Value,
) {
  const deferredByAccount = new Map<string, Prisma.Decimal>();
  const revenueByAccount = new Map<string, Prisma.Decimal>();
  for (const recognition of recognitions) {
    addAmount(
      deferredByAccount,
      recognition.contract.valuation.deferredRevenueAccountCode.toUpperCase(),
      recognition.amount,
    );
    addAmount(
      revenueByAccount,
      recognition.contract.valuation.revenueAccountCode.toUpperCase(),
      recognition.amount,
    );
  }

  const lines: Array<{
    accountCode: string;
    debit?: Prisma.Decimal;
    credit?: Prisma.Decimal;
    metadata: { treatmentRole: 'DEFERRED_RELEASE' | 'REVENUE' | 'HPP' | 'INVENTORY' };
  }> = [
    ...[...deferredByAccount].map(([accountCode, debit]) => ({
      accountCode,
      debit: debit.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      metadata: { treatmentRole: 'DEFERRED_RELEASE' as const },
    })),
    ...[...revenueByAccount].map(([accountCode, credit]) => ({
      accountCode,
      credit: credit.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      metadata: { treatmentRole: 'REVENUE' as const },
    })),
  ];
  const materialCost = new Prisma.Decimal(materialCostInput)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (materialCost.greaterThan(0)) {
    lines.push(
      { accountCode: '5100', debit: materialCost, metadata: { treatmentRole: 'HPP' } },
      { accountCode: '1300', credit: materialCost, metadata: { treatmentRole: 'INVENTORY' } },
    );
  }
  return lines;
}

/** Posts deferred release, revenue and FIFO HPP in the caller's completion transaction. */
export async function postTreatmentCompletionFinancialsInTransaction(input: {
  actorUserId: string;
  eventId: string;
  inventoryPostingId: string | null;
  materialCost: Prisma.Decimal;
  occurredAt: Date;
}, tx: Tx) {
  const event = await tx.domainEvent.findUnique({
    where: { id: input.eventId },
    include: { treatmentSession: true },
  });
  if (!event?.treatmentSession || event.eventType !== 'TREATMENT_COMPLETED') {
    throw errors.badRequest('TREATMENT_EVENT_INVALID', 'Event TREATMENT_COMPLETED tidak valid.');
  }

  const reservation = await reserveTreatmentCompletedRevenue(event.id, tx);
  const recognitions = await tx.revenueRecognition.findMany({
    where: { domainEventId: event.id },
    include: {
      contract: { include: { valuation: true } },
      memberPackage: {
        select: {
          packageType: true,
          productCode: true,
          packagePricingId: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });
  const postedRecognitions = recognitions.filter((row) => row.status === 'POSTED');
  const recognitionPayload = recognitions.map((row) => ({
    recognitionId: row.id,
    memberPackageId: row.memberPackageId,
    sourceType: row.memberPackage.packageType,
    productCode: row.memberPackage.productCode,
    packagePricingId: row.memberPackage.packagePricingId,
    amount: row.amount.toFixed(2),
    sessionOrdinal: row.sessionOrdinal,
    deferredRevenueAccountCode: row.contract.valuation.deferredRevenueAccountCode,
    revenueAccountCode: row.contract.valuation.revenueAccountCode,
  }));
  if (postedRecognitions.length > 0) {
    if (postedRecognitions.length !== recognitions.length) {
      throw errors.conflict('TREATMENT_FINANCE_PARTIAL_POSTING', 'Recognition treatment hanya terposting sebagian. Rekonsiliasi diperlukan.');
    }
    const journalIds = [...new Set(postedRecognitions.map((row) => row.journalEntryId).filter(Boolean))];
    if (journalIds.length !== 1) {
      throw errors.conflict('TREATMENT_FINANCE_TRACE_INVALID', 'Recognition treatment memiliki referensi jurnal yang tidak konsisten.');
    }
    const totalRevenue = postedRecognitions.reduce(
      (sum, row) => sum.add(row.amount),
      new Prisma.Decimal(0),
    );
    return {
      journalEntryId: journalIds[0]!,
      recognizedRevenue: totalRevenue,
      materialCost: input.materialCost.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      grossProfit: totalRevenue.sub(input.materialCost).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      recognitionCount: postedRecognitions.length,
      recognitions: recognitionPayload,
      revenueCompatibilityMode: reservation.revenueCompatibilityMode,
      idempotentReplay: true,
    };
  }

  const pendingRecognitions = recognitions.filter((row) => row.status === 'RESERVED');
  const recognizedRevenue = pendingRecognitions.reduce(
    (sum, row) => sum.add(row.amount),
    new Prisma.Decimal(0),
  ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const materialCost = input.materialCost.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const grossProfit = reservation.revenueCompatibilityMode === 'LEGACY'
    ? new Prisma.Decimal(0)
    : recognizedRevenue.sub(materialCost).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const lines = reservation.revenueCompatibilityMode === 'LEGACY'
    ? []
    : buildTreatmentCompletionJournalLines(pendingRecognitions, materialCost).map((line) => ({
        ...line,
        description: {
          DEFERRED_RELEASE: `Pelepasan deferred revenue ${event.treatmentSession!.sessionCode}`,
          REVENUE: `Revenue treatment ${event.treatmentSession!.sessionCode}`,
          HPP: `HPP treatment ${event.treatmentSession!.sessionCode}`,
          INVENTORY: `Persediaan terpakai ${event.treatmentSession!.sessionCode}`,
        }[line.metadata.treatmentRole],
      }));

  let journalEntryId: string | null = null;
  if (lines.length > 0) {
    const posted = await postTreatmentCompletionDerivedJournal({
      postingKey: `TREATMENT_COMPLETION:${event.treatmentSession.id}`,
      transactionDate: input.occurredAt,
      branchId: event.branchId,
      actorUserId: input.actorUserId,
      description: `Completion treatment ${event.treatmentSession.sessionCode}`,
      costCenterCode: event.branchId,
      lines,
      sourceLinks: [
        {
          sourceType: 'TREATMENT_SESSION',
          sourceId: event.treatmentSession.id,
          sourceNumber: event.treatmentSession.sessionCode,
        },
        ...(input.inventoryPostingId ? [{
          sourceType: 'INVENTORY_POSTING',
          sourceId: input.inventoryPostingId,
          relationType: 'MATERIAL_USAGE',
        }] : []),
        { sourceType: 'DOMAIN_EVENT', sourceId: event.id, relationType: 'TRIGGER' },
      ],
      metadata: {
        eventId: event.id,
        recognizedRevenue: recognizedRevenue.toFixed(2),
        materialCost: materialCost.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
      },
    }, tx);
    journalEntryId = posted.journal.id;
  }

  for (const recognition of pendingRecognitions) {
    if (!journalEntryId) {
      throw errors.conflict('TREATMENT_REVENUE_JOURNAL_MISSING', 'Recognition revenue membutuhkan jurnal completion.');
    }
    const contract = await tx.packageRevenueContract.findUniqueOrThrow({ where: { id: recognition.contractId } });
    const nextRecognized = contract.recognizedAmount.add(recognition.amount);
    const nextRemaining = Prisma.Decimal.max(contract.remainingDeferredAmount.sub(recognition.amount), 0);
    const nextSessions = contract.recognizedSessions + 1;
    await tx.revenueRecognition.update({
      where: { id: recognition.id },
      data: { status: 'POSTED', journalEntryId, recognizedAt: input.occurredAt },
    });
    await tx.deferredRevenueMovement.create({
      data: {
        movementKey: `${recognition.recognitionKey}:RECOGNITION`,
        contractId: recognition.contractId,
        memberPackageId: recognition.memberPackageId,
        treatmentSessionId: recognition.treatmentSessionId,
        journalEntryId,
        type: 'RECOGNITION',
        amount: recognition.amount,
        occurredAt: input.occurredAt,
        metadata: json({ domainEventId: event.id, sessionOrdinal: recognition.sessionOrdinal }),
      },
    });
    await tx.packageRevenueContract.update({
      where: { id: contract.id },
      data: {
        recognizedAmount: nextRecognized,
        remainingDeferredAmount: nextRemaining,
        recognizedSessions: nextSessions,
        status: nextRemaining.isZero()
          ? PackageRevenueContractStatus.FULLY_RECOGNIZED
          : PackageRevenueContractStatus.ACTIVE,
      },
    });
  }

  await tx.domainEvent.update({
    where: { id: event.id },
    data: { status: 'PROCESSED', processedAt: input.occurredAt, failureReason: null },
  });
  await tx.auditLog.create({
    data: {
      userId: input.actorUserId,
      branchId: event.branchId,
      action: 'CREATE',
      module: 'REVENUE',
      resource: 'TreatmentCompletionPosting',
      resourceId: event.treatmentSession.id,
      entityType: 'TreatmentSession',
      entityId: event.treatmentSession.id,
      entityCode: event.treatmentSession.sessionCode,
      description: reservation.revenueCompatibilityMode === 'LEGACY'
        ? `Completion treatment legacy ${event.treatmentSession.sessionCode} tidak membuat posting finance baru.`
        : `Revenue dan HPP treatment ${event.treatmentSession.sessionCode} diposting.`,
      afterData: json({
        journalEntryId,
        recognizedRevenue: recognizedRevenue.toFixed(2),
        materialCost: materialCost.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        revenueCompatibilityMode: reservation.revenueCompatibilityMode,
      }),
    },
  });
  return {
    journalEntryId,
    recognizedRevenue,
    materialCost,
    grossProfit,
    recognitionCount: pendingRecognitions.length,
    recognitions: recognitionPayload,
    revenueCompatibilityMode: reservation.revenueCompatibilityMode,
    idempotentReplay: false,
  };
}

/** Releases recognized revenue and reverses the completion journal atomically. */
export async function reverseTreatmentCompletionFinancialsInTransaction(input: {
  actorUserId: string;
  sessionId: string;
  sessionCode: string;
  branchId: string;
  originalJournalEntryId: string;
  reason: string;
  occurredAt: Date;
}, tx: Tx) {
  const recognitions = await tx.revenueRecognition.findMany({
    where: { treatmentSessionId: input.sessionId, status: 'POSTED' },
    orderBy: [{ contractId: 'asc' }, { id: 'asc' }],
  });
  for (const recognition of recognitions) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "package_revenue_contracts" WHERE "id" = ${recognition.contractId} FOR UPDATE
    `);
  }
  const reversal = await reverseTreatmentCompletionJournalInTransaction({
    originalJournalEntryId: input.originalJournalEntryId,
    postingKey: `TREATMENT_COMPLETION_REVERSAL:${input.sessionId}`,
    transactionDate: input.occurredAt,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    sessionId: input.sessionId,
    sessionCode: input.sessionCode,
    reason: input.reason,
  }, tx);

  for (const recognition of recognitions) {
    const contract = await tx.packageRevenueContract.findUniqueOrThrow({ where: { id: recognition.contractId } });
    await tx.deferredRevenueMovement.create({
      data: {
        movementKey: `${recognition.recognitionKey}:REVERSAL`,
        contractId: recognition.contractId,
        memberPackageId: recognition.memberPackageId,
        treatmentSessionId: recognition.treatmentSessionId,
        journalEntryId: reversal.journal.id,
        type: 'REVERSAL',
        amount: recognition.amount,
        occurredAt: input.occurredAt,
        metadata: json({ reason: input.reason, recognitionId: recognition.id }),
      },
    });
    await tx.revenueRecognition.update({
      where: { id: recognition.id },
      data: { status: 'REVERSED' },
    });
    const nextRecognized = Prisma.Decimal.max(contract.recognizedAmount.sub(recognition.amount), 0);
    const nextRemaining = Prisma.Decimal.min(
      contract.remainingDeferredAmount.add(recognition.amount),
      contract.fundedDeferredAmount,
    );
    await tx.packageRevenueContract.update({
      where: { id: contract.id },
      data: {
        recognizedAmount: nextRecognized,
        remainingDeferredAmount: nextRemaining,
        recognizedSessions: Math.max(0, contract.recognizedSessions - 1),
        status: contract.fundedDeferredAmount.greaterThan(0)
          ? PackageRevenueContractStatus.ACTIVE
          : PackageRevenueContractStatus.UNFUNDED,
      },
    });
  }
  return {
    journalEntryId: reversal.journal.id,
    releasedRevenue: recognitions.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0)),
    recognitionCount: recognitions.length,
    idempotentReplay: reversal.idempotentReplay,
  };
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
    if (!branches.includes(query.branchId)) {
      throw errors.forbidden('Tidak memiliki akses profitability cabang ini.');
    }
  }
  const rows = await prisma.treatmentSession.findMany({
    where: {
      completionStatus: 'COMPLETED',
      completionJournalEntryId: { not: null },
      branchId: query.branchId || { in: branches },
      ...(query.from || query.to ? {
        completedAt: {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        },
      } : {}),
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
      materialCost: true,
      grossProfit: true,
      branch: { select: { branchCode: true, name: true } },
    },
    orderBy: { completedAt: 'desc' },
    take: 500,
  });
  const totalRevenue = rows.reduce(
    (sum, row) => sum.add(row.recognizedRevenue),
    new Prisma.Decimal(0),
  );
  const totalHpp = rows.reduce(
    (sum, row) => sum.add(row.materialCost),
    new Prisma.Decimal(0),
  );
  const grossProfit = rows.reduce(
    (sum, row) => sum.add(row.grossProfit),
    new Prisma.Decimal(0),
  );
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
    sessions: rows.map(({ materialCost, ...row }) => ({
      ...row,
      recognizedRevenue: row.recognizedRevenue.toFixed(2),
      hppAmount: materialCost.toFixed(2),
      grossProfit: row.grossProfit.toFixed(2),
    })),
  };
}
