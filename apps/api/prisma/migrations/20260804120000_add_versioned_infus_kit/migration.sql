-- Existing sessions must retain their legacy material behavior. The database
-- default is switched only after the current rows have been backfilled.
ALTER TABLE "treatment_sessions"
  ADD COLUMN "materialPolicyVersion" INTEGER;

UPDATE "treatment_sessions"
SET "materialPolicyVersion" = 1
WHERE "materialPolicyVersion" IS NULL;

ALTER TABLE "treatment_sessions"
  ALTER COLUMN "materialPolicyVersion" SET NOT NULL,
  ALTER COLUMN "materialPolicyVersion" SET DEFAULT 2;

CREATE INDEX "treatment_sessions_materialPolicyVersion_idx"
  ON "treatment_sessions"("materialPolicyVersion");

CREATE TABLE "product_kit_components" (
  "id" TEXT NOT NULL,
  "kitProductId" TEXT NOT NULL,
  "componentProductId" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_kit_components_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_kit_components_kitProductId_componentProductId_key"
  ON "product_kit_components"("kitProductId", "componentProductId");
CREATE INDEX "product_kit_components_componentProductId_idx"
  ON "product_kit_components"("componentProductId");

ALTER TABLE "product_kit_components"
  ADD CONSTRAINT "product_kit_components_kitProductId_fkey"
  FOREIGN KEY ("kitProductId") REFERENCES "master_products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_kit_components"
  ADD CONSTRAINT "product_kit_components_componentProductId_fkey"
  FOREIGN KEY ("componentProductId") REFERENCES "master_products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- The bundle remains available for legacy sessions, while its components are
-- the inventory definition used by sessions created after this migration.
INSERT INTO "product_kit_components" (
  "id", "kitProductId", "componentProductId", "quantity", "isRequired", "sortOrder"
)
SELECT
  'kit-infus-v1-' || component."sku",
  kit."id",
  component."id",
  definition."quantity",
  true,
  definition."sortOrder"
FROM "master_products" kit
CROSS JOIN (
  VALUES
    ('PRD-MED-IVC-001', 1.0000::decimal, 1),
    ('PRD-INF-SET-001', 1.0000::decimal, 2),
    ('PRD-MED-PTR-001', 1.0000::decimal, 3),
    ('PRD-MED-SWB-001', 2.0000::decimal, 4),
    ('PRD-MED-URF-001', 3.0000::decimal, 5)
) AS definition("sku", "quantity", "sortOrder")
JOIN "master_products" component ON component."sku" = definition."sku"
WHERE kit."sku" = 'PRD-INF-SET-002'
ON CONFLICT ("kitProductId", "componentProductId") DO UPDATE
SET "quantity" = EXCLUDED."quantity",
    "isRequired" = EXCLUDED."isRequired",
    "sortOrder" = EXCLUDED."sortOrder",
    "updatedAt" = CURRENT_TIMESTAMP;

-- New branches automatically receive inventory rows for every kit component.
UPDATE "master_products"
SET "is_auto_added_to_branch" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "sku" IN (
  'PRD-MED-IVC-001',
  'PRD-INF-SET-001',
  'PRD-MED-PTR-001',
  'PRD-MED-SWB-001',
  'PRD-MED-URF-001'
);
