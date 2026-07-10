ALTER TABLE "diagnoses"
  ADD COLUMN IF NOT EXISTS "source_diagnosis_id" TEXT;

CREATE INDEX IF NOT EXISTS "diagnoses_source_diagnosis_id_idx"
  ON "diagnoses"("source_diagnosis_id");
