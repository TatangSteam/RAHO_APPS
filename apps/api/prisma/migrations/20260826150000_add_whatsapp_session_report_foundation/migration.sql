CREATE TYPE "WhatsAppDeliveryStatus" AS ENUM (
  'PENDING', 'PROCESSING', 'RETRY', 'SENT', 'FAILED', 'DEAD_LETTER', 'CANCELLED'
);

CREATE TYPE "WhatsAppDeliveryTrigger" AS ENUM (
  'SESSION_COMPLETION', 'MANUAL', 'MANUAL_RESEND'
);

CREATE TABLE "member_communication_consents" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "whatsappTreatmentReport" BOOLEAN NOT NULL DEFAULT false,
  "consentedAt" TIMESTAMP(3),
  "consentedBy" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "consentSource" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "member_communication_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "member_communication_consents_memberId_key"
  ON "member_communication_consents"("memberId");

ALTER TABLE "member_communication_consents"
  ADD CONSTRAINT "member_communication_consents_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "whatsapp_deliveries" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "treatmentSessionId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "trigger" "WhatsAppDeliveryTrigger" NOT NULL,
  "status" "WhatsAppDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "templateKey" TEXT NOT NULL DEFAULT 'SESSION_COMPLETED_V1',
  "templateVersion" INTEGER NOT NULL DEFAULT 1,
  "recipientEncrypted" TEXT NOT NULL,
  "recipientMasked" TEXT NOT NULL,
  "payloadEncrypted" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 6,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedBy" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "requestedBy" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorSanitized" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_deliveries_idempotencyKey_key"
  ON "whatsapp_deliveries"("idempotencyKey");
CREATE INDEX "whatsapp_deliveries_status_availableAt_createdAt_idx"
  ON "whatsapp_deliveries"("status", "availableAt", "createdAt");
CREATE INDEX "whatsapp_deliveries_treatmentSessionId_createdAt_idx"
  ON "whatsapp_deliveries"("treatmentSessionId", "createdAt");
CREATE INDEX "whatsapp_deliveries_branchId_status_idx"
  ON "whatsapp_deliveries"("branchId", "status");

ALTER TABLE "whatsapp_deliveries"
  ADD CONSTRAINT "whatsapp_deliveries_treatmentSessionId_fkey"
  FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_deliveries"
  ADD CONSTRAINT "whatsapp_deliveries_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "whatsapp_deliveries"
  ADD CONSTRAINT "whatsapp_deliveries_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
