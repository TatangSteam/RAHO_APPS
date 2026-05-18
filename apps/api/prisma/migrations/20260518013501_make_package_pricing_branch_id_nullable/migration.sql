-- AlterTable: Make branchId nullable in package_pricings to support global pricing
ALTER TABLE "package_pricings" ALTER COLUMN "branchId" DROP NOT NULL;

-- DropForeignKey: Drop existing foreign key constraint
ALTER TABLE "package_pricings" DROP CONSTRAINT "package_pricings_branchId_fkey";

-- AddForeignKey: Re-add foreign key with ON DELETE SET NULL
ALTER TABLE "package_pricings" ADD CONSTRAINT "package_pricings_branchId_fkey" 
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;