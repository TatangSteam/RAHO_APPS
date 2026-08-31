import { Prisma } from '@prisma/client';

function parseBoundary(value: string, boundary: 'start' | 'end') {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}+07:00`);
  }

  return new Date(value);
}

export function buildJakartaSessionDateRange(
  dateFrom?: string,
  dateTo?: string,
): Prisma.DateTimeFilter {
  return {
    ...(dateFrom ? { gte: parseBoundary(dateFrom, 'start') } : {}),
    ...(dateTo ? { lte: parseBoundary(dateTo, 'end') } : {}),
  };
}
