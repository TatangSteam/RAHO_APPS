-- Production recovery for a partially applied Sprint 7 migration.
-- Every statement is idempotent because PostgreSQL may have committed earlier
-- statements before the original migration failed during its data backfill.

DO $$ BEGIN
  CREATE TYPE "RevenueRecognitionMethod" AS ENUM ('PER_SESSION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "PackageRevenueContractStatus" AS ENUM ('UNFUNDED', 'ACTIVE', 'FULLY_RECOGNIZED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "DeferredRevenueMovementType" AS ENUM ('FUNDING', 'RECOGNITION', 'REVERSAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "RevenueRecognitionStatus" AS ENUM ('RESERVED', 'POSTED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "DomainEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "package_revenue_policies" (
  "id" TEXT PRIMARY KEY,
  "packagePricingId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "recognitionMethod" "RevenueRecognitionMethod" NOT NULL DEFAULT 'PER_SESSION',
  "deferredRevenueAccountId" TEXT NOT NULL,
  "revenueAccountId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "package_revenue_policies_version_check" CHECK ("version" > 0),
  CONSTRAINT "package_revenue_policies_effective_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE IF NOT EXISTS "package_benefit_valuations" (
  "id" TEXT PRIMARY KEY,
  "memberPackageId" TEXT NOT NULL,
  "policyId" TEXT,
  "policyVersion" INTEGER NOT NULL DEFAULT 1,
  "recognitionMethod" "RevenueRecognitionMethod" NOT NULL DEFAULT 'PER_SESSION',
  "standaloneBenefitValue" DECIMAL(18,2) NOT NULL,
  "allocatedConsideration" DECIMAL(18,2) NOT NULL,
  "totalSessions" INTEGER NOT NULL,
  "regularSessionRevenue" DECIMAL(18,2) NOT NULL,
  "finalSessionRevenue" DECIMAL(18,2) NOT NULL,
  "deferredRevenueAccountCode" TEXT NOT NULL DEFAULT '2200',
  "revenueAccountCode" TEXT NOT NULL DEFAULT '4100',
  "allocationSnapshot" JSONB NOT NULL,
  "valuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_benefit_valuations_amount_check" CHECK (
    "standaloneBenefitValue" >= 0 AND "allocatedConsideration" >= 0 AND "totalSessions" > 0
    AND "regularSessionRevenue" >= 0 AND "finalSessionRevenue" >= 0
    AND "regularSessionRevenue" * ("totalSessions" - 1) + "finalSessionRevenue" = "allocatedConsideration"
  )
);

CREATE TABLE IF NOT EXISTS "package_revenue_contracts" (
  "id" TEXT PRIMARY KEY,
  "memberPackageId" TEXT NOT NULL,
  "valuationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "totalConsideration" DECIMAL(18,2) NOT NULL,
  "fundedDeferredAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "recognizedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "remainingDeferredAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "recognizedSessions" INTEGER NOT NULL DEFAULT 0,
  "status" "PackageRevenueContractStatus" NOT NULL DEFAULT 'UNFUNDED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "package_revenue_contracts_balance_check" CHECK (
    "totalConsideration" >= 0 AND "fundedDeferredAmount" >= 0 AND "recognizedAmount" >= 0
    AND "fundedDeferredAmount" <= "totalConsideration" AND "recognizedAmount" <= "fundedDeferredAmount"
    AND "remainingDeferredAmount" = "fundedDeferredAmount" - "recognizedAmount" AND "recognizedSessions" >= 0
  )
);

CREATE TABLE IF NOT EXISTS "deferred_revenue_movements" (
  "id" TEXT PRIMARY KEY,
  "movementKey" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "memberPackageId" TEXT NOT NULL,
  "invoicePaymentId" TEXT,
  "treatmentSessionId" TEXT,
  "journalEntryId" TEXT,
  "type" "DeferredRevenueMovementType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deferred_revenue_movements_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE IF NOT EXISTS "domain_events" (
  "id" TEXT PRIMARY KEY,
  "eventKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "treatmentSessionId" TEXT,
  "payloadHash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "DomainEventStatus" NOT NULL DEFAULT 'PENDING',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "revenue_recognitions" (
  "id" TEXT PRIMARY KEY,
  "recognitionKey" TEXT NOT NULL,
  "domainEventId" TEXT NOT NULL,
  "treatmentSessionId" TEXT NOT NULL,
  "memberPackageId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "sessionOrdinal" INTEGER NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "status" "RevenueRecognitionStatus" NOT NULL DEFAULT 'RESERVED',
  "journalEntryId" TEXT,
  "recognizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "revenue_recognitions_amount_check" CHECK ("sessionOrdinal" > 0 AND "amount" > 0),
  CONSTRAINT "revenue_recognitions_posted_check" CHECK ("status" <> 'POSTED' OR ("journalEntryId" IS NOT NULL AND "recognizedAt" IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS "package_revenue_policies_packagePricingId_key" ON "package_revenue_policies"("packagePricingId");
CREATE INDEX IF NOT EXISTS "package_revenue_policies_isActive_effectiveFrom_idx" ON "package_revenue_policies"("isActive", "effectiveFrom");
CREATE UNIQUE INDEX IF NOT EXISTS "package_benefit_valuations_memberPackageId_key" ON "package_benefit_valuations"("memberPackageId");
CREATE INDEX IF NOT EXISTS "package_benefit_valuations_policyId_valuedAt_idx" ON "package_benefit_valuations"("policyId", "valuedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "package_revenue_contracts_memberPackageId_key" ON "package_revenue_contracts"("memberPackageId");
CREATE UNIQUE INDEX IF NOT EXISTS "package_revenue_contracts_valuationId_key" ON "package_revenue_contracts"("valuationId");
CREATE INDEX IF NOT EXISTS "package_revenue_contracts_branchId_status_idx" ON "package_revenue_contracts"("branchId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "deferred_revenue_movements_movementKey_key" ON "deferred_revenue_movements"("movementKey");
CREATE UNIQUE INDEX IF NOT EXISTS "deferred_revenue_movements_invoicePaymentId_memberPackageId_type_key" ON "deferred_revenue_movements"("invoicePaymentId", "memberPackageId", "type");
CREATE INDEX IF NOT EXISTS "deferred_revenue_movements_contractId_occurredAt_idx" ON "deferred_revenue_movements"("contractId", "occurredAt");
CREATE INDEX IF NOT EXISTS "deferred_revenue_movements_treatmentSessionId_idx" ON "deferred_revenue_movements"("treatmentSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "domain_events_eventKey_key" ON "domain_events"("eventKey");
CREATE UNIQUE INDEX IF NOT EXISTS "domain_events_treatmentSessionId_key" ON "domain_events"("treatmentSessionId");
CREATE INDEX IF NOT EXISTS "domain_events_eventType_status_occurredAt_idx" ON "domain_events"("eventType", "status", "occurredAt");
CREATE INDEX IF NOT EXISTS "domain_events_aggregateType_aggregateId_idx" ON "domain_events"("aggregateType", "aggregateId");
CREATE UNIQUE INDEX IF NOT EXISTS "revenue_recognitions_recognitionKey_key" ON "revenue_recognitions"("recognitionKey");
CREATE UNIQUE INDEX IF NOT EXISTS "revenue_recognitions_treatmentSessionId_memberPackageId_key" ON "revenue_recognitions"("treatmentSessionId", "memberPackageId");
CREATE INDEX IF NOT EXISTS "revenue_recognitions_contractId_status_idx" ON "revenue_recognitions"("contractId", "status");
CREATE INDEX IF NOT EXISTS "revenue_recognitions_branchId_recognizedAt_idx" ON "revenue_recognitions"("branchId", "recognizedAt");
CREATE INDEX IF NOT EXISTS "revenue_recognitions_journalEntryId_idx" ON "revenue_recognitions"("journalEntryId");

DO $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('package_revenue_policies', 'package_revenue_policies_packagePricingId_fkey', 'ALTER TABLE "package_revenue_policies" ADD CONSTRAINT "package_revenue_policies_packagePricingId_fkey" FOREIGN KEY ("packagePricingId") REFERENCES "package_pricings"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('package_revenue_policies', 'package_revenue_policies_deferredRevenueAccountId_fkey', 'ALTER TABLE "package_revenue_policies" ADD CONSTRAINT "package_revenue_policies_deferredRevenueAccountId_fkey" FOREIGN KEY ("deferredRevenueAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('package_revenue_policies', 'package_revenue_policies_revenueAccountId_fkey', 'ALTER TABLE "package_revenue_policies" ADD CONSTRAINT "package_revenue_policies_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('package_revenue_policies', 'package_revenue_policies_createdBy_fkey', 'ALTER TABLE "package_revenue_policies" ADD CONSTRAINT "package_revenue_policies_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('package_benefit_valuations', 'package_benefit_valuations_memberPackageId_fkey', 'ALTER TABLE "package_benefit_valuations" ADD CONSTRAINT "package_benefit_valuations_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('package_benefit_valuations', 'package_benefit_valuations_policyId_fkey', 'ALTER TABLE "package_benefit_valuations" ADD CONSTRAINT "package_benefit_valuations_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "package_revenue_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('package_revenue_contracts', 'package_revenue_contracts_memberPackageId_fkey', 'ALTER TABLE "package_revenue_contracts" ADD CONSTRAINT "package_revenue_contracts_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('package_revenue_contracts', 'package_revenue_contracts_valuationId_fkey', 'ALTER TABLE "package_revenue_contracts" ADD CONSTRAINT "package_revenue_contracts_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "package_benefit_valuations"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('package_revenue_contracts', 'package_revenue_contracts_branchId_fkey', 'ALTER TABLE "package_revenue_contracts" ADD CONSTRAINT "package_revenue_contracts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('deferred_revenue_movements', 'deferred_revenue_movements_contractId_fkey', 'ALTER TABLE "deferred_revenue_movements" ADD CONSTRAINT "deferred_revenue_movements_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "package_revenue_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('deferred_revenue_movements', 'deferred_revenue_movements_memberPackageId_fkey', 'ALTER TABLE "deferred_revenue_movements" ADD CONSTRAINT "deferred_revenue_movements_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('deferred_revenue_movements', 'deferred_revenue_movements_invoicePaymentId_fkey', 'ALTER TABLE "deferred_revenue_movements" ADD CONSTRAINT "deferred_revenue_movements_invoicePaymentId_fkey" FOREIGN KEY ("invoicePaymentId") REFERENCES "invoice_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('deferred_revenue_movements', 'deferred_revenue_movements_treatmentSessionId_fkey', 'ALTER TABLE "deferred_revenue_movements" ADD CONSTRAINT "deferred_revenue_movements_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('deferred_revenue_movements', 'deferred_revenue_movements_journalEntryId_fkey', 'ALTER TABLE "deferred_revenue_movements" ADD CONSTRAINT "deferred_revenue_movements_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('domain_events', 'domain_events_branchId_fkey', 'ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('domain_events', 'domain_events_treatmentSessionId_fkey', 'ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('revenue_recognitions', 'revenue_recognitions_domainEventId_fkey', 'ALTER TABLE "revenue_recognitions" ADD CONSTRAINT "revenue_recognitions_domainEventId_fkey" FOREIGN KEY ("domainEventId") REFERENCES "domain_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('revenue_recognitions', 'revenue_recognitions_treatmentSessionId_fkey', 'ALTER TABLE "revenue_recognitions" ADD CONSTRAINT "revenue_recognitions_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('revenue_recognitions', 'revenue_recognitions_memberPackageId_fkey', 'ALTER TABLE "revenue_recognitions" ADD CONSTRAINT "revenue_recognitions_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('revenue_recognitions', 'revenue_recognitions_contractId_fkey', 'ALTER TABLE "revenue_recognitions" ADD CONSTRAINT "revenue_recognitions_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "package_revenue_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('revenue_recognitions', 'revenue_recognitions_branchId_fkey', 'ALTER TABLE "revenue_recognitions" ADD CONSTRAINT "revenue_recognitions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('revenue_recognitions', 'revenue_recognitions_journalEntryId_fkey', 'ALTER TABLE "revenue_recognitions" ADD CONSTRAINT "revenue_recognitions_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE')
  ) AS constraints_to_add(table_name, constraint_name, ddl)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = item.constraint_name
        AND conrelid = to_regclass('public.' || item.table_name)
    ) THEN
      EXECUTE item.ddl;
    END IF;
  END LOOP;
END $$;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_deferred_revenue_read', 'DEFERRED_REVENUE.READ', 'Lihat Deferred Revenue', 'REVENUE', 'Melihat valuasi, kontrak, movement, dan event revenue.', true, CURRENT_TIMESTAMP),
  ('perm_revenue_policy_manage', 'REVENUE.POLICY.MANAGE', 'Kelola Revenue Policy', 'REVENUE', 'Mengatur akun dan metode revenue per session.', true, CURRENT_TIMESTAMP),
  ('perm_revenue_recognize', 'REVENUE.RECOGNIZE', 'Posting Revenue Recognition', 'REVENUE', 'Memproses TREATMENT_COMPLETED menjadi revenue.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description",
  "isSensitive" = EXCLUDED."isSensitive",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_super_s7_' || p."id", rt."id", p."id"
FROM "role_templates" rt
CROSS JOIN "permissions" p
WHERE rt."baseRole" = 'SUPER_ADMIN' AND p."module" = 'REVENUE'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_manager_s7_' || p."id", rt."id", p."id"
FROM "role_templates" rt
CROSS JOIN "permissions" p
WHERE rt."baseRole" = 'ADMIN_MANAGER' AND p."module" = 'REVENUE'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "package_benefit_valuations" (
  "id", "memberPackageId", "policyVersion", "standaloneBenefitValue", "allocatedConsideration", "totalSessions",
  "regularSessionRevenue", "finalSessionRevenue", "allocationSnapshot", "valuedAt", "createdAt"
)
SELECT
  CONCAT('s7_val_', mp."id"), mp."id", 1,
  GREATEST(COALESCE(pp."price", mp."finalPrice"), 0), GREATEST(mp."finalPrice", 0), mp."totalSessions",
  TRUNC(GREATEST(mp."finalPrice", 0) / mp."totalSessions", 2),
  GREATEST(mp."finalPrice", 0) - TRUNC(GREATEST(mp."finalPrice", 0) / mp."totalSessions", 2) * (mp."totalSessions" - 1),
  jsonb_build_object('source', 'SPRINT_7_BACKFILL', 'packageCode', mp."packageCode"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "member_packages" mp
LEFT JOIN "package_pricings" pp ON pp."id" = mp."packagePricingId"
WHERE mp."totalSessions" > 0
ON CONFLICT ("memberPackageId") DO NOTHING;

INSERT INTO "package_revenue_contracts" (
  "id", "memberPackageId", "valuationId", "branchId", "totalConsideration", "fundedDeferredAmount",
  "recognizedAmount", "remainingDeferredAmount", "recognizedSessions", "status", "createdAt", "updatedAt"
)
SELECT
  CONCAT('s7_contract_', mp."id"), mp."id", valuation."id", mp."branchId", valuation."allocatedConsideration",
  LEAST(valuation."allocatedConsideration", GREATEST(COALESCE(mp."totalVerifiedPaid", 0), 0)), 0,
  LEAST(valuation."allocatedConsideration", GREATEST(COALESCE(mp."totalVerifiedPaid", 0), 0)), 0,
  CASE
    WHEN LEAST(valuation."allocatedConsideration", GREATEST(COALESCE(mp."totalVerifiedPaid", 0), 0)) > 0
      THEN 'ACTIVE'::"PackageRevenueContractStatus"
    ELSE 'UNFUNDED'::"PackageRevenueContractStatus"
  END,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "member_packages" mp
JOIN "package_benefit_valuations" valuation ON valuation."memberPackageId" = mp."id"
WHERE mp."totalSessions" > 0
ON CONFLICT ("memberPackageId") DO NOTHING;

INSERT INTO "deferred_revenue_movements" (
  "id", "movementKey", "contractId", "memberPackageId", "type", "amount", "occurredAt", "metadata", "createdAt"
)
SELECT
  CONCAT('s7_movement_', mp."id"), CONCAT('SPRINT_7_BACKFILL:', mp."id"), contract."id", mp."id",
  'FUNDING'::"DeferredRevenueMovementType", contract."fundedDeferredAmount",
  COALESCE(mp."verifiedAt", mp."createdAt"),
  jsonb_build_object('source', 'SPRINT_7_BACKFILL', 'journalTrace', 'OPENING_RECONCILIATION_REQUIRED'),
  CURRENT_TIMESTAMP
FROM "member_packages" mp
JOIN "package_revenue_contracts" contract ON contract."memberPackageId" = mp."id"
WHERE contract."fundedDeferredAmount" > 0
ON CONFLICT ("movementKey") DO NOTHING;
