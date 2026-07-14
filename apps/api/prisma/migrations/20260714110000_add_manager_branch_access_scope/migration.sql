ALTER TABLE "manager_branches"
  ADD COLUMN "accessScope" "AdminManagerAccessScope" NOT NULL DEFAULT 'FULL';

CREATE INDEX "manager_branches_accessScope_idx" ON "manager_branches"("accessScope");
