-- AlterTable
ALTER TABLE "member_packages" ADD COLUMN     "productCode" TEXT,
ADD COLUMN     "serviceType" TEXT;

-- AlterTable
ALTER TABLE "package_pricings" ADD COLUMN     "productCode" TEXT;
