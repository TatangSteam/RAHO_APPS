-- Existing sessions keep the current behavior. Only newly created sessions
-- explicitly marked by the user will carry a deferred diagnosis reminder.
ALTER TABLE "treatment_sessions"
ADD COLUMN "diagnosisDeferred" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "treatment_sessions_diagnosisDeferred_doctorId_idx"
ON "treatment_sessions" ("diagnosisDeferred", "doctorId");
