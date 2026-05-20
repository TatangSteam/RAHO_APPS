/*
  Warnings:

  - A unique constraint covering the columns `[sku]` on the table `master_products` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "master_products" ADD COLUMN     "sku" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "master_products_sku_key" ON "master_products"("sku");

-- CreateIndex
CREATE INDEX "master_products_sku_idx" ON "master_products"("sku");
