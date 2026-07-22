INSERT INTO "permissions" (
  "id",
  "code",
  "name",
  "module",
  "description",
  "isSensitive",
  "updatedAt"
)
VALUES (
  'perm_clinical_staff_directory_read',
  'CLINICAL.STAFF_DIRECTORY.READ',
  'Lihat Direktori Staf Klinis',
  'CLINICAL',
  'Melihat staf klinis aktif dalam cakupan cabang pengguna.',
  false,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description",
  "isSensitive" = EXCLUDED."isSensitive",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_template_permissions" (
  "id",
  "roleTemplateId",
  "permissionId"
)
SELECT
  'rtp_staff_directory_' || rt."id",
  rt."id",
  p."id"
FROM "role_templates" rt
CROSS JOIN "permissions" p
WHERE rt."id" IN (
  'rt_super_admin',
  'rt_admin_manager',
  'rt_admin_cabang',
  'rt_admin_layanan',
  'rt_doctor',
  'rt_nurse'
)
AND p."code" = 'CLINICAL.STAFF_DIRECTORY.READ'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
