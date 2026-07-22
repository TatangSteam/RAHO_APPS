import { Prisma } from '@prisma/client';
import { requiresMaterialDeviationReason } from '../material-usage.helpers';

const decimal = (value: string) => new Prisma.Decimal(value);

describe('material usage deviation', () => {
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
