-- Rename PREMIERE to PREMIER in BranchType enum
-- This migration renames the enum value from PREMIERE to PREMIER

-- Step 1: Add new enum value PREMIER
ALTER TYPE "BranchType" ADD VALUE IF NOT EXISTS 'PREMIER';

-- Step 2: Update all existing records from PREMIERE to PREMIER
UPDATE "Branch" SET "type" = 'PREMIER' WHERE "type" = 'PREMIERE';

-- Note: PostgreSQL doesn't support removing enum values directly.
-- The old PREMIERE value will remain in the enum but won't be used.
-- For a clean enum, you would need to:
-- 1. Create a new enum type
-- 2. Update the column to use the new type
-- 3. Drop the old enum type
-- This is left as a future cleanup task if needed.
