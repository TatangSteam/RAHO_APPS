CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "JournalStatus" AS ENUM ('POSTED', 'REVERSED');
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

CREATE TABLE "accounts" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AccountType" NOT NULL,
  "normalBalance" "NormalBalance" NOT NULL,
  "parentId" TEXT,
  "level" INTEGER NOT NULL DEFAULT 1,
  "allowPosting" BOOLEAN NOT NULL DEFAULT true,
  "isControl" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounts_level_check" CHECK ("level" >= 1)
);

CREATE TABLE "accounting_periods" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fiscalYear" INTEGER NOT NULL,
  "periodNo" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "branchId" TEXT,
  "scopeKey" TEXT NOT NULL DEFAULT 'GLOBAL',
  "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "closedAt" TIMESTAMP(3),
  "closedBy" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounting_periods_period_no_check" CHECK ("periodNo" BETWEEN 1 AND 13),
  CONSTRAINT "accounting_periods_date_check" CHECK ("endDate" >= "startDate"),
  CONSTRAINT "accounting_periods_scope_check" CHECK (
    ("branchId" IS NULL AND "scopeKey" = 'GLOBAL') OR
    ("branchId" IS NOT NULL AND "scopeKey" = "branchId")
  )
);

CREATE TABLE "journal_entries" (
  "id" TEXT NOT NULL,
  "journalNumber" TEXT NOT NULL,
  "postingKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "accountingPeriodId" TEXT NOT NULL,
  "status" "JournalStatus" NOT NULL DEFAULT 'POSTED',
  "totalDebit" DECIMAL(18,2) NOT NULL,
  "totalCredit" DECIMAL(18,2) NOT NULL,
  "metadata" JSONB,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  "postedBy" TEXT NOT NULL,
  "reversedAt" TIMESTAMP(3),
  "reversedByEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_entries_balanced_totals_check" CHECK ("totalDebit" = "totalCredit" AND "totalDebit" > 0)
);

CREATE TABLE "journal_lines" (
  "id" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "accountId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "costCenterCode" TEXT,
  "description" TEXT,
  "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_lines_amount_check" CHECK (
    ("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)
  ),
  CONSTRAINT "journal_lines_line_no_check" CHECK ("lineNo" > 0)
);

CREATE TABLE "journal_source_links" (
  "id" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceNumber" TEXT,
  "relationType" TEXT NOT NULL DEFAULT 'PRIMARY',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_source_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journal_sequences" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "fiscalYear" INTEGER NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journal_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");
CREATE INDEX "accounts_type_isActive_idx" ON "accounts"("type", "isActive");
CREATE INDEX "accounts_parentId_idx" ON "accounts"("parentId");
CREATE UNIQUE INDEX "accounting_periods_fiscalYear_periodNo_scopeKey_key" ON "accounting_periods"("fiscalYear", "periodNo", "scopeKey");
CREATE INDEX "accounting_periods_scopeKey_status_startDate_endDate_idx" ON "accounting_periods"("scopeKey", "status", "startDate", "endDate");
CREATE INDEX "accounting_periods_branchId_status_idx" ON "accounting_periods"("branchId", "status");
CREATE UNIQUE INDEX "journal_entries_journalNumber_key" ON "journal_entries"("journalNumber");
CREATE UNIQUE INDEX "journal_entries_postingKey_key" ON "journal_entries"("postingKey");
CREATE UNIQUE INDEX "journal_entries_reversedByEntryId_key" ON "journal_entries"("reversedByEntryId");
CREATE INDEX "journal_entries_branchId_transactionDate_idx" ON "journal_entries"("branchId", "transactionDate");
CREATE INDEX "journal_entries_accountingPeriodId_status_idx" ON "journal_entries"("accountingPeriodId", "status");
CREATE INDEX "journal_entries_status_postedAt_idx" ON "journal_entries"("status", "postedAt");
CREATE UNIQUE INDEX "journal_lines_journalEntryId_lineNo_key" ON "journal_lines"("journalEntryId", "lineNo");
CREATE INDEX "journal_lines_accountId_createdAt_idx" ON "journal_lines"("accountId", "createdAt");
CREATE INDEX "journal_lines_branchId_createdAt_idx" ON "journal_lines"("branchId", "createdAt");
CREATE INDEX "journal_lines_costCenterCode_createdAt_idx" ON "journal_lines"("costCenterCode", "createdAt");
CREATE UNIQUE INDEX "journal_source_links_journalEntryId_sourceType_sourceId_relationType_key" ON "journal_source_links"("journalEntryId", "sourceType", "sourceId", "relationType");
CREATE INDEX "journal_source_links_sourceType_sourceId_idx" ON "journal_source_links"("sourceType", "sourceId");
CREATE INDEX "journal_source_links_sourceNumber_idx" ON "journal_source_links"("sourceNumber");
CREATE UNIQUE INDEX "journal_sequences_scopeKey_fiscalYear_key" ON "journal_sequences"("scopeKey", "fiscalYear");

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_postedBy_fkey" FOREIGN KEY ("postedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversedByEntryId_fkey" FOREIGN KEY ("reversedByEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_source_links" ADD CONSTRAINT "journal_source_links_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "accounts" ("id", "code", "name", "type", "normalBalance", "parentId", "level", "allowPosting", "isControl", "description", "updatedAt") VALUES
  ('coa_1000', '1000', 'Aset', 'ASSET', 'DEBIT', NULL, 1, false, true, 'Kelompok aset.', CURRENT_TIMESTAMP),
  ('coa_1100', '1100', 'Kas dan Bank', 'ASSET', 'DEBIT', 'coa_1000', 2, false, true, 'Kelompok kas dan bank.', CURRENT_TIMESTAMP),
  ('coa_1110', '1110', 'Kas', 'ASSET', 'DEBIT', 'coa_1100', 3, true, false, NULL, CURRENT_TIMESTAMP),
  ('coa_1120', '1120', 'Bank', 'ASSET', 'DEBIT', 'coa_1100', 3, true, false, NULL, CURRENT_TIMESTAMP),
  ('coa_1200', '1200', 'Piutang Usaha', 'ASSET', 'DEBIT', 'coa_1000', 2, true, true, NULL, CURRENT_TIMESTAMP),
  ('coa_1300', '1300', 'Persediaan', 'ASSET', 'DEBIT', 'coa_1000', 2, true, true, NULL, CURRENT_TIMESTAMP),
  ('coa_1400', '1400', 'Biaya Dibayar Dimuka', 'ASSET', 'DEBIT', 'coa_1000', 2, true, false, NULL, CURRENT_TIMESTAMP),
  ('coa_2000', '2000', 'Liabilitas', 'LIABILITY', 'CREDIT', NULL, 1, false, true, 'Kelompok liabilitas.', CURRENT_TIMESTAMP),
  ('coa_2100', '2100', 'Utang Usaha', 'LIABILITY', 'CREDIT', 'coa_2000', 2, true, true, NULL, CURRENT_TIMESTAMP),
  ('coa_2200', '2200', 'Pendapatan Ditangguhkan', 'LIABILITY', 'CREDIT', 'coa_2000', 2, true, true, NULL, CURRENT_TIMESTAMP),
  ('coa_2300', '2300', 'Deposit Member', 'LIABILITY', 'CREDIT', 'coa_2000', 2, true, true, NULL, CURRENT_TIMESTAMP),
  ('coa_3000', '3000', 'Ekuitas', 'EQUITY', 'CREDIT', NULL, 1, false, true, 'Kelompok ekuitas.', CURRENT_TIMESTAMP),
  ('coa_3100', '3100', 'Modal', 'EQUITY', 'CREDIT', 'coa_3000', 2, true, false, NULL, CURRENT_TIMESTAMP),
  ('coa_4000', '4000', 'Pendapatan', 'REVENUE', 'CREDIT', NULL, 1, false, true, 'Kelompok pendapatan.', CURRENT_TIMESTAMP),
  ('coa_4100', '4100', 'Pendapatan Treatment', 'REVENUE', 'CREDIT', 'coa_4000', 2, true, false, NULL, CURRENT_TIMESTAMP),
  ('coa_4200', '4200', 'Pendapatan Produk', 'REVENUE', 'CREDIT', 'coa_4000', 2, true, false, NULL, CURRENT_TIMESTAMP),
  ('coa_5000', '5000', 'Beban', 'EXPENSE', 'DEBIT', NULL, 1, false, true, 'Kelompok beban.', CURRENT_TIMESTAMP),
  ('coa_5100', '5100', 'Harga Pokok Penjualan', 'EXPENSE', 'DEBIT', 'coa_5000', 2, true, true, NULL, CURRENT_TIMESTAMP),
  ('coa_5200', '5200', 'Beban Operasional', 'EXPENSE', 'DEBIT', 'coa_5000', 2, true, false, NULL, CURRENT_TIMESTAMP);

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_account_read', 'ACCOUNT.READ', 'Lihat Chart of Accounts', 'ACCOUNTING', 'Melihat Chart of Accounts.', false, CURRENT_TIMESTAMP),
  ('perm_account_manage', 'ACCOUNT.MANAGE', 'Kelola Chart of Accounts', 'ACCOUNTING', 'Membuat dan mengubah akun.', true, CURRENT_TIMESTAMP),
  ('perm_journal_read', 'JOURNAL.READ', 'Lihat Jurnal', 'ACCOUNTING', 'Melihat jurnal dalam branch scope.', false, CURRENT_TIMESTAMP),
  ('perm_journal_post', 'JOURNAL.POST', 'Posting Jurnal', 'ACCOUNTING', 'Mem-posting jurnal balanced.', true, CURRENT_TIMESTAMP),
  ('perm_period_read', 'ACCOUNTING_PERIOD.READ', 'Lihat Periode Akuntansi', 'ACCOUNTING', 'Melihat periode akuntansi.', false, CURRENT_TIMESTAMP),
  ('perm_period_manage', 'ACCOUNTING_PERIOD.MANAGE', 'Kelola Periode Akuntansi', 'ACCOUNTING', 'Membuka, menutup, atau mengunci periode.', true, CURRENT_TIMESTAMP);

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_super_accounting_' || p."id", 'rt_super_admin', p."id"
FROM "permissions" p WHERE p."module" = 'ACCOUNTING';

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_manager_accounting_' || p."id", 'rt_admin_manager', p."id"
FROM "permissions" p WHERE p."code" IN ('ACCOUNT.READ', 'JOURNAL.READ', 'ACCOUNTING_PERIOD.READ');
