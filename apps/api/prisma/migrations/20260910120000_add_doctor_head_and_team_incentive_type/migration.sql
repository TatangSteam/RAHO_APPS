CREATE TYPE "HomecareTeamIncentiveType" AS ENUM ('HOMECARE', 'HO');

ALTER TABLE "homecare_teams"
ADD COLUMN "incentiveType" "HomecareTeamIncentiveType" NOT NULL DEFAULT 'HOMECARE';

CREATE TABLE "doctor_head_assignments" (
    "id" TEXT NOT NULL,
    "doctorHeadUserId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveUntil" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "doctor_head_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "doctor_head_assignment_period_check" CHECK (
        "effectiveUntil" IS NULL OR "effectiveUntil" >= "effectiveFrom"
    )
);

CREATE INDEX "doctor_head_assignments_branchId_isActive_idx"
ON "doctor_head_assignments"("branchId", "isActive");

CREATE INDEX "doctor_head_assignments_user_effective_idx"
ON "doctor_head_assignments"("doctorHeadUserId", "effectiveFrom", "effectiveUntil");

ALTER TABLE "doctor_head_assignments"
ADD CONSTRAINT "doctor_head_assignments_doctorHeadUserId_fkey"
FOREIGN KEY ("doctorHeadUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "doctor_head_assignments"
ADD CONSTRAINT "doctor_head_assignments_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
