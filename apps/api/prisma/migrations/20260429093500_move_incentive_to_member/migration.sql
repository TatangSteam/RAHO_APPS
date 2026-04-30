/*
  Warnings:

  - You are about to drop the column `firstIncentiveType` on the `referral_codes` table. All the data in the column will be lost.
  - You are about to drop the column `firstIncentiveValue` on the `referral_codes` table. All the data in the column will be lost.
  - You are about to drop the column `nextIncentiveType` on the `referral_codes` table. All the data in the column will be lost.
  - You are about to drop the column `nextIncentiveValue` on the `referral_codes` table. All the data in the column will be lost.

*/

-- Step 1: Add incentive fields to members table
ALTER TABLE "members" ADD COLUMN     "firstIncentiveType" "IncentiveType",
ADD COLUMN     "firstIncentiveValue" DECIMAL(10,2),
ADD COLUMN     "nextIncentiveType" "IncentiveType",
ADD COLUMN     "nextIncentiveValue" DECIMAL(10,2);

-- Step 2: Migrate existing incentive data from referral_codes to members
-- Copy incentive settings from referral code to all members using that code
UPDATE "members" m
SET 
  "firstIncentiveType" = rc."firstIncentiveType",
  "firstIncentiveValue" = rc."firstIncentiveValue",
  "nextIncentiveType" = rc."nextIncentiveType",
  "nextIncentiveValue" = rc."nextIncentiveValue"
FROM "referral_codes" rc
WHERE m."referralCodeId" = rc."id"
  AND m."referralCodeId" IS NOT NULL;

-- Step 3: Remove incentive fields from referral_codes table
ALTER TABLE "referral_codes" DROP COLUMN "firstIncentiveType",
DROP COLUMN "firstIncentiveValue",
DROP COLUMN "nextIncentiveType",
DROP COLUMN "nextIncentiveValue";

