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
  revenueFlowVersion?: number;
  packageStatus?: PackageStatus;
  usedSessions?: number;
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
        packageCode: 'PKG-TEST-001',
        finalPrice: new Prisma.Decimal('1250000'),
        revenueFlowVersion: input.revenueFlowVersion ?? CURRENT_REVENUE_FLOW_VERSION,
        status: input.packageStatus ?? PackageStatus.ACTIVE,
        usedSessions: input.usedSessions ?? 1,
        verifiedAt: null,
        activatedAt: new Date('2026-06-01T00:00:00.000Z'),
      }]),
    },
    packageRevenueContract: { findMany: jest.fn().mockResolvedValue([]) },
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

  it('does not infer legacy mode from operational status or missing references', () => {
    expect(usesLegacyRevenueCompatibility({
      revenueFlowVersion: CURRENT_REVENUE_FLOW_VERSION,
    })).toBe(false);
  });

  it('uses compatibility only for an explicitly versioned legacy package', () => {
    expect(usesLegacyRevenueCompatibility({
      revenueFlowVersion: LEGACY_REVENUE_FLOW_VERSION,
    })).toBe(true);
  });

  it('uses legacy mode only when every selected package is legacy', () => {
    expect(revenueCompatibilityModeForPackages(1, 1)).toBe('LEGACY');
    expect(revenueCompatibilityModeForPackages(2, 2)).toBe('LEGACY');
    expect(revenueCompatibilityModeForPackages(2, 1)).toBe('CURRENT');
    expect(revenueCompatibilityModeForPackages(1, 0)).toBe('CURRENT');
  });

  it('blocks an unreferenced current operational package', async () => {
    await expect(reserveTreatmentCompletedRevenue(
      'event-1',
      reservationTx({}),
    )).rejects.toMatchObject({
      status: 422,
      code: 'TREATMENT_REVENUE_CONTRACT_MISSING',
    });
  });

  it('explains that an unpaid debt session needs payment verification', async () => {
    await expect(reserveTreatmentCompletedRevenue(
      'event-1',
      reservationTx({ packageStatus: PackageStatus.PENDING_PAYMENT, usedSessions: 0 }),
    )).rejects.toMatchObject({
      status: 422,
      code: 'TREATMENT_PAYMENT_NOT_VERIFIED',
      message: expect.stringContaining('PKG-TEST-001'),
    });
  });

  it('lets an explicitly versioned legacy package complete', async () => {
    await expect(reserveTreatmentCompletedRevenue(
      'event-1',
      reservationTx({ revenueFlowVersion: LEGACY_REVENUE_FLOW_VERSION }),
    )).resolves.toEqual({
      reservations: [],
      revenueCompatibilityMode: 'LEGACY',
    });
  });
});
