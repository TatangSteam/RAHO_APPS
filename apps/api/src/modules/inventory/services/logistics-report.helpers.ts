import { Prisma } from '@prisma/client';

const REPORT_TIME_ZONE_OFFSET = '+07:00';
const DAY_MS = 24 * 60 * 60 * 1000;

function jakartaDate(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function buildLogisticsReportRange(startDate?: string, endDate?: string, now = new Date()) {
  const defaultEnd = jakartaDate(now);
  const normalizedEnd = endDate || defaultEnd;
  const normalizedStart = startDate || shiftDate(normalizedEnd, -29);
  const start = new Date(`${normalizedStart}T00:00:00.000${REPORT_TIME_ZONE_OFFSET}`);
  const endExclusive = new Date(`${shiftDate(normalizedEnd, 1)}T00:00:00.000${REPORT_TIME_ZONE_OFFSET}`);
  const days = Math.round((endExclusive.getTime() - start.getTime()) / DAY_MS);
  if (!Number.isFinite(days) || days < 1 || days > 366) {
    throw new Error('REPORT_DATE_RANGE_INVALID');
  }
  return { startDate: normalizedStart, endDate: normalizedEnd, start, endExclusive, days };
}

export function signedMutationQuantity(mutation: {
  stockBefore: Prisma.Decimal | string | number;
  stockAfter: Prisma.Decimal | string | number;
}) {
  return new Prisma.Decimal(mutation.stockAfter).sub(mutation.stockBefore);
}

export function decimalSum(values: Array<Prisma.Decimal | string | number | null | undefined>) {
  return values.reduce<Prisma.Decimal>(
    (total, value) => value === null || value === undefined ? total : total.add(value),
    new Prisma.Decimal(0),
  );
}

export function incrementCount(target: Record<string, number>, key: string) {
  target[key] = (target[key] || 0) + 1;
}

export function createDailyTrend(startDate: string, days: number) {
  return Array.from({ length: days }, (_, index) => ({
    date: shiftDate(startDate, index),
    inboundQty: new Prisma.Decimal(0),
    outboundQty: new Prisma.Decimal(0),
    movementValue: new Prisma.Decimal(0),
  }));
}

export function reportDateKey(value: Date) {
  return jakartaDate(value);
}
