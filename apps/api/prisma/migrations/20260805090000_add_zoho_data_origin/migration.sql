CREATE TYPE "ZohoDataOrigin" AS ENUM ('ERP', 'MANUAL_ZOHO');

ALTER TABLE "zoho_entity_mappings"
  ADD COLUMN "dataOrigin" "ZohoDataOrigin" NOT NULL DEFAULT 'ERP',
  ADD COLUMN "originVerifiedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "zoho_entity_mappings"
    WHERE "externalKey" IS NOT NULL
    GROUP BY "zohoConnectionId", "externalKey"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Zoho externalKey ditemukan. Selesaikan overlap mapping sebelum migrasi dilanjutkan.';
  END IF;
END $$;

CREATE UNIQUE INDEX "zoho_entity_mappings_zohoConnectionId_externalKey_key"
  ON "zoho_entity_mappings"("zohoConnectionId", "externalKey");
