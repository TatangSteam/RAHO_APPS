CREATE TYPE "CashBankAccountType" AS ENUM ('CASH', 'BANK');
CREATE TYPE "CashBankTransactionType" AS ENUM ('RECEIPT', 'PAYMENT', 'TRANSFER', 'ADJUSTMENT', 'OPENING_BALANCE');
CREATE TYPE "CashBankTransactionStatus" AS ENUM ('POSTED', 'REVERSED');

ALTER TABLE "invoices"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "customerSnapshot" JSONB,
  ADD COLUMN "branchSnapshot" JSONB,
  ADD COLUMN "termsSnapshot" JSONB,
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "settlementAccountCode" TEXT NOT NULL DEFAULT '2200';

ALTER TABLE "invoice_payments"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "payloadHash" TEXT,
  ADD COLUMN "cashBankAccountId" TEXT,
  ADD COLUMN "verificationStatus" "PaymentVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "verificationReason" TEXT,
  ADD COLUMN "verifiedBy" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "proofChecksum" TEXT;

-- Existing rows were already treated as paid by the legacy flow. Preserve that
-- meaning while tagging them explicitly as migrated records.
UPDATE "invoice_payments"
SET "idempotencyKey" = 'LEGACY:INVOICE_PAYMENT:' || "id",
    "payloadHash" = md5('LEGACY:INVOICE_PAYMENT:' || "id"),
    "verificationStatus" = 'VERIFIED',
    "verifiedAt" = "receivedAt";

ALTER TABLE "invoice_payments"
  ALTER COLUMN "idempotencyKey" SET NOT NULL,
  ALTER COLUMN "payloadHash" SET NOT NULL;

CREATE TABLE "cash_bank_accounts" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "CashBankAccountType" NOT NULL,
  "branchId" TEXT NOT NULL,
  "coaAccountId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "bankName" TEXT,
  "accountNumber" TEXT,
  "accountHolderName" TEXT,
  "requiresReference" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cash_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_bank_transactions" (
  "id" TEXT NOT NULL,
  "transactionNumber" TEXT NOT NULL,
  "postingKey" TEXT NOT NULL,
  "cashBankAccountId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "type" "CashBankTransactionType" NOT NULL,
  "status" "CashBankTransactionStatus" NOT NULL DEFAULT 'POSTED',
  "amount" DECIMAL(18,2) NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceNumber" TEXT,
  "invoicePaymentId" TEXT,
  "journalEntryId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_bank_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_bank_transactions_amount_check" CHECK ("amount" > 0)
);

ALTER TABLE "invoice_payments"
  ADD CONSTRAINT "invoice_payments_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "invoice_payments_verifier_check" CHECK ("verifiedBy" IS NULL OR "verifiedBy" <> "receivedBy");

CREATE UNIQUE INDEX "invoice_payments_idempotencyKey_key" ON "invoice_payments"("idempotencyKey");
CREATE INDEX "invoice_payments_invoiceId_verificationStatus_idx" ON "invoice_payments"("invoiceId", "verificationStatus");
CREATE INDEX "invoice_payments_cashBankAccountId_verificationStatus_idx" ON "invoice_payments"("cashBankAccountId", "verificationStatus");
CREATE UNIQUE INDEX "cash_bank_accounts_code_key" ON "cash_bank_accounts"("code");
CREATE UNIQUE INDEX "cash_bank_accounts_branchId_name_key" ON "cash_bank_accounts"("branchId", "name");
CREATE INDEX "cash_bank_accounts_branchId_type_isActive_idx" ON "cash_bank_accounts"("branchId", "type", "isActive");
CREATE UNIQUE INDEX "cash_bank_transactions_transactionNumber_key" ON "cash_bank_transactions"("transactionNumber");
CREATE UNIQUE INDEX "cash_bank_transactions_postingKey_key" ON "cash_bank_transactions"("postingKey");
CREATE UNIQUE INDEX "cash_bank_transactions_invoicePaymentId_key" ON "cash_bank_transactions"("invoicePaymentId");
CREATE UNIQUE INDEX "cash_bank_transactions_journalEntryId_key" ON "cash_bank_transactions"("journalEntryId");
CREATE INDEX "cash_bank_transactions_cashBankAccountId_transactionDate_idx" ON "cash_bank_transactions"("cashBankAccountId", "transactionDate");
CREATE INDEX "cash_bank_transactions_branchId_transactionDate_idx" ON "cash_bank_transactions"("branchId", "transactionDate");
CREATE INDEX "cash_bank_transactions_sourceType_sourceId_idx" ON "cash_bank_transactions"("sourceType", "sourceId");
CREATE INDEX "cash_bank_transactions_status_transactionDate_idx" ON "cash_bank_transactions"("status", "transactionDate");

ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_cashBankAccountId_fkey" FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_bank_accounts" ADD CONSTRAINT "cash_bank_accounts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_bank_accounts" ADD CONSTRAINT "cash_bank_accounts_coaAccountId_fkey" FOREIGN KEY ("coaAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_bank_accounts" ADD CONSTRAINT "cash_bank_accounts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_bank_transactions" ADD CONSTRAINT "cash_bank_transactions_cashBankAccountId_fkey" FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_bank_transactions" ADD CONSTRAINT "cash_bank_transactions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_bank_transactions" ADD CONSTRAINT "cash_bank_transactions_invoicePaymentId_fkey" FOREIGN KEY ("invoicePaymentId") REFERENCES "invoice_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_bank_transactions" ADD CONSTRAINT "cash_bank_transactions_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_bank_transactions" ADD CONSTRAINT "cash_bank_transactions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_payment_submit', 'PAYMENT.SUBMIT', 'Ajukan Pembayaran', 'PAYMENT', 'Mencatat pembayaran invoice untuk diverifikasi.', true, CURRENT_TIMESTAMP),
  ('perm_payment_verify', 'PAYMENT.VERIFY', 'Verifikasi Pembayaran', 'PAYMENT', 'Memverifikasi dan mem-posting pembayaran.', true, CURRENT_TIMESTAMP),
  ('perm_payment_reject', 'PAYMENT.REJECT', 'Tolak Pembayaran', 'PAYMENT', 'Menolak bukti atau pembayaran yang tidak valid.', true, CURRENT_TIMESTAMP),
  ('perm_cash_bank_read', 'CASH_BANK.READ', 'Lihat Kas dan Bank', 'CASH_BANK', 'Melihat rekening dan ledger kas/bank dalam branch scope.', false, CURRENT_TIMESTAMP),
  ('perm_cash_bank_manage', 'CASH_BANK.MANAGE', 'Kelola Kas dan Bank', 'CASH_BANK', 'Mengelola master rekening kas/bank.', true, CURRENT_TIMESTAMP);

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_super_payment_' || p."id", 'rt_super_admin', p."id"
FROM "permissions" p WHERE p."module" IN ('PAYMENT', 'CASH_BANK');

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_manager_payment_' || p."id", 'rt_admin_manager', p."id"
FROM "permissions" p WHERE p."code" IN ('PAYMENT.SUBMIT','PAYMENT.VERIFY','PAYMENT.REJECT','CASH_BANK.READ','CASH_BANK.MANAGE','JOURNAL.POST');

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_cabang_payment_' || p."id", 'rt_admin_cabang', p."id"
FROM "permissions" p WHERE p."code" IN ('PAYMENT.SUBMIT','PAYMENT.VERIFY','PAYMENT.REJECT','CASH_BANK.READ','JOURNAL.POST');

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_layanan_payment_' || p."id", 'rt_admin_layanan', p."id"
FROM "permissions" p WHERE p."code" IN ('PAYMENT.SUBMIT','CASH_BANK.READ');
