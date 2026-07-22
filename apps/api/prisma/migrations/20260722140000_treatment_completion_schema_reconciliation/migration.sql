-- Reconcile databases where Developer B's completion migration was applied
-- before the parallel finance snapshot migration arrived from main.
UPDATE "treatment_sessions"
SET
  "completionStatus" = CASE
    WHEN "isCompleted" = true AND "completionStatus" = 'IN_PROGRESS'
      THEN 'COMPLETED'::"TreatmentCompletionStatus"
    ELSE "completionStatus"
  END,
  "recognizedRevenue" = COALESCE("recognizedRevenue", 0),
  "materialCost" = COALESCE("materialCost", 0),
  "grossProfit" = COALESCE("grossProfit", COALESCE("recognizedRevenue", 0) - COALESCE("materialCost", 0));

ALTER TABLE "treatment_sessions"
  ALTER COLUMN "recognizedRevenue" SET DEFAULT 0,
  ALTER COLUMN "recognizedRevenue" SET NOT NULL,
  ALTER COLUMN "materialCost" SET DEFAULT 0,
  ALTER COLUMN "materialCost" SET NOT NULL,
  ALTER COLUMN "grossProfit" SET DEFAULT 0,
  ALTER COLUMN "grossProfit" SET NOT NULL,
  DROP CONSTRAINT IF EXISTS "treatment_sessions_finance_nonnegative_check",
  DROP CONSTRAINT IF EXISTS "treatment_sessions_gross_profit_check";

ALTER TABLE "treatment_sessions"
  ADD CONSTRAINT "treatment_sessions_finance_nonnegative_check"
    CHECK ("recognizedRevenue" >= 0 AND "materialCost" >= 0),
  ADD CONSTRAINT "treatment_sessions_gross_profit_check"
    CHECK ("grossProfit" = "recognizedRevenue" - "materialCost");
