-- Check ICD code usage statistics in diagnoses table

-- Total diagnoses
SELECT 'Total Diagnoses' as metric, COUNT(*) as count FROM diagnoses;

-- Diagnoses with ICD Primer
SELECT 'With ICD Primer' as metric, COUNT(*) as count FROM diagnoses WHERE "icdPrimer" IS NOT NULL;

-- Diagnoses with ICD Sekunder
SELECT 'With ICD Sekunder' as metric, COUNT(*) as count FROM diagnoses WHERE "icdSekunder" IS NOT NULL;

-- Diagnoses with ICD Tersier
SELECT 'With ICD Tersier' as metric, COUNT(*) as count FROM diagnoses WHERE "icdTersier" IS NOT NULL;

-- Diagnoses with any ICD code
SELECT 'With Any ICD' as metric, COUNT(*) as count FROM diagnoses 
WHERE "icdPrimer" IS NOT NULL OR "icdSekunder" IS NOT NULL OR "icdTersier" IS NOT NULL;

-- Percentage calculation
SELECT 
  'Percentage Analysis' as metric,
  COUNT(*) as total,
  COUNT(CASE WHEN "icdPrimer" IS NOT NULL THEN 1 END) as with_icd_primer,
  ROUND(CAST(COUNT(CASE WHEN "icdPrimer" IS NOT NULL THEN 1 END) AS NUMERIC) / NULLIF(COUNT(*), 0) * 100, 2) as percentage_with_icd
FROM diagnoses;

-- Sample of ICD codes being used
SELECT "icdPrimer", "icdSekunder", "icdTersier", COUNT(*) as usage_count
FROM diagnoses
WHERE "icdPrimer" IS NOT NULL OR "icdSekunder" IS NOT NULL OR "icdTersier" IS NOT NULL
GROUP BY "icdPrimer", "icdSekunder", "icdTersier"
ORDER BY usage_count DESC
LIMIT 10;
