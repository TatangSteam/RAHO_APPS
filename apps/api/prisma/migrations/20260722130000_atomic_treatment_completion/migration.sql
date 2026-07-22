CREATE TYPE "TreatmentCompletionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

ALTER TABLE "treatment_sessions"
  ADD COLUMN "completionStatus" "TreatmentCompletionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN "completionJournalEntryId" TEXT,
  ADD COLUMN "recognizedRevenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "materialCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "grossProfit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledBy" TEXT,
  ADD COLUMN "cancellationIdempotencyKey" TEXT,
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "materialReversalPostingId" TEXT,
  ADD COLUMN "cancellationJournalEntryId" TEXT;

UPDATE "treatment_sessions"
SET "completionStatus" = 'COMPLETED'
WHERE "isCompleted" = true;

CREATE UNIQUE INDEX "treatment_sessions_completionJournalEntryId_key"
  ON "treatment_sessions"("completionJournalEntryId");
CREATE UNIQUE INDEX "treatment_sessions_cancellationIdempotencyKey_key"
  ON "treatment_sessions"("cancellationIdempotencyKey");
CREATE UNIQUE INDEX "treatment_sessions_materialReversalPostingId_key"
  ON "treatment_sessions"("materialReversalPostingId");
CREATE UNIQUE INDEX "treatment_sessions_cancellationJournalEntryId_key"
  ON "treatment_sessions"("cancellationJournalEntryId");
CREATE INDEX "treatment_sessions_completionStatus_completedAt_idx"
  ON "treatment_sessions"("completionStatus", "completedAt");

ALTER TABLE "treatment_sessions"
  ADD CONSTRAINT "treatment_sessions_completionJournalEntryId_fkey"
  FOREIGN KEY ("completionJournalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treatment_sessions"
  ADD CONSTRAINT "treatment_sessions_materialReversalPostingId_fkey"
  FOREIGN KEY ("materialReversalPostingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treatment_sessions"
  ADD CONSTRAINT "treatment_sessions_cancellationJournalEntryId_fkey"
  FOREIGN KEY ("cancellationJournalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt")
VALUES (
  'perm_treatment_completion_reverse',
  'TREATMENT.COMPLETION.REVERSE',
  'Batalkan Completion Treatment',
  'TREATMENT',
  'Membalik revenue, HPP, dan konsumsi FIFO dari treatment yang telah selesai.',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_treatment_reverse_' || rt."id", rt."id", p."id"
FROM "role_templates" rt
CROSS JOIN "permissions" p
WHERE rt."baseRole" IN ('SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG')
  AND p."code" = 'TREATMENT.COMPLETION.REVERSE'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
