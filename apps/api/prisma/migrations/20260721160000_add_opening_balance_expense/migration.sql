CREATE TYPE "OpeningBalanceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'POSTED', 'REJECTED');
CREATE TYPE "OpeningBalanceLineType" AS ENUM ('GENERAL', 'CASH_BANK', 'INVENTORY', 'AR', 'AP', 'DEPOSIT', 'DEFERRED_REVENUE');
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');

-- One journal may contain multiple cash/bank lines (notably opening balance).
DROP INDEX IF EXISTS "cash_bank_transactions_journalEntryId_key";
CREATE INDEX "cash_bank_transactions_journalEntryId_idx" ON "cash_bank_transactions"("journalEntryId");

CREATE TABLE "opening_balances" (
  "id" TEXT NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "postingKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "balanceDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "status" "OpeningBalanceStatus" NOT NULL DEFAULT 'DRAFT',
  "totalDebit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "journalEntryId" TEXT,
  "rejectionReason" TEXT,
  "createdBy" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "opening_balances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "opening_balances_balanced_check" CHECK ("totalDebit" = "totalCredit" AND "totalDebit" > 0),
  CONSTRAINT "opening_balances_maker_checker_check" CHECK ("reviewedBy" IS NULL OR "reviewedBy" <> "createdBy")
);

CREATE TABLE "opening_balance_lines" (
  "id" TEXT NOT NULL,
  "openingBalanceId" TEXT NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "type" "OpeningBalanceLineType" NOT NULL,
  "accountId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "counterpartyRef" TEXT,
  "cashBankAccountId" TEXT,
  "inventoryItemId" TEXT,
  "stockLocationId" TEXT,
  "quantity" DECIMAL(18,4),
  "unitCost" DECIMAL(18,4),
  "batchNumber" TEXT,
  "manufactureDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "inventoryPostingId" TEXT,
  "cashBankTransactionId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opening_balance_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "opening_balance_lines_amount_check" CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)),
  CONSTRAINT "opening_balance_lines_inventory_check" CHECK (
    "type" <> 'INVENTORY' OR (
      "inventoryItemId" IS NOT NULL AND "stockLocationId" IS NOT NULL AND "quantity" > 0 AND "unitCost" >= 0
      AND "debit" = "quantity" * "unitCost" AND ROUND("quantity" * "unitCost", 2) = "quantity" * "unitCost"
    )
  ),
  CONSTRAINT "opening_balance_lines_cash_check" CHECK ("type" <> 'CASH_BANK' OR ("cashBankAccountId" IS NOT NULL AND "debit" > 0))
);

CREATE TABLE "expenses" (
  "id" TEXT NOT NULL,
  "expenseNumber" TEXT NOT NULL,
  "postingKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "expenseAccountId" TEXT NOT NULL,
  "cashBankAccountId" TEXT NOT NULL,
  "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
  "evidenceFileUrl" TEXT,
  "evidenceFileName" TEXT,
  "evidenceFileSize" INTEGER,
  "evidenceMimeType" TEXT,
  "evidenceChecksum" TEXT,
  "approvalNote" TEXT,
  "rejectionReason" TEXT,
  "journalEntryId" TEXT,
  "cashBankTransactionId" TEXT,
  "createdBy" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "paidBy" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "expenses_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "expenses_maker_checker_check" CHECK ("reviewedBy" IS NULL OR "reviewedBy" <> "createdBy")
);

CREATE UNIQUE INDEX "opening_balances_documentNumber_key" ON "opening_balances"("documentNumber");
CREATE UNIQUE INDEX "opening_balances_postingKey_key" ON "opening_balances"("postingKey");
CREATE UNIQUE INDEX "opening_balances_journalEntryId_key" ON "opening_balances"("journalEntryId");
CREATE INDEX "opening_balances_branchId_balanceDate_idx" ON "opening_balances"("branchId", "balanceDate");
CREATE INDEX "opening_balances_status_createdAt_idx" ON "opening_balances"("status", "createdAt");
CREATE UNIQUE INDEX "opening_balance_lines_openingBalanceId_lineNo_key" ON "opening_balance_lines"("openingBalanceId", "lineNo");
CREATE UNIQUE INDEX "opening_balance_lines_inventoryPostingId_key" ON "opening_balance_lines"("inventoryPostingId");
CREATE UNIQUE INDEX "opening_balance_lines_cashBankTransactionId_key" ON "opening_balance_lines"("cashBankTransactionId");
CREATE INDEX "opening_balance_lines_type_accountId_idx" ON "opening_balance_lines"("type", "accountId");
CREATE INDEX "opening_balance_lines_inventoryItemId_stockLocationId_idx" ON "opening_balance_lines"("inventoryItemId", "stockLocationId");
CREATE UNIQUE INDEX "expenses_expenseNumber_key" ON "expenses"("expenseNumber");
CREATE UNIQUE INDEX "expenses_postingKey_key" ON "expenses"("postingKey");
CREATE UNIQUE INDEX "expenses_journalEntryId_key" ON "expenses"("journalEntryId");
CREATE UNIQUE INDEX "expenses_cashBankTransactionId_key" ON "expenses"("cashBankTransactionId");
CREATE INDEX "expenses_branchId_expenseDate_idx" ON "expenses"("branchId", "expenseDate");
CREATE INDEX "expenses_status_createdAt_idx" ON "expenses"("status", "createdAt");
CREATE INDEX "expenses_expenseAccountId_idx" ON "expenses"("expenseAccountId");

ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_openingBalanceId_fkey" FOREIGN KEY ("openingBalanceId") REFERENCES "opening_balances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_cashBankAccountId_fkey" FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_inventoryPostingId_fkey" FOREIGN KEY ("inventoryPostingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_cashBankTransactionId_fkey" FOREIGN KEY ("cashBankTransactionId") REFERENCES "cash_bank_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cashBankAccountId_fkey" FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cashBankTransactionId_fkey" FOREIGN KEY ("cashBankTransactionId") REFERENCES "cash_bank_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_opening_read', 'OPENING_BALANCE.READ', 'Lihat Opening Balance', 'OPENING_BALANCE', 'Melihat opening balance dalam branch scope.', true, CURRENT_TIMESTAMP),
  ('perm_opening_manage', 'OPENING_BALANCE.MANAGE', 'Kelola Opening Balance', 'OPENING_BALANCE', 'Membuat dan mengajukan opening balance.', true, CURRENT_TIMESTAMP),
  ('perm_opening_post', 'OPENING_BALANCE.POST', 'Posting Opening Balance', 'OPENING_BALANCE', 'Maker-checker posting opening balance.', true, CURRENT_TIMESTAMP),
  ('perm_expense_read', 'EXPENSE.READ', 'Lihat Expense', 'EXPENSE', 'Melihat expense dalam branch scope.', false, CURRENT_TIMESTAMP),
  ('perm_expense_create', 'EXPENSE.CREATE', 'Buat Expense', 'EXPENSE', 'Membuat dan mengajukan expense.', true, CURRENT_TIMESTAMP),
  ('perm_expense_approve', 'EXPENSE.APPROVE', 'Approve Expense', 'EXPENSE', 'Menyetujui atau menolak expense.', true, CURRENT_TIMESTAMP),
  ('perm_expense_pay', 'EXPENSE.PAY', 'Bayar Expense', 'EXPENSE', 'Membayar dan mem-posting expense.', true, CURRENT_TIMESTAMP);

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_super_s4_' || p."id", 'rt_super_admin', p."id" FROM "permissions" p WHERE p."module" IN ('OPENING_BALANCE','EXPENSE');

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_manager_s4_' || p."id", 'rt_admin_manager', p."id" FROM "permissions" p WHERE p."module" IN ('OPENING_BALANCE','EXPENSE');

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_cabang_s4_' || p."id", 'rt_admin_cabang', p."id"
FROM "permissions" p WHERE p."code" IN ('EXPENSE.READ','EXPENSE.CREATE','EXPENSE.APPROVE','EXPENSE.PAY');

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_layanan_s4_' || p."id", 'rt_admin_layanan', p."id"
FROM "permissions" p WHERE p."code" IN ('EXPENSE.READ','EXPENSE.CREATE');
