import { PackageStatus, Prisma } from '@prisma/client';
import {
  CURRENT_REVENUE_FLOW_VERSION,
  LEGACY_REVENUE_FLOW_VERSION,
  revenueCompatibilityModeForPackages,
  requiresDeferredRevenueContract,
  reserveTreatmentCompletedRevenue,
  usesLegacyRevenueCompatibility,
} from '../revenue.service';

function reservationTx(input: {
  packageStatus?: PackageStatus;
  usedSessions?: number;
  hasInvoiceItem?: boolean;
  hasLegacyVerifiedPayment?: boolean;
}) {
  const packageId = 'package-1';
  return {
    domainEvent: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'event-1',
        eventType: 'TREATMENT_COMPLETED',
        treatmentSession: {
          id: 'session-1',
          boosterPackageId: null,
          revenueSourceType: 'BASIC',
          encounter: { memberPackageId: packageId },
        },
      }),
    },
    memberPackage: {
      findMany: jest.fn().mockResolvedValue([{
        id: packageId,
        finalPrice: new Prisma.Decimal('1250000'),
        revenueFlowVersion: CURRENT_REVENUE_FLOW_VERSION,
        status: input.packageStatus ?? PackageStatus.ACTIVE,
        usedSessions: input.usedSessions ?? 1,
        verifiedAt: null,
        activatedAt: new Date('2026-06-01T00:00:00.000Z'),
      }]),
    },
    packageRevenueContract: { findMany: jest.fn().mockResolvedValue([]) },
    invoiceItem: {
      findMany: jest.fn().mockResolvedValue(input.hasInvoiceItem ? [{
        itemId: packageId,
        invoice: {
          payments: input.hasLegacyVerifiedPayment
            ? [{ cashBankAccountId: null, cashBankTransaction: null }]
            : [],
        },
      }] : []),
    },
  } as unknown as Prisma.TransactionClient;
}

describe('member package revenue flow compatibility', () => {
  it('does not force a deferred-revenue contract onto a paid legacy package', () => {
    expect(requiresDeferredRevenueContract({
      finalPrice: new Prisma.Decimal('1250000'),
      revenueFlowVersion: LEGACY_REVENUE_FLOW_VERSION,
    })).toBe(false);
  });

  it('requires a deferred-revenue contract for a paid package created in the current flow', () => {
    expect(requiresDeferredRevenueContract({
      finalPrice: new Prisma.Decimal('1250000'),
      revenueFlowVersion: CURRENT_REVENUE_FLOW_VERSION,
    })).toBe(true);
  });

  it('does not require a contract for a free package in the current flow', () => {
    expect(requiresDeferredRevenueContract({
      finalPrice: new Prisma.Decimal(0),
      revenueFlowVersion: CURRENT_REVENUE_FLOW_VERSION,
    })).toBe(false);
  });

  it('keeps an operational package without any finance reference on the legacy path', () => {
    expect(usesLegacyRevenueCompatibility({
      finalPrice: new Prisma.Decimal('1250000'),
      revenueFlowVersion: CURRENT_REVENUE_FLOW_VERSION,
      status: PackageStatus.ACTIVE,
      usedSessions: 1,
      verifiedAt: null,
      activatedAt: new Date('2026-06-01T00:00:00.000Z'),
    }, {
      hasInvoiceItem: false,
      hasDeferredRevenueContract: false,
    })).toBe(true);
  });

  it('does not bypass payment verification when a current invoice reference exists', () => {
    expect(usesLegacyRevenueCompatibility({
      finalPrice: new Prisma.Decimal('1250000'),
      revenueFlowVersion: CURRENT_REVENUE_FLOW_VERSION,
      status: PackageStatus.ACTIVE,
      usedSessions: 1,
      verifiedAt: new Date('2026-08-01T00:00:00.000Z'),
      activatedAt: new Date('2026-08-01T00:00:00.000Z'),
    }, {
      hasInvoiceItem: true,
      hasDeferredRevenueContract: false,
      hasLegacyVerifiedPayment: false,
    })).toBe(false);
  });

  it('keeps a verified payment from the old package endpoint on the legacy path', () => {
    expect(usesLegacyRevenueCompatibility({
      finalPrice: new Prisma.Decimal('1250000'),
      revenueFlowVersion: CURRENT_REVENUE_FLOW_VERSION,
      status: PackageStatus.ACTIVE,
      usedSessions: 1,
      verifiedAt: new Date('2026-08-01T00:00:00.000Z'),
      activatedAt: new Date('2026-08-01T00:00:00.000Z'),
    }, {
      hasInvoiceItem: true,
      hasDeferredRevenueContract: false,
      hasLegacyVerifiedPayment: true,
    })).toBe(true);
  });

  it('does not classify a new unpaid package without references as legacy', () => {
    expect(usesLegacyRevenueCompatibility({
      finalPrice: new Prisma.Decimal('1250000'),
      revenueFlowVersion: CURRENT_REVENUE_FLOW_VERSION,
      status: PackageStatus.PENDING_PAYMENT,
      usedSessions: 0,
      verifiedAt: null,
      activatedAt: null,
    }, {
      hasInvoiceItem: false,
      hasDeferredRevenueContract: false,
    })).toBe(false);
  });

  it('keeps free current packages on the current non-revenue path', () => {
    expect(usesLegacyRevenueCompatibility({
      finalPrice: new Prisma.Decimal(0),
      revenueFlowVersion: CURRENT_REVENUE_FLOW_VERSION,
      status: PackageStatus.ACTIVE,
      usedSessions: 1,
      verifiedAt: null,
      activatedAt: new Date('2026-06-01T00:00:00.000Z'),
    }, {
      hasInvoiceItem: false,
      hasDeferredRevenueContract: false,
    })).toBe(false);
  });

  it('uses legacy mode only when every selected package is legacy', () => {
    expect(revenueCompatibilityModeForPackages(1, 1)).toBe('LEGACY');
    expect(revenueCompatibilityModeForPackages(2, 2)).toBe('LEGACY');
    expect(revenueCompatibilityModeForPackages(2, 1)).toBe('CURRENT');
    expect(revenueCompatibilityModeForPackages(1, 0)).toBe('CURRENT');
  });

  it('lets an unreferenced operational package complete through the reservation compatibility path', async () => {
    await expect(reserveTreatmentCompletedRevenue(
      'event-1',
      reservationTx({ hasInvoiceItem: false }),
    )).resolves.toEqual({
      reservations: [],
      revenueCompatibilityMode: 'LEGACY',
    });
  });

  it('still blocks a current invoice that has not funded deferred revenue', async () => {
    await expect(reserveTreatmentCompletedRevenue(
      'event-1',
      reservationTx({ hasInvoiceItem: true }),
    )).rejects.toMatchObject({
      status: 422,
      code: 'TREATMENT_REVENUE_CONTRACT_MISSING',
    });
  });

  it('lets an operational package with a legacy verified invoice payment complete', async () => {
    await expect(reserveTreatmentCompletedRevenue(
      'event-1',
      reservationTx({ hasInvoiceItem: true, hasLegacyVerifiedPayment: true }),
    )).resolves.toEqual({
      reservations: [],
      revenueCompatibilityMode: 'LEGACY',
    });
  });
});
