ALTER TABLE "master_products"
ADD COLUMN "default_unit_cost" DECIMAL(18,4);

-- Temporary opening costs requested for a zero-input sales workflow. Admins
-- can update these values later from Master Inventori without changing prices
-- that have already been posted to FIFO layers.
UPDATE "master_products"
SET "default_unit_cost" = CASE
  WHEN "sku" IN ('PRD-ANN-KNG-001', 'PRD-ANN-BRU-001', 'PRD-ANN-HJU-001', 'PRD-ANN-H2S-001') THEN 15000
  WHEN "sku" IN ('PRD-ANN-KNG-002', 'PRD-ANN-BRU-002', 'PRD-ANN-HJU-002', 'PRD-ANN-H2S-002') THEN 35000
  WHEN "sku" = 'PRD-CON-RKK-001' THEN 20000
  ELSE NULL
END
WHERE "sku" IN (
  'PRD-ANN-KNG-001', 'PRD-ANN-BRU-001', 'PRD-ANN-HJU-001', 'PRD-ANN-H2S-001',
  'PRD-ANN-KNG-002', 'PRD-ANN-BRU-002', 'PRD-ANN-HJU-002', 'PRD-ANN-H2S-002',
  'PRD-CON-RKK-001'
);
