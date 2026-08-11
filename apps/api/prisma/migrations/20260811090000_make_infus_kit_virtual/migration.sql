-- "Infus Set + Pelengkap" is a virtual kit definition. Existing inventory
-- rows and balances are intentionally retained for historical postings,
-- legacy-session consumption, and reversals.
UPDATE "master_products"
SET "is_auto_added_to_branch" = false,
    "default_initial_stock" = NULL,
    "description" = 'Kit virtual Infus Set + Pelengkap. Stok dan restock dicatat melalui komponen fisiknya.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "sku" = 'PRD-INF-SET-002';

-- Retained legacy rows must not create a replenishment alert.
UPDATE "inventory_items" item
SET "minThreshold" = 0,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "master_products" product
WHERE item."masterProductId" = product."id"
  AND product."sku" = 'PRD-INF-SET-002';
