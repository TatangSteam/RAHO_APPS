CREATE TYPE "InventoryPostingType" AS ENUM ('OPENING', 'RECEIPT', 'ISSUE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'REVERSAL');
CREATE TYPE "InventoryPostingStatus" AS ENUM ('POSTED', 'REVERSED');
CREATE TYPE "InventoryValuationStatus" AS ENUM ('VALUED', 'PENDING_VALUATION');
CREATE TYPE "InventoryCostAllocationType" AS ENUM ('CONSUMPTION', 'REVERSAL');

ALTER TABLE "master_products"
  ADD COLUMN "baseUomId" TEXT,
  ADD COLUMN "usageUomId" TEXT,
  ADD COLUMN "tracksBatch" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tracksExpiry" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "inventory_items"
  ADD COLUMN "warehouseId" TEXT,
  ADD COLUMN "stockLocationId" TEXT;

ALTER TABLE "stock_mutations"
  ADD COLUMN "inventoryPostingId" TEXT,
  ADD COLUMN "inventoryBalanceId" TEXT,
  ADD COLUMN "batchId" TEXT,
  ADD COLUMN "actualCost" DECIMAL(18,4);

CREATE TABLE "warehouses" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_locations" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "units_of_measure" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "precision" INTEGER NOT NULL DEFAULT 4,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "unit_conversions" (
  "id" TEXT NOT NULL,
  "masterProductId" TEXT NOT NULL,
  "fromUomId" TEXT NOT NULL,
  "toUomId" TEXT NOT NULL,
  "factor" DECIMAL(18,6) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "unit_conversions_factor_check" CHECK ("factor" > 0)
);

CREATE TABLE "inventory_batches" (
  "id" TEXT NOT NULL,
  "masterProductId" TEXT NOT NULL,
  "batchNumber" TEXT NOT NULL,
  "manufactureDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  "isLegacyPlaceholder" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_batches_dates_check" CHECK ("manufactureDate" IS NULL OR "expiryDate" IS NULL OR "expiryDate" > "manufactureDate")
);

CREATE TABLE "inventory_balances" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "stockLocationId" TEXT NOT NULL,
  "masterProductId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "batchId" TEXT,
  "batchKey" TEXT NOT NULL DEFAULT 'NO_BATCH',
  "onHandQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "reservedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "quarantineQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "inTransitQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_balances_non_negative_check" CHECK (
    "onHandQty" >= 0 AND "reservedQty" >= 0 AND "quarantineQty" >= 0 AND "inTransitQty" >= 0
  ),
  CONSTRAINT "inventory_balances_available_check" CHECK ("reservedQty" + "quarantineQty" <= "onHandQty"),
  CONSTRAINT "inventory_balances_batch_key_check" CHECK (
    ("batchId" IS NULL AND "batchKey" = 'NO_BATCH') OR ("batchId" IS NOT NULL AND "batchKey" = "batchId")
  )
);

CREATE TABLE "inventory_postings" (
  "id" TEXT NOT NULL,
  "postingNumber" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "type" "InventoryPostingType" NOT NULL,
  "status" "InventoryPostingStatus" NOT NULL DEFAULT 'POSTED',
  "reasonCode" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceNumber" TEXT,
  "branchId" TEXT NOT NULL,
  "costCenterCode" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "totalCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "postedBy" TEXT NOT NULL,
  "reversedAt" TIMESTAMP(3),
  "reversalOfId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_postings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_cost_layers" (
  "id" TEXT NOT NULL,
  "inventoryBalanceId" TEXT NOT NULL,
  "batchId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "originalQty" DECIMAL(18,4) NOT NULL,
  "remainingQty" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,4),
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "valuationStatus" "InventoryValuationStatus" NOT NULL DEFAULT 'VALUED',
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "isVoided" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_cost_layers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_cost_layers_quantity_check" CHECK (
    "originalQty" > 0 AND "remainingQty" >= 0 AND "remainingQty" <= "originalQty"
  ),
  CONSTRAINT "inventory_cost_layers_valuation_check" CHECK (
    ("valuationStatus" = 'VALUED' AND "unitCost" IS NOT NULL AND "unitCost" >= 0) OR
    ("valuationStatus" = 'PENDING_VALUATION' AND "unitCost" IS NULL)
  )
);

CREATE TABLE "inventory_cost_allocations" (
  "id" TEXT NOT NULL,
  "postingId" TEXT NOT NULL,
  "stockMutationId" TEXT NOT NULL,
  "costLayerId" TEXT NOT NULL,
  "type" "InventoryCostAllocationType" NOT NULL DEFAULT 'CONSUMPTION',
  "quantity" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,4) NOT NULL,
  "totalCost" DECIMAL(18,4) NOT NULL,
  "reversalOfId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_cost_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_cost_allocations_quantity_check" CHECK ("quantity" > 0 AND "unitCost" >= 0 AND "totalCost" >= 0)
);

CREATE UNIQUE INDEX "warehouses_branchId_code_key" ON "warehouses"("branchId", "code");
CREATE UNIQUE INDEX "warehouses_one_default_per_branch" ON "warehouses"("branchId") WHERE "isDefault" = true;
CREATE INDEX "warehouses_branchId_isActive_idx" ON "warehouses"("branchId", "isActive");
CREATE UNIQUE INDEX "stock_locations_warehouseId_code_key" ON "stock_locations"("warehouseId", "code");
CREATE UNIQUE INDEX "stock_locations_one_default_per_warehouse" ON "stock_locations"("warehouseId") WHERE "isDefault" = true;
CREATE INDEX "stock_locations_warehouseId_isActive_idx" ON "stock_locations"("warehouseId", "isActive");
CREATE UNIQUE INDEX "units_of_measure_code_key" ON "units_of_measure"("code");
CREATE INDEX "units_of_measure_category_isActive_idx" ON "units_of_measure"("category", "isActive");
CREATE UNIQUE INDEX "unit_conversions_masterProductId_fromUomId_toUomId_key" ON "unit_conversions"("masterProductId", "fromUomId", "toUomId");
CREATE INDEX "unit_conversions_fromUomId_toUomId_isActive_idx" ON "unit_conversions"("fromUomId", "toUomId", "isActive");
CREATE UNIQUE INDEX "inventory_batches_masterProductId_batchNumber_key" ON "inventory_batches"("masterProductId", "batchNumber");
CREATE INDEX "inventory_batches_masterProductId_expiryDate_idx" ON "inventory_batches"("masterProductId", "expiryDate");
CREATE UNIQUE INDEX "inventory_balances_inventoryItemId_stockLocationId_batchKey_key" ON "inventory_balances"("inventoryItemId", "stockLocationId", "batchKey");
CREATE INDEX "inventory_balances_branchId_masterProductId_idx" ON "inventory_balances"("branchId", "masterProductId");
CREATE INDEX "inventory_balances_stockLocationId_masterProductId_idx" ON "inventory_balances"("stockLocationId", "masterProductId");
CREATE INDEX "inventory_balances_batchId_idx" ON "inventory_balances"("batchId");
CREATE UNIQUE INDEX "inventory_postings_postingNumber_key" ON "inventory_postings"("postingNumber");
CREATE UNIQUE INDEX "inventory_postings_idempotencyKey_key" ON "inventory_postings"("idempotencyKey");
CREATE UNIQUE INDEX "inventory_postings_reversalOfId_key" ON "inventory_postings"("reversalOfId");
CREATE INDEX "inventory_postings_sourceType_sourceId_idx" ON "inventory_postings"("sourceType", "sourceId");
CREATE INDEX "inventory_postings_branchId_occurredAt_idx" ON "inventory_postings"("branchId", "occurredAt");
CREATE INDEX "inventory_postings_status_createdAt_idx" ON "inventory_postings"("status", "createdAt");
CREATE INDEX "inventory_cost_layers_inventoryBalanceId_receivedAt_id_idx" ON "inventory_cost_layers"("inventoryBalanceId", "receivedAt", "id");
CREATE INDEX "inventory_cost_layers_batchId_receivedAt_idx" ON "inventory_cost_layers"("batchId", "receivedAt");
CREATE INDEX "inventory_cost_layers_sourceType_sourceId_idx" ON "inventory_cost_layers"("sourceType", "sourceId");
CREATE UNIQUE INDEX "inventory_cost_allocations_reversalOfId_key" ON "inventory_cost_allocations"("reversalOfId");
CREATE UNIQUE INDEX "inventory_cost_allocations_postingId_stockMutationId_costLayerId_type_key" ON "inventory_cost_allocations"("postingId", "stockMutationId", "costLayerId", "type");
CREATE INDEX "inventory_cost_allocations_costLayerId_createdAt_idx" ON "inventory_cost_allocations"("costLayerId", "createdAt");
CREATE INDEX "inventory_cost_allocations_stockMutationId_idx" ON "inventory_cost_allocations"("stockMutationId");
CREATE INDEX "master_products_baseUomId_idx" ON "master_products"("baseUomId");
CREATE INDEX "master_products_usageUomId_idx" ON "master_products"("usageUomId");
CREATE INDEX "inventory_items_warehouseId_idx" ON "inventory_items"("warehouseId");
CREATE INDEX "inventory_items_stockLocationId_idx" ON "inventory_items"("stockLocationId");
CREATE INDEX "stock_mutations_inventoryPostingId_idx" ON "stock_mutations"("inventoryPostingId");
CREATE INDEX "stock_mutations_inventoryBalanceId_idx" ON "stock_mutations"("inventoryBalanceId");
CREATE INDEX "stock_mutations_batchId_idx" ON "stock_mutations"("batchId");

ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_products" ADD CONSTRAINT "master_products_baseUomId_fkey" FOREIGN KEY ("baseUomId") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "master_products" ADD CONSTRAINT "master_products_usageUomId_fkey" FOREIGN KEY ("usageUomId") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_fromUomId_fkey" FOREIGN KEY ("fromUomId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_toUomId_fkey" FOREIGN KEY ("toUomId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_postings" ADD CONSTRAINT "inventory_postings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_postings" ADD CONSTRAINT "inventory_postings_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_mutations" ADD CONSTRAINT "stock_mutations_inventoryPostingId_fkey" FOREIGN KEY ("inventoryPostingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_mutations" ADD CONSTRAINT "stock_mutations_inventoryBalanceId_fkey" FOREIGN KEY ("inventoryBalanceId") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_mutations" ADD CONSTRAINT "stock_mutations_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_inventoryBalanceId_fkey" FOREIGN KEY ("inventoryBalanceId") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_allocations" ADD CONSTRAINT "inventory_cost_allocations_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_allocations" ADD CONSTRAINT "inventory_cost_allocations_stockMutationId_fkey" FOREIGN KEY ("stockMutationId") REFERENCES "stock_mutations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_allocations" ADD CONSTRAINT "inventory_cost_allocations_costLayerId_fkey" FOREIGN KEY ("costLayerId") REFERENCES "inventory_cost_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_allocations" ADD CONSTRAINT "inventory_cost_allocations_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "inventory_cost_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "warehouses" ("id", "branchId", "code", "name", "isDefault", "createdAt", "updatedAt")
SELECT 'wh_default_' || b."id", b."id", 'DEFAULT', 'Warehouse Utama', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "branches" b
ON CONFLICT ("branchId", "code") DO NOTHING;

INSERT INTO "stock_locations" ("id", "warehouseId", "code", "name", "isDefault", "createdAt", "updatedAt")
SELECT 'loc_default_' || w."branchId", w."id", 'DEFAULT', 'Lokasi Utama', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "warehouses" w
WHERE w."isDefault" = true
ON CONFLICT ("warehouseId", "code") DO NOTHING;

UPDATE "inventory_items" i
SET "warehouseId" = w."id", "stockLocationId" = l."id"
FROM "warehouses" w
JOIN "stock_locations" l ON l."warehouseId" = w."id" AND l."isDefault" = true
WHERE w."branchId" = i."branchId" AND w."isDefault" = true;

WITH legacy_uom AS (
  SELECT DISTINCT trim(unit_name) AS unit_name
  FROM (
    SELECT "base_unit" AS unit_name FROM "master_products"
    UNION ALL
    SELECT "usage_unit" AS unit_name FROM "master_products"
  ) source
  WHERE unit_name IS NOT NULL AND trim(unit_name) <> ''
)
INSERT INTO "units_of_measure" ("id", "code", "name", "category", "createdAt", "updatedAt")
SELECT 'uom_' || substr(md5(lower(unit_name)), 1, 20), 'UOM_' || upper(substr(md5(lower(unit_name)), 1, 12)), unit_name, 'LEGACY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM legacy_uom
ON CONFLICT ("code") DO NOTHING;

UPDATE "master_products" p
SET "baseUomId" = u."id"
FROM "units_of_measure" u
WHERE lower(trim(p."base_unit")) = lower(trim(u."name"));

UPDATE "master_products" p
SET "usageUomId" = u."id"
FROM "units_of_measure" u
WHERE lower(trim(p."usage_unit")) = lower(trim(u."name"));

INSERT INTO "unit_conversions" ("id", "masterProductId", "fromUomId", "toUomId", "factor", "createdAt", "updatedAt")
SELECT 'conv_' || p."id", p."id", p."baseUomId", p."usageUomId", p."conversion_factor", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "master_products" p
WHERE p."baseUomId" IS NOT NULL AND p."usageUomId" IS NOT NULL AND p."conversion_factor" > 0
ON CONFLICT ("masterProductId", "fromUomId", "toUomId") DO NOTHING;

INSERT INTO "inventory_balances" (
  "id", "inventoryItemId", "stockLocationId", "masterProductId", "branchId", "batchKey",
  "onHandQty", "createdAt", "updatedAt"
)
SELECT 'bal_legacy_' || i."id", i."id", i."stockLocationId", i."masterProductId", i."branchId", 'NO_BATCH',
       GREATEST(i."stock", 0), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "inventory_items" i
WHERE i."stockLocationId" IS NOT NULL
ON CONFLICT ("inventoryItemId", "stockLocationId", "batchKey") DO NOTHING;

INSERT INTO "inventory_postings" (
  "id", "postingNumber", "idempotencyKey", "payloadHash", "type", "reasonCode", "sourceType", "sourceId",
  "branchId", "occurredAt", "postedBy", "createdAt"
)
SELECT 'post_legacy_' || i."id", 'INV-MIG-' || i."id", 'LEGACY-MIGRATION:' || i."id", md5(i."id" || ':' || i."stock"::text),
       'OPENING', 'LEGACY_MIGRATION', 'INVENTORY_ITEM', i."id", i."branchId", CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP
FROM "inventory_items" i
WHERE i."stockLocationId" IS NOT NULL
ON CONFLICT ("idempotencyKey") DO NOTHING;

INSERT INTO "stock_mutations" (
  "id", "inventoryItemId", "type", "quantity", "stockBefore", "stockAfter", "referenceType", "referenceId",
  "notes", "createdBy", "createdAt", "inventoryPostingId", "inventoryBalanceId"
)
SELECT 'mut_legacy_' || i."id", i."id", 'ADJUSTMENT', GREATEST(i."stock", 0), 0, GREATEST(i."stock", 0),
       'LEGACY_MIGRATION', i."id", 'Opening balance generated by inventory ledger migration', 'system', CURRENT_TIMESTAMP,
       'post_legacy_' || i."id", b."id"
FROM "inventory_items" i
JOIN "inventory_balances" b ON b."inventoryItemId" = i."id" AND b."batchKey" = 'NO_BATCH'
WHERE i."stock" > 0
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "inventory_cost_layers" (
  "id", "inventoryBalanceId", "sourceType", "sourceId", "originalQty", "remainingQty", "unitCost",
  "valuationStatus", "receivedAt", "createdAt"
)
SELECT 'layer_legacy_' || i."id", b."id", 'LEGACY_MIGRATION', i."id", i."stock", i."stock", NULL,
       'PENDING_VALUATION', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "inventory_items" i
JOIN "inventory_balances" b ON b."inventoryItemId" = i."id" AND b."batchKey" = 'NO_BATCH'
WHERE i."stock" > 0
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_inventory_read', 'INVENTORY.READ', 'Lihat Inventory', 'INVENTORY', 'Melihat saldo, batch, dan stock card sesuai branch scope.', false, CURRENT_TIMESTAMP),
  ('perm_inventory_master_manage', 'INVENTORY.MASTER.MANAGE', 'Kelola Master Inventory', 'INVENTORY', 'Mengelola warehouse, location, UOM, conversion, product, dan batch.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_post', 'INVENTORY.POST', 'Posting Inventory', 'INVENTORY', 'Melakukan receipt dan issue inventory melalui source document.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_reverse', 'INVENTORY.REVERSE', 'Reverse Inventory', 'INVENTORY', 'Membalik posting inventory yang sudah posted.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_valuation_read', 'INVENTORY.VALUATION.READ', 'Lihat Nilai Inventory', 'INVENTORY', 'Melihat cost layer dan actual inventory cost.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_reconcile', 'INVENTORY.RECONCILE', 'Rekonsiliasi Inventory', 'INVENTORY', 'Menjalankan dan melihat rekonsiliasi inventory ledger.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_inv_super_' || p."id", 'rt_super_admin', p."id" FROM "permissions" p WHERE p."module" = 'INVENTORY'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_inv_manager_' || p."id", 'rt_admin_manager', p."id" FROM "permissions" p WHERE p."module" = 'INVENTORY'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_inv_logistik_' || p."id", 'rt_admin_logistik', p."id" FROM "permissions" p WHERE p."module" = 'INVENTORY'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_inv_cabang_' || p."id", 'rt_admin_cabang', p."id" FROM "permissions" p
WHERE p."code" IN ('INVENTORY.READ', 'INVENTORY.POST')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_inv_read_' || rt."id" || '_' || p."id", rt."id", p."id"
FROM "role_templates" rt CROSS JOIN "permissions" p
WHERE rt."baseRole" IN ('ADMIN_LAYANAN', 'DOCTOR', 'NURSE') AND p."code" = 'INVENTORY.READ'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
