-- Repair installations where the infusion-kit migration ran before master
-- products were seeded. The parent SKU is virtual; sessions consume the five
-- physical components below.
INSERT INTO "product_kit_components" (
  "id", "kitProductId", "componentProductId", "quantity", "isRequired", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'kit-infus-v1-' || component."sku",
  kit."id",
  component."id",
  definition."quantity",
  true,
  definition."sortOrder",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
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
    "isRequired" = true,
    "sortOrder" = EXCLUDED."sortOrder",
    "updatedAt" = CURRENT_TIMESTAMP;

-- Some development and upgraded databases received compatibility stock after
-- the ledger migration. Create a canonical scope only for affected branches.
INSERT INTO "warehouses" (
  "id", "branchId", "code", "name", "isDefault", "isActive", "createdBy", "createdAt", "updatedAt"
)
SELECT
  'repair_infus_wh_' || substr(md5(branch."id"), 1, 20),
  branch."id",
  'DEFAULT',
  'Scope Stok Cabang',
  true,
  true,
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "branches" branch
WHERE EXISTS (
  SELECT 1
  FROM "inventory_items" item
  JOIN "master_products" product ON product."id" = item."masterProductId"
  WHERE item."branchId" = branch."id"
    AND product."sku" IN (
      'PRD-MED-IVC-001', 'PRD-INF-SET-001', 'PRD-MED-PTR-001',
      'PRD-MED-SWB-001', 'PRD-MED-URF-001'
    )
)
AND NOT EXISTS (SELECT 1 FROM "warehouses" warehouse WHERE warehouse."branchId" = branch."id")
ON CONFLICT ("branchId", "code") DO NOTHING;

WITH canonical_warehouse AS (
  SELECT DISTINCT ON (warehouse."branchId")
    warehouse."id", warehouse."branchId"
  FROM "warehouses" warehouse
  ORDER BY warehouse."branchId", warehouse."isDefault" DESC,
           warehouse."isActive" DESC, warehouse."createdAt", warehouse."id"
)
INSERT INTO "stock_locations" (
  "id", "warehouseId", "code", "name", "isDefault", "isActive", "createdBy", "createdAt", "updatedAt"
)
SELECT
  'repair_infus_loc_' || substr(md5(warehouse."id"), 1, 20),
  warehouse."id",
  'DEFAULT',
  'Scope Stok Cabang',
  true,
  true,
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM canonical_warehouse warehouse
WHERE NOT EXISTS (
  SELECT 1 FROM "stock_locations" location WHERE location."warehouseId" = warehouse."id"
)
ON CONFLICT ("warehouseId", "code") DO NOTHING;

-- Materialize only the positive delta between the compatibility mirror and
-- authoritative ledger. Existing balances, reservations, and quarantines are
-- preserved. The quantity is marked pending valuation, exactly like the
-- application's compatibility reconciliation service.
CREATE TEMP TABLE "_infusion_kit_stock_repair" ON COMMIT DROP AS
WITH canonical_scope AS (
  SELECT DISTINCT ON (warehouse."branchId")
    warehouse."branchId",
    warehouse."id" AS "warehouseId",
    location."id" AS "stockLocationId"
  FROM "warehouses" warehouse
  JOIN "stock_locations" location ON location."warehouseId" = warehouse."id"
  ORDER BY warehouse."branchId", warehouse."isDefault" DESC,
           warehouse."isActive" DESC, location."isDefault" DESC,
           location."isActive" DESC, warehouse."createdAt", location."createdAt",
           warehouse."id", location."id"
), ledger_stock AS (
  SELECT balance."inventoryItemId", COALESCE(sum(balance."onHandQty"), 0) AS "onHandQty"
  FROM "inventory_balances" balance
  GROUP BY balance."inventoryItemId"
)
SELECT
  item."id" AS "inventoryItemId",
  item."masterProductId",
  item."branchId",
  scope."warehouseId",
  COALESCE(
    item."stockLocationId",
    (
      SELECT balance."stockLocationId"
      FROM "inventory_balances" balance
      WHERE balance."inventoryItemId" = item."id"
      ORDER BY balance."createdAt", balance."id"
      LIMIT 1
    ),
    scope."stockLocationId"
  ) AS "stockLocationId",
  item."stock" - COALESCE(ledger."onHandQty", 0) AS "deltaQty"
FROM "inventory_items" item
JOIN "master_products" product ON product."id" = item."masterProductId"
JOIN canonical_scope scope ON scope."branchId" = item."branchId"
LEFT JOIN ledger_stock ledger ON ledger."inventoryItemId" = item."id"
WHERE product."sku" IN (
    'PRD-MED-IVC-001', 'PRD-INF-SET-001', 'PRD-MED-PTR-001',
    'PRD-MED-SWB-001', 'PRD-MED-URF-001'
  )
  AND item."stock" > COALESCE(ledger."onHandQty", 0);

UPDATE "inventory_items" item
SET "warehouseId" = location."warehouseId",
    "stockLocationId" = repair."stockLocationId",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "_infusion_kit_stock_repair" repair
JOIN "stock_locations" location ON location."id" = repair."stockLocationId"
WHERE item."id" = repair."inventoryItemId";

INSERT INTO "inventory_balances" (
  "id", "inventoryItemId", "stockLocationId", "masterProductId", "branchId", "batchKey",
  "onHandQty", "createdAt", "updatedAt"
)
SELECT
  'repair_infus_bal_' || substr(md5(repair."inventoryItemId" || ':' || repair."stockLocationId"), 1, 20),
  repair."inventoryItemId",
  repair."stockLocationId",
  repair."masterProductId",
  repair."branchId",
  'NO_BATCH',
  repair."deltaQty",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "_infusion_kit_stock_repair" repair
WHERE repair."deltaQty" > 0
ON CONFLICT ("inventoryItemId", "stockLocationId", "batchKey") DO UPDATE
SET "onHandQty" = "inventory_balances"."onHandQty" + EXCLUDED."onHandQty",
    "version" = "inventory_balances"."version" + 1,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "inventory_cost_layers" (
  "id", "inventoryBalanceId", "sourceType", "sourceId", "originalQty", "remainingQty",
  "unitCost", "valuationStatus", "receivedAt", "createdAt"
)
SELECT
  'repair_infus_layer_' || substr(md5(repair."inventoryItemId"), 1, 20),
  balance."id",
  'INFUSION_KIT_STOCK_REPAIR',
  repair."inventoryItemId",
  repair."deltaQty",
  repair."deltaQty",
  NULL,
  'PENDING_VALUATION',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "_infusion_kit_stock_repair" repair
JOIN "inventory_balances" balance
  ON balance."inventoryItemId" = repair."inventoryItemId"
 AND balance."stockLocationId" = repair."stockLocationId"
 AND balance."batchKey" = 'NO_BATCH'
WHERE repair."deltaQty" > 0
ON CONFLICT ("id") DO NOTHING;
