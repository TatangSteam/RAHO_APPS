-- Repair permission rows that can be absent on databases where the original
-- Sprint 9 migration was retried from an older migration-file revision.
-- This migration is additive and safe for databases that already have them.
INSERT INTO "permissions" (
  "id", "code", "name", "module", "description", "isSensitive", "isActive", "updatedAt"
) VALUES
  (
    'perm_workflow_rule_manage',
    'WORKFLOW.RULE.MANAGE',
    'Kelola Approval Rule',
    'WORKFLOW',
    'Mengelola rule dan tahapan approval.',
    true,
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'perm_inventory_opname_create',
    'INVENTORY.OPNAME.CREATE',
    'Buat Stock Opname',
    'INVENTORY',
    'Membuat dan submit stock opname.',
    true,
    true,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description",
  "isSensitive" = EXCLUDED."isSensitive",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT
  'rtp_permission_repair_' || template."id" || '_' || permission."id",
  template."id",
  permission."id"
FROM "role_templates" AS template
JOIN "permissions" AS permission
  ON permission."code" IN ('WORKFLOW.RULE.MANAGE', 'INVENTORY.OPNAME.CREATE')
WHERE template."id" IN ('rt_super_admin', 'rt_admin_manager')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT
  'rtp_permission_repair_' || template."id" || '_' || permission."id",
  template."id",
  permission."id"
FROM "role_templates" AS template
JOIN "permissions" AS permission
  ON permission."code" = 'INVENTORY.OPNAME.CREATE'
WHERE template."id" = 'rt_admin_logistik'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
