export type TreatmentRecognitionSnapshot = {
  recognitionId: string;
  memberPackageId: string;
  sourceType: 'BASIC' | 'BOOSTER';
  productCode: string | null;
  packagePricingId: string | null;
  amount: string;
  sessionOrdinal: number;
  deferredRevenueAccountCode: string;
  revenueAccountCode: string;
};

export function buildRetainerInvoicePayload(input: {
  customerId: string;
  locationId?: string;
  referenceNumber: string;
  date: string;
  packageCode: string;
  totalConsideration: string;
}) {
  return {
    customer_id: input.customerId,
    reference_number: input.referenceNumber,
    date: input.date,
    ...(input.locationId ? { location_id: input.locationId } : {}),
    line_items: [{
      description: `Uang muka paket terapi ${input.packageCode}`,
      item_order: 1,
      rate: Number(input.totalConsideration),
    }],
    notes: `Deferred revenue RAHO untuk ${input.packageCode}. Belum menjadi omzet sampai terapi selesai.`,
  };
}

export function buildRetainerPaymentPayload(input: {
  customerId: string;
  retainerInvoiceId: string;
  accountId: string;
  locationId?: string;
  paymentMode: string;
  amount: string;
  date: string;
  referenceNumber: string;
}) {
  return {
    customer_id: input.customerId,
    payment_mode: input.paymentMode,
    amount: Number(input.amount),
    date: input.date,
    reference_number: input.referenceNumber,
    description: `Pembayaran uang muka paket RAHO ${input.referenceNumber}`,
    account_id: input.accountId,
    retainerinvoice_id: input.retainerInvoiceId,
    invoices: [],
    ...(input.locationId ? { location_id: input.locationId } : {}),
  };
}

export function buildTreatmentInvoicePayload(input: {
  customerId: string;
  itemId: string;
  locationId?: string;
  referenceNumber: string;
  date: string;
  sessionCode: string;
  recognition: TreatmentRecognitionSnapshot;
}) {
  return {
    customer_id: input.customerId,
    reference_number: input.referenceNumber,
    date: input.date,
    due_date: input.date,
    ...(input.locationId ? { location_id: input.locationId } : {}),
    line_items: [{
      item_id: input.itemId,
      description: `Pengakuan omzet ${input.recognition.sourceType} sesi ${input.sessionCode} ke-${input.recognition.sessionOrdinal}`,
      quantity: 1,
      rate: Number(input.recognition.amount),
    }],
    notes: `Omzet diakui saat terapi selesai. Recognition ${input.recognition.recognitionId}.`,
  };
}

export function buildRetainerApplicationPayload(invoiceId: string, amount: string, applyDate: string) {
  return {
    invoice_payments: [{
      invoice_id: invoiceId,
      amount_applied: Number(amount),
      apply_date: applyDate,
    }],
  };
}

export function buildTreatmentJournalPayload(input: {
  referenceNumber: string;
  date: string;
  locationId?: string;
  deferredAccountId: string;
  revenueAccountId: string;
  customerId?: string;
  sessionCode: string;
  amount: string;
}) {
  const common = {
    ...(input.customerId ? { customer_id: input.customerId } : {}),
    ...(input.locationId ? { location_id: input.locationId } : {}),
  };
  return {
    journal_date: input.date,
    reference_number: input.referenceNumber,
    notes: `Pengakuan deferred revenue terapi ${input.sessionCode}`,
    journal_type: 'both',
    ...(input.locationId ? { location_id: input.locationId } : {}),
    line_items: [
      {
        account_id: input.deferredAccountId,
        debit_or_credit: 'debit',
        amount: Number(input.amount),
        description: `Pelepasan uang muka ${input.sessionCode}`,
        ...common,
      },
      {
        account_id: input.revenueAccountId,
        debit_or_credit: 'credit',
        amount: Number(input.amount),
        description: `Omzet terapi ${input.sessionCode}`,
        ...common,
      },
    ],
  };
}
