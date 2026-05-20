-- Update IFA fields in therapy_plans and infusion_executions
-- Change from single 'ifa' field to 'ifa250' (IFA + NO 2,5ml 250ml - wajib) and 'ifa500' (IFA A + MG 500ml - alternatif)

-- Rename ifa to ifa250 in therapy_plans (preserve existing data)
ALTER TABLE "therapy_plans" RENAME COLUMN "ifa" TO "ifa250";

-- Add ifa500 column to therapy_plans
ALTER TABLE "therapy_plans" ADD COLUMN "ifa500" DECIMAL(10,2);

-- Rename ifa to ifa250 in infusion_executions (preserve existing data)
ALTER TABLE "infusion_executions" RENAME COLUMN "ifa" TO "ifa250";

-- Add ifa500 column to infusion_executions
ALTER TABLE "infusion_executions" ADD COLUMN "ifa500" DECIMAL(10,2);
