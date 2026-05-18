-- Convert boosterType from enum to TEXT, preserving data using USING cast
-- This change allows custom booster type codes to be used (not just hardcoded enum values)

-- Drop the unique index on package_pricings first (will recreate after)
DROP INDEX IF EXISTS "package_pricings_branchId_packageType_boosterType_serviceTy_key";

-- AlterTable: package_pricings
ALTER TABLE "package_pricings" 
  ALTER COLUMN "boosterType" TYPE TEXT USING "boosterType"::TEXT;

-- AlterTable: member_packages
ALTER TABLE "member_packages" 
  ALTER COLUMN "boosterType" TYPE TEXT USING "boosterType"::TEXT;

-- AlterTable: treatment_sessions
ALTER TABLE "treatment_sessions" 
  ALTER COLUMN "boosterType" TYPE TEXT USING "boosterType"::TEXT;

-- Recreate the unique index on package_pricings
CREATE UNIQUE INDEX "package_pricings_branchId_packageType_boosterType_serviceTy_key" 
  ON "package_pricings"("branchId", "packageType", "boosterType", "serviceType", "totalSessions");
