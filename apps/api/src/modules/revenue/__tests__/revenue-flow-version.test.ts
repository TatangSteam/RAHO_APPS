import { Prisma } from '@prisma/client';
import {
  CURRENT_REVENUE_FLOW_VERSION,
  LEGACY_REVENUE_FLOW_VERSION,
  requiresDeferredRevenueContract,
} from '../revenue.service';

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
});
