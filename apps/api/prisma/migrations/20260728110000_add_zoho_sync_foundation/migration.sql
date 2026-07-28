ALTER TYPE "IntegrationEventStatus" ADD VALUE IF NOT EXISTS 'DRY_RUN';
ALTER TYPE "IntegrationEventStatus" ADD VALUE IF NOT EXISTS 'DEAD_LETTER';
ALTER TYPE "IntegrationEventStatus" ADD VALUE IF NOT EXISTS 'IGNORED';

CREATE TYPE "ZohoMappingStatus" AS ENUM ('ACTIVE', 'NEEDS_REVIEW', 'INACTIVE');
CREATE TYPE "ZohoSyncAttemptStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED', 'RETRY_SCHEDULED', 'DRY_RUN');
CREATE TYPE "ZohoDiscoveryResourceType" AS ENUM ('ORGANIZATION', 'ACCOUNT', 'TAX', 'LOCATION', 'BANK_ACCOUNT', 'PAYMENT_MODE');

ALTER TABLE "zoho_connections"
  ADD COLUMN "scopeVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "organizationCurrencyId" TEXT,
  ADD COLUMN "organizationCurrencyCode" TEXT,
  ADD COLUMN "organizationTimeZone" TEXT,
  ADD COLUMN "discoveryLastRunAt" TIMESTAMP(3);

ALTER TABLE "integration_events"
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "lockedBy" TEXT,
  ADD COLUMN "leaseUntil" TIMESTAMP(3),
  ADD COLUMN "deadLetteredAt" TIMESTAMP(3),
  ADD COLUMN "ignoredAt" TIMESTAMP(3),
  ADD COLUMN "ignoredById" TEXT,
  ADD COLUMN "ignoreReason" TEXT,
  ADD COLUMN "payloadHash" TEXT;

CREATE INDEX "integration_events_leaseUntil_idx" ON "integration_events"("leaseUntil");
CREATE INDEX "integration_events_payloadHash_idx" ON "integration_events"("payloadHash");

CREATE TABLE "zoho_entity_mappings" (
  "id" TEXT NOT NULL,
  "zohoConnectionId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "localEntityId" TEXT NOT NULL,
  "zohoEntityType" TEXT NOT NULL,
  "zohoEntityId" TEXT NOT NULL,
  "externalKey" TEXT,
  "status" "ZohoMappingStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "zoho_entity_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "zoho_entity_mappings_local_key"
  ON "zoho_entity_mappings"("zohoConnectionId", "entityType", "localEntityId");
CREATE UNIQUE INDEX "zoho_entity_mappings_external_key"
  ON "zoho_entity_mappings"("zohoConnectionId", "zohoEntityType", "zohoEntityId");
CREATE INDEX "zoho_entity_mappings_status_entityType_idx"
  ON "zoho_entity_mappings"("status", "entityType");

CREATE TABLE "zoho_sync_attempts" (
  "id" TEXT NOT NULL,
  "integrationEventId" TEXT NOT NULL,
  "attemptNo" INTEGER NOT NULL,
  "workerId" TEXT NOT NULL,
  "status" "ZohoSyncAttemptStatus" NOT NULL DEFAULT 'PROCESSING',
  "httpStatus" INTEGER,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "retryable" BOOLEAN,
  "requestSummary" JSONB,
  "responseSummary" JSONB,
  "nextRetryAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "zoho_sync_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "zoho_sync_attempts_event_attempt_key"
  ON "zoho_sync_attempts"("integrationEventId", "attemptNo");
CREATE INDEX "zoho_sync_attempts_status_startedAt_idx"
  ON "zoho_sync_attempts"("status", "startedAt");

CREATE TABLE "zoho_discovery_cache" (
  "id" TEXT NOT NULL,
  "zohoConnectionId" TEXT NOT NULL,
  "resourceType" "ZohoDiscoveryResourceType" NOT NULL,
  "zohoId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "payload" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "zoho_discovery_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "zoho_discovery_cache_resource_key"
  ON "zoho_discovery_cache"("zohoConnectionId", "resourceType", "zohoId");
CREATE INDEX "zoho_discovery_cache_type_active_name_idx"
  ON "zoho_discovery_cache"("resourceType", "isActive", "name");

ALTER TABLE "zoho_entity_mappings"
  ADD CONSTRAINT "zoho_entity_mappings_connection_fkey"
  FOREIGN KEY ("zohoConnectionId") REFERENCES "zoho_connections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "zoho_sync_attempts"
  ADD CONSTRAINT "zoho_sync_attempts_event_fkey"
  FOREIGN KEY ("integrationEventId") REFERENCES "integration_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "zoho_discovery_cache"
  ADD CONSTRAINT "zoho_discovery_cache_connection_fkey"
  FOREIGN KEY ("zohoConnectionId") REFERENCES "zoho_connections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_super_zoho_' || p."id", 'rt_super_admin', p."id"
FROM "permissions" p
WHERE p."code" LIKE 'ZOHO.%'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
