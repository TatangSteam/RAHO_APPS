CREATE TYPE "RevenueRecognitionMethod" AS ENUM ('PER_SESSION');
CREATE TYPE "PackageRevenueContractStatus" AS ENUM ('UNFUNDED', 'ACTIVE', 'FULLY_RECOGNIZED', 'CANCELLED');
CREATE TYPE "DeferredRevenueMovementType" AS ENUM ('FUNDING', 'RECOGNITION', 'REVERSAL');
CREATE TYPE "RevenueRecognitionStatus" AS ENUM ('RESERVED', 'POSTED', 'REVERSED');
CREATE TYPE "DomainEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

CREATE TABLE "package_revenue_policies" (
  "id" TEXT PRIMARY KEY, "packagePricingId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "recognitionMethod" "RevenueRecognitionMethod" NOT NULL DEFAULT 'PER_SESSION',
  "deferredRevenueAccountId" TEXT NOT NULL, "revenueAccountId" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "effectiveTo" TIMESTAMP(3), "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "package_revenue_policies_version_check" CHECK ("version" > 0),
  CONSTRAINT "package_revenue_policies_effective_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);
CREATE UNIQUE INDEX "package_revenue_policies_packagePricingId_key" ON "package_revenue_policies"("packagePricingId");
CREATE INDEX "package_revenue_policies_isActive_effectiveFrom_idx" ON "package_revenue_policies"("isActive", "effectiveFrom");

CREATE TABLE "package_benefit_valuations" (
  "id" TEXT PRIMARY KEY, "memberPackageId" TEXT NOT NULL, "policyId" TEXT, "policyVersion" INTEGER NOT NULL DEFAULT 1,
  "recognitionMethod" "RevenueRecognitionMethod" NOT NULL DEFAULT 'PER_SESSION',
  "standaloneBenefitValue" DECIMAL(18,2) NOT NULL, "allocatedConsideration" DECIMAL(18,2) NOT NULL,
  "totalSessions" INTEGER NOT NULL, "regularSessionRevenue" DECIMAL(18,2) NOT NULL, "finalSessionRevenue" DECIMAL(18,2) NOT NULL,
  "deferredRevenueAccountCode" TEXT NOT NULL DEFAULT '2200', "revenueAccountCode" TEXT NOT NULL DEFAULT '4100',
  "allocationSnapshot" JSONB NOT NULL, "valuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_benefit_valuations_amount_check" CHECK (
    "standaloneBenefitValue" >= 0 AND "allocatedConsideration" >= 0 AND "totalSessions" > 0
    AND "regularSessionRevenue" >= 0 AND "finalSessionRevenue" >= 0
    AND "regularSessionRevenue" * ("totalSessions" - 1) + "finalSessionRevenue" = "allocatedConsideration"
  )
);
CREATE UNIQUE INDEX "package_benefit_valuations_memberPackageId_key" ON "package_benefit_valuations"("memberPackageId");
CREATE INDEX "package_benefit_valuations_policyId_valuedAt_idx" ON "package_benefit_valuations"("policyId", "valuedAt");

CREATE TABLE "package_revenue_contracts" (
  "id" TEXT PRIMARY KEY, "memberPackageId" TEXT NOT NULL, "valuationId" TEXT NOT NULL, "branchId" TEXT NOT NULL,
  "totalConsideration" DECIMAL(18,2) NOT NULL, "fundedDeferredAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "recognizedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "remainingDeferredAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "recognizedSessions" INTEGER NOT NULL DEFAULT 0, "status" "PackageRevenueContractStatus" NOT NULL DEFAULT 'UNFUNDED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "package_revenue_contracts_balance_check" CHECK (
    "totalConsideration" >= 0 AND "fundedDeferredAmount" >= 0 AND "recognizedAmount" >= 0
    AND "fundedDeferredAmount" <= "totalConsideration" AND "recognizedAmount" <= "fundedDeferredAmount"
    AND "remainingDeferredAmount" = "fundedDeferredAmount" - "recognizedAmount" AND "recognizedSessions" >= 0
  )
);
CREATE UNIQUE INDEX "package_revenue_contracts_memberPackageId_key" ON "package_revenue_contracts"("memberPackageId");
CREATE UNIQUE INDEX "package_revenue_contracts_valuationId_key" ON "package_revenue_contracts"("valuationId");
CREATE INDEX "package_revenue_contracts_branchId_status_idx" ON "package_revenue_contracts"("branchId", "status");

CREATE TABLE "deferred_revenue_movements" (
  "id" TEXT PRIMARY KEY, "movementKey" TEXT NOT NULL, "contractId" TEXT NOT NULL, "memberPackageId" TEXT NOT NULL,
  "invoicePaymentId" TEXT, "treatmentSessionId" TEXT, "journalEntryId" TEXT,
  "type" "DeferredRevenueMovementType" NOT NULL, "amount" DECIMAL(18,2) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deferred_revenue_movements_amount_check" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "deferred_revenue_movements_movementKey_key" ON "deferred_revenue_movements"("movementKey");
CREATE UNIQUE INDEX "deferred_revenue_movements_invoicePaymentId_memberPackageId_type_key" ON "deferred_revenue_movements"("invoicePaymentId", "memberPackageId", "type");
CREATE INDEX "deferred_revenue_movements_contractId_occurredAt_idx" ON "deferred_revenue_movements"("contractId", "occurredAt");
CREATE INDEX "deferred_revenue_movements_treatmentSessionId_idx" ON "deferred_revenue_movements"("treatmentSessionId");

CREATE TABLE "domain_events" (
  "id" TEXT PRIMARY KEY, "eventKey" TEXT NOT NULL, "eventType" TEXT NOT NULL, "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "treatmentSessionId" TEXT, "payloadHash" TEXT NOT NULL,
  "payload" JSONB NOT NULL, "status" "DomainEventStatus" NOT NULL DEFAULT 'PENDING',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" TIMESTAMP(3), "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "domain_events_eventKey_key" ON "domain_events"("eventKey");
CREATE UNIQUE INDEX "domain_events_treatmentSessionId_key" ON "domain_events"("treatmentSessionId");
CREATE INDEX "domain_events_eventType_status_occurredAt_idx" ON "domain_events"("eventType", "status", "occurredAt");
CREATE INDEX "domain_events_aggregateType_aggregateId_idx" ON "domain_events"("aggregateType", "aggregateId");

CREATE TABLE "revenue_recognitions" (
  "id" TEXT PRIMARY KEY, "recognitionKey" TEXT NOT NULL, "domainEventId" TEXT NOT NULL, "treatmentSessionId" TEXT NOT NULL,
  "memberPackageId" TEXT NOT NULL, "contractId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "sessionOrdinal" INTEGER NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL, "status" "RevenueRecognitionStatus" NOT NULL DEFAULT 'RESERVED',
  "journalEntryId" TEXT, "recognizedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "revenue_recognitions_amount_check" CHECK ("sessionOrdinal" > 0 AND "amount" > 0),
  CONSTRAINT "revenue_recognitions_posted_check" CHECK ("status" <> 'POSTED' OR ("journalEntryId" IS NOT NULL AND "recognizedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "revenue_recognitions_recognitionKey_key" ON "revenue_recognitions"("recognitionKey");
CREATE UNIQUE INDEX "revenue_recognitions_treatmentSessionId_memberPackageId_key" ON "revenue_recognitions"("treatmentSessionId", "memberPackageId");
CREATE INDEX "revenue_recognitions_contractId_status_idx" ON "revenue_recognitions"("contractId", "status");
CREATE INDEX "revenue_recognitions_branchId_recognizedAt_idx" ON "revenue_recognitions"("branchId", "recognizedAt");
CREATE INDEX "revenue_recognitions_journalEntryId_idx" ON "revenue_recognitions"("journalEntryId");

ALTER TABLE "package_revenue_policies" ADD CONSTRAINT "package_revenue_policies_packagePricingId_fkey" FOREIGN KEY ("packagePricingId") REFERENCES "package_pricings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_revenue_policies" ADD CONSTRAINT "package_revenue_policies_deferredRevenueAccountId_fkey" FOREIGN KEY ("deferredRevenueAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_revenue_policies" ADD CONSTRAINT "package_revenue_policies_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_revenue_policies" ADD CONSTRAINT "package_revenue_policies_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_benefit_valuations" ADD CONSTRAINT "package_benefit_valuations_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_benefit_valuations" ADD CONSTRAINT "package_benefit_valuations_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "package_revenue_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_revenue_contracts" ADD CONSTRAINT "package_revenue_contracts_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_revenue_contracts" ADD CONSTRAINT "package_revenue_contracts_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "package_benefit_valuations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_revenue_contracts" ADD CONSTRAINT "package_revenue_contracts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deferred_revenue_movements" ADD CONSTRAINT "deferred_revenue_movements_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "package_revenue_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deferred_revenue_movements" ADD CONSTRAINT "deferred_revenue_movements_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deferred_revenue_movements" ADD CONSTRAINT "deferred_revenue_movements_invoicePaymentId_fkey" FOREIGN KEY ("invoicePaymentId") REFERENCES "invoice_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deferred_revenue_movements" ADD CONSTRAINT "deferred_revenue_movements_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deferred_revenue_movements" ADD CONSTRAINT "deferred_revenue_movements_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_recognitions" ADD CONSTRAINT "revenue_recognitions_domainEventId_fkey" FOREIGN KEY ("domainEventId") REFERENCES "domain_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_recognitions" ADD CONSTRAINT "revenue_recognitions_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_recognitions" ADD CONSTRAINT "revenue_recognitions_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_recognitions" ADD CONSTRAINT "revenue_recognitions_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "package_revenue_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_recognitions" ADD CONSTRAINT "revenue_recognitions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_recognitions" ADD CONSTRAINT "revenue_recognitions_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
 ('perm_deferred_revenue_read','DEFERRED_REVENUE.READ','Lihat Deferred Revenue','REVENUE','Melihat valuasi, kontrak, movement, dan event revenue.',true,CURRENT_TIMESTAMP),
 ('perm_revenue_policy_manage','REVENUE.POLICY.MANAGE','Kelola Revenue Policy','REVENUE','Mengatur akun dan metode revenue per session.',true,CURRENT_TIMESTAMP),
 ('perm_revenue_recognize','REVENUE.RECOGNIZE','Posting Revenue Recognition','REVENUE','Memproses TREATMENT_COMPLETED menjadi revenue.',true,CURRENT_TIMESTAMP);
INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_super_s7_' || "id", 'rt_super_admin', "id" FROM "permissions" WHERE "module" = 'REVENUE';
INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_manager_s7_' || "id", 'rt_admin_manager', "id" FROM "permissions" WHERE "module" = 'REVENUE';

-- Upgrade-safe baseline for packages that already existed before Sprint 7.
INSERT INTO "package_benefit_valuations" (
  "id", "memberPackageId", "policyVersion", "standaloneBenefitValue", "allocatedConsideration", "totalSessions",
  "regularSessionRevenue", "finalSessionRevenue", "allocationSnapshot", "valuedAt", "createdAt"
)
SELECT CONCAT('s7_val_', mp."id"), mp."id", 1, COALESCE(pp."price", mp."finalPrice"), mp."finalPrice", mp."totalSessions",
  TRUNC(mp."finalPrice" / mp."totalSessions", 2),
  mp."finalPrice" - TRUNC(mp."finalPrice" / mp."totalSessions", 2) * (mp."totalSessions" - 1),
  jsonb_build_object('source', 'SPRINT_7_BACKFILL', 'packageCode', mp."packageCode"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "member_packages" mp LEFT JOIN "package_pricings" pp ON pp."id" = mp."packagePricingId"
WHERE mp."totalSessions" > 0;

INSERT INTO "package_revenue_contracts" (
  "id", "memberPackageId", "valuationId", "branchId", "totalConsideration", "fundedDeferredAmount",
  "recognizedAmount", "remainingDeferredAmount", "recognizedSessions", "status", "createdAt", "updatedAt"
)
SELECT CONCAT('s7_contract_', mp."id"), mp."id", CONCAT('s7_val_', mp."id"), mp."branchId", mp."finalPrice",
  LEAST(mp."finalPrice", COALESCE(mp."totalVerifiedPaid", 0)), 0,
  LEAST(mp."finalPrice", COALESCE(mp."totalVerifiedPaid", 0)), 0,
  CASE WHEN COALESCE(mp."totalVerifiedPaid", 0) > 0 THEN 'ACTIVE'::"PackageRevenueContractStatus" ELSE 'UNFUNDED'::"PackageRevenueContractStatus" END,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "member_packages" mp WHERE mp."totalSessions" > 0;

INSERT INTO "deferred_revenue_movements" (
  "id", "movementKey", "contractId", "memberPackageId", "type", "amount", "occurredAt", "metadata", "createdAt"
)
SELECT CONCAT('s7_movement_', mp."id"), CONCAT('SPRINT_7_BACKFILL:', mp."id"), CONCAT('s7_contract_', mp."id"), mp."id",
  'FUNDING'::"DeferredRevenueMovementType", LEAST(mp."finalPrice", mp."totalVerifiedPaid"),
  COALESCE(mp."verifiedAt", mp."createdAt"), jsonb_build_object('source', 'SPRINT_7_BACKFILL', 'journalTrace', 'OPENING_RECONCILIATION_REQUIRED'), CURRENT_TIMESTAMP
FROM "member_packages" mp WHERE mp."totalSessions" > 0 AND mp."totalVerifiedPaid" > 0;
