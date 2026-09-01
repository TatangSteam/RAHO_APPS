ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VOUCHER_OPERATOR';

CREATE TYPE "VoucherCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED');
CREATE TYPE "VoucherLocationPolicy" AS ENUM ('ALL_ACTIVE', 'SPECIFIC');
CREATE TYPE "VoucherCodeMode" AS ENUM ('AUTO', 'MANUAL');
CREATE TYPE "CampaignVoucherStatus" AS ENUM ('AVAILABLE', 'ISSUED', 'CLAIMED', 'EXHAUSTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "VoucherClaimAttemptResult" AS ENUM ('SUCCESS', 'FAILURE');

CREATE TABLE "voucher_campaigns" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quota" INTEGER NOT NULL,
    "issuedCount" INTEGER NOT NULL DEFAULT 0,
    "claimedCount" INTEGER NOT NULL DEFAULT 0,
    "basicSessions" INTEGER NOT NULL DEFAULT 0,
    "boosterSessions" INTEGER NOT NULL DEFAULT 0,
    "boosterType" TEXT,
    "unitPrice" DECIMAL(15,2),
    "totalPrice" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "issueStartAt" TIMESTAMP(3),
    "issueEndAt" TIMESTAMP(3),
    "claimStartAt" TIMESTAMP(3),
    "claimEndAt" TIMESTAMP(3),
    "benefitValidityDays" INTEGER,
    "termsSnapshot" TEXT,
    "locationPolicy" "VoucherLocationPolicy" NOT NULL DEFAULT 'ALL_ACTIVE',
    "codeMode" "VoucherCodeMode" NOT NULL DEFAULT 'AUTO',
    "status" "VoucherCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "voucher_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "voucher_claim_locations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "partnerName" TEXT,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "mapsUrl" TEXT,
    "frontPhotoUrl" TEXT,
    "branchId" TEXT,
    "sourceReference" TEXT,
    "dataCompletenessStatus" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "voucher_claim_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "voucher_operator_locations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    CONSTRAINT "voucher_operator_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campaign_vouchers" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeLast4" TEXT NOT NULL,
    "recipientMemberId" TEXT NOT NULL,
    "recipientNameSnapshot" TEXT NOT NULL,
    "nikLast4" TEXT NOT NULL,
    "allowedLocationId" TEXT,
    "status" "CampaignVoucherStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimDeadline" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "claimedAt" TIMESTAMP(3),
    "claimedLocationId" TEXT,
    "claimedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaign_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "voucher_claim_attempts" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT,
    "operatorId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "result" "VoucherClaimAttemptResult" NOT NULL,
    "failureCode" TEXT,
    "requestId" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voucher_claim_attempts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "member_packages" ADD COLUMN "campaignVoucherId" TEXT;

CREATE UNIQUE INDEX "voucher_campaigns_code_key" ON "voucher_campaigns"("code");
CREATE UNIQUE INDEX "voucher_campaigns_code_version_key" ON "voucher_campaigns"("code", "version");
CREATE INDEX "voucher_campaigns_status_idx" ON "voucher_campaigns"("status");
CREATE UNIQUE INDEX "voucher_claim_locations_code_key" ON "voucher_claim_locations"("code");
CREATE INDEX "voucher_claim_locations_city_isActive_idx" ON "voucher_claim_locations"("city", "isActive");
CREATE INDEX "voucher_claim_locations_branchId_idx" ON "voucher_claim_locations"("branchId");
CREATE UNIQUE INDEX "voucher_operator_locations_userId_locationId_key" ON "voucher_operator_locations"("userId", "locationId");
CREATE INDEX "voucher_operator_locations_locationId_idx" ON "voucher_operator_locations"("locationId");
CREATE UNIQUE INDEX "campaign_vouchers_codeHash_key" ON "campaign_vouchers"("codeHash");
CREATE UNIQUE INDEX "campaign_vouchers_campaignId_recipientMemberId_key" ON "campaign_vouchers"("campaignId", "recipientMemberId");
CREATE INDEX "campaign_vouchers_campaignId_status_idx" ON "campaign_vouchers"("campaignId", "status");
CREATE INDEX "campaign_vouchers_recipientMemberId_idx" ON "campaign_vouchers"("recipientMemberId");
CREATE INDEX "campaign_vouchers_allowedLocationId_idx" ON "campaign_vouchers"("allowedLocationId");
CREATE INDEX "campaign_vouchers_claimedLocationId_claimedAt_idx" ON "campaign_vouchers"("claimedLocationId", "claimedAt");
CREATE UNIQUE INDEX "voucher_claim_attempts_operatorId_requestId_key" ON "voucher_claim_attempts"("operatorId", "requestId");
CREATE INDEX "voucher_claim_attempts_operatorId_attemptedAt_idx" ON "voucher_claim_attempts"("operatorId", "attemptedAt");
CREATE INDEX "voucher_claim_attempts_voucherId_attemptedAt_idx" ON "voucher_claim_attempts"("voucherId", "attemptedAt");
CREATE INDEX "voucher_claim_attempts_locationId_attemptedAt_idx" ON "voucher_claim_attempts"("locationId", "attemptedAt");
CREATE INDEX "member_packages_campaignVoucherId_idx" ON "member_packages"("campaignVoucherId");

ALTER TABLE "voucher_claim_locations" ADD CONSTRAINT "voucher_claim_locations_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "voucher_operator_locations" ADD CONSTRAINT "voucher_operator_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voucher_operator_locations" ADD CONSTRAINT "voucher_operator_locations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "voucher_claim_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campaign_vouchers" ADD CONSTRAINT "campaign_vouchers_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "voucher_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campaign_vouchers" ADD CONSTRAINT "campaign_vouchers_recipientMemberId_fkey" FOREIGN KEY ("recipientMemberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campaign_vouchers" ADD CONSTRAINT "campaign_vouchers_allowedLocationId_fkey" FOREIGN KEY ("allowedLocationId") REFERENCES "voucher_claim_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campaign_vouchers" ADD CONSTRAINT "campaign_vouchers_claimedLocationId_fkey" FOREIGN KEY ("claimedLocationId") REFERENCES "voucher_claim_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voucher_claim_attempts" ADD CONSTRAINT "voucher_claim_attempts_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "campaign_vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "voucher_claim_attempts" ADD CONSTRAINT "voucher_claim_attempts_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "voucher_claim_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_campaignVoucherId_fkey" FOREIGN KEY ("campaignVoucherId") REFERENCES "campaign_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "voucher_campaigns" (
    "id", "code", "version", "title", "description", "quota", "basicSessions", "boosterSessions",
    "unitPrice", "totalPrice", "status", "locationPolicy", "codeMode", "createdBy", "updatedBy", "updatedAt"
) VALUES
('vcamp-social-15b-10bst-v1', 'SOCIAL-15B-10BST', 1, 'Voucher Program Sosial Raho Club – 15× Infus + 10× Booster', 'Voucher khusus Program Sosial Raho Club untuk 15× sesi Infus Nano Bubble HHO dan 10× Booster dengan harga spesial Rp22.500.000. Berlaku sesuai syarat dan ketentuan program.', 50, 15, 10, NULL, 22500000, 'ACTIVE', 'ALL_ACTIVE', 'AUTO', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('vcamp-gift-10b-v1', 'GIFT-10B', 1, 'Special Gift Voucher – 10× Nano Bubble HHO Basic', 'Voucher untuk 10× sesi terapi Nano Bubble HHO Basic tanpa Booster di Raho Club Premier. Berlaku sesuai syarat dan ketentuan voucher.', 100, 10, 0, NULL, 0, 'ACTIVE', 'ALL_ACTIVE', 'AUTO', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('vcamp-social-15b-v1', 'SOCIAL-15B', 1, 'Voucher Program Sosial Raho Club – 15× Nano Bubble HHO Basic', 'Voucher untuk 15× sesi terapi Nano Bubble HHO Basic tanpa Booster di Raho Club Premier dengan harga Rp500.000 per 1× Infus. Berlaku sesuai syarat dan ketentuan voucher.', 50, 15, 0, 500000, 7500000, 'ACTIVE', 'ALL_ACTIVE', 'AUTO', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP);

INSERT INTO "voucher_claim_locations" (
    "id", "code", "displayName", "partnerName", "city", "sourceReference", "createdBy", "updatedBy", "updatedAt"
) VALUES
('VCL-001', 'VCL-001', 'Raho Club Premier Jakarta', NULL, 'Jakarta', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-002', 'VCL-002', 'Raho Club Premier Menara Batavia', NULL, 'Jakarta', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-003', 'VCL-003', 'Raho Club Premier D''Botanica', NULL, 'Bandung', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-004', 'VCL-004', 'Klinik Griya Sehat HWA', 'Konstan (Makassar & Kendari)', 'Makassar', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-005', 'VCL-005', 'Griya Sehat HWA', NULL, 'Kendari', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-006', 'VCL-006', 'Klinik Utama O2', 'Rio (Klinik O2)', 'Jakarta', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-007', 'VCL-007', 'Attiya Reverse Aging', 'Klinik ATTIYA', 'Jakarta', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-008', 'VCL-008', 'Attiya Reverse Aging', NULL, 'Semarang', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-009', 'VCL-009', 'Raho Club Premier Bandung', 'Indra (Bandung)', 'Bandung', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-010', 'VCL-010', 'Klinik Kecantikan Edmee Clinic', 'Ministry', 'Jakarta', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-011', 'VCL-011', 'Timeless Aesthetic Clinic Medan', NULL, 'Medan', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-012', 'VCL-012', 'Klinik Kecantikan Ministry Treatment - Hair, Beauty & Wellness', NULL, 'Jakarta', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-013', 'VCL-013', 'Raho Club Premier Grand Orchard Kelapa Gading', 'Eddy Santoso (Seli)', 'Jakarta', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-014', 'VCL-014', 'Raho Club Premier Batam', 'Sendjaja Tjandra (Ciska)', 'Batam', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-015', 'VCL-015', 'Raho Club Premier Pekanbaru', 'Sunarto Kwok', 'Pekanbaru', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-016', 'VCL-016', 'Quantum Wellness Center', 'Bambang Santoso', 'Serpong', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-017', 'VCL-017', 'Glowing Anti Aging & Wellness', 'Magdalena Vandry', 'Jakarta', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-018', 'VCL-018', 'Raho Premier Bali (Apotek Hannah)', 'Janti (Bali)', 'Bali', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-019', 'VCL-019', 'Raho Club Premier Jambi', 'Mario Liberty (Inge)', 'Jambi', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP),
('VCL-020', 'VCL-020', 'Inti Sehat Medika (Ibu Lena)', NULL, 'Jambi', 'NEW PARTNERSHIP CSV 2026-09-01', 'SYSTEM', 'SYSTEM', CURRENT_TIMESTAMP);
