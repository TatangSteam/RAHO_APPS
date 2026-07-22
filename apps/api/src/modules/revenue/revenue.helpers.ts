import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { errors } from '@middleware/errorHandler';

export type BenefitInput = { key: string; standaloneValue: Prisma.Decimal.Value };

export function allocateConsideration(totalInput: Prisma.Decimal.Value, benefits: BenefitInput[]) {
  const total = new Prisma.Decimal(totalInput);
  if (total.isNegative()) throw errors.badRequest('CONSIDERATION_INVALID', 'Nilai consideration tidak boleh negatif.');
  if (benefits.length === 0) return [];
  const normalized = benefits.map((benefit) => ({ ...benefit, standaloneValue: new Prisma.Decimal(benefit.standaloneValue) }));
  const standaloneTotal = normalized.reduce((sum, benefit) => sum.add(benefit.standaloneValue), new Prisma.Decimal(0));
  if (!standaloneTotal.greaterThan(0)) throw errors.unprocessable('BENEFIT_VALUE_INVALID', 'Total standalone benefit value harus lebih besar dari nol.');
  let allocated = new Prisma.Decimal(0);
  return normalized.map((benefit, index) => {
    const amount = index === normalized.length - 1
      ? total.sub(allocated)
      : total.mul(benefit.standaloneValue).div(standaloneTotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    allocated = allocated.add(amount);
    return { key: benefit.key, standaloneValue: benefit.standaloneValue, allocationRatio: benefit.standaloneValue.div(standaloneTotal), amount };
  });
}

export function calculatePerSessionRevenue(totalInput: Prisma.Decimal.Value, totalSessions: number) {
  if (!Number.isInteger(totalSessions) || totalSessions <= 0) throw errors.badRequest('SESSION_COUNT_INVALID', 'Jumlah sesi harus bilangan bulat positif.');
  const total = new Prisma.Decimal(totalInput);
  const regularSessionRevenue = total.div(totalSessions).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  const finalSessionRevenue = total.sub(regularSessionRevenue.mul(totalSessions - 1));
  return { regularSessionRevenue, finalSessionRevenue };
}

export function revenueForOrdinal(regular: Prisma.Decimal.Value, final: Prisma.Decimal.Value, ordinal: number, totalSessions: number) {
  if (ordinal < 1 || ordinal > totalSessions) throw errors.unprocessable('SESSION_ORDINAL_INVALID', 'Urutan sesi berada di luar benefit package.');
  return new Prisma.Decimal(ordinal === totalSessions ? final : regular);
}

export function treatmentCompletedEventPayload(input: {
  sessionId: string; sessionCode: string; branchId: string; memberId: string; treatmentDate: Date; completedAt: Date;
  packageIds: string[];
}) {
  const payload = {
    eventType: 'TREATMENT_COMPLETED' as const,
    aggregateType: 'TreatmentSession' as const,
    aggregateId: input.sessionId,
    branchId: input.branchId,
    occurredAt: input.completedAt.toISOString(),
    treatmentDate: input.treatmentDate.toISOString(),
    memberId: input.memberId,
    sessionCode: input.sessionCode,
    packageIds: [...new Set(input.packageIds)].sort(),
  };
  return { payload, payloadHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
}
