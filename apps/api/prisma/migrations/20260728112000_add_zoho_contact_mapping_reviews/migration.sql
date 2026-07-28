CREATE TYPE "ZohoMappingReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "zoho_mapping_reviews" (
  "id" TEXT NOT NULL,
  "zohoConnectionId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "localEntityId" TEXT NOT NULL,
  "localDisplayName" TEXT NOT NULL,
  "expectedZohoEntityType" TEXT NOT NULL,
  "candidates" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "ZohoMappingReviewStatus" NOT NULL DEFAULT 'PENDING',
  "resolvedZohoEntityId" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "zoho_mapping_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "zoho_mapping_reviews_local_key"
  ON "zoho_mapping_reviews"("zohoConnectionId", "entityType", "localEntityId");
CREATE INDEX "zoho_mapping_reviews_status_type_created_idx"
  ON "zoho_mapping_reviews"("status", "entityType", "createdAt");

ALTER TABLE "zoho_mapping_reviews"
  ADD CONSTRAINT "zoho_mapping_reviews_connection_fkey"
  FOREIGN KEY ("zohoConnectionId") REFERENCES "zoho_connections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_flc_contact_' || p."id", 'rt_finance_logistics_controller', p."id"
FROM "permissions" p
WHERE p."code" = 'ZOHO.MAPPING.MANAGE'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
