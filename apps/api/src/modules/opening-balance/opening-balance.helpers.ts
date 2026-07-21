import { Prisma } from '@prisma/client';

type AmountLine = { debit?: string | Prisma.Decimal; credit?: string | Prisma.Decimal };

type OpeningTotals = { debit: Prisma.Decimal; credit: Prisma.Decimal };

export function calculateOpeningTotals(lines: AmountLine[]) {
  return lines.reduce<OpeningTotals>((totals, line) => ({
    debit: totals.debit.add(new Prisma.Decimal(line.debit ?? 0)),
    credit: totals.credit.add(new Prisma.Decimal(line.credit ?? 0)),
  }), { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) });
}

export function openingInventoryValue(quantity: string | Prisma.Decimal, unitCost: string | Prisma.Decimal) {
  return new Prisma.Decimal(quantity).mul(new Prisma.Decimal(unitCost));
}

export function hasExactCurrencyPrecision(value: Prisma.Decimal) {
  return value.equals(value.toDecimalPlaces(2));
}

export function isBalancedOpening(lines: AmountLine[]) {
  const totals = calculateOpeningTotals(lines);
  return totals.debit.greaterThan(0) && totals.debit.equals(totals.credit);
}
