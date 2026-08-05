CREATE TYPE "ZohoDataOriginV2" AS ENUM ('UNKNOWN', 'ERP', 'MANUAL_ZOHO');

ALTER TABLE "zoho_entity_mappings"
  ALTER COLUMN "dataOrigin" DROP DEFAULT,
  ALTER COLUMN "dataOrigin" TYPE "ZohoDataOriginV2"
    USING ("dataOrigin"::text::"ZohoDataOriginV2");

DROP TYPE "ZohoDataOrigin";
ALTER TYPE "ZohoDataOriginV2" RENAME TO "ZohoDataOrigin";

ALTER TABLE "zoho_entity_mappings"
  ALTER COLUMN "dataOrigin" SET DEFAULT 'UNKNOWN';

CREATE TYPE "ZohoManagementMode" AS ENUM ('REVIEW_REQUIRED', 'ERP_MANAGED', 'MANUAL_ONLY');

ALTER TABLE "zoho_entity_mappings"
  ADD COLUMN "managementMode" "ZohoManagementMode" NOT NULL DEFAULT 'REVIEW_REQUIRED';

DROP INDEX "zoho_entity_mappings_zohoConnectionId_externalKey_key";

CREATE UNIQUE INDEX "zoho_entity_mappings_zohoConnectionId_entityType_externalKey_key"
  ON "zoho_entity_mappings"("zohoConnectionId", "entityType", "externalKey");

-- Mapping konfigurasi menunjuk record yang memang dikelola di Zoho Books.
UPDATE "zoho_entity_mappings"
SET
  "dataOrigin" = 'MANUAL_ZOHO',
  "managementMode" = 'MANUAL_ONLY',
  "originVerifiedAt" = NOW()
WHERE "entityType" IN (
  'ACCOUNT_ROLE', 'UOM', 'CASH_BANK_ACCOUNT', 'PAYMENT_METHOD', 'TAX_RATE',
  'EXPENSE_ACCOUNT', 'EXPENSE_PAID_THROUGH', 'GL_ACCOUNT'
);

-- Mapping hasil create/upsert ERP mempunyai bukti operasi yang cukup.
UPDATE "zoho_entity_mappings"
SET
  "dataOrigin" = 'ERP',
  "managementMode" = 'ERP_MANAGED',
  "originVerifiedAt" = COALESCE("originVerifiedAt", "lastSyncedAt", "createdAt")
WHERE COALESCE("metadata"->>'operation', '') IN (
  'CREATE', 'AUTO_MATCH', 'UPDATE', 'MARK_INACTIVE'
);

-- Record yang pernah dipilih manusia berorigin manual tetapi sudah diserahkan
-- kepada ERP untuk update berikutnya.
UPDATE "zoho_entity_mappings"
SET
  "dataOrigin" = 'MANUAL_ZOHO',
  "managementMode" = 'ERP_MANAGED',
  "originVerifiedAt" = COALESCE("originVerifiedAt", "updatedAt")
WHERE COALESCE("metadata"->>'operation', '') = 'MANUAL_APPROVAL';

-- Recovery lama tidak cukup membuktikan bahwa record dibuat ERP.
UPDATE "zoho_entity_mappings"
SET
  "dataOrigin" = 'UNKNOWN',
  "managementMode" = 'REVIEW_REQUIRED',
  "originVerifiedAt" = NULL
WHERE "originVerifiedAt" IS NULL;
