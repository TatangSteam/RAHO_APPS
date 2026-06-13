-- AlterTable
ALTER TABLE "therapy_plans" ADD COLUMN     "supersededAt" TIMESTAMP(3),
ADD COLUMN     "supersededById" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "therapy_plans_supersededById_idx" ON "therapy_plans"("supersededById");

-- AddForeignKey
ALTER TABLE "therapy_plans" ADD CONSTRAINT "therapy_plans_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "therapy_plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
