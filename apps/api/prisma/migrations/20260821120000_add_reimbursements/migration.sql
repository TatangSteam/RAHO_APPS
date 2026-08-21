-- Employee reimbursement claims with private photo evidence, generic approval,
-- and accounting-backed payment.

ALTER TYPE "ApprovalDecisionType" ADD VALUE IF NOT EXISTS 'RETURN_FOR_REVISION';

CREATE TYPE "ReimbursementStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'REVISION_REQUIRED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'PAID'
);

CREATE TYPE "ReimbursementPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER');

CREATE TABLE "reimbursements" (
  "id" TEXT NOT NULL,
  "reimbursementNumber" TEXT NOT NULL,
  "postingKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "claimantUserId" TEXT NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "paymentMethod" "ReimbursementPaymentMethod" NOT NULL,
  "recipientBankName" TEXT,
  "recipientAccountNumber" TEXT,
  "recipientAccountHolder" TEXT,
  "status" "ReimbursementStatus" NOT NULL DEFAULT 'DRAFT',
  "approvalInstanceId" TEXT,
  "expenseAccountId" TEXT,
  "cashBankAccountId" TEXT,
  "paymentReference" TEXT,
  "rejectionReason" TEXT,
  "revisionNote" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "paidBy" TEXT,
  "paidAt" TIMESTAMP(3),
  "journalEntryId" TEXT,
  "cashBankTransactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reimbursement_attachments" (
  "id" TEXT NOT NULL,
  "reimbursementId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reimbursement_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reimbursements_reimbursementNumber_key" ON "reimbursements"("reimbursementNumber");
CREATE UNIQUE INDEX "reimbursements_postingKey_key" ON "reimbursements"("postingKey");
CREATE UNIQUE INDEX "reimbursements_approvalInstanceId_key" ON "reimbursements"("approvalInstanceId");
CREATE UNIQUE INDEX "reimbursements_journalEntryId_key" ON "reimbursements"("journalEntryId");
CREATE UNIQUE INDEX "reimbursements_cashBankTransactionId_key" ON "reimbursements"("cashBankTransactionId");
CREATE INDEX "reimbursements_branchId_status_createdAt_idx" ON "reimbursements"("branchId", "status", "createdAt");
CREATE INDEX "reimbursements_claimantUserId_createdAt_idx" ON "reimbursements"("claimantUserId", "createdAt");
CREATE INDEX "reimbursements_status_submittedAt_idx" ON "reimbursements"("status", "submittedAt");
CREATE UNIQUE INDEX "reimbursement_attachments_reimbursementId_checksum_key" ON "reimbursement_attachments"("reimbursementId", "checksum");
CREATE INDEX "reimbursement_attachments_checksum_idx" ON "reimbursement_attachments"("checksum");

ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_claimantUserId_fkey" FOREIGN KEY ("claimantUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_approvalInstanceId_fkey" FOREIGN KEY ("approvalInstanceId") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_cashBankAccountId_fkey" FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_cashBankTransactionId_fkey" FOREIGN KEY ("cashBankTransactionId") REFERENCES "cash_bank_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reimbursement_attachments" ADD CONSTRAINT "reimbursement_attachments_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "reimbursements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_reimbursement_read', 'REIMBURSEMENT.READ', 'Lihat Reimburse', 'REIMBURSEMENT', 'Melihat reimburse sesuai branch scope atau milik sendiri.', false, CURRENT_TIMESTAMP),
  ('perm_reimbursement_create', 'REIMBURSEMENT.CREATE', 'Ajukan Reimburse', 'REIMBURSEMENT', 'Membuat dan mengajukan reimburse.', true, CURRENT_TIMESTAMP),
  ('perm_reimbursement_verify', 'REIMBURSEMENT.VERIFY', 'Verifikasi Reimburse Cabang', 'REIMBURSEMENT', 'Memverifikasi kelayakan operasional reimburse cabang.', true, CURRENT_TIMESTAMP),
  ('perm_reimbursement_approve', 'REIMBURSEMENT.APPROVE', 'Approve Reimburse Finance', 'REIMBURSEMENT', 'Memberikan persetujuan Finance atas reimburse.', true, CURRENT_TIMESTAMP),
  ('perm_reimbursement_high_approve', 'REIMBURSEMENT.HIGH_APPROVE', 'Approve Reimburse Nominal Besar', 'REIMBURSEMENT', 'Memberikan persetujuan akhir untuk reimburse nominal besar.', true, CURRENT_TIMESTAMP),
  ('perm_reimbursement_pay', 'REIMBURSEMENT.PAY', 'Bayar Reimburse', 'REIMBURSEMENT', 'Membayar reimburse dan mem-posting jurnal.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_reimb_super_' || p."id", 'rt_super_admin', p."id"
FROM "permissions" p WHERE p."module" = 'REIMBURSEMENT'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_reimb_manager_' || p."id", 'rt_admin_manager', p."id"
FROM "permissions" p WHERE p."module" = 'REIMBURSEMENT'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_reimb_branch_' || p."id", 'rt_admin_cabang', p."id"
FROM "permissions" p WHERE p."code" IN ('REIMBURSEMENT.READ', 'REIMBURSEMENT.CREATE', 'REIMBURSEMENT.VERIFY', 'WORKFLOW.APPROVAL.READ')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_reimb_creator_' || rt."id" || '_' || p."id", rt."id", p."id"
FROM "role_templates" rt CROSS JOIN "permissions" p
WHERE rt."id" IN ('rt_admin_layanan', 'rt_doctor', 'rt_nurse')
  AND p."code" IN ('REIMBURSEMENT.READ', 'REIMBURSEMENT.CREATE')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_reimb_finance_' || p."id", 'rt_finance_logistics_controller', p."id"
FROM "permissions" p
WHERE p."code" IN ('REIMBURSEMENT.READ', 'REIMBURSEMENT.CREATE', 'REIMBURSEMENT.APPROVE', 'REIMBURSEMENT.PAY', 'WORKFLOW.APPROVAL.READ')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "approval_rules" ("id", "ruleCode", "name", "module", "transactionType", "minAmount", "maxAmount", "priority", "createdBy", "updatedAt") VALUES
  ('apr_reimbursement_standard', 'REIMBURSEMENT_STANDARD', 'Reimburse standard', 'REIMBURSEMENT', 'REIMBURSEMENT', 0, 9999999.99, 10, 'SYSTEM', CURRENT_TIMESTAMP),
  ('apr_reimbursement_high', 'REIMBURSEMENT_HIGH_VALUE', 'Reimburse nominal besar', 'REIMBURSEMENT', 'REIMBURSEMENT', 10000000, NULL, 100, 'SYSTEM', CURRENT_TIMESTAMP)
ON CONFLICT ("ruleCode") DO NOTHING;

INSERT INTO "approval_rule_steps" ("id", "approvalRuleId", "stepNo", "name", "permissionCode", "requiredApprovals") VALUES
  ('aps_reimbursement_standard_1', 'apr_reimbursement_standard', 1, 'Verifikasi Cabang', 'REIMBURSEMENT.VERIFY', 1),
  ('aps_reimbursement_standard_2', 'apr_reimbursement_standard', 2, 'Persetujuan Finance', 'REIMBURSEMENT.APPROVE', 1),
  ('aps_reimbursement_high_1', 'apr_reimbursement_high', 1, 'Verifikasi Cabang', 'REIMBURSEMENT.VERIFY', 1),
  ('aps_reimbursement_high_2', 'apr_reimbursement_high', 2, 'Persetujuan Finance', 'REIMBURSEMENT.APPROVE', 1),
  ('aps_reimbursement_high_3', 'apr_reimbursement_high', 3, 'Persetujuan Nominal Besar', 'REIMBURSEMENT.HIGH_APPROVE', 1)
ON CONFLICT ("approvalRuleId", "stepNo") DO NOTHING;
