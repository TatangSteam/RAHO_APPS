export interface InvoiceItemForAllocation {
  itemType: string;
  itemId: string;
  code?: string | null;
  description: string;
  quantity: number;
  pricePerUnit: number;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
}

/**
 * Finance payments must represent real money received. Zero-value invoices
 * (for example complimentary packages) can be finalized without inserting an
 * invoice_payments row because the database enforces amount > 0.
 */
export function shouldRecordInvoicePayment(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}

export function allocateInvoiceItems<T extends InvoiceItemForAllocation>(
  items: T[],
  invoiceAmount: number,
  sourceTotal: number
): T[] {
  if (items.length === 0) return [];

  if (sourceTotal <= 0 || invoiceAmount <= 0) {
    return items.map((item, index) => ({
      ...item,
      description: index === 0 ? `${item.description} - Termin` : item.description,
      pricePerUnit: index === 0 ? invoiceAmount : 0,
      subtotal: index === 0 ? invoiceAmount : 0,
      totalAmount: index === 0 ? invoiceAmount : 0,
      discountAmount: 0,
    }));
  }

  let allocated = 0;

  return items.map((item, index) => {
    const isLast = index === items.length - 1;
    const rawAmount = isLast
      ? invoiceAmount - allocated
      : Math.round((Number(item.totalAmount || item.subtotal || 0) / sourceTotal) * invoiceAmount);
    allocated += rawAmount;

    return {
      ...item,
      pricePerUnit: rawAmount,
      subtotal: rawAmount,
      discountAmount: 0,
      totalAmount: rawAmount,
    };
  });
}

export function cloneInvoiceItemsForAllocation(items: Array<Partial<InvoiceItemForAllocation>>) {
  return items.map((item) => ({
    itemType: item.itemType || '',
    itemId: item.itemId || '',
    code: item.code || null,
    description: item.description || '',
    quantity: Number(item.quantity || 0),
    pricePerUnit: Number(item.pricePerUnit || 0),
    subtotal: Number(item.subtotal || 0),
    discountAmount: 0,
    totalAmount: Number(item.totalAmount || 0),
  }));
}
