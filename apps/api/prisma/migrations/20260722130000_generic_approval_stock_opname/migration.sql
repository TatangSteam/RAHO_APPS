CREATE TYPE "ApprovalInstanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "ApprovalDecisionType" AS ENUM ('APPROVE', 'REJECT');
CREATE TYPE "StockOpnameStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED');

CREATE TABLE "approval_rules" (
  "id" TEXT NOT NULL, "ruleCode" TEXT NOT NULL, "name" TEXT NOT NULL,
  "module" TEXT NOT NULL, "transactionType" TEXT NOT NULL DEFAULT '*',
  "branchScopeKey" TEXT NOT NULL DEFAULT 'GLOBAL', "categoryKey" TEXT NOT NULL DEFAULT '*',
  "minAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "maxAmount" DECIMAL(18,2),
  "priority" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approval_rules_amount_check" CHECK ("minAmount" >= 0 AND ("maxAmount" IS NULL OR "maxAmount" >= "minAmount"))
);
CREATE UNIQUE INDEX "approval_rules_ruleCode_key" ON "approval_rules"("ruleCode");
CREATE INDEX "approval_rules_module_transactionType_isActive_priority_idx" ON "approval_rules"("module", "transactionType", "isActive", "priority");
CREATE INDEX "approval_rules_branchScopeKey_categoryKey_idx" ON "approval_rules"("branchScopeKey", "categoryKey");

CREATE TABLE "approval_rule_steps" (
  "id" TEXT NOT NULL, "approvalRuleId" TEXT NOT NULL, "stepNo" INTEGER NOT NULL,
  "name" TEXT NOT NULL, "permissionCode" TEXT NOT NULL, "requiredApprovals" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "approval_rule_steps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approval_rule_steps_required_check" CHECK ("stepNo" > 0 AND "requiredApprovals" > 0),
  CONSTRAINT "approval_rule_steps_rule_fkey" FOREIGN KEY ("approvalRuleId") REFERENCES "approval_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "approval_rule_steps_approvalRuleId_stepNo_key" ON "approval_rule_steps"("approvalRuleId", "stepNo");

CREATE TABLE "approval_instances" (
  "id" TEXT NOT NULL, "entityKey" TEXT NOT NULL, "module" TEXT NOT NULL,
  "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "entityNumber" TEXT,
  "branchId" TEXT NOT NULL, "makerUserId" TEXT NOT NULL, "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "category" TEXT, "transactionType" TEXT NOT NULL, "approvalRuleId" TEXT NOT NULL,
  "ruleSnapshot" JSONB NOT NULL, "payloadHash" TEXT NOT NULL,
  "status" "ApprovalInstanceStatus" NOT NULL DEFAULT 'PENDING', "currentStep" INTEGER NOT NULL DEFAULT 1,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approval_instances_rule_fkey" FOREIGN KEY ("approvalRuleId") REFERENCES "approval_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "approval_instances_branch_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "approval_instances_maker_fkey" FOREIGN KEY ("makerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "approval_instances_entityKey_key" ON "approval_instances"("entityKey");
CREATE INDEX "approval_instances_module_status_branchId_submittedAt_idx" ON "approval_instances"("module", "status", "branchId", "submittedAt");
CREATE INDEX "approval_instances_entityType_entityId_idx" ON "approval_instances"("entityType", "entityId");

CREATE TABLE "approval_decisions" (
  "id" TEXT NOT NULL, "approvalInstanceId" TEXT NOT NULL, "stepNo" INTEGER NOT NULL,
  "decision" "ApprovalDecisionType" NOT NULL, "approverUserId" TEXT NOT NULL,
  "permissionCode" TEXT NOT NULL, "note" TEXT, "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approval_decisions_instance_fkey" FOREIGN KEY ("approvalInstanceId") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "approval_decisions_approver_fkey" FOREIGN KEY ("approverUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "approval_decisions_approvalInstanceId_stepNo_approverUserId_key" ON "approval_decisions"("approvalInstanceId", "stepNo", "approverUserId");
CREATE INDEX "approval_decisions_approverUserId_decidedAt_idx" ON "approval_decisions"("approverUserId", "decidedAt");

CREATE TABLE "approval_audit_logs" (
  "id" TEXT NOT NULL, "approvalInstanceId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL, "stepNo" INTEGER, "beforeStatus" TEXT,
  "afterStatus" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approval_audit_logs_instance_fkey" FOREIGN KEY ("approvalInstanceId") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "approval_audit_logs_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "approval_audit_logs_approvalInstanceId_createdAt_idx" ON "approval_audit_logs"("approvalInstanceId", "createdAt");
CREATE INDEX "approval_audit_logs_actorUserId_createdAt_idx" ON "approval_audit_logs"("actorUserId", "createdAt");

CREATE TABLE "stock_opnames" (
  "id" TEXT NOT NULL, "opnameNumber" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL, "branchId" TEXT NOT NULL,
  "status" "StockOpnameStatus" NOT NULL DEFAULT 'DRAFT', "reasonCode" "StockAdjustmentReason" NOT NULL,
  "notes" TEXT NOT NULL, "countedAt" TIMESTAMP(3) NOT NULL, "createdBy" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3), "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT, "approvalInstanceId" TEXT,
  "totalAdjustmentValue" DECIMAL(18,2) NOT NULL DEFAULT 0, "journalEntryId" TEXT,
  "postedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_opnames_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_opnames_branch_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_opnames_creator_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_opnames_approval_fkey" FOREIGN KEY ("approvalInstanceId") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_opnames_journal_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "stock_opnames_opnameNumber_key" ON "stock_opnames"("opnameNumber");
CREATE UNIQUE INDEX "stock_opnames_idempotencyKey_key" ON "stock_opnames"("idempotencyKey");
CREATE UNIQUE INDEX "stock_opnames_approvalInstanceId_key" ON "stock_opnames"("approvalInstanceId");
CREATE UNIQUE INDEX "stock_opnames_journalEntryId_key" ON "stock_opnames"("journalEntryId");
CREATE INDEX "stock_opnames_branchId_status_countedAt_idx" ON "stock_opnames"("branchId", "status", "countedAt");

CREATE TABLE "stock_opname_lines" (
  "id" TEXT NOT NULL, "stockOpnameId" TEXT NOT NULL, "lineNo" INTEGER NOT NULL,
  "inventoryItemId" TEXT NOT NULL, "stockLocationId" TEXT NOT NULL, "batchId" TEXT,
  "batchKey" TEXT NOT NULL DEFAULT 'NO_BATCH', "systemQty" DECIMAL(18,4) NOT NULL,
  "physicalQty" DECIMAL(18,4) NOT NULL, "differenceQty" DECIMAL(18,4) NOT NULL,
  "positiveUnitCost" DECIMAL(18,4), "actualCost" DECIMAL(18,4),
  "inventoryPostingId" TEXT, "stockMutationId" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_opname_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_opname_lines_opname_fkey" FOREIGN KEY ("stockOpnameId") REFERENCES "stock_opnames"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_opname_lines_item_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_opname_lines_location_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_opname_lines_batch_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_opname_lines_inventory_posting_fkey" FOREIGN KEY ("inventoryPostingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_opname_lines_stock_mutation_fkey" FOREIGN KEY ("stockMutationId") REFERENCES "stock_mutations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "stock_opname_lines_stockOpnameId_lineNo_key" ON "stock_opname_lines"("stockOpnameId", "lineNo");
CREATE UNIQUE INDEX "stock_opname_lines_stockOpnameId_inventoryItemId_stockLocationId_batchKey_key" ON "stock_opname_lines"("stockOpnameId", "inventoryItemId", "stockLocationId", "batchKey");
CREATE INDEX "stock_opname_lines_inventoryItemId_stockLocationId_idx" ON "stock_opname_lines"("inventoryItemId", "stockLocationId");
CREATE INDEX "stock_opname_lines_inventoryPostingId_idx" ON "stock_opname_lines"("inventoryPostingId");

INSERT INTO "accounts" ("id", "code", "name", "type", "normalBalance", "parentId", "level", "allowPosting", "isControl", "description", "updatedAt") VALUES
  ('coa_4300', '4300', 'Keuntungan Penyesuaian Persediaan', 'REVENUE', 'CREDIT', 'coa_4000', 2, true, false, 'Selisih lebih stock opname.', CURRENT_TIMESTAMP),
  ('coa_5300', '5300', 'Kerugian Penyesuaian Persediaan', 'EXPENSE', 'DEBIT', 'coa_5000', 2, true, false, 'Selisih kurang stock opname.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_workflow_read', 'WORKFLOW.APPROVAL.READ', 'Lihat Approval', 'WORKFLOW', 'Melihat inbox dan audit approval.', false, CURRENT_TIMESTAMP),
  ('perm_workflow_rule_manage', 'WORKFLOW.RULE.MANAGE', 'Kelola Approval Rule', 'WORKFLOW', 'Mengelola rule dan tahapan approval.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_opname_read', 'INVENTORY.OPNAME.READ', 'Lihat Stock Opname', 'INVENTORY', 'Melihat dokumen stock opname.', false, CURRENT_TIMESTAMP),
  ('perm_inventory_opname_create', 'INVENTORY.OPNAME.CREATE', 'Buat Stock Opname', 'INVENTORY', 'Membuat dan submit stock opname.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_adjust_approve', 'INVENTORY.ADJUSTMENT.APPROVE', 'Approve Adjustment', 'INVENTORY', 'Menyetujui adjustment stock opname.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_adjust_post', 'INVENTORY.ADJUSTMENT.POST', 'Post Adjustment', 'INVENTORY', 'Mem-posting mutation dan jurnal adjustment.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_super_s9_' || p."id", 'rt_super_admin', p."id" FROM "permissions" p WHERE p."module" = 'WORKFLOW' OR p."code" LIKE 'INVENTORY.OPNAME.%' OR p."code" LIKE 'INVENTORY.ADJUSTMENT.%'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_manager_s9_' || p."id", 'rt_admin_manager', p."id" FROM "permissions" p WHERE p."module" = 'WORKFLOW' OR p."code" LIKE 'INVENTORY.OPNAME.%' OR p."code" LIKE 'INVENTORY.ADJUSTMENT.%'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_logistik_s9_' || p."id", 'rt_admin_logistik', p."id" FROM "permissions" p WHERE p."code" IN ('WORKFLOW.APPROVAL.READ','INVENTORY.OPNAME.READ','INVENTORY.OPNAME.CREATE','INVENTORY.ADJUSTMENT.POST')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "approval_rules" ("id", "ruleCode", "name", "module", "transactionType", "minAmount", "maxAmount", "priority", "createdBy") VALUES
  ('apr_expense_standard', 'EXPENSE_STANDARD', 'Expense standard', 'EXPENSE', 'EXPENSE', 0, 9999999.99, 10, 'SYSTEM'),
  ('apr_expense_high', 'EXPENSE_HIGH_VALUE', 'Expense high value', 'EXPENSE', 'EXPENSE', 10000000, NULL, 100, 'SYSTEM'),
  ('apr_pr_standard', 'PR_STANDARD', 'Purchase request standard', 'PURCHASE_REQUEST', 'PURCHASE_REQUEST', 0, 9999999.99, 10, 'SYSTEM'),
  ('apr_pr_high', 'PR_HIGH_VALUE', 'Purchase request high value', 'PURCHASE_REQUEST', 'PURCHASE_REQUEST', 10000000, NULL, 100, 'SYSTEM'),
  ('apr_stock_request', 'STOCK_REQUEST_STANDARD', 'Stock request', 'STOCK_REQUEST', 'STOCK_REQUEST', 0, NULL, 10, 'SYSTEM'),
  ('apr_stock_opname', 'STOCK_OPNAME_STANDARD', 'Stock opname adjustment', 'STOCK_OPNAME', 'STOCK_OPNAME', 0, NULL, 10, 'SYSTEM');

INSERT INTO "approval_rule_steps" ("id", "approvalRuleId", "stepNo", "name", "permissionCode") VALUES
  ('aps_expense_standard_1', 'apr_expense_standard', 1, 'Expense approver', 'EXPENSE.APPROVE'),
  ('aps_expense_high_1', 'apr_expense_high', 1, 'Expense approver', 'EXPENSE.APPROVE'),
  ('aps_expense_high_2', 'apr_expense_high', 2, 'Final expense approver', 'EXPENSE.APPROVE'),
  ('aps_pr_standard_1', 'apr_pr_standard', 1, 'PR approver', 'PURCHASE_REQUEST.APPROVE'),
  ('aps_pr_high_1', 'apr_pr_high', 1, 'PR approver', 'PURCHASE_REQUEST.APPROVE'),
  ('aps_pr_high_2', 'apr_pr_high', 2, 'Final PR approver', 'PURCHASE_REQUEST.APPROVE'),
  ('aps_stock_request_1', 'apr_stock_request', 1, 'Stock request approver', 'INVENTORY.REQUEST.APPROVE'),
  ('aps_stock_opname_1', 'apr_stock_opname', 1, 'Inventory adjustment approver', 'INVENTORY.ADJUSTMENT.APPROVE');

-- Approval audit is append-only through the application role.
CREATE OR REPLACE FUNCTION prevent_approval_audit_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'approval audit log is immutable'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER approval_audit_no_update BEFORE UPDATE OR DELETE ON "approval_audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_approval_audit_mutation();
