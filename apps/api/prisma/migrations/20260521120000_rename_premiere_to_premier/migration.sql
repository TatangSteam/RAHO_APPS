-- Rename PREMIERE to PREMIER in BranchType enum
-- This migration renames the enum value from PREMIERE to PREMIER

-- Step 1: Add new enum value PREMIER (if not exists)
-- Note: This needs to be committed before it can be used
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'PREMIER' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BranchType')
    ) THEN
        ALTER TYPE "BranchType" ADD VALUE 'PREMIER';
    END IF;
END
$$;

-- Note: PostgreSQL doesn't support removing enum values directly.
-- The old PREMIERE value will remain in the enum but won't be used.
-- The UPDATE to change existing records will be done in a separate migration
-- or manually after this migration is committed.
