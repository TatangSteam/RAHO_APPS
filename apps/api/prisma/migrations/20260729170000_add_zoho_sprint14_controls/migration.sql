CREATE TABLE "zoho_reconciliation_runs" (
  "id" TEXT NOT NULL,
  "zohoConnectionId" TEXT,
  "runType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "triggerSource" TEXT NOT NULL,
  "scheduledKey" TEXT,
  "cursor" JSONB,
  "filters" JSONB,
  "totalChecked" INTEGER NOT NULL DEFAULT 0,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "exceptionCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "requestedById" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "zoho_reconciliation_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "zoho_webhook_inbox" (
  "id" TEXT NOT NULL,
  "zohoConnectionId" TEXT,
  "organizationId" TEXT NOT NULL,
  "dedupKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "zohoEntityType" TEXT,
  "zohoEntityId" TEXT,
  "externalReference" TEXT,
  "payloadHash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "headers" JSONB,
  "signatureValid" BOOLEAN NOT NULL,
  "sourceValid" BOOLEAN NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "correlationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "correlatedMappingId" TEXT,
  "reconciliationRunId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "zoho_webhook_inbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "zoho_reconciliation_results" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "localEntityId" TEXT,
  "zohoEntityId" TEXT,
  "externalReference" TEXT,
  "status" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "differences" JSONB,
  "evidence" JSONB,
  "ownerUserId" TEXT,
  "actionRequired" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "zoho_reconciliation_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "zoho_go_live_controls" (
  "id" TEXT NOT NULL,
  "zohoConnectionId" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'OFF',
  "masterFrozen" BOOLEAN NOT NULL DEFAULT false,
  "canaryBranchIds" JSONB,
  "canaryCustomerId" TEXT,
  "canaryVendorId" TEXT,
  "mismatchFreeBusinessDays" INTEGER NOT NULL DEFAULT 0,
  "financeApprovedAt" TIMESTAMP(3),
  "financeApprovedById" TEXT,
  "logisticsApprovedAt" TIMESTAMP(3),
  "logisticsApprovedById" TEXT,
  "lastRehearsalAt" TIMESTAMP(3),
  "lastRollbackAt" TIMESTAMP(3),
  "rollbackReason" TEXT,
  "notes" TEXT,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "zoho_go_live_controls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "zoho_reconciliation_runs_scheduledKey_key" ON "zoho_reconciliation_runs"("scheduledKey");
CREATE INDEX "zoho_reconciliation_runs_status_createdAt_idx" ON "zoho_reconciliation_runs"("status", "createdAt");
CREATE INDEX "zoho_reconciliation_runs_zohoConnectionId_runType_createdAt_idx" ON "zoho_reconciliation_runs"("zohoConnectionId", "runType", "createdAt");
CREATE UNIQUE INDEX "zoho_webhook_inbox_dedupKey_key" ON "zoho_webhook_inbox"("dedupKey");
CREATE INDEX "zoho_webhook_inbox_status_receivedAt_idx" ON "zoho_webhook_inbox"("status", "receivedAt");
CREATE INDEX "zoho_webhook_inbox_organizationId_eventType_receivedAt_idx" ON "zoho_webhook_inbox"("organizationId", "eventType", "receivedAt");
CREATE INDEX "zoho_webhook_inbox_zohoEntityType_zohoEntityId_idx" ON "zoho_webhook_inbox"("zohoEntityType", "zohoEntityId");
CREATE UNIQUE INDEX "zoho_reconciliation_results_runId_entityType_localEntityId_zohoEntityId_key" ON "zoho_reconciliation_results"("runId", "entityType", "localEntityId", "zohoEntityId");
CREATE INDEX "zoho_reconciliation_results_status_severity_createdAt_idx" ON "zoho_reconciliation_results"("status", "severity", "createdAt");
CREATE INDEX "zoho_reconciliation_results_localEntityId_idx" ON "zoho_reconciliation_results"("localEntityId");
CREATE INDEX "zoho_reconciliation_results_zohoEntityId_idx" ON "zoho_reconciliation_results"("zohoEntityId");
CREATE UNIQUE INDEX "zoho_go_live_controls_zohoConnectionId_key" ON "zoho_go_live_controls"("zohoConnectionId");
CREATE INDEX "zoho_go_live_controls_mode_idx" ON "zoho_go_live_controls"("mode");

ALTER TABLE "zoho_webhook_inbox"
  ADD CONSTRAINT "zoho_webhook_inbox_zohoConnectionId_fkey"
  FOREIGN KEY ("zohoConnectionId") REFERENCES "zoho_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "zoho_webhook_inbox"
  ADD CONSTRAINT "zoho_webhook_inbox_reconciliationRunId_fkey"
  FOREIGN KEY ("reconciliationRunId") REFERENCES "zoho_reconciliation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "zoho_reconciliation_runs"
  ADD CONSTRAINT "zoho_reconciliation_runs_zohoConnectionId_fkey"
  FOREIGN KEY ("zohoConnectionId") REFERENCES "zoho_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "zoho_reconciliation_results"
  ADD CONSTRAINT "zoho_reconciliation_results_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "zoho_reconciliation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "zoho_go_live_controls"
  ADD CONSTRAINT "zoho_go_live_controls_zohoConnectionId_fkey"
  FOREIGN KEY ("zohoConnectionId") REFERENCES "zoho_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
