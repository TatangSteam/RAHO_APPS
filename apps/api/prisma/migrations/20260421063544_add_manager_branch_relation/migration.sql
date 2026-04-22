-- CreateTable
CREATE TABLE "manager_branches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manager_branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manager_branches_userId_idx" ON "manager_branches"("userId");

-- CreateIndex
CREATE INDEX "manager_branches_branchId_idx" ON "manager_branches"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "manager_branches_userId_branchId_key" ON "manager_branches"("userId", "branchId");

-- AddForeignKey
ALTER TABLE "manager_branches" ADD CONSTRAINT "manager_branches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_branches" ADD CONSTRAINT "manager_branches_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
