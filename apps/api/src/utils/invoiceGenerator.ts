import { prisma } from '../lib/prisma';

/**
 * Generate unique invoice number
 * Format: INV-{BRANCH_CODE}-{YYMM}-{SEQUENCE}
 * Example: INV-PST-2604-00001
 */
export async function generateInvoiceNumber(branchCode: string): Promise<string> {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `INV-${branchCode}-${year}${month}`;

  // Get last invoice with this prefix
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastInvoice) {
    // Extract sequence from last invoice number
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0');
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(5, '0')}`;
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
