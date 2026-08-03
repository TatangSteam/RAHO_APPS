import { prisma } from '../lib/prisma';
import { generateInvoiceNumber as formatInvoiceNumber } from './codeGenerator';
import { Prisma } from '@prisma/client';

type InvoiceNumberDb = Pick<Prisma.TransactionClient, 'invoice' | '$queryRaw'>;

/**
 * Generate unique invoice number
 * Format: {SEQUENCE:05}-{BRANCH_CODE}-{MM}-{YYYY}
 * Example: 00001-PST-07-2026
 */
export async function generateInvoiceNumber(
  branchCode: string,
  date = new Date(),
  db: InvoiceNumberDb = prisma,
): Promise<string> {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const suffix = `-${branchCode}-${month}-${year}`;

  await db.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`INVOICE_NUMBER:${branchCode}:${year}:${month}`}))::text AS "lockResult"`,
  );
  const lastInvoice = await db.invoice.findFirst({
    where: {
      invoiceNumber: {
        endsWith: suffix,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
    select: {
      invoiceNumber: true,
    },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = Number.parseInt(lastInvoice.invoiceNumber.split('-', 1)[0], 10);
    if (Number.isFinite(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return formatInvoiceNumber(branchCode, sequence, date);
}

/**
 * Generate unique purchase code for non-therapy products
 * Format: NTP-{BRANCH_CODE}-{YYMM}-{RANDOM}
 * Example: NTP-PST-2604-A1B2C
 */
export function generatePurchaseCode(branchCode: string): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();

  return `NTP-${branchCode}-${year}${month}-${random}`;
}
