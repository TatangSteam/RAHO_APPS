DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_SUCCESS';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_FAILED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'VERIFY_PAYMENT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'REJECT_PAYMENT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'UPLOAD_FILE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'STATUS_CHANGE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'ASSIGN';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'CANCEL';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'COMPLETE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'STOCK_REQUEST';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'SHIPMENT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'RECEIVE_SHIPMENT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'STOCK_ADJUSTMENT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."audit_logs"
ADD COLUMN IF NOT EXISTS "userName" TEXT,
ADD COLUMN IF NOT EXISTS "userRole" TEXT,
ADD COLUMN IF NOT EXISTS "branchName" TEXT,
ADD COLUMN IF NOT EXISTS "module" TEXT,
ADD COLUMN IF NOT EXISTS "entityType" TEXT,
ADD COLUMN IF NOT EXISTS "entityId" TEXT,
ADD COLUMN IF NOT EXISTS "entityCode" TEXT,
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "beforeData" JSONB,
ADD COLUMN IF NOT EXISTS "afterData" JSONB,
ADD COLUMN IF NOT EXISTS "changedFields" JSONB,
ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "audit_logs_module_idx" ON "public"."audit_logs"("module");
CREATE INDEX IF NOT EXISTS "audit_logs_entityType_idx" ON "public"."audit_logs"("entityType");
CREATE INDEX IF NOT EXISTS "audit_logs_entityId_idx" ON "public"."audit_logs"("entityId");
