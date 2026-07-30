-- Preserve every treatment session that existed before this deployment as a
-- legacy session. These rows must not be forced through newer completion
-- contracts such as BOM, FIFO posting, accounting periods, or Zoho events.
ALTER TABLE "treatment_sessions"
ADD COLUMN "completionFlowVersion" INTEGER NOT NULL DEFAULT 1;

-- Only sessions created after the cutover use the current completion flow.
ALTER TABLE "treatment_sessions"
ALTER COLUMN "completionFlowVersion" SET DEFAULT 2;

ALTER TABLE "treatment_sessions"
ADD CONSTRAINT "treatment_sessions_completionFlowVersion_check"
CHECK ("completionFlowVersion" IN (1, 2));

CREATE INDEX "treatment_sessions_completionFlowVersion_idx"
ON "treatment_sessions"("completionFlowVersion");
