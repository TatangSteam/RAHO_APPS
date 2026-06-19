-- Add set-level grouping for therapy plans while keeping legacy fields compatible.

CREATE TABLE IF NOT EXISTS "therapy_plan_sets" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "setCode" TEXT NOT NULL,
  "name" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "supersededById" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "therapy_plan_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "therapy_plan_sets_setCode_key"
  ON "therapy_plan_sets"("setCode");

CREATE INDEX IF NOT EXISTS "therapy_plan_sets_memberId_status_idx"
  ON "therapy_plan_sets"("memberId", "status");

CREATE INDEX IF NOT EXISTS "therapy_plan_sets_supersededById_idx"
  ON "therapy_plan_sets"("supersededById");

ALTER TABLE "therapy_plan_sets"
  ADD CONSTRAINT "therapy_plan_sets_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "members"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapy_plan_sets"
  ADD CONSTRAINT "therapy_plan_sets_supersededById_fkey"
  FOREIGN KEY ("supersededById") REFERENCES "therapy_plan_sets"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "therapy_plans"
  ADD COLUMN IF NOT EXISTS "therapyPlanSetId" TEXT,
  ADD COLUMN IF NOT EXISTS "planNumber" INTEGER;

ALTER TABLE "infusion_executions"
  ADD COLUMN IF NOT EXISTS "therapyPlanId" TEXT;

INSERT INTO "therapy_plan_sets" (
  "id",
  "memberId",
  "setCode",
  "name",
  "version",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy_' || substr(md5(tp."memberId"), 1, 18) AS "id",
  tp."memberId",
  'TPS-LEGACY-' || m."memberNo" AS "setCode",
  'Legacy Therapy Plan Set' AS "name",
  1 AS "version",
  'ACTIVE' AS "status",
  MIN(tp."createdAt") AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM "therapy_plans" tp
JOIN "members" m ON m."id" = tp."memberId"
WHERE tp."memberId" IS NOT NULL
  AND tp."therapyPlanSetId" IS NULL
GROUP BY tp."memberId", m."memberNo"
ON CONFLICT ("setCode") DO NOTHING;

UPDATE "therapy_plans" tp
SET "therapyPlanSetId" = tps."id"
FROM "therapy_plan_sets" tps
WHERE tp."memberId" = tps."memberId"
  AND tps."setCode" LIKE 'TPS-LEGACY-%'
  AND tp."therapyPlanSetId" IS NULL;

WITH numbered AS (
  SELECT
    tp."id",
    row_number() OVER (
      PARTITION BY tp."therapyPlanSetId"
      ORDER BY COALESCE(ts."infusKe", 2147483647), tp."createdAt", tp."id"
    ) AS rn
  FROM "therapy_plans" tp
  LEFT JOIN "treatment_sessions" ts ON ts."id" = tp."treatmentSessionId"
  WHERE tp."therapyPlanSetId" IS NOT NULL
    AND tp."planNumber" IS NULL
)
UPDATE "therapy_plans" tp
SET "planNumber" = numbered.rn
FROM numbered
WHERE tp."id" = numbered."id";

UPDATE "infusion_executions" ie
SET "therapyPlanId" = tp."id"
FROM "therapy_plans" tp
WHERE tp."treatmentSessionId" = ie."treatmentSessionId"
  AND ie."therapyPlanId" IS NULL;

CREATE INDEX IF NOT EXISTS "therapy_plans_therapyPlanSetId_idx"
  ON "therapy_plans"("therapyPlanSetId");

CREATE UNIQUE INDEX IF NOT EXISTS "therapy_plans_therapyPlanSetId_planNumber_key"
  ON "therapy_plans"("therapyPlanSetId", "planNumber");

CREATE INDEX IF NOT EXISTS "infusion_executions_therapyPlanId_idx"
  ON "infusion_executions"("therapyPlanId");

ALTER TABLE "therapy_plans"
  ADD CONSTRAINT "therapy_plans_therapyPlanSetId_fkey"
  FOREIGN KEY ("therapyPlanSetId") REFERENCES "therapy_plan_sets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "infusion_executions"
  ADD CONSTRAINT "infusion_executions_therapyPlanId_fkey"
  FOREIGN KEY ("therapyPlanId") REFERENCES "therapy_plans"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
