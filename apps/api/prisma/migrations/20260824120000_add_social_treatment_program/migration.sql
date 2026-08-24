-- Additive rollout for Program Sosial. This migration intentionally does not
-- update historical packages, invoices, payments, or revenue records.

CREATE TYPE "SocialProgramStatus" AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED',
  'ACTIVE',
  'REJECTED',
  'ACTIVATION_FAILED',
  'CANCELLED'
);

CREATE TABLE "social_program_requests" (
  "id" TEXT NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "basicSessions" INTEGER NOT NULL,
  "basicListUnitPrice" DECIMAL(12,2) NOT NULL DEFAULT 2000000,
  "basicSocialUnitPrice" DECIMAL(12,2) NOT NULL DEFAULT 500000,
  "freeBooster" BOOLEAN NOT NULL DEFAULT false,
  "boosterType" TEXT,
  "freeBoosterSessions" INTEGER NOT NULL DEFAULT 0,
  "boosterListUnitPrice" DECIMAL(12,2) NOT NULL DEFAULT 1000000,
  "reason" TEXT NOT NULL,
  "status" "SocialProgramStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "approvalInstanceId" TEXT,
  "purchaseGroupId" TEXT,
  "activationError" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_program_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "member_packages" ADD COLUMN "socialProgramRequestId" TEXT;

CREATE UNIQUE INDEX "social_program_requests_requestNumber_key" ON "social_program_requests"("requestNumber");
CREATE UNIQUE INDEX "social_program_requests_approvalInstanceId_key" ON "social_program_requests"("approvalInstanceId");
CREATE INDEX "social_program_requests_memberId_status_createdAt_idx" ON "social_program_requests"("memberId", "status", "createdAt");
CREATE INDEX "social_program_requests_branchId_status_submittedAt_idx" ON "social_program_requests"("branchId", "status", "submittedAt");
CREATE INDEX "member_packages_socialProgramRequestId_idx" ON "member_packages"("socialProgramRequestId");

ALTER TABLE "social_program_requests" ADD CONSTRAINT "social_program_requests_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "social_program_requests" ADD CONSTRAINT "social_program_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "social_program_requests" ADD CONSTRAINT "social_program_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "social_program_requests" ADD CONSTRAINT "social_program_requests_approvalInstanceId_fkey" FOREIGN KEY ("approvalInstanceId") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_socialProgramRequestId_fkey" FOREIGN KEY ("socialProgramRequestId") REFERENCES "social_program_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_social_program_read', 'SOCIAL_PROGRAM.READ', 'Lihat Program Sosial', 'SOCIAL_PROGRAM', 'Melihat pengajuan dan paket Program Sosial sesuai branch scope.', false, CURRENT_TIMESTAMP),
  ('perm_social_program_create', 'SOCIAL_PROGRAM.CREATE', 'Ajukan Program Sosial', 'SOCIAL_PROGRAM', 'Mengajukan paket terapi Program Sosial.', true, CURRENT_TIMESTAMP),
  ('perm_social_program_manager_approve', 'SOCIAL_PROGRAM.MANAGER_APPROVE', 'Setujui Kelayakan Program Sosial', 'SOCIAL_PROGRAM', 'Menyetujui kelayakan dan kuota Program Sosial.', true, CURRENT_TIMESTAMP),
  ('perm_social_program_finance_approve', 'SOCIAL_PROGRAM.FINANCE_APPROVE', 'Setujui Subsidi Program Sosial', 'SOCIAL_PROGRAM', 'Menyetujui dampak diskon dan subsidi Program Sosial.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_social_super_' || p."id", rt."id", p."id"
FROM "role_templates" rt CROSS JOIN "permissions" p
WHERE rt."code" = 'SUPER_ADMIN_DEFAULT' AND p."module" = 'SOCIAL_PROGRAM'
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_social_manager_' || p."id", rt."id", p."id"
FROM "role_templates" rt CROSS JOIN "permissions" p
WHERE rt."code" = 'ADMIN_MANAGER_DEFAULT'
  AND p."code" IN ('SOCIAL_PROGRAM.READ', 'SOCIAL_PROGRAM.MANAGER_APPROVE', 'WORKFLOW.APPROVAL.READ')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_social_creator_' || rt."id" || '_' || p."id", rt."id", p."id"
FROM "role_templates" rt CROSS JOIN "permissions" p
WHERE rt."code" IN ('ADMIN_CABANG_DEFAULT', 'ADMIN_LAYANAN_DEFAULT')
  AND p."code" IN ('SOCIAL_PROGRAM.READ', 'SOCIAL_PROGRAM.CREATE')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_social_finance_' || p."id", rt."id", p."id"
FROM "role_templates" rt CROSS JOIN "permissions" p
WHERE rt."code" = 'FINANCE_LOGISTICS_CONTROLLER_DEFAULT'
  AND p."code" IN ('SOCIAL_PROGRAM.READ', 'SOCIAL_PROGRAM.FINANCE_APPROVE', 'WORKFLOW.APPROVAL.READ')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "approval_rules" (
  "id", "ruleCode", "name", "module", "transactionType", "branchScopeKey",
  "categoryKey", "minAmount", "maxAmount", "priority", "createdBy", "updatedAt"
) VALUES (
  'apr_social_program_standard', 'SOCIAL_PROGRAM_STANDARD', 'Program Sosial',
  'SOCIAL_PROGRAM', 'SOCIAL_TREATMENT', 'GLOBAL', '*', 0, NULL, 50, 'SYSTEM', CURRENT_TIMESTAMP
)
ON CONFLICT ("ruleCode") DO NOTHING;

INSERT INTO "approval_rule_steps" ("id", "approvalRuleId", "stepNo", "name", "permissionCode", "requiredApprovals") VALUES
  ('aps_social_program_1', 'apr_social_program_standard', 1, 'Persetujuan Admin Manager', 'SOCIAL_PROGRAM.MANAGER_APPROVE', 1),
  ('aps_social_program_2', 'apr_social_program_standard', 2, 'Persetujuan Finance', 'SOCIAL_PROGRAM.FINANCE_APPROVE', 1)
ON CONFLICT ("approvalRuleId", "stepNo") DO NOTHING;

-- Exact business code requested by RAHO. Existing rows are never updated.
INSERT INTO "package_pricings" (
  "id", "branchId", "packageType", "boosterType", "serviceType", "productCode",
  "name", "totalSessions", "price", "isActive", "createdAt", "updatedAt"
)
SELECT
  'pkg_social_' || md5(b."id"), b."id", 'BASIC'::"PackageType", NULL, 'PS',
  'SRV-TNB-TRP-PS-001', 'Terapi Nano Bubble 1X (Program Sosial)', 1,
  500000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "branches" b
WHERE NOT EXISTS (
  SELECT 1 FROM "package_pricings" pp
  WHERE pp."branchId" = b."id" AND pp."productCode" = 'SRV-TNB-TRP-PS-001'
);
