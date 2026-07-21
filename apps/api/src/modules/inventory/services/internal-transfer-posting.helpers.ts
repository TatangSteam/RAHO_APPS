import { Prisma } from '@prisma/client';

export const INTERNAL_TRANSFER_ACCOUNTS = {
  inventory: '1300',
  inTransit: '1310',
} as const;

export function buildInternalTransferJournal(direction: 'DISPATCH' | 'RECEIPT', value: Prisma.Decimal.Value) {
  const amount = new Prisma.Decimal(value).toDecimalPlaces(2);
  if (!amount.isPositive()) throw new Error('Internal transfer value must be positive');
  return direction === 'DISPATCH'
    ? [
      { accountCode: INTERNAL_TRANSFER_ACCOUNTS.inTransit, debit: amount, credit: new Prisma.Decimal(0) },
      { accountCode: INTERNAL_TRANSFER_ACCOUNTS.inventory, debit: new Prisma.Decimal(0), credit: amount },
    ]
    : [
      { accountCode: INTERNAL_TRANSFER_ACCOUNTS.inventory, debit: amount, credit: new Prisma.Decimal(0) },
      { accountCode: INTERNAL_TRANSFER_ACCOUNTS.inTransit, debit: new Prisma.Decimal(0), credit: amount },
    ];
}

export function calculateTransferValueInvariant(
  sourceLayerValue: Prisma.Decimal.Value,
  inTransitValue: Prisma.Decimal.Value,
  destinationLayerValue: Prisma.Decimal.Value,
) {
  return new Prisma.Decimal(sourceLayerValue).add(inTransitValue).add(destinationLayerValue);
}
