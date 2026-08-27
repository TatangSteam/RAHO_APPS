ALTER TABLE "members"
  ADD COLUMN "isEmployee" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "employeeTreatmentType" "PackageType";

CREATE INDEX "members_isEmployee_isActive_idx"
  ON "members"("isEmployee", "isActive");
