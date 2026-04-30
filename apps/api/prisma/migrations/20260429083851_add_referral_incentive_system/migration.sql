/*
  Warnings:

  - The values [MEDIA,LAINNYA] on the enum `ReferrerType` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `branchId` to the `referral_codes` table without a default value. This is not possible if the table is not empty.
  - Made the column `referrerType` on table `referral_codes` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "IncentiveType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- Step 1: Add nullable branchId first
ALTER TABLE "referral_codes" ADD COLUMN "branchId" TEXT;

-- Step 2: Set default branchId for existing records (use first active branch)
UPDATE "referral_codes" 
SET "branchId" = (SELECT id FROM "branches" WHERE "isActive" = true ORDER BY "createdAt" ASC LIMIT 1)
WHERE "branchId" IS NULL;

-- Step 3: Update existing referrerType values that will be removed (BEFORE altering enum)
UPDATE "referral_codes" 
SET "referrerType" = 'DOKTER' 
WHERE "referrerType" IN ('MEDIA', 'LAINNYA');

-- Step 4: Set default for NULL referrerType
UPDATE "referral_codes" 
SET "referrerType" = 'DOKTER' 
WHERE "referrerType" IS NULL;

-- AlterEnum (AFTER updating data)
BEGIN;
CREATE TYPE "ReferrerType_new" AS ENUM ('SALES', 'DOKTER', 'MEMBER');
ALTER TABLE "referral_codes" ALTER COLUMN "referrerType" TYPE "ReferrerType_new" USING ("referrerType"::text::"ReferrerType_new");
ALTER TYPE "ReferrerType" RENAME TO "ReferrerType_old";
ALTER TYPE "ReferrerType_new" RENAME TO "ReferrerType";
DROP TYPE "ReferrerType_old";
COMMIT;

-- Step 5: Now make branchId NOT NULL and add other columns
ALTER TABLE "referral_codes" 
ALTER COLUMN "branchId" SET NOT NULL,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "firstIncentiveType" "IncentiveType" NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN     "firstIncentiveValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "nextIncentiveType" "IncentiveType" NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN     "nextIncentiveValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "totalIncentiveEarned" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalReferrals" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "referrerType" SET NOT NULL;

-- CreateTable
CREATE TABLE "referral_incentive_records" (
    "id" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "memberPackageId" TEXT NOT NULL,
    "packageType" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "packageValue" DECIMAL(15,2) NOT NULL,
    "isFirstPackage" BOOLEAN NOT NULL,
    "incentiveType" "IncentiveType" NOT NULL,
    "incentiveValue" DECIMAL(10,2) NOT NULL,
    "incentiveAmount" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_incentive_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referral_incentive_records_referralCodeId_idx" ON "referral_incentive_records"("referralCodeId");

-- CreateIndex
CREATE INDEX "referral_incentive_records_memberId_idx" ON "referral_incentive_records"("memberId");

-- CreateIndex
CREATE INDEX "referral_incentive_records_memberPackageId_idx" ON "referral_incentive_records"("memberPackageId");

-- CreateIndex
CREATE INDEX "referral_incentive_records_createdAt_idx" ON "referral_incentive_records"("createdAt");

-- CreateIndex
CREATE INDEX "referral_codes_branchId_idx" ON "referral_codes"("branchId");

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_incentive_records" ADD CONSTRAINT "referral_incentive_records_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "referral_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_incentive_records" ADD CONSTRAINT "referral_incentive_records_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_incentive_records" ADD CONSTRAINT "referral_incentive_records_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
