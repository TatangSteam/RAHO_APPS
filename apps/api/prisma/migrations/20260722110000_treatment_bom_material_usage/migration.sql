CREATE TYPE "TreatmentBomStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');
CREATE TYPE "MaterialUsageStatus" AS ENUM ('DRAFT', 'CONSUMED', 'REVERSED');
CREATE TYPE "MaterialDeviationReason" AS ENUM (
  'CLINICAL_ADJUSTMENT',
  'PATIENT_CONDITION',
  'MATERIAL_SUBSTITUTION',
  'WASTE_DAMAGE',
  'STOCK_AVAILABILITY',
  'OTHER'
);
CREATE TYPE "IntegrationEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

ALTER TABLE "treatment_sessions"
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "completedBy" TEXT,
  ADD COLUMN "materialPostingId" TEXT;

ALTER TABLE "material_usages"
  ALTER COLUMN "quantity" TYPE DECIMAL(18,4),
  ADD COLUMN "usageKey" TEXT,
  ADD COLUMN "treatmentBomItemId" TEXT,
  ADD COLUMN "baseQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "recommendedQuantity" DECIMAL(18,4),
  ADD COLUMN "deviationReason" "MaterialDeviationReason",
  ADD COLUMN "deviationNotes" TEXT,
  ADD COLUMN "status" "MaterialUsageStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "inventoryPostingId" TEXT,
  ADD COLUMN "actualUnitCost" DECIMAL(18,4),
  ADD COLUMN "totalActualCost" DECIMAL(18,4),
  ADD COLUMN "isLegacyConsumption" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "consumedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "material_usages" usage
SET
  "baseQuantity" = ROUND(
    usage."quantity" / NULLIF(product."conversion_factor", 0),
    4
  ),
  "status" = 'CONSUMED',
  "isLegacyConsumption" = true,
  "consumedAt" = usage."createdAt"
FROM "inventory_items" item
JOIN "master_products" product ON product."id" = item."masterProductId"
WHERE usage."inventoryItemId" = item."id";

CREATE TABLE "treatment_boms" (
  "id" TEXT NOT NULL,
  "bomCode" TEXT NOT NULL,
  "packagePricingId" TEXT NOT NULL,
  "branchId" TEXT,
  "branchScopeKey" TEXT NOT NULL DEFAULT 'GLOBAL',
  "version" INTEGER NOT NULL,
  "status" "TreatmentBomStatus" NOT NULL DEFAULT 'DRAFT',
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "activatedBy" TEXT,
  "activatedAt" TIMESTAMP(3),
  "supersededById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "treatment_boms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "treatment_bom_items" (
  "id" TEXT NOT NULL,
  "treatmentBomId" TEXT NOT NULL,
  "masterProductId" TEXT NOT NULL,
  "recommendedQuantity" DECIMAL(18,4) NOT NULL,
  "unitSnapshot" TEXT NOT NULL,
  "tolerancePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "treatment_bom_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_events" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventVersion" INTEGER NOT NULL DEFAULT 1,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "branchId" TEXT,
  "payload" JSONB NOT NULL,
  "status" "IntegrationEventStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "treatment_sessions_materialPostingId_key" ON "treatment_sessions"("materialPostingId");
CREATE UNIQUE INDEX "material_usages_usageKey_key" ON "material_usages"("usageKey");
CREATE INDEX "material_usages_treatmentSessionId_status_idx" ON "material_usages"("treatmentSessionId", "status");
CREATE INDEX "material_usages_treatmentBomItemId_idx" ON "material_usages"("treatmentBomItemId");
CREATE INDEX "material_usages_inventoryPostingId_idx" ON "material_usages"("inventoryPostingId");
CREATE UNIQUE INDEX "treatment_boms_bomCode_key" ON "treatment_boms"("bomCode");
CREATE UNIQUE INDEX "treatment_boms_packagePricingId_branchScopeKey_version_key" ON "treatment_boms"("packagePricingId", "branchScopeKey", "version");
CREATE UNIQUE INDEX "treatment_boms_one_active_scope_key" ON "treatment_boms"("packagePricingId", "branchScopeKey") WHERE "status" = 'ACTIVE';
CREATE INDEX "treatment_boms_packagePricingId_branchScopeKey_status_idx" ON "treatment_boms"("packagePricingId", "branchScopeKey", "status");
CREATE INDEX "treatment_boms_branchId_status_idx" ON "treatment_boms"("branchId", "status");
CREATE INDEX "treatment_boms_effectiveFrom_effectiveTo_idx" ON "treatment_boms"("effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "treatment_bom_items_treatmentBomId_masterProductId_key" ON "treatment_bom_items"("treatmentBomId", "masterProductId");
CREATE INDEX "treatment_bom_items_masterProductId_idx" ON "treatment_bom_items"("masterProductId");
CREATE UNIQUE INDEX "integration_events_eventType_aggregateId_key" ON "integration_events"("eventType", "aggregateId");
CREATE INDEX "integration_events_status_availableAt_createdAt_idx" ON "integration_events"("status", "availableAt", "createdAt");
CREATE INDEX "integration_events_branchId_occurredAt_idx" ON "integration_events"("branchId", "occurredAt");

ALTER TABLE "treatment_sessions"
  ADD CONSTRAINT "treatment_sessions_materialPostingId_fkey"
  FOREIGN KEY ("materialPostingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_usages"
  ADD CONSTRAINT "material_usages_treatmentBomItemId_fkey"
  FOREIGN KEY ("treatmentBomItemId") REFERENCES "treatment_bom_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_usages"
  ADD CONSTRAINT "material_usages_inventoryPostingId_fkey"
  FOREIGN KEY ("inventoryPostingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treatment_boms"
  ADD CONSTRAINT "treatment_boms_packagePricingId_fkey"
  FOREIGN KEY ("packagePricingId") REFERENCES "package_pricings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treatment_boms"
  ADD CONSTRAINT "treatment_boms_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treatment_boms"
  ADD CONSTRAINT "treatment_boms_supersededById_fkey"
  FOREIGN KEY ("supersededById") REFERENCES "treatment_boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treatment_bom_items"
  ADD CONSTRAINT "treatment_bom_items_treatmentBomId_fkey"
  FOREIGN KEY ("treatmentBomId") REFERENCES "treatment_boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "treatment_bom_items"
  ADD CONSTRAINT "treatment_bom_items_masterProductId_fkey"
  FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_treatment_bom_read', 'TREATMENT.BOM.READ', 'Lihat Treatment BOM', 'TREATMENT', 'Melihat BOM dan rekomendasi material treatment dalam branch scope.', false, CURRENT_TIMESTAMP),
  ('perm_treatment_bom_manage', 'TREATMENT.BOM.MANAGE', 'Kelola Treatment BOM', 'TREATMENT', 'Membuat versi dan mengaktifkan Treatment BOM.', true, CURRENT_TIMESTAMP),
  ('perm_treatment_material_record', 'TREATMENT.MATERIAL.RECORD', 'Catat Material Aktual', 'TREATMENT', 'Mencatat material aktual dan alasan deviasi treatment.', true, CURRENT_TIMESTAMP),
  ('perm_treatment_material_consume', 'TREATMENT.MATERIAL.CONSUME', 'Konsumsi Material Treatment', 'TREATMENT', 'Memposting konsumsi material FIFO saat treatment diselesaikan.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_treatment_admin_' || rt."id" || '_' || p."id", rt."id", p."id"
FROM "role_templates" rt CROSS JOIN "permissions" p
WHERE rt."baseRole" IN ('SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'ADMIN_CABANG')
  AND p."code" IN ('TREATMENT.BOM.READ', 'TREATMENT.BOM.MANAGE', 'TREATMENT.MATERIAL.RECORD', 'TREATMENT.MATERIAL.CONSUME')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_treatment_clinical_' || rt."id" || '_' || p."id", rt."id", p."id"
FROM "role_templates" rt CROSS JOIN "permissions" p
WHERE rt."baseRole" IN ('ADMIN_LAYANAN', 'DOCTOR', 'NURSE')
  AND p."code" IN ('TREATMENT.BOM.READ', 'TREATMENT.MATERIAL.RECORD', 'TREATMENT.MATERIAL.CONSUME')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
