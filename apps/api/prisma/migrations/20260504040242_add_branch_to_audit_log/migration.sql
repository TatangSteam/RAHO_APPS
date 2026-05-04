-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "branchId" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_branchId_createdAt_idx" ON "audit_logs"("branchId", "createdAt");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
