CREATE TYPE "AdminManagerAccessScope" AS ENUM ('FULL', 'MEMBER_VIEW_ONLY');

ALTER TABLE "users"
  ADD COLUMN "adminManagerAccessScope" "AdminManagerAccessScope" NOT NULL DEFAULT 'FULL';
