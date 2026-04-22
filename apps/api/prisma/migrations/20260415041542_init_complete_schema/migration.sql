-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE', 'MEMBER');

-- CreateEnum
CREATE TYPE "BranchType" AS ENUM ('KLINIK', 'HOMECARE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('L', 'P');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PERSETUJUAN_SETELAH_PENJELASAN', 'FOTO_PROFIL');

-- CreateEnum
CREATE TYPE "ReferrerType" AS ENUM ('DOKTER', 'MEMBER', 'MEDIA', 'LAINNYA');

-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('BASIC', 'BOOSTER');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BoosterType" AS ENUM ('HHO', 'NO2');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('ON_SITE', 'HOME_CARE');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('ONGOING', 'CLOSED');

-- CreateEnum
CREATE TYPE "VitalType" AS ENUM ('SISTOL', 'DIASTOL', 'HR', 'SATURASI', 'PI');

-- CreateEnum
CREATE TYPE "VitalTiming" AS ENUM ('SEBELUM', 'SESUDAH');

-- CreateEnum
CREATE TYPE "BottleType" AS ENUM ('IFA', 'EDTA');

-- CreateEnum
CREATE TYPE "EMRNoteType" AS ENUM ('CLINICAL_NOTE', 'OPERATIONAL_NOTE', 'ASSESSMENT', 'OUTCOME_MONITORING');

-- CreateEnum
CREATE TYPE "DiagnosisCategory" AS ENUM ('HIPERTENSI', 'NEUROLOGI', 'DIABETES', 'KARDIOVASKULAR', 'ORTOPEDI', 'IMUNOLOGI', 'HEMATOLOGI', 'LAINNYA');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('MEDICINE', 'DEVICE', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "StockMutationType" AS ENUM ('USED', 'RECEIVED', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PREPARING', 'SHIPPED', 'RECEIVED', 'APPROVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INVOICE', 'REMINDER', 'INFO');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VERIFY');

-- CreateEnum
CREATE TYPE "AddOnType" AS ENUM ('AIR_NANO', 'KONSULTASI_GIZI', 'KONSULTASI_PSIKOLOG', 'LAINNYA');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('AIR_NANO', 'ROKOK_KENKOU');

-- CreateEnum
CREATE TYPE "AirNanoColor" AS ENUM ('KUNING', 'BIRU', 'HIJAU');

-- CreateEnum
CREATE TYPE "AirNanoVolume" AS ENUM ('ML_600', 'ML_1500');

-- CreateEnum
CREATE TYPE "AirNanoUnit" AS ENUM ('BOTOL', 'DUS');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'QRIS', 'OTHER');

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "type" "BranchType" NOT NULL DEFAULT 'KLINIK',
    "operatingHours" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "staffCode" TEXT,
    "branchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberNo" TEXT NOT NULL,
    "registrationBranchId" TEXT NOT NULL,
    "referralCodeId" TEXT,
    "voucherCount" INTEGER NOT NULL DEFAULT 0,
    "isConsentToPhoto" BOOLEAN NOT NULL DEFAULT true,
    "nik" TEXT,
    "tempatLahir" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "jenisKelamin" "Gender",
    "address" TEXT,
    "pekerjaan" TEXT,
    "statusNikah" TEXT,
    "emergencyContact" TEXT,
    "sumberInfoRaho" TEXT,
    "postalCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_documents" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_member_access" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_member_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "referrerName" TEXT NOT NULL,
    "referrerType" "ReferrerType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_pricings" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "packageType" "PackageType" NOT NULL,
    "name" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_pricings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_packages" (
    "id" TEXT NOT NULL,
    "packageCode" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "packagePricingId" TEXT,
    "packageType" "PackageType" NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "usedSessions" INTEGER NOT NULL DEFAULT 0,
    "finalPrice" DECIMAL(12,2) NOT NULL,
    "discountPercent" DECIMAL(5,2),
    "discountAmount" DECIMAL(12,2),
    "discountNote" TEXT,
    "notes" TEXT,
    "status" "PackageStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "boosterType" "BoosterType",
    "purchaseGroupId" TEXT,
    "upgradedFromId" TEXT,
    "assignedBy" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_add_ons" (
    "id" TEXT NOT NULL,
    "addOnCode" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "packageId" TEXT,
    "addOnType" "AddOnType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pricePerUnit" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "status" "PackageStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "notes" TEXT,
    "assignedBy" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "non_therapy_products" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "airNanoColor" "AirNanoColor",
    "airNanoVolume" "AirNanoVolume",
    "airNanoUnit" "AirNanoUnit",
    "pricePerUnit" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "non_therapy_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_non_therapy_purchases" (
    "id" TEXT NOT NULL,
    "purchaseCode" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pricePerUnit" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "status" "PackageStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "notes" TEXT,
    "assignedBy" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_non_therapy_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountPercent" DECIMAL(5,2),
    "discountAmount" DECIMAL(12,2),
    "discountNote" TEXT,
    "taxPercent" DECIMAL(5,2) DEFAULT 0,
    "taxAmount" DECIMAL(12,2) DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "paymentMethod" "PaymentMethod",
    "paymentReference" TEXT,
    "paymentNotes" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pricePerUnit" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentReference" TEXT,
    "notes" TEXT,
    "receivedBy" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" TEXT NOT NULL,
    "encounterCode" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "memberPackageId" TEXT NOT NULL,
    "adminLayananId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "status" "EncounterStatus" NOT NULL DEFAULT 'ONGOING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_sessions" (
    "id" TEXT NOT NULL,
    "sessionCode" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "infusKe" INTEGER NOT NULL,
    "pelaksanaan" "SessionType" NOT NULL,
    "treatmentDate" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "adminLayananId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "boosterPackageId" TEXT,
    "boosterType" "BoosterType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" TEXT NOT NULL,
    "diagnosisCode" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "encounterId" TEXT,
    "doktorPemeriksa" TEXT NOT NULL,
    "diagnosa" TEXT NOT NULL,
    "kategoriDiagnosa" "DiagnosisCategory",
    "icdPrimer" TEXT,
    "icdSekunder" TEXT,
    "icdTersier" TEXT,
    "keluhanRiwayatSekarang" TEXT,
    "riwayatPenyakitTerdahulu" TEXT,
    "riwayatSosialKebiasaan" TEXT,
    "riwayatPengobatan" TEXT,
    "pemeriksaanFisik" TEXT,
    "pemeriksaanTambahan" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapy_plans" (
    "id" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "memberId" TEXT,
    "treatmentSessionId" TEXT,
    "keterangan" TEXT,
    "ifa" DECIMAL(10,2),
    "hho" DECIMAL(10,2),
    "h2" DECIMAL(10,2),
    "no" DECIMAL(10,2),
    "gaso" DECIMAL(10,2),
    "o2" DECIMAL(10,2),
    "o3" DECIMAL(10,2),
    "edta" DECIMAL(10,2),
    "mb" DECIMAL(10,2),
    "h2s" DECIMAL(10,2),
    "kcl" DECIMAL(10,2),
    "jmlNb" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapy_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vital_signs" (
    "id" TEXT NOT NULL,
    "treatmentSessionId" TEXT NOT NULL,
    "pencatatan" "VitalType" NOT NULL,
    "waktuCatat" "VitalTiming" NOT NULL,
    "value" DECIMAL(8,2) NOT NULL,
    "unit" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "infusion_executions" (
    "id" TEXT NOT NULL,
    "treatmentSessionId" TEXT NOT NULL,
    "ifa" DECIMAL(10,2),
    "hho" DECIMAL(10,2),
    "h2" DECIMAL(10,2),
    "no" DECIMAL(10,2),
    "gaso" DECIMAL(10,2),
    "o2" DECIMAL(10,2),
    "o3" DECIMAL(10,2),
    "edta" DECIMAL(10,2),
    "mb" DECIMAL(10,2),
    "h2s" DECIMAL(10,2),
    "kcl" DECIMAL(10,2),
    "jmlNb" DECIMAL(10,2),
    "deviationNotes" TEXT,
    "bottleType" "BottleType",
    "jenisCairan" TEXT,
    "volumeCarrier" DECIMAL(8,2),
    "jumlahJarum" INTEGER,
    "tanggalProduksi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "infusion_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_usages" (
    "id" TEXT NOT NULL,
    "treatmentSessionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_photos" (
    "id" TEXT NOT NULL,
    "treatmentSessionId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emr_notes" (
    "id" TEXT NOT NULL,
    "treatmentSessionId" TEXT NOT NULL,
    "noteType" "EMRNoteType" NOT NULL,
    "content" TEXT NOT NULL,
    "writtenBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emr_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_evaluations" (
    "id" TEXT NOT NULL,
    "evaluationCode" TEXT NOT NULL,
    "treatmentSessionId" TEXT NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "generalNotes" TEXT,
    "writtenBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_evaluation_histories" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_evaluation_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stock" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "minThreshold" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "storageLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_mutations" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "type" "StockMutationType" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "stockBefore" DECIMAL(10,2) NOT NULL,
    "stockAfter" DECIMAL(10,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_mutations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "StockRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_request_items" (
    "id" TEXT NOT NULL,
    "stockRequestId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "requestedQty" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "stock_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "shipmentCode" TEXT NOT NULL,
    "stockRequestId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PREPARING',
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "sentQty" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deepLink" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "staffId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "chatRoomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "meta" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_branchCode_key" ON "branches"("branchCode");

-- CreateIndex
CREATE INDEX "branches_branchCode_idx" ON "branches"("branchCode");

-- CreateIndex
CREATE INDEX "branches_isActive_idx" ON "branches"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_staffCode_key" ON "users"("staffCode");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_branchId_role_isActive_idx" ON "users"("branchId", "role", "isActive");

-- CreateIndex
CREATE INDEX "users_staffCode_idx" ON "users"("staffCode");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_profiles_fullName_idx" ON "user_profiles"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "members_userId_key" ON "members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "members_memberNo_key" ON "members"("memberNo");

-- CreateIndex
CREATE UNIQUE INDEX "members_nik_key" ON "members"("nik");

-- CreateIndex
CREATE INDEX "members_memberNo_idx" ON "members"("memberNo");

-- CreateIndex
CREATE INDEX "members_registrationBranchId_isActive_idx" ON "members"("registrationBranchId", "isActive");

-- CreateIndex
CREATE INDEX "members_referralCodeId_idx" ON "members"("referralCodeId");

-- CreateIndex
CREATE INDEX "members_nik_idx" ON "members"("nik");

-- CreateIndex
CREATE INDEX "members_voucherCount_idx" ON "members"("voucherCount");

-- CreateIndex
CREATE INDEX "member_documents_memberId_documentType_idx" ON "member_documents"("memberId", "documentType");

-- CreateIndex
CREATE INDEX "branch_member_access_branchId_idx" ON "branch_member_access"("branchId");

-- CreateIndex
CREATE INDEX "branch_member_access_memberId_idx" ON "branch_member_access"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_member_access_memberId_branchId_key" ON "branch_member_access"("memberId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- CreateIndex
CREATE INDEX "referral_codes_code_idx" ON "referral_codes"("code");

-- CreateIndex
CREATE INDEX "referral_codes_isActive_idx" ON "referral_codes"("isActive");

-- CreateIndex
CREATE INDEX "referral_codes_referrerType_idx" ON "referral_codes"("referrerType");

-- CreateIndex
CREATE INDEX "package_pricings_branchId_isActive_idx" ON "package_pricings"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "package_pricings_packageType_idx" ON "package_pricings"("packageType");

-- CreateIndex
CREATE UNIQUE INDEX "package_pricings_branchId_packageType_totalSessions_key" ON "package_pricings"("branchId", "packageType", "totalSessions");

-- CreateIndex
CREATE UNIQUE INDEX "member_packages_packageCode_key" ON "member_packages"("packageCode");

-- CreateIndex
CREATE INDEX "member_packages_memberId_status_idx" ON "member_packages"("memberId", "status");

-- CreateIndex
CREATE INDEX "member_packages_branchId_status_idx" ON "member_packages"("branchId", "status");

-- CreateIndex
CREATE INDEX "member_packages_packageCode_idx" ON "member_packages"("packageCode");

-- CreateIndex
CREATE INDEX "member_packages_memberId_packageType_status_idx" ON "member_packages"("memberId", "packageType", "status");

-- CreateIndex
CREATE INDEX "member_packages_purchaseGroupId_idx" ON "member_packages"("purchaseGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "member_add_ons_addOnCode_key" ON "member_add_ons"("addOnCode");

-- CreateIndex
CREATE INDEX "member_add_ons_memberId_status_idx" ON "member_add_ons"("memberId", "status");

-- CreateIndex
CREATE INDEX "member_add_ons_branchId_status_idx" ON "member_add_ons"("branchId", "status");

-- CreateIndex
CREATE INDEX "member_add_ons_addOnCode_idx" ON "member_add_ons"("addOnCode");

-- CreateIndex
CREATE UNIQUE INDEX "non_therapy_products_productCode_key" ON "non_therapy_products"("productCode");

-- CreateIndex
CREATE INDEX "non_therapy_products_productType_isActive_idx" ON "non_therapy_products"("productType", "isActive");

-- CreateIndex
CREATE INDEX "non_therapy_products_productCode_idx" ON "non_therapy_products"("productCode");

-- CreateIndex
CREATE UNIQUE INDEX "member_non_therapy_purchases_purchaseCode_key" ON "member_non_therapy_purchases"("purchaseCode");

-- CreateIndex
CREATE INDEX "member_non_therapy_purchases_memberId_status_idx" ON "member_non_therapy_purchases"("memberId", "status");

-- CreateIndex
CREATE INDEX "member_non_therapy_purchases_branchId_status_idx" ON "member_non_therapy_purchases"("branchId", "status");

-- CreateIndex
CREATE INDEX "member_non_therapy_purchases_purchaseCode_idx" ON "member_non_therapy_purchases"("purchaseCode");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_memberId_status_idx" ON "invoices"("memberId", "status");

-- CreateIndex
CREATE INDEX "invoices_branchId_status_idx" ON "invoices"("branchId", "status");

-- CreateIndex
CREATE INDEX "invoices_invoiceNumber_idx" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_status_dueDate_idx" ON "invoices"("status", "dueDate");

-- CreateIndex
CREATE INDEX "invoices_createdAt_idx" ON "invoices"("createdAt");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_items_itemType_itemId_idx" ON "invoice_items"("itemType", "itemId");

-- CreateIndex
CREATE INDEX "invoice_payments_invoiceId_idx" ON "invoice_payments"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_payments_receivedAt_idx" ON "invoice_payments"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "encounters_encounterCode_key" ON "encounters"("encounterCode");

-- CreateIndex
CREATE INDEX "encounters_memberId_status_idx" ON "encounters"("memberId", "status");

-- CreateIndex
CREATE INDEX "encounters_branchId_status_idx" ON "encounters"("branchId", "status");

-- CreateIndex
CREATE INDEX "encounters_memberPackageId_idx" ON "encounters"("memberPackageId");

-- CreateIndex
CREATE INDEX "encounters_doctorId_idx" ON "encounters"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_sessions_sessionCode_key" ON "treatment_sessions"("sessionCode");

-- CreateIndex
CREATE INDEX "treatment_sessions_encounterId_idx" ON "treatment_sessions"("encounterId");

-- CreateIndex
CREATE INDEX "treatment_sessions_branchId_treatmentDate_idx" ON "treatment_sessions"("branchId", "treatmentDate");

-- CreateIndex
CREATE INDEX "treatment_sessions_doctorId_treatmentDate_idx" ON "treatment_sessions"("doctorId", "treatmentDate");

-- CreateIndex
CREATE INDEX "treatment_sessions_isCompleted_idx" ON "treatment_sessions"("isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "diagnoses_diagnosisCode_key" ON "diagnoses"("diagnosisCode");

-- CreateIndex
CREATE UNIQUE INDEX "diagnoses_encounterId_key" ON "diagnoses"("encounterId");

-- CreateIndex
CREATE INDEX "diagnoses_memberId_idx" ON "diagnoses"("memberId");

-- CreateIndex
CREATE INDEX "diagnoses_doktorPemeriksa_idx" ON "diagnoses"("doktorPemeriksa");

-- CreateIndex
CREATE INDEX "diagnoses_kategoriDiagnosa_idx" ON "diagnoses"("kategoriDiagnosa");

-- CreateIndex
CREATE UNIQUE INDEX "therapy_plans_planCode_key" ON "therapy_plans"("planCode");

-- CreateIndex
CREATE UNIQUE INDEX "therapy_plans_treatmentSessionId_key" ON "therapy_plans"("treatmentSessionId");

-- CreateIndex
CREATE INDEX "therapy_plans_memberId_idx" ON "therapy_plans"("memberId");

-- CreateIndex
CREATE INDEX "vital_signs_treatmentSessionId_idx" ON "vital_signs"("treatmentSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "vital_signs_treatmentSessionId_pencatatan_waktuCatat_key" ON "vital_signs"("treatmentSessionId", "pencatatan", "waktuCatat");

-- CreateIndex
CREATE UNIQUE INDEX "infusion_executions_treatmentSessionId_key" ON "infusion_executions"("treatmentSessionId");

-- CreateIndex
CREATE INDEX "material_usages_treatmentSessionId_idx" ON "material_usages"("treatmentSessionId");

-- CreateIndex
CREATE INDEX "material_usages_inventoryItemId_idx" ON "material_usages"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "session_photos_treatmentSessionId_key" ON "session_photos"("treatmentSessionId");

-- CreateIndex
CREATE INDEX "emr_notes_treatmentSessionId_noteType_idx" ON "emr_notes"("treatmentSessionId", "noteType");

-- CreateIndex
CREATE INDEX "emr_notes_treatmentSessionId_idx" ON "emr_notes"("treatmentSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_evaluations_evaluationCode_key" ON "doctor_evaluations"("evaluationCode");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_evaluations_treatmentSessionId_key" ON "doctor_evaluations"("treatmentSessionId");

-- CreateIndex
CREATE INDEX "doctor_evaluation_histories_evaluationId_idx" ON "doctor_evaluation_histories"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "master_products_name_key" ON "master_products"("name");

-- CreateIndex
CREATE INDEX "master_products_category_isActive_idx" ON "master_products"("category", "isActive");

-- CreateIndex
CREATE INDEX "master_products_isActive_idx" ON "master_products"("isActive");

-- CreateIndex
CREATE INDEX "inventory_items_branchId_stock_idx" ON "inventory_items"("branchId", "stock");

-- CreateIndex
CREATE INDEX "inventory_items_branchId_idx" ON "inventory_items"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_masterProductId_branchId_key" ON "inventory_items"("masterProductId", "branchId");

-- CreateIndex
CREATE INDEX "stock_mutations_inventoryItemId_createdAt_idx" ON "stock_mutations"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_mutations_referenceType_referenceId_idx" ON "stock_mutations"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "stock_mutations_type_idx" ON "stock_mutations"("type");

-- CreateIndex
CREATE INDEX "stock_mutations_createdAt_idx" ON "stock_mutations"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stock_requests_requestCode_key" ON "stock_requests"("requestCode");

-- CreateIndex
CREATE INDEX "stock_requests_branchId_status_idx" ON "stock_requests"("branchId", "status");

-- CreateIndex
CREATE INDEX "stock_requests_status_idx" ON "stock_requests"("status");

-- CreateIndex
CREATE INDEX "stock_request_items_stockRequestId_idx" ON "stock_request_items"("stockRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_shipmentCode_key" ON "shipments"("shipmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_stockRequestId_key" ON "shipments"("stockRequestId");

-- CreateIndex
CREATE INDEX "shipments_toBranchId_status_idx" ON "shipments"("toBranchId", "status");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipment_items_shipmentId_idx" ON "shipment_items"("shipmentId");

-- CreateIndex
CREATE INDEX "notifications_userId_status_idx" ON "notifications"("userId", "status");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_memberId_key" ON "chat_rooms"("memberId");

-- CreateIndex
CREATE INDEX "chat_rooms_isActive_idx" ON "chat_rooms"("isActive");

-- CreateIndex
CREATE INDEX "chat_messages_chatRoomId_createdAt_idx" ON "chat_messages"("chatRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "audit_logs"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_registrationBranchId_fkey" FOREIGN KEY ("registrationBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "referral_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_member_access" ADD CONSTRAINT "branch_member_access_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_member_access" ADD CONSTRAINT "branch_member_access_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_pricings" ADD CONSTRAINT "package_pricings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_packagePricingId_fkey" FOREIGN KEY ("packagePricingId") REFERENCES "package_pricings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_upgradedFromId_fkey" FOREIGN KEY ("upgradedFromId") REFERENCES "member_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_add_ons" ADD CONSTRAINT "member_add_ons_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_add_ons" ADD CONSTRAINT "member_add_ons_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_add_ons" ADD CONSTRAINT "member_add_ons_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "member_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_add_ons" ADD CONSTRAINT "member_add_ons_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_add_ons" ADD CONSTRAINT "member_add_ons_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_non_therapy_purchases" ADD CONSTRAINT "member_non_therapy_purchases_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_non_therapy_purchases" ADD CONSTRAINT "member_non_therapy_purchases_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_non_therapy_purchases" ADD CONSTRAINT "member_non_therapy_purchases_productId_fkey" FOREIGN KEY ("productId") REFERENCES "non_therapy_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_non_therapy_purchases" ADD CONSTRAINT "member_non_therapy_purchases_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_non_therapy_purchases" ADD CONSTRAINT "member_non_therapy_purchases_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_adminLayananId_fkey" FOREIGN KEY ("adminLayananId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_boosterPackageId_fkey" FOREIGN KEY ("boosterPackageId") REFERENCES "member_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_plans" ADD CONSTRAINT "therapy_plans_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_plans" ADD CONSTRAINT "therapy_plans_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "infusion_executions" ADD CONSTRAINT "infusion_executions_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usages" ADD CONSTRAINT "material_usages_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usages" ADD CONSTRAINT "material_usages_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_photos" ADD CONSTRAINT "session_photos_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emr_notes" ADD CONSTRAINT "emr_notes_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_evaluations" ADD CONSTRAINT "doctor_evaluations_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_evaluation_histories" ADD CONSTRAINT "doctor_evaluation_histories_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "doctor_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_mutations" ADD CONSTRAINT "stock_mutations_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_request_items" ADD CONSTRAINT "stock_request_items_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "stock_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_request_items" ADD CONSTRAINT "stock_request_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "stock_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "chat_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
