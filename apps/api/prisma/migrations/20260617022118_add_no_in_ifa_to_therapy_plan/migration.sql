-- Store default NO amount inside IFA + NO 2,5ml plans.
-- This is documentation data on therapy_plans and does not affect infusion execution/material usage.

ALTER TABLE "therapy_plans" ADD COLUMN "noInIfa" DECIMAL(10,2) DEFAULT 2.5;

UPDATE "therapy_plans"
SET "noInIfa" = NULL
WHERE "ifa250" IS NULL
  OR "ifa250" <= 0;
