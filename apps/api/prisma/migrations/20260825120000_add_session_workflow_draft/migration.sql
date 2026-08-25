ALTER TABLE "treatment_sessions"
  ADD COLUMN "workflowDraft" JSONB,
  ADD COLUMN "workflowDraftStep" INTEGER,
  ADD COLUMN "workflowDraftUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "workflowDraftUpdatedBy" TEXT,
  ADD COLUMN "workflowRevision" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "treatment_sessions_workflowDraftUpdatedAt_idx"
  ON "treatment_sessions"("workflowDraftUpdatedAt");
