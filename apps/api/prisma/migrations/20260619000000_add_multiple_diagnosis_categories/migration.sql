ALTER TABLE "diagnoses"
ADD COLUMN IF NOT EXISTS "kategori_diagnosa_list" JSONB;

UPDATE "diagnoses"
SET "kategori_diagnosa_list" = jsonb_build_array("kategoriDiagnosa"::text)
WHERE "kategoriDiagnosa" IS NOT NULL
  AND "kategori_diagnosa_list" IS NULL;
