-- Add IFA substance composition tracking to therapy plans only.
-- This is documentation data and does not affect infusion execution or material usage.

ALTER TABLE "therapy_plans"
ADD COLUMN "ifa_substances" JSONB,
ADD COLUMN "ifa_substance_total_ml" DECIMAL(10,2);

UPDATE "therapy_plans"
SET
  "ifa_substances" = '[{"name":"NO","amount":2.5,"unit":"ml","keterangan":"Default NO di IFA 2,5ml","isDefault":true}]'::jsonb,
  "ifa_substance_total_ml" = 2.50
WHERE "ifa250" IS NOT NULL
  AND "ifa250" > 0
  AND "ifa_substances" IS NULL;
