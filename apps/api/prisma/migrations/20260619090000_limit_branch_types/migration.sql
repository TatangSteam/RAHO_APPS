-- Keep branch type aligned with the current operating model:
-- PUSAT, PREMIER, and PARTNERSHIP only.

UPDATE "branches"
SET "type" = 'PREMIER'
WHERE "type"::text = 'KLINIK';

UPDATE "branches"
SET "type" = 'PARTNERSHIP'
WHERE "type"::text = 'HOMECARE';

ALTER TABLE "branches" ALTER COLUMN "type" DROP DEFAULT;

CREATE TYPE "BranchType_new" AS ENUM ('PUSAT', 'PREMIER', 'PARTNERSHIP');

ALTER TABLE "branches"
  ALTER COLUMN "type" TYPE "BranchType_new"
  USING ("type"::text::"BranchType_new");

ALTER TYPE "BranchType" RENAME TO "BranchType_old";
ALTER TYPE "BranchType_new" RENAME TO "BranchType";
DROP TYPE "BranchType_old";

ALTER TABLE "branches" ALTER COLUMN "type" SET DEFAULT 'PREMIER';
