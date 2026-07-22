-- Sprint 9 extends the generic approval and stock-opname foundation introduced by
-- 20260722130000_generic_approval_stock_opname. Keep this migration additive so
-- both features share one workflow engine and one set of opname tables.

ALTER TYPE "StockOpnameStatus" ADD VALUE IF NOT EXISTS 'COUNTING';
ALTER TYPE "StockOpnameStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';

CREATE TYPE "InventoryAdjustmentDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "InventoryAdjustmentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED');
CREATE TYPE "StockOpnameResolution" AS ENUM ('PENDING', 'ADJUST', 'RECOUNT', 'ACCEPTED');
CREATE TYPE "DiscrepancyResolutionAction" AS ENUM ('RELEASE_TO_STOCK', 'RETURN_TO_SENDER', 'WRITE_OFF', 'NO_STOCK_ACTION');

CREATE TABLE "inventory_adjustment_reason_codes" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "direction" "InventoryAdjustmentDirection",
  "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "approvalThreshold" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "gainAccountCode" TEXT NOT NULL DEFAULT '4300',
  "lossAccountCode" TEXT NOT NULL DEFAULT '5210',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_adjustment_reason_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_adjustments" (
  "id" TEXT NOT NULL,
  "adjustmentNumber" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "stockLocationId" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "status" "InventoryAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
  "description" TEXT NOT NULL,
  "totalEstimatedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalPostedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "approvalInstanceId" TEXT,
  "sourceType" TEXT NOT NULL DEFAULT 'MANUAL_ADJUSTMENT',
  "sourceId" TEXT,
  "stockOpnameId" TEXT,
  "inboundPostingId" TEXT,
  "outboundPostingId" TEXT,
  "journalEntryId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "rejectionReason" TEXT,
  "postedAt" TIMESTAMP(3),
  "postedBy" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_adjustments_approval_fkey" FOREIGN KEY ("approvalInstanceId") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "inventory_adjustment_lines" (
  "id" TEXT NOT NULL,
  "inventoryAdjustmentId" TEXT NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "batchId" TEXT,
  "direction" "InventoryAdjustmentDirection" NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,4),
  "estimatedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "postedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "inventoryPostingId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_adjustment_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_adjustment_lines_adjustment_fkey" FOREIGN KEY ("inventoryAdjustmentId") REFERENCES "inventory_adjustments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "stock_opnames"
  ADD COLUMN "warehouseId" TEXT,
  ADD COLUMN "stockLocationId" TEXT,
  ADD COLUMN "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lockToken" TEXT,
  ADD COLUMN "startedBy" TEXT,
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "adjustmentId" TEXT,
  ADD COLUMN "postedBy" TEXT,
  ADD COLUMN "cancelledBy" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3);

ALTER TABLE "stock_opname_lines"
  ADD COLUMN "inventoryBalanceId" TEXT,
  ADD COLUMN "systemUnitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "systemValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "resolvedUnitCost" DECIMAL(18,4),
  ADD COLUMN "resolution" "StockOpnameResolution" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "resolutionNote" TEXT,
  ADD COLUMN "countedBy" TEXT,
  ADD COLUMN "countedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "shipment_discrepancies"
  ADD COLUMN "resolutionAction" "DiscrepancyResolutionAction",
  ADD COLUMN "resolutionQty" DECIMAL(18,4),
  ADD COLUMN "resolutionKey" TEXT,
  ADD COLUMN "inventoryPostingId" TEXT,
  ADD COLUMN "journalEntryId" TEXT;

ALTER TABLE "homecare_bag_usages" ADD COLUMN "multiBagUsageId" TEXT;

CREATE TABLE "homecare_multi_bag_usages" (
  "id" TEXT NOT NULL,
  "completionNumber" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "treatmentSessionId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "status" "HomecareBagUsageStatus" NOT NULL DEFAULT 'COMPLETED',
  "usageIds" JSONB NOT NULL,
  "bagCount" INTEGER NOT NULL,
  "totalItemLines" INTEGER NOT NULL,
  "notes" TEXT NOT NULL,
  "completedBy" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "homecare_multi_bag_usages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_adjustment_reason_codes_code_key" ON "inventory_adjustment_reason_codes"("code");
CREATE INDEX "inventory_adjustment_reason_codes_isActive_direction_idx" ON "inventory_adjustment_reason_codes"("isActive", "direction");
CREATE UNIQUE INDEX "inventory_adjustments_adjustmentNumber_key" ON "inventory_adjustments"("adjustmentNumber");
CREATE UNIQUE INDEX "inventory_adjustments_idempotencyKey_key" ON "inventory_adjustments"("idempotencyKey");
CREATE UNIQUE INDEX "inventory_adjustments_approvalInstanceId_key" ON "inventory_adjustments"("approvalInstanceId");
CREATE UNIQUE INDEX "inventory_adjustments_inboundPostingId_key" ON "inventory_adjustments"("inboundPostingId");
CREATE UNIQUE INDEX "inventory_adjustments_outboundPostingId_key" ON "inventory_adjustments"("outboundPostingId");
CREATE UNIQUE INDEX "inventory_adjustments_journalEntryId_key" ON "inventory_adjustments"("journalEntryId");
CREATE INDEX "inventory_adjustments_branchId_status_createdAt_idx" ON "inventory_adjustments"("branchId", "status", "createdAt");
CREATE INDEX "inventory_adjustments_stockLocationId_status_idx" ON "inventory_adjustments"("stockLocationId", "status");
CREATE INDEX "inventory_adjustments_stockOpnameId_idx" ON "inventory_adjustments"("stockOpnameId");
CREATE UNIQUE INDEX "inventory_adjustment_lines_inventoryAdjustmentId_lineNo_key" ON "inventory_adjustment_lines"("inventoryAdjustmentId", "lineNo");
CREATE INDEX "inventory_adjustment_lines_inventoryItemId_batchId_idx" ON "inventory_adjustment_lines"("inventoryItemId", "batchId");
CREATE INDEX "inventory_adjustment_lines_inventoryPostingId_idx" ON "inventory_adjustment_lines"("inventoryPostingId");
CREATE UNIQUE INDEX "stock_opnames_lockToken_key" ON "stock_opnames"("lockToken");
CREATE UNIQUE INDEX "stock_opnames_adjustmentId_key" ON "stock_opnames"("adjustmentId");
CREATE INDEX "stock_opnames_stockLocationId_status_idx" ON "stock_opnames"("stockLocationId", "status");
CREATE UNIQUE INDEX "stock_opname_lines_stockOpnameId_inventoryBalanceId_key" ON "stock_opname_lines"("stockOpnameId", "inventoryBalanceId");
CREATE UNIQUE INDEX "shipment_discrepancies_resolutionKey_key" ON "shipment_discrepancies"("resolutionKey");
CREATE UNIQUE INDEX "shipment_discrepancies_inventoryPostingId_key" ON "shipment_discrepancies"("inventoryPostingId");
CREATE UNIQUE INDEX "shipment_discrepancies_journalEntryId_key" ON "shipment_discrepancies"("journalEntryId");
CREATE INDEX "homecare_bag_usages_multiBagUsageId_idx" ON "homecare_bag_usages"("multiBagUsageId");
CREATE UNIQUE INDEX "homecare_bag_usages_treatmentSessionId_bagId_key" ON "homecare_bag_usages"("treatmentSessionId", "bagId");
CREATE UNIQUE INDEX "homecare_multi_bag_usages_completionNumber_key" ON "homecare_multi_bag_usages"("completionNumber");
CREATE UNIQUE INDEX "homecare_multi_bag_usages_idempotencyKey_key" ON "homecare_multi_bag_usages"("idempotencyKey");
CREATE UNIQUE INDEX "homecare_multi_bag_usages_treatmentSessionId_key" ON "homecare_multi_bag_usages"("treatmentSessionId");
CREATE INDEX "homecare_multi_bag_usages_teamId_completedAt_idx" ON "homecare_multi_bag_usages"("teamId", "completedAt");
CREATE INDEX "homecare_multi_bag_usages_branchId_completedAt_idx" ON "homecare_multi_bag_usages"("branchId", "completedAt");

INSERT INTO "accounts" ("id", "code", "name", "type", "normalBalance", "parentId", "level", "allowPosting", "isControl", "description", "updatedAt") VALUES
  ('coa_5210', '5210', 'Kerugian Penyesuaian Persediaan', 'EXPENSE', 'DEBIT', 'coa_5000', 2, true, false, 'Selisih kurang adjustment dan stock opname.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "inventory_adjustment_reason_codes" ("id", "code", "name", "direction", "requiresApproval", "approvalThreshold", "gainAccountCode", "lossAccountCode", "updatedAt") VALUES
  ('adj_reason_opname', 'STOCK_OPNAME', 'Selisih stock opname', NULL, true, 0, '4300', '5210', CURRENT_TIMESTAMP),
  ('adj_reason_expired', 'EXPIRED', 'Persediaan kedaluwarsa', 'OUT', true, 0, '4300', '5210', CURRENT_TIMESTAMP),
  ('adj_reason_damaged', 'DAMAGED', 'Persediaan rusak', 'OUT', true, 0, '4300', '5210', CURRENT_TIMESTAMP),
  ('adj_reason_lost', 'LOST', 'Persediaan hilang', 'OUT', true, 0, '4300', '5210', CURRENT_TIMESTAMP),
  ('adj_reason_found', 'FOUND', 'Persediaan ditemukan', 'IN', true, 0, '4300', '5210', CURRENT_TIMESTAMP),
  ('adj_reason_other', 'OTHER', 'Penyesuaian lainnya', NULL, true, 0, '4300', '5210', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_inventory_adjustment_read', 'INVENTORY.ADJUSTMENT.READ', 'Lihat Adjustment', 'INVENTORY', 'Melihat dokumen penyesuaian stok.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_adjustment_create', 'INVENTORY.ADJUSTMENT.CREATE', 'Buat Adjustment', 'INVENTORY', 'Membuat dan mengajukan adjustment stok.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_opname_count', 'INVENTORY.OPNAME.COUNT', 'Hitung Stock Opname', 'INVENTORY', 'Memulai dan mengisi hitungan stock opname.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_opname_approve', 'INVENTORY.OPNAME.APPROVE', 'Approve Stock Opname', 'INVENTORY', 'Menyetujui resolusi selisih stock opname.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_opname_post', 'INVENTORY.OPNAME.POST', 'Post Stock Opname', 'INVENTORY', 'Membentuk mutation dan journal dari opname.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_discrepancy_resolve', 'INVENTORY.DISCREPANCY.RESOLVE', 'Resolve Discrepancy', 'INVENTORY', 'Menyelesaikan discrepancy dan quarantine.', true, CURRENT_TIMESTAMP),
  ('perm_homecare_multi_bag_complete', 'HOMECARE.MULTI_BAG.COMPLETE', 'Finalisasi Multi Tas Homecare', 'INVENTORY', 'Mencatat konsumsi satu sesi dari beberapa tas.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "approval_rules" ("id", "ruleCode", "name", "module", "transactionType", "minAmount", "maxAmount", "priority", "createdBy") VALUES
  ('apr_inventory_adjustment_standard', 'INVENTORY_ADJUSTMENT_STANDARD', 'Inventory adjustment standard', 'INVENTORY_ADJUSTMENT', '*', 0, 9999999.99, 10, 'SYSTEM'),
  ('apr_inventory_adjustment_high', 'INVENTORY_ADJUSTMENT_HIGH_VALUE', 'Inventory adjustment high value', 'INVENTORY_ADJUSTMENT', '*', 10000000, NULL, 100, 'SYSTEM')
ON CONFLICT ("ruleCode") DO NOTHING;

INSERT INTO "approval_rule_steps" ("id", "approvalRuleId", "stepNo", "name", "permissionCode")
SELECT 'aps_inventory_adjustment_standard_1', "id", 1, 'Inventory adjustment approver', 'INVENTORY.ADJUSTMENT.APPROVE'
FROM "approval_rules" WHERE "ruleCode" = 'INVENTORY_ADJUSTMENT_STANDARD'
ON CONFLICT ("approvalRuleId", "stepNo") DO NOTHING;

INSERT INTO "approval_rule_steps" ("id", "approvalRuleId", "stepNo", "name", "permissionCode")
SELECT step."id", rule."id", step."stepNo", step."name", 'INVENTORY.ADJUSTMENT.APPROVE'
FROM "approval_rules" rule
CROSS JOIN (VALUES
  ('aps_inventory_adjustment_high_1', 1, 'Inventory adjustment approver'),
  ('aps_inventory_adjustment_high_2', 2, 'Final inventory adjustment approver')
) AS step("id", "stepNo", "name")
WHERE rule."ruleCode" = 'INVENTORY_ADJUSTMENT_HIGH_VALUE'
ON CONFLICT ("approvalRuleId", "stepNo") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 's9_super_' || p."id", 'rt_super_admin', p."id" FROM "permissions" p
WHERE p."code" LIKE 'INVENTORY.ADJUSTMENT.%' OR p."code" LIKE 'INVENTORY.OPNAME.%' OR p."code" IN ('INVENTORY.DISCREPANCY.RESOLVE', 'HOMECARE.MULTI_BAG.COMPLETE')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 's9_manager_' || p."id", 'rt_admin_manager', p."id" FROM "permissions" p
WHERE p."code" IN ('INVENTORY.ADJUSTMENT.READ','INVENTORY.ADJUSTMENT.APPROVE','INVENTORY.ADJUSTMENT.POST','INVENTORY.OPNAME.READ','INVENTORY.OPNAME.APPROVE','INVENTORY.OPNAME.POST','INVENTORY.DISCREPANCY.RESOLVE','HOMECARE.MULTI_BAG.COMPLETE')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 's9_logistik_' || p."id", 'rt_admin_logistik', p."id" FROM "permissions" p
WHERE p."code" IN ('INVENTORY.ADJUSTMENT.READ','INVENTORY.ADJUSTMENT.CREATE','INVENTORY.ADJUSTMENT.POST','INVENTORY.OPNAME.READ','INVENTORY.OPNAME.CREATE','INVENTORY.OPNAME.COUNT','INVENTORY.OPNAME.POST','INVENTORY.DISCREPANCY.RESOLVE','HOMECARE.MULTI_BAG.COMPLETE')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 's9_cabang_' || p."id", 'rt_admin_cabang', p."id" FROM "permissions" p
WHERE p."code" IN ('INVENTORY.ADJUSTMENT.READ','INVENTORY.ADJUSTMENT.CREATE','INVENTORY.OPNAME.READ','INVENTORY.OPNAME.CREATE','INVENTORY.OPNAME.COUNT','HOMECARE.MULTI_BAG.COMPLETE')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
