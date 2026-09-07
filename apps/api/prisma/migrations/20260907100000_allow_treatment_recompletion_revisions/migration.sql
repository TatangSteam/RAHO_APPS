-- A posted treatment may be reversed, reopened for editing, and completed
-- again. Keep every accounting event/recognition as an immutable audit trail,
-- while allowing a new row for each completion revision.
DROP INDEX IF EXISTS "domain_events_treatmentSessionId_key";
CREATE INDEX IF NOT EXISTS "domain_events_treatmentSessionId_idx"
  ON "domain_events"("treatmentSessionId");

DROP INDEX IF EXISTS "revenue_recognitions_treatmentSessionId_memberPackageId_key";
CREATE INDEX IF NOT EXISTS "revenue_recognitions_treatmentSessionId_memberPackageId_idx"
  ON "revenue_recognitions"("treatmentSessionId", "memberPackageId");
