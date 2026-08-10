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
  'perm_staff_performance_read',
  'STAFF.PERFORMANCE.READ',
  'Lihat Kinerja Staff',
  'STAFF',
  'Melihat ringkasan dan riwayat kinerja staff dalam cakupan cabang yang dapat diakses.',
  false,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_template_permissions" (
  "id",
  "roleTemplateId",
  "permissionId"
)
SELECT
  'rtp_staff_performance_read_' || rt."id",
  rt."id",
  p."id"
FROM "role_templates" rt
JOIN "permissions" p ON p."code" = 'STAFF.PERFORMANCE.READ'
WHERE rt."baseRole" IN ('SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'DOCTOR')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
