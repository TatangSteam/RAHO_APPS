import { Prisma } from '@prisma/client';
import {
  calculatePhysicalAvailableBaseQuantity,
  requiresMaterialDeviationReason,
} from '../material-usage.helpers';

const decimal = (value: string) => new Prisma.Decimal(value);

describe('material usage deviation', () => {
  it('uses physical availability without requiring item valuation', () => {
    const available = calculatePhysicalAvailableBaseQuantity([{
      onHandQty: decimal('10'),
      reservedQty: decimal('2'),
      quarantineQty: decimal('1'),
    }]);

    expect(available.toFixed(4)).toBe('7.0000');
  });

  it('does not require a reason when no BOM is active', () => {
    expect(requiresMaterialDeviationReason(decimal('99'), null, decimal('0'), false)).toBe(false);
  });

  it('requires a reason for an ad-hoc material when a BOM is active', () => {
    expect(requiresMaterialDeviationReason(decimal('1'), null, decimal('0'), true)).toBe(true);
  });

  it('accepts quantities on the inclusive tolerance boundaries', () => {
    expect(requiresMaterialDeviationReason(decimal('9'), decimal('10'), decimal('10'), true)).toBe(false);
    expect(requiresMaterialDeviationReason(decimal('11'), decimal('10'), decimal('10'), true)).toBe(false);
  });

  it('requires a reason outside the tolerance range', () => {
    expect(requiresMaterialDeviationReason(decimal('8.9999'), decimal('10'), decimal('10'), true)).toBe(true);
    expect(requiresMaterialDeviationReason(decimal('11.0001'), decimal('10'), decimal('10'), true)).toBe(true);
  });
});
