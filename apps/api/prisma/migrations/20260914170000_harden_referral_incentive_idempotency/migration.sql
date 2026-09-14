ALTER TABLE "referral_incentive_records"
ADD COLUMN "purchaseGroupId" TEXT;

-- Keep the oldest canonical record when legacy retries produced duplicates.
WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "memberPackageId" ORDER BY "createdAt", "id") AS row_number
  FROM "referral_incentive_records"
)
DELETE FROM "referral_incentive_records" record
USING ranked
WHERE record."id" = ranked."id"
  AND ranked.row_number > 1;

UPDATE "referral_incentive_records" record
SET "purchaseGroupId" = package."purchaseGroupId"
FROM "member_packages" package
WHERE package."id" = record."memberPackageId";

-- Remove incentives that were created before a purchase became eligible.
DELETE FROM "referral_incentive_records" record
USING "member_packages" package
WHERE package."id" = record."memberPackageId"
  AND (
    package."status" <> 'ACTIVE'
    OR package."verifiedAt" IS NULL
    OR package."refundedAt" IS NOT NULL
    OR package."socialProgramRequestId" IS NOT NULL
    OR (package."paymentPlanStatus" IS NOT NULL AND package."paymentPlanStatus" <> 'PAID')
  );

WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "purchaseGroupId" ORDER BY "createdAt", "id") AS row_number
  FROM "referral_incentive_records"
  WHERE "purchaseGroupId" IS NOT NULL
)
DELETE FROM "referral_incentive_records" record
USING ranked
WHERE record."id" = ranked."id"
  AND ranked.row_number > 1;

-- Repair cached totals after removing any legacy duplicates.
UPDATE "referral_codes" referral
SET "totalIncentiveEarned" = COALESCE(summary.total_incentive, 0)
FROM (
  SELECT code."id",
         SUM(record."incentiveAmount") AS total_incentive
  FROM "referral_codes" code
  LEFT JOIN "referral_incentive_records" record ON record."referralCodeId" = code."id"
  GROUP BY code."id"
) summary
WHERE referral."id" = summary."id";

CREATE UNIQUE INDEX "referral_incentive_records_memberPackageId_key"
ON "referral_incentive_records"("memberPackageId");

CREATE UNIQUE INDEX "referral_incentive_records_purchaseGroupId_key"
ON "referral_incentive_records"("purchaseGroupId");
