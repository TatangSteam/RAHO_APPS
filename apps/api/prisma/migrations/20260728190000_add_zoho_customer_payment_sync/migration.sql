CREATE TABLE "invoice_payment_refunds" (
  "id" TEXT NOT NULL,
  "refundNumber" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "invoicePaymentId" TEXT NOT NULL,
  "cashBankAccountId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "referenceNumber" TEXT,
  "refundDate" TIMESTAMP(3) NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "cashBankTransactionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'POSTED',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_payment_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_payment_refunds_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "invoice_payment_refunds_refundNumber_key" ON "invoice_payment_refunds"("refundNumber");
CREATE UNIQUE INDEX "invoice_payment_refunds_idempotencyKey_key" ON "invoice_payment_refunds"("idempotencyKey");
CREATE UNIQUE INDEX "invoice_payment_refunds_cashBankTransactionId_key" ON "invoice_payment_refunds"("cashBankTransactionId");
CREATE INDEX "invoice_payment_refunds_invoicePaymentId_refundDate_idx" ON "invoice_payment_refunds"("invoicePaymentId", "refundDate");
CREATE INDEX "invoice_payment_refunds_branchId_refundDate_idx" ON "invoice_payment_refunds"("branchId", "refundDate");
CREATE INDEX "invoice_payment_refunds_status_idx" ON "invoice_payment_refunds"("status");

ALTER TABLE "invoice_payment_refunds"
  ADD CONSTRAINT "invoice_payment_refunds_invoicePaymentId_fkey"
  FOREIGN KEY ("invoicePaymentId") REFERENCES "invoice_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_payment_refunds"
  ADD CONSTRAINT "invoice_payment_refunds_cashBankAccountId_fkey"
  FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_payment_refunds"
  ADD CONSTRAINT "invoice_payment_refunds_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_payment_refunds"
  ADD CONSTRAINT "invoice_payment_refunds_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt")
VALUES (
  'perm_payment_refund',
  'PAYMENT.REFUND',
  'Refund Pembayaran',
  'PAYMENT',
  'Membalik pembayaran terverifikasi dengan jurnal, kas/bank, audit, dan referensi dokumen asli.',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description",
  "isSensitive" = EXCLUDED."isSensitive",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_payment_refund_' || rt."id", rt."id", p."id"
FROM "role_templates" rt
CROSS JOIN "permissions" p
WHERE p."code" = 'PAYMENT.REFUND'
  AND (
    rt."id" IN ('rt_super_admin', 'rt_admin_manager')
    OR rt."code" = 'FINANCE_DUMMY'
  )
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
