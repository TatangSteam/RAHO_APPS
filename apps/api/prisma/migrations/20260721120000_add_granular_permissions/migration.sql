CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

CREATE TABLE "permissions" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "description" TEXT,
  "isSensitive" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_templates" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "baseRole" "Role",
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "role_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_template_permissions" (
  "id" TEXT NOT NULL,
  "roleTemplateId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_template_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_permission_overrides" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "effect" "PermissionEffect" NOT NULL,
  "branchId" TEXT,
  "scopeKey" TEXT NOT NULL DEFAULT 'GLOBAL',
  "reason" TEXT,
  "validUntil" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users" ADD COLUMN "roleTemplateId" TEXT;

CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE INDEX "permissions_module_isActive_idx" ON "permissions"("module", "isActive");
CREATE UNIQUE INDEX "role_templates_code_key" ON "role_templates"("code");
CREATE UNIQUE INDEX "role_templates_baseRole_key" ON "role_templates"("baseRole");
CREATE INDEX "role_templates_isActive_idx" ON "role_templates"("isActive");
CREATE UNIQUE INDEX "role_template_permissions_roleTemplateId_permissionId_key" ON "role_template_permissions"("roleTemplateId", "permissionId");
CREATE INDEX "role_template_permissions_permissionId_idx" ON "role_template_permissions"("permissionId");
CREATE UNIQUE INDEX "user_permission_overrides_userId_permissionId_scopeKey_key" ON "user_permission_overrides"("userId", "permissionId", "scopeKey");
CREATE INDEX "user_permission_overrides_userId_effect_idx" ON "user_permission_overrides"("userId", "effect");
CREATE INDEX "user_permission_overrides_branchId_idx" ON "user_permission_overrides"("branchId");
CREATE INDEX "user_permission_overrides_validUntil_idx" ON "user_permission_overrides"("validUntil");
CREATE INDEX "users_roleTemplateId_idx" ON "users"("roleTemplateId");

ALTER TABLE "users" ADD CONSTRAINT "users_roleTemplateId_fkey" FOREIGN KEY ("roleTemplateId") REFERENCES "role_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "role_template_permissions" ADD CONSTRAINT "role_template_permissions_roleTemplateId_fkey" FOREIGN KEY ("roleTemplateId") REFERENCES "role_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_template_permissions" ADD CONSTRAINT "role_template_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_iam_permission_read', 'IAM.PERMISSION.READ', 'Lihat Permission', 'IAM', 'Melihat katalog permission dan role template.', true, CURRENT_TIMESTAMP),
  ('perm_iam_permission_manage', 'IAM.PERMISSION.MANAGE', 'Kelola Permission', 'IAM', 'Mengubah role template dan override user.', true, CURRENT_TIMESTAMP),
  ('perm_iam_user_read', 'IAM.USER.READ', 'Lihat User', 'IAM', 'Melihat user dalam branch scope.', false, CURRENT_TIMESTAMP),
  ('perm_iam_user_create', 'IAM.USER.CREATE', 'Buat User', 'IAM', 'Membuat user dalam branch scope.', true, CURRENT_TIMESTAMP),
  ('perm_iam_user_update', 'IAM.USER.UPDATE', 'Ubah User', 'IAM', 'Mengubah user dalam branch scope.', true, CURRENT_TIMESTAMP),
  ('perm_iam_user_deactivate', 'IAM.USER.DEACTIVATE', 'Nonaktifkan User', 'IAM', 'Menonaktifkan user lain.', true, CURRENT_TIMESTAMP),
  ('perm_iam_user_reset_password', 'IAM.USER.RESET_PASSWORD', 'Reset Password User', 'IAM', 'Mereset password user lain.', true, CURRENT_TIMESTAMP),
  ('perm_iam_user_manage_role', 'IAM.USER.MANAGE_ROLE', 'Kelola Role User', 'IAM', 'Mengubah role atau role template user.', true, CURRENT_TIMESTAMP),
  ('perm_iam_branch_scope_read', 'IAM.BRANCH_SCOPE.READ', 'Lihat Branch Scope', 'IAM', 'Melihat cakupan cabang user.', false, CURRENT_TIMESTAMP),
  ('perm_iam_branch_scope_manage', 'IAM.BRANCH_SCOPE.MANAGE', 'Kelola Branch Scope', 'IAM', 'Mengubah cakupan cabang user lain.', true, CURRENT_TIMESTAMP),
  ('perm_branch_access_all', 'BRANCH.ACCESS_ALL', 'Akses Semua Cabang', 'BRANCH', 'Melewati pembatasan cabang.', true, CURRENT_TIMESTAMP),
  ('perm_branch_read', 'BRANCH.READ', 'Lihat Cabang', 'BRANCH', 'Melihat cabang yang dapat diakses.', false, CURRENT_TIMESTAMP),
  ('perm_branch_create', 'BRANCH.CREATE', 'Buat Cabang', 'BRANCH', 'Membuat master cabang.', true, CURRENT_TIMESTAMP),
  ('perm_branch_update', 'BRANCH.UPDATE', 'Ubah Cabang', 'BRANCH', 'Mengubah master cabang dalam scope.', true, CURRENT_TIMESTAMP),
  ('perm_branch_delete', 'BRANCH.DELETE', 'Hapus Cabang', 'BRANCH', 'Menghapus master cabang.', true, CURRENT_TIMESTAMP),
  ('perm_audit_read', 'AUDIT.READ', 'Lihat Audit Log', 'AUDIT', 'Melihat audit log dalam branch scope.', true, CURRENT_TIMESTAMP),
  ('perm_audit_export', 'AUDIT.EXPORT', 'Export Audit Log', 'AUDIT', 'Mengunduh audit log.', true, CURRENT_TIMESTAMP),
  ('perm_invoice_read', 'INVOICE.READ', 'Lihat Invoice', 'INVOICE', 'Melihat invoice dalam scope.', false, CURRENT_TIMESTAMP),
  ('perm_invoice_create', 'INVOICE.CREATE', 'Buat Invoice', 'INVOICE', 'Membuat draft invoice.', true, CURRENT_TIMESTAMP),
  ('perm_invoice_update', 'INVOICE.UPDATE', 'Ubah Invoice', 'INVOICE', 'Mengubah draft invoice.', true, CURRENT_TIMESTAMP),
  ('perm_invoice_finalize', 'INVOICE.FINALIZE', 'Finalisasi Invoice', 'INVOICE', 'Memfinalisasi invoice.', true, CURRENT_TIMESTAMP),
  ('perm_invoice_payment', 'INVOICE.PAYMENT', 'Catat Pembayaran', 'INVOICE', 'Mencatat atau memverifikasi pembayaran.', true, CURRENT_TIMESTAMP),
  ('perm_invoice_cancel', 'INVOICE.CANCEL', 'Batalkan Invoice', 'INVOICE', 'Membatalkan invoice melalui workflow.', true, CURRENT_TIMESTAMP),
  ('perm_invoice_proof_read', 'INVOICE.PROOF.READ', 'Lihat Bukti Pembayaran', 'INVOICE', 'Melihat bukti pembayaran yang dilindungi.', true, CURRENT_TIMESTAMP);

INSERT INTO "role_templates" ("id", "code", "name", "description", "baseRole", "isSystem", "updatedAt") VALUES
  ('rt_super_admin', 'SUPER_ADMIN_DEFAULT', 'Super Admin', 'Template sistem Super Admin.', 'SUPER_ADMIN', true, CURRENT_TIMESTAMP),
  ('rt_admin_manager', 'ADMIN_MANAGER_DEFAULT', 'Admin Manager', 'Template sistem Admin Manager.', 'ADMIN_MANAGER', true, CURRENT_TIMESTAMP),
  ('rt_admin_cabang', 'ADMIN_CABANG_DEFAULT', 'Admin Cabang', 'Template sistem Admin Cabang.', 'ADMIN_CABANG', true, CURRENT_TIMESTAMP),
  ('rt_admin_layanan', 'ADMIN_LAYANAN_DEFAULT', 'Admin Layanan', 'Template sistem Admin Layanan.', 'ADMIN_LAYANAN', true, CURRENT_TIMESTAMP),
  ('rt_admin_logistik', 'ADMIN_LOGISTIK_DEFAULT', 'Admin Logistik', 'Template sistem Admin Logistik.', 'ADMIN_LOGISTIK', true, CURRENT_TIMESTAMP),
  ('rt_doctor', 'DOCTOR_DEFAULT', 'Dokter', 'Template sistem Dokter.', 'DOCTOR', true, CURRENT_TIMESTAMP),
  ('rt_nurse', 'NURSE_DEFAULT', 'Perawat', 'Template sistem Perawat.', 'NURSE', true, CURRENT_TIMESTAMP),
  ('rt_member', 'MEMBER_DEFAULT', 'Member', 'Template sistem Member.', 'MEMBER', true, CURRENT_TIMESTAMP);

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_super_' || p."id", 'rt_super_admin', p."id" FROM "permissions" p;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_manager_' || p."id", 'rt_admin_manager', p."id" FROM "permissions" p
WHERE p."code" IN ('IAM.USER.READ','IAM.USER.CREATE','IAM.USER.UPDATE','IAM.USER.DEACTIVATE','IAM.USER.RESET_PASSWORD','IAM.BRANCH_SCOPE.READ','BRANCH.READ','BRANCH.CREATE','BRANCH.UPDATE','AUDIT.READ','AUDIT.EXPORT','INVOICE.READ','INVOICE.CREATE','INVOICE.UPDATE','INVOICE.FINALIZE','INVOICE.PAYMENT','INVOICE.CANCEL','INVOICE.PROOF.READ');

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_cabang_' || p."id", 'rt_admin_cabang', p."id" FROM "permissions" p
WHERE p."code" IN ('IAM.USER.READ','IAM.USER.CREATE','IAM.USER.UPDATE','IAM.USER.DEACTIVATE','IAM.BRANCH_SCOPE.READ','BRANCH.READ','INVOICE.READ','INVOICE.CREATE','INVOICE.UPDATE','INVOICE.FINALIZE','INVOICE.PAYMENT','INVOICE.CANCEL','INVOICE.PROOF.READ');

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_layanan_' || p."id", 'rt_admin_layanan', p."id" FROM "permissions" p
WHERE p."code" IN ('BRANCH.READ','INVOICE.READ','INVOICE.CREATE','INVOICE.UPDATE','INVOICE.FINALIZE','INVOICE.PAYMENT','INVOICE.CANCEL','INVOICE.PROOF.READ');

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_logistik_' || p."id", 'rt_admin_logistik', p."id" FROM "permissions" p WHERE p."code" = 'BRANCH.READ';

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_doctor_' || p."id", 'rt_doctor', p."id" FROM "permissions" p WHERE p."code" = 'BRANCH.READ';

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_nurse_' || p."id", 'rt_nurse', p."id" FROM "permissions" p WHERE p."code" = 'BRANCH.READ';

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_member_' || p."id", 'rt_member', p."id" FROM "permissions" p WHERE p."code" IN ('INVOICE.READ','INVOICE.PROOF.READ');
