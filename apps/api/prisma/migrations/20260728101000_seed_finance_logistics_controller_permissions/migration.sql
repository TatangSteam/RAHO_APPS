INSERT INTO "permissions" (
  "id", "code", "name", "module", "description", "isSensitive", "updatedAt"
) VALUES
  ('perm_zoho_connection_manage', 'ZOHO.CONNECTION.MANAGE', 'Kelola Koneksi Zoho', 'ZOHO', 'Menghubungkan dan mengganti organisasi Zoho.', true, CURRENT_TIMESTAMP),
  ('perm_zoho_mapping_manage', 'ZOHO.MAPPING.MANAGE', 'Kelola Mapping Zoho', 'ZOHO', 'Mengelola mapping entity ERP dengan Zoho.', true, CURRENT_TIMESTAMP),
  ('perm_zoho_sync_read', 'ZOHO.SYNC.READ', 'Lihat Sinkronisasi Zoho', 'ZOHO', 'Melihat antrean dan hasil sinkronisasi Zoho.', false, CURRENT_TIMESTAMP),
  ('perm_zoho_sync_retry', 'ZOHO.SYNC.RETRY', 'Ulang Sinkronisasi Zoho', 'ZOHO', 'Menjalankan ulang event sinkronisasi Zoho yang gagal.', true, CURRENT_TIMESTAMP),
  ('perm_zoho_reconcile_run', 'ZOHO.RECONCILE.RUN', 'Jalankan Rekonsiliasi Zoho', 'ZOHO', 'Menjalankan rekonsiliasi ERP dengan Zoho.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description",
  "isSensitive" = EXCLUDED."isSensitive",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_templates" (
  "id", "code", "name", "description", "baseRole", "isSystem", "isActive", "updatedAt"
) VALUES (
  'rt_finance_logistics_controller',
  'FINANCE_LOGISTICS_CONTROLLER_DEFAULT',
  'Finance & Logistics Controller',
  'Kontrol Finance, Logistik, sinkronisasi Zoho, dan rekonsiliasi dengan branch scope.',
  'FINANCE_LOGISTICS_CONTROLLER',
  true,
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "baseRole" = EXCLUDED."baseRole",
  "isSystem" = true,
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT
  'rtp_flc_' || p."id",
  'rt_finance_logistics_controller',
  p."id"
FROM "permissions" p
WHERE p."code" IN (
  'BRANCH.READ',
  'AUDIT.READ',
  'AUDIT.EXPORT',
  'ACCOUNT.READ',
  'JOURNAL.READ',
  'CASH_BANK.READ',
  'EXPENSE.READ',
  'INVENTORY.READ',
  'INVENTORY.VALUATION.READ',
  'INVENTORY.RECONCILE',
  'INVENTORY.REQUEST.READ',
  'INVENTORY.REQUEST.APPROVE',
  'INVENTORY.RESERVATION.CREATE',
  'INVENTORY.SHIPMENT.READ',
  'INVENTORY.SHIPMENT.DISPATCH',
  'INVENTORY.DISCREPANCY.READ',
  'INVENTORY.OPNAME.READ',
  'INVENTORY.ADJUSTMENT.READ',
  'SUPPLIER.READ',
  'PURCHASE_REQUEST.READ',
  'PURCHASE_ORDER.READ',
  'GOODS_RECEIPT.READ',
  'AP.READ',
  'DEFERRED_REVENUE.READ',
  'WORKFLOW.APPROVAL.READ',
  'ZOHO.SYNC.READ',
  'ZOHO.SYNC.RETRY',
  'ZOHO.RECONCILE.RUN'
)
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
