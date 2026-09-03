-- Keep new attribution nullable so historical add-on transactions remain valid.
ALTER TABLE "member_add_ons"
ADD COLUMN "transactionDate" DATE,
ADD COLUMN "sellerMsoId" TEXT;

ALTER TABLE "member_add_ons"
ADD CONSTRAINT "member_add_ons_sellerMsoId_fkey"
FOREIGN KEY ("sellerMsoId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "member_add_ons_sellerMsoId_transactionDate_status_idx"
ON "member_add_ons"("sellerMsoId", "transactionDate", "status");

CREATE INDEX "member_add_ons_transactionDate_branchId_idx"
ON "member_add_ons"("transactionDate", "branchId");
