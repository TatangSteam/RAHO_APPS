-- AlterTable: Add auto-use and auto-add fields to MasterProduct
-- These fields enable automatic product usage per infusion session
-- and automatic addition to new branch inventory

ALTER TABLE "master_products" ADD COLUMN "is_auto_used_per_session" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "master_products" ADD COLUMN "is_auto_added_to_branch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "master_products" ADD COLUMN "default_initial_stock" DECIMAL(10,4);

-- Add comment for documentation
COMMENT ON COLUMN "master_products"."is_auto_used_per_session" IS 'Auto-deduct 1 unit per infusion session';
COMMENT ON COLUMN "master_products"."is_auto_added_to_branch" IS 'Auto-add to new branch inventory';
COMMENT ON COLUMN "master_products"."default_initial_stock" IS 'Default stock when auto-added to branch';
