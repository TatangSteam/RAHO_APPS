/*
  Warnings:

  - You are about to alter the column `stock` on the `inventory_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to alter the column `minThreshold` on the `inventory_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to alter the column `quantity` on the `stock_mutations` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to alter the column `stockBefore` on the `stock_mutations` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to alter the column `stockAfter` on the `stock_mutations` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.

*/
-- AlterTable
ALTER TABLE "inventory_items" ALTER COLUMN "stock" SET DATA TYPE DECIMAL(10,4),
ALTER COLUMN "minThreshold" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "stock_mutations" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,4),
ALTER COLUMN "stockBefore" SET DATA TYPE DECIMAL(10,4),
ALTER COLUMN "stockAfter" SET DATA TYPE DECIMAL(10,4);
