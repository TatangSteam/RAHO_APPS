-- Script untuk mengubah nama produk Infus HHO (5ml)
-- Ganti "Nama Baru Yang Diinginkan" dengan nama yang Anda inginkan

-- 1. Cek produk yang ada
SELECT id, name, category, unit, description 
FROM master_products 
WHERE name = 'Infus HHO (5ml)';

-- 2. Update nama produk (ganti dengan nama yang diinginkan)
UPDATE master_products 
SET name = 'Infus Gassotraus HHO (5ml)'
WHERE name = 'Infus HHO (5ml)';

-- 3. Verifikasi perubahan
SELECT id, name, category, unit, description 
FROM master_products 
WHERE name LIKE '%HHO%';

-- 4. Cek inventory items yang terpengaruh
SELECT 
    ii.id,
    mp.name as product_name,
    b.name as branch_name,
    ii.stock,
    ii.min_threshold
FROM inventory_items ii
JOIN master_products mp ON ii.master_product_id = mp.id
JOIN branches b ON ii.branch_id = b.id
WHERE mp.name LIKE '%HHO%';