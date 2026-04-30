-- CreateTable
CREATE TABLE "staff_branches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_branches_userId_idx" ON "staff_branches"("userId");

-- CreateIndex
CREATE INDEX "staff_branches_branchId_idx" ON "staff_branches"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_branches_userId_branchId_key" ON "staff_branches"("userId", "branchId");

-- AddForeignKey
ALTER TABLE "staff_branches" ADD CONSTRAINT "staff_branches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_branches" ADD CONSTRAINT "staff_branches_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
