CREATE TABLE "chs_coordinator_assignments" (
    "id" TEXT NOT NULL,
    "scope" VARCHAR(16) NOT NULL,
    "coordinatorUserId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "homecareTeamId" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "effectiveUntil" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chs_coordinator_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chs_coordinator_assignment_scope_check" CHECK (
        ("scope" = 'TEAM' AND "homecareTeamId" IS NOT NULL)
        OR ("scope" = 'BRANCH' AND "homecareTeamId" IS NULL)
    ),
    CONSTRAINT "chs_coordinator_assignment_period_check" CHECK (
        "effectiveUntil" IS NULL OR "effectiveUntil" >= "effectiveFrom"
    )
);

CREATE INDEX "chs_coordinator_assignments_branchId_scope_isActive_idx"
ON "chs_coordinator_assignments"("branchId", "scope", "isActive");

CREATE INDEX "chs_coordinator_assignments_homecareTeamId_isActive_idx"
ON "chs_coordinator_assignments"("homecareTeamId", "isActive");

CREATE INDEX "chs_coordinator_assignments_coordinatorUserId_effective_idx"
ON "chs_coordinator_assignments"("coordinatorUserId", "effectiveFrom", "effectiveUntil");

ALTER TABLE "chs_coordinator_assignments"
ADD CONSTRAINT "chs_coordinator_assignments_coordinatorUserId_fkey"
FOREIGN KEY ("coordinatorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chs_coordinator_assignments"
ADD CONSTRAINT "chs_coordinator_assignments_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chs_coordinator_assignments"
ADD CONSTRAINT "chs_coordinator_assignments_homecareTeamId_fkey"
FOREIGN KEY ("homecareTeamId") REFERENCES "homecare_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
