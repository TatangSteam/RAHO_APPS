/*
  Warnings:

  - The values [PREMIERE] on the enum `BranchType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BranchType_new" AS ENUM ('PUSAT', 'KLINIK', 'HOMECARE', 'PREMIER', 'PARTNERSHIP');
ALTER TABLE "branches" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "branches" ALTER COLUMN "type" TYPE "BranchType_new" USING ("type"::text::"BranchType_new");
ALTER TYPE "BranchType" RENAME TO "BranchType_old";
ALTER TYPE "BranchType_new" RENAME TO "BranchType";
DROP TYPE "BranchType_old";
ALTER TABLE "branches" ALTER COLUMN "type" SET DEFAULT 'KLINIK';
COMMIT;

-- AlterEnum
ALTER TYPE "PackageStatus" ADD VALUE 'WAITING_VERIFICATION';
