-- AlterTable
ALTER TABLE "branches" ADD COLUMN "createdBy" TEXT;

-- CreateIndex
CREATE INDEX "branches_createdBy_idx" ON "branches"("createdBy");
