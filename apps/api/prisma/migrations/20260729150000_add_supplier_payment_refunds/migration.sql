CREATE TABLE "supplier_payment_refunds" (
  "id" TEXT NOT NULL,
  "refundNumber" TEXT NOT NULL,
  "postingKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "supplierPaymentId" TEXT NOT NULL,
  "supplierInvoiceId" TEXT NOT NULL,
  "cashBankAccountId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "refundDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "referenceNumber" TEXT,
  "journalEntryId" TEXT NOT NULL,
  "cashBankTransactionId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplier_payment_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_payment_refunds_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "supplier_payment_refunds_refundNumber_key"
  ON "supplier_payment_refunds"("refundNumber");
CREATE UNIQUE INDEX "supplier_payment_refunds_postingKey_key"
  ON "supplier_payment_refunds"("postingKey");
CREATE UNIQUE INDEX "supplier_payment_refunds_journalEntryId_key"
  ON "supplier_payment_refunds"("journalEntryId");
CREATE UNIQUE INDEX "supplier_payment_refunds_cashBankTransactionId_key"
  ON "supplier_payment_refunds"("cashBankTransactionId");
CREATE INDEX "supplier_payment_refunds_supplierPaymentId_refundDate_idx"
  ON "supplier_payment_refunds"("supplierPaymentId", "refundDate");
CREATE INDEX "supplier_payment_refunds_supplierInvoiceId_refundDate_idx"
  ON "supplier_payment_refunds"("supplierInvoiceId", "refundDate");
CREATE INDEX "supplier_payment_refunds_branchId_refundDate_idx"
  ON "supplier_payment_refunds"("branchId", "refundDate");

ALTER TABLE "supplier_payment_refunds"
  ADD CONSTRAINT "supplier_payment_refunds_supplierPaymentId_fkey"
  FOREIGN KEY ("supplierPaymentId") REFERENCES "supplier_payments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_refunds"
  ADD CONSTRAINT "supplier_payment_refunds_supplierInvoiceId_fkey"
  FOREIGN KEY ("supplierInvoiceId") REFERENCES "supplier_invoices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_refunds"
  ADD CONSTRAINT "supplier_payment_refunds_cashBankAccountId_fkey"
  FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_refunds"
  ADD CONSTRAINT "supplier_payment_refunds_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_refunds"
  ADD CONSTRAINT "supplier_payment_refunds_journalEntryId_fkey"
  FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_refunds"
  ADD CONSTRAINT "supplier_payment_refunds_cashBankTransactionId_fkey"
  FOREIGN KEY ("cashBankTransactionId") REFERENCES "cash_bank_transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_refunds"
  ADD CONSTRAINT "supplier_payment_refunds_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
