CREATE TYPE "TreatmentRevenueSourceType" AS ENUM ('BASIC', 'BOOSTER');

ALTER TABLE "treatment_sessions"
  ADD COLUMN "revenueSourceType" "TreatmentRevenueSourceType",
  ADD COLUMN "revenuePackageId" TEXT;

UPDATE "treatment_sessions" AS session
SET
  "revenueSourceType" = CASE
    WHEN session."boosterPackageId" IS NOT NULL THEN 'BOOSTER'::"TreatmentRevenueSourceType"
    ELSE 'BASIC'::"TreatmentRevenueSourceType"
  END,
  "revenuePackageId" = COALESCE(session."boosterPackageId", encounter."memberPackageId")
FROM "encounters" AS encounter
WHERE encounter."id" = session."encounterId"
  AND session."completionStatus" IN ('COMPLETED', 'CANCELLED');

ALTER TABLE "treatment_sessions"
  ADD CONSTRAINT "treatment_sessions_revenue_source_pair_check"
  CHECK (
    ("revenueSourceType" IS NULL AND "revenuePackageId" IS NULL)
    OR
    ("revenueSourceType" IS NOT NULL AND "revenuePackageId" IS NOT NULL)
  );

ALTER TABLE "treatment_sessions"
  ADD CONSTRAINT "treatment_sessions_revenuePackageId_fkey"
  FOREIGN KEY ("revenuePackageId") REFERENCES "member_packages"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "treatment_sessions_revenuePackageId_idx"
  ON "treatment_sessions"("revenuePackageId");
