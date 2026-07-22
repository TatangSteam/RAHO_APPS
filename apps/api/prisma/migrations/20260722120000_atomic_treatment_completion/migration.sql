-- Sprint 8: persist the immutable finance result of treatment completion.
ALTER TABLE "treatment_sessions"
  ADD COLUMN "completionJournalEntryId" TEXT,
  ADD COLUMN "recognizedRevenue" DECIMAL(18,2),
  ADD COLUMN "hppAmount" DECIMAL(18,2),
  ADD COLUMN "grossProfit" DECIMAL(18,2);

CREATE UNIQUE INDEX "treatment_sessions_completionJournalEntryId_key"
  ON "treatment_sessions"("completionJournalEntryId");

ALTER TABLE "treatment_sessions"
  ADD CONSTRAINT "treatment_sessions_completionJournalEntryId_fkey"
  FOREIGN KEY ("completionJournalEntryId") REFERENCES "journal_entries"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "treatment_sessions"
  ADD CONSTRAINT "treatment_sessions_finance_nonnegative_check"
  CHECK (
    ("recognizedRevenue" IS NULL OR "recognizedRevenue" >= 0)
    AND ("hppAmount" IS NULL OR "hppAmount" >= 0)
  ),
  ADD CONSTRAINT "treatment_sessions_gross_profit_check"
  CHECK (
    "completionJournalEntryId" IS NULL
    OR (
      "recognizedRevenue" IS NOT NULL
      AND "hppAmount" IS NOT NULL
      AND "grossProfit" = "recognizedRevenue" - "hppAmount"
    )
  );
