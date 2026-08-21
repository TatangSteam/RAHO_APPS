CREATE TYPE "HomecareTeamLoanStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'RETURNED');

ALTER TYPE "LogisticTransactionType" ADD VALUE 'TEAM_LOAN';
ALTER TYPE "LogisticTransactionType" ADD VALUE 'TEAM_LOAN_RETURN';

CREATE TABLE "homecare_team_loans" (
    "id" TEXT NOT NULL,
    "loanCode" TEXT NOT NULL,
    "lenderTeamId" TEXT NOT NULL,
    "borrowerTeamId" TEXT NOT NULL,
    "fromBagId" TEXT NOT NULL,
    "toBagId" TEXT NOT NULL,
    "status" "HomecareTeamLoanStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "returnedBy" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "homecare_team_loans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "homecare_team_loan_items" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "requestedQty" DECIMAL(10,4) NOT NULL,
    "approvedQty" DECIMAL(10,4),
    "returnedQty" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "homecare_team_loan_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "homecare_team_loans_loanCode_key" ON "homecare_team_loans"("loanCode");
CREATE INDEX "homecare_team_loans_lenderTeamId_status_idx" ON "homecare_team_loans"("lenderTeamId", "status");
CREATE INDEX "homecare_team_loans_borrowerTeamId_status_idx" ON "homecare_team_loans"("borrowerTeamId", "status");
CREATE INDEX "homecare_team_loans_fromBagId_idx" ON "homecare_team_loans"("fromBagId");
CREATE INDEX "homecare_team_loans_toBagId_idx" ON "homecare_team_loans"("toBagId");
CREATE INDEX "homecare_team_loans_requestedAt_idx" ON "homecare_team_loans"("requestedAt");
CREATE UNIQUE INDEX "homecare_team_loan_items_loanId_masterProductId_key" ON "homecare_team_loan_items"("loanId", "masterProductId");
CREATE INDEX "homecare_team_loan_items_masterProductId_idx" ON "homecare_team_loan_items"("masterProductId");

ALTER TABLE "homecare_team_loans" ADD CONSTRAINT "homecare_team_loans_lenderTeamId_fkey"
FOREIGN KEY ("lenderTeamId") REFERENCES "homecare_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "homecare_team_loans" ADD CONSTRAINT "homecare_team_loans_borrowerTeamId_fkey"
FOREIGN KEY ("borrowerTeamId") REFERENCES "homecare_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "homecare_team_loans" ADD CONSTRAINT "homecare_team_loans_fromBagId_fkey"
FOREIGN KEY ("fromBagId") REFERENCES "homecare_bags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "homecare_team_loans" ADD CONSTRAINT "homecare_team_loans_toBagId_fkey"
FOREIGN KEY ("toBagId") REFERENCES "homecare_bags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "homecare_team_loan_items" ADD CONSTRAINT "homecare_team_loan_items_loanId_fkey"
FOREIGN KEY ("loanId") REFERENCES "homecare_team_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homecare_team_loan_items" ADD CONSTRAINT "homecare_team_loan_items_masterProductId_fkey"
FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
