# Data Dictionary - RAHO ERP Management System

Last updated: 6 Juli 2026

Sumber utama: `apps/api/prisma/schema.prisma`. Field relation-only seperti `user User @relation(...)` dan list relation seperti `members Member[]` tidak dimasukkan sebagai kolom database.

| Entity | Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- | --- |
| Branch | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| Branch | branchCode | String | Yes | Unique | Field branch code pada entity Branch. |
| Branch | name | String | Yes | - | Nama data. |
| Branch | address | String? | No | - | Field address pada entity Branch. |
| Branch | city | String? | No | - | Field city pada entity Branch. |
| Branch | phone | String? | No | Phone format | Nomor telepon. |
| Branch | type | BranchType | Yes | Default: PREMIER; Allowed: PUSAT, PREMIER, PARTNERSHIP | Field type pada entity Branch. |
| Branch | operatingHours | String? | No | - | Field operating hours pada entity Branch. |
| Branch | isActive | Boolean | Yes | Default: true | Status aktif/nonaktif data. |
| Branch | createdBy | String? | No | - | User pembuat data. |
| Branch | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| Branch | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| User | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| User | email | String | Yes | Unique; Email format | Alamat email. |
| User | password | String | Yes | - | Password terenkripsi/hash. |
| User | role | Role | Yes | Allowed: SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG, ADMIN_LAYANAN, DOCTOR, NURSE, MEMBER | Field role pada entity User. |
| User | staffCode | String? | No | Unique | Field staff code pada entity User. |
| User | branchId | String? | No | - | Referensi cabang terkait. |
| User | isActive | Boolean | Yes | Default: true | Status aktif/nonaktif data. |
| User | lastLoginAt | DateTime? | No | - | Field last login at pada entity User. |
| User | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| User | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| UserProfile | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| UserProfile | userId | String | Yes | Unique | Referensi user terkait. |
| UserProfile | fullName | String | Yes | - | Field full name pada entity UserProfile. |
| UserProfile | phone | String? | No | Phone format | Nomor telepon. |
| UserProfile | avatarUrl | String? | No | URL/path file valid | Field avatar url pada entity UserProfile. |
| UserProfile | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| UserProfile | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| ManagerBranch | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| ManagerBranch | userId | String | Yes | - | Referensi user terkait. |
| ManagerBranch | branchId | String | Yes | - | Referensi cabang terkait. |
| ManagerBranch | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| ManagerBranch | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| StaffBranch | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| StaffBranch | userId | String | Yes | - | Referensi user terkait. |
| StaffBranch | branchId | String | Yes | - | Referensi cabang terkait. |
| StaffBranch | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| StaffBranch | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| Member | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| Member | userId | String | Yes | Unique | Referensi user terkait. |
| Member | memberNo | String | Yes | Unique | Field member no pada entity Member. |
| Member | registrationBranchId | String | Yes | - | Field registration branch id pada entity Member. |
| Member | referralCodeId | String? | No | - | Field referral code id pada entity Member. |
| Member | firstIncentiveType | IncentiveType? | No | Allowed: PERCENTAGE, FIXED_AMOUNT; Numeric non-negative sesuai konteks | Field first incentive type pada entity Member. |
| Member | firstIncentiveValue | Decimal? | No | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field first incentive value pada entity Member. |
| Member | nextIncentiveType | IncentiveType? | No | Allowed: PERCENTAGE, FIXED_AMOUNT; Numeric non-negative sesuai konteks | Field next incentive type pada entity Member. |
| Member | nextIncentiveValue | Decimal? | No | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field next incentive value pada entity Member. |
| Member | voucherCount | Int | Yes | Default: 0 | Field voucher count pada entity Member. |
| Member | isConsentToPhoto | Boolean | Yes | Default: true | Field is consent to photo pada entity Member. |
| Member | nik | String? | No | Unique | Field nik pada entity Member. |
| Member | tempatLahir | String? | No | - | Field tempat lahir pada entity Member. |
| Member | dateOfBirth | DateTime? | No | - | Field date of birth pada entity Member. |
| Member | jenisKelamin | Gender? | No | Allowed: L, P | Field jenis kelamin pada entity Member. |
| Member | agama | String? | No | - | Field agama pada entity Member. |
| Member | address | String? | No | - | Field address pada entity Member. |
| Member | pekerjaan | String? | No | - | Field pekerjaan pada entity Member. |
| Member | statusNikah | String? | No | - | Field status nikah pada entity Member. |
| Member | emergencyContact | String? | No | - | Field emergency contact pada entity Member. |
| Member | sumberInfoRaho | String? | No | - | Field sumber info raho pada entity Member. |
| Member | postalCode | String? | No | - | Field postal code pada entity Member. |
| Member | isDeceased | Boolean | Yes | Default: false | Field is deceased pada entity Member. |
| Member | isActive | Boolean | Yes | Default: true | Status aktif/nonaktif data. |
| Member | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| Member | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| MemberDocument | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| MemberDocument | memberId | String | Yes | - | Referensi member terkait. |
| MemberDocument | documentType | DocumentType | Yes | Allowed: PERSETUJUAN_SETELAH_PENJELASAN, FOTO_PROFIL | Field document type pada entity MemberDocument. |
| MemberDocument | fileUrl | String | Yes | URL/path file valid | Lokasi URL/path file. |
| MemberDocument | fileName | String | Yes | - | Nama file. |
| MemberDocument | fileSize | Int | Yes | >= 0 bytes | Ukuran file dalam bytes. |
| MemberDocument | mimeType | String | Yes | - | MIME type file. |
| MemberDocument | uploadedBy | String | Yes | - | User yang mengunggah file. |
| MemberDocument | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| BranchMemberAccess | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| BranchMemberAccess | memberId | String | Yes | - | Referensi member terkait. |
| BranchMemberAccess | branchId | String | Yes | - | Referensi cabang terkait. |
| BranchMemberAccess | grantedBy | String | Yes | - | Field granted by pada entity BranchMemberAccess. |
| BranchMemberAccess | notes | String? | No | - | Catatan tambahan. |
| BranchMemberAccess | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| ReferralCode | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| ReferralCode | code | String | Yes | Unique | Kode unik data. |
| ReferralCode | referrerName | String | Yes | - | Field referrer name pada entity ReferralCode. |
| ReferralCode | referrerType | ReferrerType | Yes | Allowed: SALES, DOKTER, MEMBER | Field referrer type pada entity ReferralCode. |
| ReferralCode | branchId | String | Yes | - | Referensi cabang terkait. |
| ReferralCode | phone | String? | No | Phone format | Nomor telepon. |
| ReferralCode | email | String? | No | Email format | Alamat email. |
| ReferralCode | totalReferrals | Int | Yes | Default: 0; Numeric non-negative sesuai konteks | Field total referrals pada entity ReferralCode. |
| ReferralCode | totalIncentiveEarned | Decimal | Yes | Default: 0; DB: Decimal(15, 2); Numeric non-negative sesuai konteks | Field total incentive earned pada entity ReferralCode. |
| ReferralCode | isActive | Boolean | Yes | Default: true | Status aktif/nonaktif data. |
| ReferralCode | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| ReferralCode | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| ReferralIncentiveRecord | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| ReferralIncentiveRecord | referralCodeId | String | Yes | - | Field referral code id pada entity ReferralIncentiveRecord. |
| ReferralIncentiveRecord | memberId | String | Yes | - | Referensi member terkait. |
| ReferralIncentiveRecord | memberPackageId | String | Yes | - | Field member package id pada entity ReferralIncentiveRecord. |
| ReferralIncentiveRecord | packageType | String | Yes | - | Field package type pada entity ReferralIncentiveRecord. |
| ReferralIncentiveRecord | packageName | String | Yes | - | Field package name pada entity ReferralIncentiveRecord. |
| ReferralIncentiveRecord | packageValue | Decimal | Yes | DB: Decimal(15, 2); Numeric non-negative sesuai konteks | Field package value pada entity ReferralIncentiveRecord. |
| ReferralIncentiveRecord | isFirstPackage | Boolean | Yes | - | Field is first package pada entity ReferralIncentiveRecord. |
| ReferralIncentiveRecord | incentiveType | IncentiveType | Yes | Allowed: PERCENTAGE, FIXED_AMOUNT; Numeric non-negative sesuai konteks | Field incentive type pada entity ReferralIncentiveRecord. |
| ReferralIncentiveRecord | incentiveValue | Decimal | Yes | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field incentive value pada entity ReferralIncentiveRecord. |
| ReferralIncentiveRecord | incentiveAmount | Decimal | Yes | DB: Decimal(15, 2); Numeric non-negative sesuai konteks | Field incentive amount pada entity ReferralIncentiveRecord. |
| ReferralIncentiveRecord | notes | String? | No | - | Catatan tambahan. |
| ReferralIncentiveRecord | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| MasterBoosterType | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| MasterBoosterType | code | String | Yes | Unique | Kode unik data. |
| MasterBoosterType | name | String | Yes | - | Nama data. |
| MasterBoosterType | icon | String? | No | - | Field icon pada entity MasterBoosterType. |
| MasterBoosterType | description | String? | No | - | Field description pada entity MasterBoosterType. |
| MasterBoosterType | isActive | Boolean | Yes | Default: true | Status aktif/nonaktif data. |
| MasterBoosterType | sortOrder | Int | Yes | Default: 0 | Field sort order pada entity MasterBoosterType. |
| MasterBoosterType | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| MasterBoosterType | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| MasterServiceType | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| MasterServiceType | code | String | Yes | Unique | Kode unik data. |
| MasterServiceType | name | String | Yes | - | Nama data. |
| MasterServiceType | description | String? | No | - | Field description pada entity MasterServiceType. |
| MasterServiceType | price | Decimal? | No | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field price pada entity MasterServiceType. |
| MasterServiceType | isActive | Boolean | Yes | Default: true | Status aktif/nonaktif data. |
| MasterServiceType | sortOrder | Int | Yes | Default: 0 | Field sort order pada entity MasterServiceType. |
| MasterServiceType | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| MasterServiceType | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| PackagePricing | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| PackagePricing | branchId | String? | No | - | Referensi cabang terkait. |
| PackagePricing | packageType | PackageType | Yes | Allowed: BASIC, BOOSTER | Field package type pada entity PackagePricing. |
| PackagePricing | boosterType | String? | No | - | Field booster type pada entity PackagePricing. |
| PackagePricing | serviceType | String? | No | - | Field service type pada entity PackagePricing. |
| PackagePricing | productCode | String? | No | - | Field product code pada entity PackagePricing. |
| PackagePricing | name | String | Yes | - | Nama data. |
| PackagePricing | totalSessions | Int | Yes | Numeric non-negative sesuai konteks | Field total sessions pada entity PackagePricing. |
| PackagePricing | price | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field price pada entity PackagePricing. |
| PackagePricing | isActive | Boolean | Yes | Default: true | Status aktif/nonaktif data. |
| PackagePricing | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| PackagePricing | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| MemberPackage | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| MemberPackage | packageCode | String | Yes | Unique | Field package code pada entity MemberPackage. |
| MemberPackage | memberId | String | Yes | - | Referensi member terkait. |
| MemberPackage | branchId | String | Yes | - | Referensi cabang terkait. |
| MemberPackage | packagePricingId | String? | No | - | Field package pricing id pada entity MemberPackage. |
| MemberPackage | packageType | PackageType | Yes | Allowed: BASIC, BOOSTER | Field package type pada entity MemberPackage. |
| MemberPackage | productCode | String? | No | - | Field product code pada entity MemberPackage. |
| MemberPackage | totalSessions | Int | Yes | Numeric non-negative sesuai konteks | Field total sessions pada entity MemberPackage. |
| MemberPackage | usedSessions | Int | Yes | Default: 0 | Field used sessions pada entity MemberPackage. |
| MemberPackage | finalPrice | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field final price pada entity MemberPackage. |
| MemberPackage | discountPercent | Decimal? | No | DB: Decimal(5, 2); Numeric non-negative sesuai konteks | Field discount percent pada entity MemberPackage. |
| MemberPackage | discountAmount | Decimal? | No | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field discount amount pada entity MemberPackage. |
| MemberPackage | discountNote | String? | No | Numeric non-negative sesuai konteks | Field discount note pada entity MemberPackage. |
| MemberPackage | notes | String? | No | - | Catatan tambahan. |
| MemberPackage | status | PackageStatus | Yes | Default: PENDING_PAYMENT; Allowed: PENDING_PAYMENT, WAITING_VERIFICATION, ACTIVE, EXPIRED, CANCELLED | Status proses/data. |
| MemberPackage | paymentPlanType | PaymentPlanType | Yes | Default: FULL_PAYMENT; Allowed: FULL_PAYMENT, INSTALLMENT | Field payment plan type pada entity MemberPackage. |
| MemberPackage | installmentTotal | Int? | No | Numeric non-negative sesuai konteks | Field installment total pada entity MemberPackage. |
| MemberPackage | installmentSchedule | Json? | No | - | Field installment schedule pada entity MemberPackage. |
| MemberPackage | totalVerifiedPaid | Decimal | Yes | Default: 0; DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field total verified paid pada entity MemberPackage. |
| MemberPackage | paymentPlanStatus | String? | No | - | Field payment plan status pada entity MemberPackage. |
| MemberPackage | boosterType | String? | No | - | Field booster type pada entity MemberPackage. |
| MemberPackage | serviceType | String? | No | - | Field service type pada entity MemberPackage. |
| MemberPackage | purchaseGroupId | String? | No | - | Field purchase group id pada entity MemberPackage. |
| MemberPackage | upgradedFromId | String? | No | - | Field upgraded from id pada entity MemberPackage. |
| MemberPackage | paymentProofUrl | String? | No | URL/path file valid | Field payment proof url pada entity MemberPackage. |
| MemberPackage | paymentProofFileName | String? | No | - | Field payment proof file name pada entity MemberPackage. |
| MemberPackage | paymentProofFileSize | Int? | No | >= 0 bytes | Field payment proof file size pada entity MemberPackage. |
| MemberPackage | paymentProofMimeType | String? | No | - | Field payment proof mime type pada entity MemberPackage. |
| MemberPackage | refundAmount | Decimal? | No | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field refund amount pada entity MemberPackage. |
| MemberPackage | refundReason | String? | No | - | Field refund reason pada entity MemberPackage. |
| MemberPackage | refundProofUrl | String? | No | URL/path file valid | Field refund proof url pada entity MemberPackage. |
| MemberPackage | refundProofFileName | String? | No | - | Field refund proof file name pada entity MemberPackage. |
| MemberPackage | refundProofFileSize | Int? | No | >= 0 bytes | Field refund proof file size pada entity MemberPackage. |
| MemberPackage | refundProofMimeType | String? | No | - | Field refund proof mime type pada entity MemberPackage. |
| MemberPackage | refundedBy | String? | No | - | Field refunded by pada entity MemberPackage. |
| MemberPackage | refundedAt | DateTime? | No | - | Field refunded at pada entity MemberPackage. |
| MemberPackage | assignedBy | String | Yes | - | Field assigned by pada entity MemberPackage. |
| MemberPackage | verifiedBy | String? | No | - | Field verified by pada entity MemberPackage. |
| MemberPackage | rejectedBy | String? | No | - | Field rejected by pada entity MemberPackage. |
| MemberPackage | paidAt | DateTime? | No | Numeric non-negative sesuai konteks | Field paid at pada entity MemberPackage. |
| MemberPackage | verifiedAt | DateTime? | No | - | Field verified at pada entity MemberPackage. |
| MemberPackage | rejectedAt | DateTime? | No | - | Field rejected at pada entity MemberPackage. |
| MemberPackage | rejectionReason | String? | No | - | Field rejection reason pada entity MemberPackage. |
| MemberPackage | activatedAt | DateTime? | No | - | Field activated at pada entity MemberPackage. |
| MemberPackage | expiredAt | DateTime? | No | - | Field expired at pada entity MemberPackage. |
| MemberPackage | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| MemberPackage | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| MemberAddOn | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| MemberAddOn | addOnCode | String | Yes | Unique | Field add on code pada entity MemberAddOn. |
| MemberAddOn | memberId | String | Yes | - | Referensi member terkait. |
| MemberAddOn | branchId | String | Yes | - | Referensi cabang terkait. |
| MemberAddOn | packageId | String? | No | - | Field package id pada entity MemberAddOn. |
| MemberAddOn | addOnType | AddOnType | Yes | Allowed: AIR_NANO, KONSULTASI_GIZI, KONSULTASI_PSIKOLOG, ROKOK_KENKOU, LAINNYA | Field add on type pada entity MemberAddOn. |
| MemberAddOn | quantity | Int | Yes | Default: 1; Numeric non-negative sesuai konteks | Field quantity pada entity MemberAddOn. |
| MemberAddOn | pricePerUnit | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field price per unit pada entity MemberAddOn. |
| MemberAddOn | totalPrice | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field total price pada entity MemberAddOn. |
| MemberAddOn | status | PackageStatus | Yes | Default: PENDING_PAYMENT; Allowed: PENDING_PAYMENT, WAITING_VERIFICATION, ACTIVE, EXPIRED, CANCELLED | Status proses/data. |
| MemberAddOn | paymentPlanType | PaymentPlanType | Yes | Default: FULL_PAYMENT; Allowed: FULL_PAYMENT, INSTALLMENT | Field payment plan type pada entity MemberAddOn. |
| MemberAddOn | installmentTotal | Int? | No | Numeric non-negative sesuai konteks | Field installment total pada entity MemberAddOn. |
| MemberAddOn | installmentSchedule | Json? | No | - | Field installment schedule pada entity MemberAddOn. |
| MemberAddOn | totalVerifiedPaid | Decimal | Yes | Default: 0; DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field total verified paid pada entity MemberAddOn. |
| MemberAddOn | paymentPlanStatus | String? | No | - | Field payment plan status pada entity MemberAddOn. |
| MemberAddOn | notes | String? | No | - | Catatan tambahan. |
| MemberAddOn | paymentProofUrl | String? | No | URL/path file valid | Field payment proof url pada entity MemberAddOn. |
| MemberAddOn | paymentProofFileName | String? | No | - | Field payment proof file name pada entity MemberAddOn. |
| MemberAddOn | paymentProofFileSize | Int? | No | >= 0 bytes | Field payment proof file size pada entity MemberAddOn. |
| MemberAddOn | paymentProofMimeType | String? | No | - | Field payment proof mime type pada entity MemberAddOn. |
| MemberAddOn | assignedBy | String | Yes | - | Field assigned by pada entity MemberAddOn. |
| MemberAddOn | verifiedBy | String? | No | - | Field verified by pada entity MemberAddOn. |
| MemberAddOn | rejectedBy | String? | No | - | Field rejected by pada entity MemberAddOn. |
| MemberAddOn | paidAt | DateTime? | No | Numeric non-negative sesuai konteks | Field paid at pada entity MemberAddOn. |
| MemberAddOn | verifiedAt | DateTime? | No | - | Field verified at pada entity MemberAddOn. |
| MemberAddOn | rejectedAt | DateTime? | No | - | Field rejected at pada entity MemberAddOn. |
| MemberAddOn | rejectionReason | String? | No | - | Field rejection reason pada entity MemberAddOn. |
| MemberAddOn | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| MemberAddOn | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| NonTherapyProduct | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| NonTherapyProduct | productCode | String | Yes | Unique | Field product code pada entity NonTherapyProduct. |
| NonTherapyProduct | productType | ProductType | Yes | Allowed: AIR_NANO, ROKOK_KENKOU | Field product type pada entity NonTherapyProduct. |
| NonTherapyProduct | name | String | Yes | - | Nama data. |
| NonTherapyProduct | description | String? | No | - | Field description pada entity NonTherapyProduct. |
| NonTherapyProduct | airNanoColor | AirNanoColor? | No | Allowed: KUNING, BIRU, HIJAU | Field air nano color pada entity NonTherapyProduct. |
| NonTherapyProduct | airNanoVolume | AirNanoVolume? | No | Allowed: ML_600, ML_1500 | Field air nano volume pada entity NonTherapyProduct. |
| NonTherapyProduct | airNanoUnit | AirNanoUnit? | No | Allowed: BOTOL, DUS | Field air nano unit pada entity NonTherapyProduct. |
| NonTherapyProduct | pricePerUnit | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field price per unit pada entity NonTherapyProduct. |
| NonTherapyProduct | isActive | Boolean | Yes | Default: true | Status aktif/nonaktif data. |
| NonTherapyProduct | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| NonTherapyProduct | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| MemberNonTherapyPurchase | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| MemberNonTherapyPurchase | purchaseCode | String | Yes | Unique | Field purchase code pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | memberId | String | Yes | - | Referensi member terkait. |
| MemberNonTherapyPurchase | branchId | String | Yes | - | Referensi cabang terkait. |
| MemberNonTherapyPurchase | productId | String | Yes | - | Field product id pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | quantity | Int | Yes | Default: 1; Numeric non-negative sesuai konteks | Field quantity pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | pricePerUnit | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field price per unit pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | totalPrice | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field total price pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | status | PackageStatus | Yes | Default: PENDING_PAYMENT; Allowed: PENDING_PAYMENT, WAITING_VERIFICATION, ACTIVE, EXPIRED, CANCELLED | Status proses/data. |
| MemberNonTherapyPurchase | notes | String? | No | - | Catatan tambahan. |
| MemberNonTherapyPurchase | paymentProofUrl | String? | No | URL/path file valid | Field payment proof url pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | paymentProofFileName | String? | No | - | Field payment proof file name pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | paymentProofFileSize | Int? | No | >= 0 bytes | Field payment proof file size pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | paymentProofMimeType | String? | No | - | Field payment proof mime type pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | assignedBy | String | Yes | - | Field assigned by pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | verifiedBy | String? | No | - | Field verified by pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | paidAt | DateTime? | No | Numeric non-negative sesuai konteks | Field paid at pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | verifiedAt | DateTime? | No | - | Field verified at pada entity MemberNonTherapyPurchase. |
| MemberNonTherapyPurchase | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| MemberNonTherapyPurchase | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| Invoice | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| Invoice | invoiceNumber | String | Yes | Unique | Field invoice number pada entity Invoice. |
| Invoice | memberId | String | Yes | - | Referensi member terkait. |
| Invoice | branchId | String | Yes | - | Referensi cabang terkait. |
| Invoice | subtotal | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field subtotal pada entity Invoice. |
| Invoice | discountPercent | Decimal? | No | DB: Decimal(5, 2); Numeric non-negative sesuai konteks | Field discount percent pada entity Invoice. |
| Invoice | discountAmount | Decimal? | No | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field discount amount pada entity Invoice. |
| Invoice | discountNote | String? | No | Numeric non-negative sesuai konteks | Field discount note pada entity Invoice. |
| Invoice | taxPercent | Decimal? | No | Default: 0; DB: Decimal(5, 2) | Field tax percent pada entity Invoice. |
| Invoice | taxAmount | Decimal? | No | Default: 0; DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field tax amount pada entity Invoice. |
| Invoice | totalAmount | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field total amount pada entity Invoice. |
| Invoice | status | InvoiceStatus | Yes | Default: DRAFT; Allowed: DRAFT, PENDING_PAYMENT, PAID, DEBT, CANCELLED, OVERDUE | Status proses/data. |
| Invoice | paymentPlanType | PaymentPlanType | Yes | Default: FULL_PAYMENT; Allowed: FULL_PAYMENT, INSTALLMENT | Field payment plan type pada entity Invoice. |
| Invoice | paymentGroupId | String? | No | - | Field payment group id pada entity Invoice. |
| Invoice | installmentNumber | Int? | No | - | Field installment number pada entity Invoice. |
| Invoice | installmentTotal | Int? | No | Numeric non-negative sesuai konteks | Field installment total pada entity Invoice. |
| Invoice | installmentSchedule | Json? | No | - | Field installment schedule pada entity Invoice. |
| Invoice | totalPurchaseAmount | Decimal? | No | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field total purchase amount pada entity Invoice. |
| Invoice | installmentAmount | Decimal? | No | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field installment amount pada entity Invoice. |
| Invoice | carryOverAmount | Decimal? | No | Default: 0; DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field carry over amount pada entity Invoice. |
| Invoice | creditAmount | Decimal? | No | Default: 0; DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field credit amount pada entity Invoice. |
| Invoice | actualPaidAmount | Decimal? | No | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field actual paid amount pada entity Invoice. |
| Invoice | paymentVerificationStatus | PaymentVerificationStatus | Yes | Default: PENDING; Allowed: PENDING, VERIFIED, REJECTED | Field payment verification status pada entity Invoice. |
| Invoice | paymentRejectionReason | String? | No | - | Field payment rejection reason pada entity Invoice. |
| Invoice | isAdjustment | Boolean | Yes | Default: false | Field is adjustment pada entity Invoice. |
| Invoice | dueDate | DateTime? | No | - | Field due date pada entity Invoice. |
| Invoice | paidAt | DateTime? | No | Numeric non-negative sesuai konteks | Field paid at pada entity Invoice. |
| Invoice | cancelledAt | DateTime? | No | - | Field cancelled at pada entity Invoice. |
| Invoice | paymentMethod | PaymentMethod? | No | Allowed: CASH, TRANSFER, DEBIT, CREDIT, QRIS, OTHER | Field payment method pada entity Invoice. |
| Invoice | paymentReference | String? | No | - | Field payment reference pada entity Invoice. |
| Invoice | paymentNotes | String? | No | - | Field payment notes pada entity Invoice. |
| Invoice | notes | String? | No | - | Catatan tambahan. |
| Invoice | createdBy | String | Yes | - | User pembuat data. |
| Invoice | verifiedBy | String? | No | - | Field verified by pada entity Invoice. |
| Invoice | verifiedAt | DateTime? | No | - | Field verified at pada entity Invoice. |
| Invoice | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| Invoice | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| InvoiceItem | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| InvoiceItem | invoiceId | String | Yes | - | Field invoice id pada entity InvoiceItem. |
| InvoiceItem | itemType | String | Yes | - | Field item type pada entity InvoiceItem. |
| InvoiceItem | itemId | String | Yes | - | Field item id pada entity InvoiceItem. |
| InvoiceItem | code | String? | No | - | Kode unik data. |
| InvoiceItem | description | String | Yes | - | Field description pada entity InvoiceItem. |
| InvoiceItem | quantity | Int | Yes | Default: 1; Numeric non-negative sesuai konteks | Field quantity pada entity InvoiceItem. |
| InvoiceItem | pricePerUnit | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field price per unit pada entity InvoiceItem. |
| InvoiceItem | subtotal | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field subtotal pada entity InvoiceItem. |
| InvoiceItem | discountAmount | Decimal? | No | Default: 0; DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field discount amount pada entity InvoiceItem. |
| InvoiceItem | totalAmount | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field total amount pada entity InvoiceItem. |
| InvoiceItem | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| InvoicePayment | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| InvoicePayment | invoiceId | String | Yes | - | Field invoice id pada entity InvoicePayment. |
| InvoicePayment | amount | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field amount pada entity InvoicePayment. |
| InvoicePayment | paymentMethod | PaymentMethod | Yes | Allowed: CASH, TRANSFER, DEBIT, CREDIT, QRIS, OTHER | Field payment method pada entity InvoicePayment. |
| InvoicePayment | paymentReference | String? | No | - | Field payment reference pada entity InvoicePayment. |
| InvoicePayment | notes | String? | No | - | Catatan tambahan. |
| InvoicePayment | proofFileUrl | String? | No | URL/path file valid | Field proof file url pada entity InvoicePayment. |
| InvoicePayment | proofFileName | String? | No | - | Field proof file name pada entity InvoicePayment. |
| InvoicePayment | proofFileSize | Int? | No | >= 0 bytes | Field proof file size pada entity InvoicePayment. |
| InvoicePayment | proofMimeType | String? | No | - | Field proof mime type pada entity InvoicePayment. |
| InvoicePayment | receivedBy | String | Yes | - | Field received by pada entity InvoicePayment. |
| InvoicePayment | receivedAt | DateTime | Yes | Default: now() | Field received at pada entity InvoicePayment. |
| InvoicePayment | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| Encounter | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| Encounter | encounterCode | String | Yes | Unique | Field encounter code pada entity Encounter. |
| Encounter | memberId | String | Yes | - | Referensi member terkait. |
| Encounter | branchId | String | Yes | - | Referensi cabang terkait. |
| Encounter | memberPackageId | String | Yes | - | Field member package id pada entity Encounter. |
| Encounter | adminLayananId | String | Yes | - | Field admin layanan id pada entity Encounter. |
| Encounter | doctorId | String | Yes | - | Field doctor id pada entity Encounter. |
| Encounter | nurseId | String | Yes | - | Field nurse id pada entity Encounter. |
| Encounter | status | EncounterStatus | Yes | Default: ONGOING; Allowed: ONGOING, CLOSED | Status proses/data. |
| Encounter | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| Encounter | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| TreatmentSession | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| TreatmentSession | sessionCode | String | Yes | Unique | Field session code pada entity TreatmentSession. |
| TreatmentSession | encounterId | String | Yes | - | Field encounter id pada entity TreatmentSession. |
| TreatmentSession | branchId | String | Yes | - | Referensi cabang terkait. |
| TreatmentSession | infusKe | Int | Yes | - | Field infus ke pada entity TreatmentSession. |
| TreatmentSession | pelaksanaan | SessionType | Yes | Allowed: ON_SITE, HOME_CARE | Field pelaksanaan pada entity TreatmentSession. |
| TreatmentSession | treatmentDate | DateTime | Yes | - | Field treatment date pada entity TreatmentSession. |
| TreatmentSession | isCompleted | Boolean | Yes | Default: false | Field is completed pada entity TreatmentSession. |
| TreatmentSession | adminLayananId | String | Yes | - | Field admin layanan id pada entity TreatmentSession. |
| TreatmentSession | doctorId | String | Yes | - | Field doctor id pada entity TreatmentSession. |
| TreatmentSession | nurseId | String | Yes | - | Field nurse id pada entity TreatmentSession. |
| TreatmentSession | boosterPackageId | String? | No | - | Field booster package id pada entity TreatmentSession. |
| TreatmentSession | boosterType | String? | No | - | Field booster type pada entity TreatmentSession. |
| TreatmentSession | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| TreatmentSession | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| SessionDoctor | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| SessionDoctor | sessionId | String | Yes | - | Field session id pada entity SessionDoctor. |
| SessionDoctor | doctorId | String | Yes | - | Field doctor id pada entity SessionDoctor. |
| SessionDoctor | isPrimary | Boolean | Yes | Default: false | Field is primary pada entity SessionDoctor. |
| SessionDoctor | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| SessionNurse | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| SessionNurse | sessionId | String | Yes | - | Field session id pada entity SessionNurse. |
| SessionNurse | nurseId | String | Yes | - | Field nurse id pada entity SessionNurse. |
| SessionNurse | isPrimary | Boolean | Yes | Default: false | Field is primary pada entity SessionNurse. |
| SessionNurse | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| Diagnosis | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| Diagnosis | diagnosisCode | String | Yes | Unique | Field diagnosis code pada entity Diagnosis. |
| Diagnosis | memberId | String | Yes | - | Referensi member terkait. |
| Diagnosis | encounterId | String? | No | Unique | Field encounter id pada entity Diagnosis. |
| Diagnosis | doktorPemeriksa | String | Yes | - | Field doktor pemeriksa pada entity Diagnosis. |
| Diagnosis | diagnosa | String | Yes | DB: Text | Field diagnosa pada entity Diagnosis. |
| Diagnosis | kategoriDiagnosa | DiagnosisCategory? | No | Allowed: HIPERTENSI, NEUROLOGI, DIABETES, KARDIOVASKULAR, ORTOPEDI, IMUNOLOGI, HEMATOLOGI, STROKE, JANTUNG_KARDIOVASKULAR, SINDROM_METABOLIK, KANKER, DEGENERATIF, AUTO_IMUN, ONKOLOGI, LAINNYA | Field kategori diagnosa pada entity Diagnosis. |
| Diagnosis | kategoriDiagnosaList | Json? | No | - | Field kategori diagnosa list pada entity Diagnosis. |
| Diagnosis | icdPrimer | String? | No | - | Field icd primer pada entity Diagnosis. |
| Diagnosis | icdSekunder | String? | No | - | Field icd sekunder pada entity Diagnosis. |
| Diagnosis | icdTersier | String? | No | - | Field icd tersier pada entity Diagnosis. |
| Diagnosis | keluhanRiwayatSekarang | String? | No | DB: Text | Field keluhan riwayat sekarang pada entity Diagnosis. |
| Diagnosis | riwayatPenyakitTerdahulu | String? | No | DB: Text | Field riwayat penyakit terdahulu pada entity Diagnosis. |
| Diagnosis | riwayatSosialKebiasaan | String? | No | DB: Text | Field riwayat sosial kebiasaan pada entity Diagnosis. |
| Diagnosis | riwayatPengobatan | String? | No | DB: Text | Field riwayat pengobatan pada entity Diagnosis. |
| Diagnosis | pemeriksaanFisik | String? | No | DB: Text | Field pemeriksaan fisik pada entity Diagnosis. |
| Diagnosis | pemeriksaanTambahan | Json? | No | - | Field pemeriksaan tambahan pada entity Diagnosis. |
| Diagnosis | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| Diagnosis | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| TherapyPlanSet | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| TherapyPlanSet | memberId | String | Yes | - | Referensi member terkait. |
| TherapyPlanSet | setCode | String | Yes | Unique | Field set code pada entity TherapyPlanSet. |
| TherapyPlanSet | name | String? | No | - | Nama data. |
| TherapyPlanSet | version | Int | Yes | Default: 1 | Field version pada entity TherapyPlanSet. |
| TherapyPlanSet | status | String | Yes | Default: "ACTIVE" | Status proses/data. |
| TherapyPlanSet | supersededById | String? | No | - | Field superseded by id pada entity TherapyPlanSet. |
| TherapyPlanSet | createdBy | String? | No | - | User pembuat data. |
| TherapyPlanSet | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| TherapyPlanSet | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| TherapyPlan | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| TherapyPlan | planCode | String | Yes | Unique | Field plan code pada entity TherapyPlan. |
| TherapyPlan | memberId | String? | No | - | Referensi member terkait. |
| TherapyPlan | therapyPlanSetId | String? | No | - | Field therapy plan set id pada entity TherapyPlan. |
| TherapyPlan | planNumber | Int? | No | - | Field plan number pada entity TherapyPlan. |
| TherapyPlan | treatmentSessionId | String? | No | Unique | Field treatment session id pada entity TherapyPlan. |
| TherapyPlan | keterangan | String? | No | DB: Text | Field keterangan pada entity TherapyPlan. |
| TherapyPlan | ifa250 | Decimal? | No | DB: Decimal(10, 2) | Field ifa250 pada entity TherapyPlan. |
| TherapyPlan | ifa500 | Decimal? | No | DB: Decimal(10, 2) | Field ifa500 pada entity TherapyPlan. |
| TherapyPlan | hho | Decimal? | No | DB: Decimal(10, 2) | Field hho pada entity TherapyPlan. |
| TherapyPlan | h2 | Decimal? | No | DB: Decimal(10, 2) | Field h2 pada entity TherapyPlan. |
| TherapyPlan | no | Decimal? | No | DB: Decimal(10, 2) | Field no pada entity TherapyPlan. |
| TherapyPlan | gaso | Decimal? | No | DB: Decimal(10, 2) | Field gaso pada entity TherapyPlan. |
| TherapyPlan | o2 | Decimal? | No | DB: Decimal(10, 2) | Field o2 pada entity TherapyPlan. |
| TherapyPlan | o3 | Decimal? | No | DB: Decimal(10, 2) | Field o3 pada entity TherapyPlan. |
| TherapyPlan | edta | Decimal? | No | DB: Decimal(10, 2) | Field edta pada entity TherapyPlan. |
| TherapyPlan | mb | Decimal? | No | DB: Decimal(10, 2) | Field mb pada entity TherapyPlan. |
| TherapyPlan | h2s | Decimal? | No | DB: Decimal(10, 2) | Field h2s pada entity TherapyPlan. |
| TherapyPlan | kcl | Decimal? | No | DB: Decimal(10, 2) | Field kcl pada entity TherapyPlan. |
| TherapyPlan | jmlNb | Decimal? | No | DB: Decimal(10, 2) | Field jml nb pada entity TherapyPlan. |
| TherapyPlan | noInIfa | Decimal? | No | Default: 2.5; DB: Decimal(10, 2) | Field no in ifa pada entity TherapyPlan. |
| TherapyPlan | ifaSubstances | Json? | No | - | Field ifa substances pada entity TherapyPlan. |
| TherapyPlan | ifaSubstanceTotalMl | Decimal? | No | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field ifa substance total ml pada entity TherapyPlan. |
| TherapyPlan | version | Int | Yes | Default: 1 | Field version pada entity TherapyPlan. |
| TherapyPlan | supersededById | String? | No | - | Field superseded by id pada entity TherapyPlan. |
| TherapyPlan | supersededAt | DateTime? | No | - | Field superseded at pada entity TherapyPlan. |
| TherapyPlan | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| TherapyPlan | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| VitalSign | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| VitalSign | treatmentSessionId | String | Yes | - | Field treatment session id pada entity VitalSign. |
| VitalSign | pencatatan | VitalType | Yes | Allowed: SISTOL, DIASTOL, HR, SATURASI, PI | Field pencatatan pada entity VitalSign. |
| VitalSign | waktuCatat | VitalTiming | Yes | Allowed: SEBELUM, SESUDAH | Field waktu catat pada entity VitalSign. |
| VitalSign | value | Decimal | Yes | DB: Decimal(8, 2); Numeric non-negative sesuai konteks | Field value pada entity VitalSign. |
| VitalSign | unit | String? | No | - | Field unit pada entity VitalSign. |
| VitalSign | recordedBy | String | Yes | - | Field recorded by pada entity VitalSign. |
| VitalSign | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| VitalSign | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| InfusionExecution | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| InfusionExecution | treatmentSessionId | String | Yes | Unique | Field treatment session id pada entity InfusionExecution. |
| InfusionExecution | therapyPlanId | String? | No | - | Field therapy plan id pada entity InfusionExecution. |
| InfusionExecution | ifa250 | Decimal? | No | DB: Decimal(10, 2) | Field ifa250 pada entity InfusionExecution. |
| InfusionExecution | ifa500 | Decimal? | No | DB: Decimal(10, 2) | Field ifa500 pada entity InfusionExecution. |
| InfusionExecution | hho | Decimal? | No | DB: Decimal(10, 2) | Field hho pada entity InfusionExecution. |
| InfusionExecution | h2 | Decimal? | No | DB: Decimal(10, 2) | Field h2 pada entity InfusionExecution. |
| InfusionExecution | no | Decimal? | No | DB: Decimal(10, 2) | Field no pada entity InfusionExecution. |
| InfusionExecution | gaso | Decimal? | No | DB: Decimal(10, 2) | Field gaso pada entity InfusionExecution. |
| InfusionExecution | o2 | Decimal? | No | DB: Decimal(10, 2) | Field o2 pada entity InfusionExecution. |
| InfusionExecution | o3 | Decimal? | No | DB: Decimal(10, 2) | Field o3 pada entity InfusionExecution. |
| InfusionExecution | edta | Decimal? | No | DB: Decimal(10, 2) | Field edta pada entity InfusionExecution. |
| InfusionExecution | mb | Decimal? | No | DB: Decimal(10, 2) | Field mb pada entity InfusionExecution. |
| InfusionExecution | h2s | Decimal? | No | DB: Decimal(10, 2) | Field h2s pada entity InfusionExecution. |
| InfusionExecution | kcl | Decimal? | No | DB: Decimal(10, 2) | Field kcl pada entity InfusionExecution. |
| InfusionExecution | jmlNb | Decimal? | No | DB: Decimal(10, 2) | Field jml nb pada entity InfusionExecution. |
| InfusionExecution | deviationNotes | String? | No | DB: Text | Field deviation notes pada entity InfusionExecution. |
| InfusionExecution | bottleType | BottleType? | No | Allowed: IFA, EDTA | Field bottle type pada entity InfusionExecution. |
| InfusionExecution | jenisCairan | String? | No | - | Field jenis cairan pada entity InfusionExecution. |
| InfusionExecution | volumeCarrier | Decimal? | No | DB: Decimal(8, 2) | Field volume carrier pada entity InfusionExecution. |
| InfusionExecution | jumlahJarum | Int? | No | - | Field jumlah jarum pada entity InfusionExecution. |
| InfusionExecution | tanggalProduksi | DateTime? | No | - | Field tanggal produksi pada entity InfusionExecution. |
| InfusionExecution | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| InfusionExecution | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| MaterialUsage | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| MaterialUsage | treatmentSessionId | String | Yes | - | Field treatment session id pada entity MaterialUsage. |
| MaterialUsage | inventoryItemId | String | Yes | - | Field inventory item id pada entity MaterialUsage. |
| MaterialUsage | quantity | Decimal | Yes | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field quantity pada entity MaterialUsage. |
| MaterialUsage | unit | String | Yes | - | Field unit pada entity MaterialUsage. |
| MaterialUsage | recordedBy | String | Yes | - | Field recorded by pada entity MaterialUsage. |
| MaterialUsage | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| SessionPhoto | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| SessionPhoto | treatmentSessionId | String | Yes | Unique | Field treatment session id pada entity SessionPhoto. |
| SessionPhoto | fileUrl | String | Yes | URL/path file valid | Lokasi URL/path file. |
| SessionPhoto | fileName | String | Yes | - | Nama file. |
| SessionPhoto | fileSize | Int | Yes | >= 0 bytes | Ukuran file dalam bytes. |
| SessionPhoto | mimeType | String | Yes | - | MIME type file. |
| SessionPhoto | uploadedBy | String | Yes | - | User yang mengunggah file. |
| SessionPhoto | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| SessionSupportingPhoto | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| SessionSupportingPhoto | treatmentSessionId | String | Yes | - | Field treatment session id pada entity SessionSupportingPhoto. |
| SessionSupportingPhoto | fileUrl | String | Yes | URL/path file valid | Lokasi URL/path file. |
| SessionSupportingPhoto | fileName | String | Yes | - | Nama file. |
| SessionSupportingPhoto | fileSize | Int | Yes | >= 0 bytes | Ukuran file dalam bytes. |
| SessionSupportingPhoto | mimeType | String | Yes | - | MIME type file. |
| SessionSupportingPhoto | description | String? | No | DB: Text | Field description pada entity SessionSupportingPhoto. |
| SessionSupportingPhoto | uploadedBy | String | Yes | - | User yang mengunggah file. |
| SessionSupportingPhoto | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| EMRNote | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| EMRNote | treatmentSessionId | String | Yes | - | Field treatment session id pada entity EMRNote. |
| EMRNote | noteType | EMRNoteType | Yes | Allowed: CLINICAL_NOTE, OPERATIONAL_NOTE, ASSESSMENT, OUTCOME_MONITORING | Field note type pada entity EMRNote. |
| EMRNote | content | String | Yes | DB: Text | Field content pada entity EMRNote. |
| EMRNote | writtenBy | String | Yes | - | Field written by pada entity EMRNote. |
| EMRNote | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| EMRNote | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| DoctorEvaluation | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| DoctorEvaluation | evaluationCode | String | Yes | Unique | Field evaluation code pada entity DoctorEvaluation. |
| DoctorEvaluation | treatmentSessionId | String | Yes | Unique | Field treatment session id pada entity DoctorEvaluation. |
| DoctorEvaluation | keluhan | String? | No | DB: Text | Field keluhan pada entity DoctorEvaluation. |
| DoctorEvaluation | rekomendasi | String? | No | DB: Text | Field rekomendasi pada entity DoctorEvaluation. |
| DoctorEvaluation | subjective | String? | No | DB: Text | Field subjective pada entity DoctorEvaluation. |
| DoctorEvaluation | objective | String? | No | DB: Text | Field objective pada entity DoctorEvaluation. |
| DoctorEvaluation | assessment | String? | No | DB: Text | Field assessment pada entity DoctorEvaluation. |
| DoctorEvaluation | plan | String? | No | DB: Text | Field plan pada entity DoctorEvaluation. |
| DoctorEvaluation | generalNotes | String? | No | DB: Text | Field general notes pada entity DoctorEvaluation. |
| DoctorEvaluation | writtenBy | String | Yes | - | Field written by pada entity DoctorEvaluation. |
| DoctorEvaluation | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| DoctorEvaluation | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| DoctorEvaluationHistory | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| DoctorEvaluationHistory | evaluationId | String | Yes | - | Field evaluation id pada entity DoctorEvaluationHistory. |
| DoctorEvaluationHistory | fieldName | String | Yes | - | Field field name pada entity DoctorEvaluationHistory. |
| DoctorEvaluationHistory | oldValue | String? | No | DB: Text; Numeric non-negative sesuai konteks | Field old value pada entity DoctorEvaluationHistory. |
| DoctorEvaluationHistory | newValue | String? | No | DB: Text; Numeric non-negative sesuai konteks | Field new value pada entity DoctorEvaluationHistory. |
| DoctorEvaluationHistory | changedBy | String | Yes | - | Field changed by pada entity DoctorEvaluationHistory. |
| DoctorEvaluationHistory | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| MasterProduct | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| MasterProduct | sku | String? | No | Unique | Field sku pada entity MasterProduct. |
| MasterProduct | name | String | Yes | Unique | Nama data. |
| MasterProduct | category | ProductCategory | Yes | Allowed: MEDICINE, DEVICE, CONSUMABLE | Field category pada entity MasterProduct. |
| MasterProduct | unit | String | Yes | - | Field unit pada entity MasterProduct. |
| MasterProduct | baseUnit | String | Yes | - | Field base unit pada entity MasterProduct. |
| MasterProduct | usageUnit | String | Yes | - | Field usage unit pada entity MasterProduct. |
| MasterProduct | conversionFactor | Decimal | Yes | Default: 1.0; DB: Decimal(10, 4) | Field conversion factor pada entity MasterProduct. |
| MasterProduct | description | String? | No | - | Field description pada entity MasterProduct. |
| MasterProduct | isAutoUsedPerSession | Boolean | Yes | Default: false | Field is auto used per session pada entity MasterProduct. |
| MasterProduct | isAutoAddedToBranch | Boolean | Yes | Default: false | Field is auto added to branch pada entity MasterProduct. |
| MasterProduct | defaultInitialStock | Decimal? | No | DB: Decimal(10, 4); Numeric non-negative sesuai konteks | Field default initial stock pada entity MasterProduct. |
| MasterProduct | isActive | Boolean | Yes | Default: true | Status aktif/nonaktif data. |
| MasterProduct | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| MasterProduct | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| InventoryItem | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| InventoryItem | masterProductId | String | Yes | - | Field master product id pada entity InventoryItem. |
| InventoryItem | branchId | String | Yes | - | Referensi cabang terkait. |
| InventoryItem | stock | Decimal | Yes | Default: 0; DB: Decimal(10, 4); Numeric non-negative sesuai konteks | Field stock pada entity InventoryItem. |
| InventoryItem | minThreshold | Decimal | Yes | Default: 0; DB: Decimal(10, 4); Numeric non-negative sesuai konteks | Field min threshold pada entity InventoryItem. |
| InventoryItem | storageLocation | String? | No | - | Field storage location pada entity InventoryItem. |
| InventoryItem | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| InventoryItem | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| StockMutation | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| StockMutation | inventoryItemId | String | Yes | - | Field inventory item id pada entity StockMutation. |
| StockMutation | type | StockMutationType | Yes | Allowed: USED, RECEIVED, ADJUSTMENT | Field type pada entity StockMutation. |
| StockMutation | quantity | Decimal | Yes | DB: Decimal(10, 4); Numeric non-negative sesuai konteks | Field quantity pada entity StockMutation. |
| StockMutation | stockBefore | Decimal | Yes | DB: Decimal(10, 4); Numeric non-negative sesuai konteks | Field stock before pada entity StockMutation. |
| StockMutation | stockAfter | Decimal | Yes | DB: Decimal(10, 4); Numeric non-negative sesuai konteks | Field stock after pada entity StockMutation. |
| StockMutation | referenceType | String? | No | - | Field reference type pada entity StockMutation. |
| StockMutation | referenceId | String? | No | - | Field reference id pada entity StockMutation. |
| StockMutation | notes | String? | No | - | Catatan tambahan. |
| StockMutation | createdBy | String | Yes | - | User pembuat data. |
| StockMutation | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| StockRequest | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| StockRequest | requestCode | String | Yes | Unique | Field request code pada entity StockRequest. |
| StockRequest | branchId | String | Yes | - | Referensi cabang terkait. |
| StockRequest | requestedBy | String | Yes | - | Field requested by pada entity StockRequest. |
| StockRequest | status | StockRequestStatus | Yes | Default: PENDING; Allowed: PENDING, APPROVED, WAITING_PAYMENT, PAYMENT_UPLOADED, PAYMENT_CONFIRMED, REJECTED, SHIPPED, COMPLETED, COMPLETED_WITH_ISSUE | Status proses/data. |
| StockRequest | notes | String? | No | - | Catatan tambahan. |
| StockRequest | reviewedBy | String? | No | - | Field reviewed by pada entity StockRequest. |
| StockRequest | reviewedAt | DateTime? | No | - | Field reviewed at pada entity StockRequest. |
| StockRequest | reviewNotes | String? | No | - | Field review notes pada entity StockRequest. |
| StockRequest | paymentProofUrl | String? | No | URL/path file valid | Field payment proof url pada entity StockRequest. |
| StockRequest | paymentProofFileName | String? | No | - | Field payment proof file name pada entity StockRequest. |
| StockRequest | paymentProofFileSize | Int? | No | >= 0 bytes | Field payment proof file size pada entity StockRequest. |
| StockRequest | paymentProofMimeType | String? | No | - | Field payment proof mime type pada entity StockRequest. |
| StockRequest | paymentUploadedAt | DateTime? | No | - | Field payment uploaded at pada entity StockRequest. |
| StockRequest | paymentUploadedBy | String? | No | - | Field payment uploaded by pada entity StockRequest. |
| StockRequest | paymentVerifiedBy | String? | No | - | Field payment verified by pada entity StockRequest. |
| StockRequest | paymentVerifiedAt | DateTime? | No | - | Field payment verified at pada entity StockRequest. |
| StockRequest | paymentVerificationNotes | String? | No | - | Field payment verification notes pada entity StockRequest. |
| StockRequest | paymentRejectionReason | String? | No | - | Field payment rejection reason pada entity StockRequest. |
| StockRequest | shippedBy | String? | No | - | Field shipped by pada entity StockRequest. |
| StockRequest | shippedAt | DateTime? | No | - | Field shipped at pada entity StockRequest. |
| StockRequest | receivedBy | String? | No | - | Field received by pada entity StockRequest. |
| StockRequest | receivedAt | DateTime? | No | - | Field received at pada entity StockRequest. |
| StockRequest | receivingNotes | String? | No | - | Field receiving notes pada entity StockRequest. |
| StockRequest | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| StockRequest | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| StockRequestItem | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| StockRequestItem | stockRequestId | String | Yes | Numeric non-negative sesuai konteks | Field stock request id pada entity StockRequestItem. |
| StockRequestItem | inventoryItemId | String? | No | - | Field inventory item id pada entity StockRequestItem. |
| StockRequestItem | masterProductId | String | Yes | - | Field master product id pada entity StockRequestItem. |
| StockRequestItem | requestedQty | Decimal | Yes | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field requested qty pada entity StockRequestItem. |
| StockRequestItem | approvedQty | Decimal? | No | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field approved qty pada entity StockRequestItem. |
| StockRequestItem | overstockDeducted | Decimal? | No | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field overstock deducted pada entity StockRequestItem. |
| StockRequestItem | finalQty | Decimal? | No | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field final qty pada entity StockRequestItem. |
| StockRequestItem | notes | String? | No | - | Catatan tambahan. |
| Shipment | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| Shipment | shipmentCode | String | Yes | Unique | Field shipment code pada entity Shipment. |
| Shipment | stockRequestId | String | Yes | Unique; Numeric non-negative sesuai konteks | Field stock request id pada entity Shipment. |
| Shipment | fromBranchId | String | Yes | - | Field from branch id pada entity Shipment. |
| Shipment | toBranchId | String | Yes | - | Field to branch id pada entity Shipment. |
| Shipment | status | ShipmentStatus | Yes | Default: PREPARING; Allowed: PREPARING, SHIPPED, RECEIVED, RECEIVED_WITH_ISSUE, APPROVED | Status proses/data. |
| Shipment | shippedAt | DateTime? | No | - | Field shipped at pada entity Shipment. |
| Shipment | shippedBy | String? | No | - | Field shipped by pada entity Shipment. |
| Shipment | shipmentPhotoUrl | String? | No | URL/path file valid | Field shipment photo url pada entity Shipment. |
| Shipment | shipmentPhotoName | String? | No | - | Field shipment photo name pada entity Shipment. |
| Shipment | receivedAt | DateTime? | No | - | Field received at pada entity Shipment. |
| Shipment | receivedBy | String? | No | - | Field received by pada entity Shipment. |
| Shipment | receiptFileUrl | String? | No | URL/path file valid | Field receipt file url pada entity Shipment. |
| Shipment | receiptFileName | String? | No | - | Field receipt file name pada entity Shipment. |
| Shipment | receiptFileSize | Int? | No | >= 0 bytes | Field receipt file size pada entity Shipment. |
| Shipment | receiptMimeType | String? | No | - | Field receipt mime type pada entity Shipment. |
| Shipment | approvedAt | DateTime? | No | - | Field approved at pada entity Shipment. |
| Shipment | approvedBy | String? | No | - | Field approved by pada entity Shipment. |
| Shipment | notes | String? | No | - | Catatan tambahan. |
| Shipment | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| Shipment | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| ShipmentItem | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| ShipmentItem | shipmentId | String | Yes | - | Field shipment id pada entity ShipmentItem. |
| ShipmentItem | masterProductId | String | Yes | - | Field master product id pada entity ShipmentItem. |
| ShipmentItem | sentQty | Decimal | Yes | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field sent qty pada entity ShipmentItem. |
| ShipmentItem | receivedQty | Decimal? | No | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field received qty pada entity ShipmentItem. |
| ShipmentItem | requestedQty | Decimal? | No | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field requested qty pada entity ShipmentItem. |
| ShipmentItem | overstockQty | Decimal? | No | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field overstock qty pada entity ShipmentItem. |
| ShipmentItem | overstockReason | String? | No | Numeric non-negative sesuai konteks | Field overstock reason pada entity ShipmentItem. |
| StockRequestInvoice | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| StockRequestInvoice | invoiceNumber | String | Yes | Unique | Field invoice number pada entity StockRequestInvoice. |
| StockRequestInvoice | stockRequestId | String | Yes | Unique; Numeric non-negative sesuai konteks | Field stock request id pada entity StockRequestInvoice. |
| StockRequestInvoice | branchId | String | Yes | - | Referensi cabang terkait. |
| StockRequestInvoice | subtotal | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field subtotal pada entity StockRequestInvoice. |
| StockRequestInvoice | totalAmount | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field total amount pada entity StockRequestInvoice. |
| StockRequestInvoice | paidAmount | Decimal | Yes | Default: 0; DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field paid amount pada entity StockRequestInvoice. |
| StockRequestInvoice | remainingAmount | Decimal | Yes | Default: 0; DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field remaining amount pada entity StockRequestInvoice. |
| StockRequestInvoice | status | InvoiceStatus | Yes | Default: PENDING_PAYMENT; Allowed: DRAFT, PENDING_PAYMENT, PAID, DEBT, CANCELLED, OVERDUE | Status proses/data. |
| StockRequestInvoice | paymentProofUrl | String? | No | URL/path file valid | Field payment proof url pada entity StockRequestInvoice. |
| StockRequestInvoice | paymentProofFileName | String? | No | - | Field payment proof file name pada entity StockRequestInvoice. |
| StockRequestInvoice | paymentProofFileSize | Int? | No | >= 0 bytes | Field payment proof file size pada entity StockRequestInvoice. |
| StockRequestInvoice | paymentProofMimeType | String? | No | - | Field payment proof mime type pada entity StockRequestInvoice. |
| StockRequestInvoice | paymentUploadedAt | DateTime? | No | - | Field payment uploaded at pada entity StockRequestInvoice. |
| StockRequestInvoice | paymentUploadedBy | String? | No | - | Field payment uploaded by pada entity StockRequestInvoice. |
| StockRequestInvoice | paymentVerificationStatus | PaymentVerificationStatus | Yes | Default: PENDING; Allowed: PENDING, VERIFIED, REJECTED | Field payment verification status pada entity StockRequestInvoice. |
| StockRequestInvoice | verifiedBy | String? | No | - | Field verified by pada entity StockRequestInvoice. |
| StockRequestInvoice | verifiedAt | DateTime? | No | - | Field verified at pada entity StockRequestInvoice. |
| StockRequestInvoice | verificationNotes | String? | No | - | Field verification notes pada entity StockRequestInvoice. |
| StockRequestInvoice | rejectionReason | String? | No | - | Field rejection reason pada entity StockRequestInvoice. |
| StockRequestInvoice | paidAt | DateTime? | No | Numeric non-negative sesuai konteks | Field paid at pada entity StockRequestInvoice. |
| StockRequestInvoice | notes | String? | No | - | Catatan tambahan. |
| StockRequestInvoice | createdBy | String | Yes | - | User pembuat data. |
| StockRequestInvoice | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| StockRequestInvoice | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| StockRequestInvoicePayment | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| StockRequestInvoicePayment | invoiceId | String | Yes | - | Field invoice id pada entity StockRequestInvoicePayment. |
| StockRequestInvoicePayment | amount | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field amount pada entity StockRequestInvoicePayment. |
| StockRequestInvoicePayment | proofFileUrl | String | Yes | URL/path file valid | Field proof file url pada entity StockRequestInvoicePayment. |
| StockRequestInvoicePayment | proofFileName | String | Yes | - | Field proof file name pada entity StockRequestInvoicePayment. |
| StockRequestInvoicePayment | proofFileSize | Int | Yes | >= 0 bytes | Field proof file size pada entity StockRequestInvoicePayment. |
| StockRequestInvoicePayment | proofMimeType | String | Yes | - | Field proof mime type pada entity StockRequestInvoicePayment. |
| StockRequestInvoicePayment | notes | String? | No | - | Catatan tambahan. |
| StockRequestInvoicePayment | uploadedBy | String | Yes | - | User yang mengunggah file. |
| StockRequestInvoicePayment | uploadedAt | DateTime | Yes | Default: now() | Field uploaded at pada entity StockRequestInvoicePayment. |
| StockRequestInvoicePayment | verifiedBy | String? | No | - | Field verified by pada entity StockRequestInvoicePayment. |
| StockRequestInvoicePayment | verifiedAt | DateTime? | No | - | Field verified at pada entity StockRequestInvoicePayment. |
| StockRequestInvoicePayment | verificationNotes | String? | No | - | Field verification notes pada entity StockRequestInvoicePayment. |
| StockRequestInvoicePayment | rejectionReason | String? | No | - | Field rejection reason pada entity StockRequestInvoicePayment. |
| StockRequestInvoicePayment | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| StockRequestInvoicePayment | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| StockRequestInvoiceItem | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| StockRequestInvoiceItem | invoiceId | String | Yes | - | Field invoice id pada entity StockRequestInvoiceItem. |
| StockRequestInvoiceItem | masterProductId | String | Yes | - | Field master product id pada entity StockRequestInvoiceItem. |
| StockRequestInvoiceItem | sku | String? | No | - | Field sku pada entity StockRequestInvoiceItem. |
| StockRequestInvoiceItem | productName | String | Yes | - | Field product name pada entity StockRequestInvoiceItem. |
| StockRequestInvoiceItem | description | String? | No | - | Field description pada entity StockRequestInvoiceItem. |
| StockRequestInvoiceItem | quantity | Decimal | Yes | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field quantity pada entity StockRequestInvoiceItem. |
| StockRequestInvoiceItem | pricePerUnit | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field price per unit pada entity StockRequestInvoiceItem. |
| StockRequestInvoiceItem | subtotal | Decimal | Yes | DB: Decimal(12, 2); Numeric non-negative sesuai konteks | Field subtotal pada entity StockRequestInvoiceItem. |
| ShipmentDiscrepancy | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| ShipmentDiscrepancy | shipmentId | String | Yes | - | Field shipment id pada entity ShipmentDiscrepancy. |
| ShipmentDiscrepancy | masterProductId | String | Yes | - | Field master product id pada entity ShipmentDiscrepancy. |
| ShipmentDiscrepancy | productName | String | Yes | - | Field product name pada entity ShipmentDiscrepancy. |
| ShipmentDiscrepancy | expectedQty | Decimal | Yes | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field expected qty pada entity ShipmentDiscrepancy. |
| ShipmentDiscrepancy | receivedQty | Decimal | Yes | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field received qty pada entity ShipmentDiscrepancy. |
| ShipmentDiscrepancy | discrepancyType | DiscrepancyType | Yes | Allowed: SHORTAGE, DAMAGE, WRONG_ITEM, OTHER | Field discrepancy type pada entity ShipmentDiscrepancy. |
| ShipmentDiscrepancy | notes | String? | No | - | Catatan tambahan. |
| ShipmentDiscrepancy | photoUrl | String? | No | URL/path file valid | Field photo url pada entity ShipmentDiscrepancy. |
| ShipmentDiscrepancy | photoFileName | String? | No | - | Field photo file name pada entity ShipmentDiscrepancy. |
| ShipmentDiscrepancy | reportedBy | String | Yes | - | Field reported by pada entity ShipmentDiscrepancy. |
| ShipmentDiscrepancy | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| BranchOverstock | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| BranchOverstock | branchId | String | Yes | - | Referensi cabang terkait. |
| BranchOverstock | masterProductId | String | Yes | - | Field master product id pada entity BranchOverstock. |
| BranchOverstock | quantity | Decimal | Yes | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field quantity pada entity BranchOverstock. |
| BranchOverstock | originalQty | Decimal | Yes | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field original qty pada entity BranchOverstock. |
| BranchOverstock | reason | String | Yes | - | Field reason pada entity BranchOverstock. |
| BranchOverstock | sourceShipmentId | String | Yes | - | Field source shipment id pada entity BranchOverstock. |
| BranchOverstock | status | OverstockStatus | Yes | Default: AVAILABLE; Allowed: AVAILABLE, PARTIALLY_USED, FULLY_USED | Status proses/data. |
| BranchOverstock | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| BranchOverstock | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| OverstockUsage | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| OverstockUsage | overstockId | String | Yes | Numeric non-negative sesuai konteks | Field overstock id pada entity OverstockUsage. |
| OverstockUsage | stockRequestId | String | Yes | Numeric non-negative sesuai konteks | Field stock request id pada entity OverstockUsage. |
| OverstockUsage | stockRequestItemId | String | Yes | Numeric non-negative sesuai konteks | Field stock request item id pada entity OverstockUsage. |
| OverstockUsage | quantityUsed | Decimal | Yes | DB: Decimal(10, 2); Numeric non-negative sesuai konteks | Field quantity used pada entity OverstockUsage. |
| OverstockUsage | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| Notification | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| Notification | userId | String | Yes | - | Referensi user terkait. |
| Notification | type | NotificationType | Yes | Allowed: INVOICE, REMINDER, INFO | Field type pada entity Notification. |
| Notification | title | String | Yes | - | Field title pada entity Notification. |
| Notification | body | String | Yes | DB: Text | Field body pada entity Notification. |
| Notification | deepLink | String? | No | - | Field deep link pada entity Notification. |
| Notification | status | NotificationStatus | Yes | Default: UNREAD; Allowed: UNREAD, READ | Status proses/data. |
| Notification | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| Notification | readAt | DateTime? | No | - | Field read at pada entity Notification. |
| ChatRoom | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| ChatRoom | memberId | String | Yes | Unique | Referensi member terkait. |
| ChatRoom | staffId | String? | No | - | Field staff id pada entity ChatRoom. |
| ChatRoom | isActive | Boolean | Yes | Default: true | Status aktif/nonaktif data. |
| ChatRoom | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| ChatRoom | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
| ChatMessage | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| ChatMessage | chatRoomId | String | Yes | - | Field chat room id pada entity ChatMessage. |
| ChatMessage | senderId | String | Yes | - | Field sender id pada entity ChatMessage. |
| ChatMessage | content | String | Yes | DB: Text | Field content pada entity ChatMessage. |
| ChatMessage | fileUrl | String? | No | URL/path file valid | Lokasi URL/path file. |
| ChatMessage | fileName | String? | No | - | Nama file. |
| ChatMessage | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| AuditLog | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| AuditLog | userId | String? | No | - | Referensi user terkait. |
| AuditLog | userName | String? | No | - | Field user name pada entity AuditLog. |
| AuditLog | userRole | String? | No | - | Field user role pada entity AuditLog. |
| AuditLog | branchId | String? | No | - | Referensi cabang terkait. |
| AuditLog | branchName | String? | No | - | Field branch name pada entity AuditLog. |
| AuditLog | action | AuditAction | Yes | Allowed: CREATE, UPDATE, DELETE, VERIFY, LOGIN, LOGOUT, FAILED_LOGIN, PASSWORD_CHANGE, PASSWORD_RESET, LOGIN_SUCCESS, LOGIN_FAILED, VERIFY_PAYMENT, REJECT_PAYMENT, UPLOAD_FILE, STATUS_CHANGE, ASSIGN, CANCEL, COMPLETE, STOCK_REQUEST, SHIPMENT, RECEIVE_SHIPMENT, STOCK_ADJUSTMENT | Field action pada entity AuditLog. |
| AuditLog | module | String? | No | - | Field module pada entity AuditLog. |
| AuditLog | resource | String | Yes | - | Field resource pada entity AuditLog. |
| AuditLog | resourceId | String | Yes | - | Field resource id pada entity AuditLog. |
| AuditLog | entityType | String? | No | - | Field entity type pada entity AuditLog. |
| AuditLog | entityId | String? | No | - | Field entity id pada entity AuditLog. |
| AuditLog | entityCode | String? | No | - | Field entity code pada entity AuditLog. |
| AuditLog | description | String? | No | - | Field description pada entity AuditLog. |
| AuditLog | meta | Json? | No | - | Field meta pada entity AuditLog. |
| AuditLog | beforeData | Json? | No | - | Field before data pada entity AuditLog. |
| AuditLog | afterData | Json? | No | - | Field after data pada entity AuditLog. |
| AuditLog | changedFields | Json? | No | - | Field changed fields pada entity AuditLog. |
| AuditLog | metadata | Json? | No | - | Field metadata pada entity AuditLog. |
| AuditLog | ipAddress | String? | No | - | Field ip address pada entity AuditLog. |
| AuditLog | userAgent | String? | No | - | Field user agent pada entity AuditLog. |
| AuditLog | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| LabResult | id | String | Yes | Primary key; Default: cuid() | Primary key unik. |
| LabResult | memberId | String | Yes | - | Referensi member terkait. |
| LabResult | fileName | String | Yes | - | Nama file. |
| LabResult | fileUrl | String | Yes | URL/path file valid | Lokasi URL/path file. |
| LabResult | fileType | String | Yes | - | Field file type pada entity LabResult. |
| LabResult | fileSize | Int | Yes | >= 0 bytes | Ukuran file dalam bytes. |
| LabResult | description | String? | No | DB: Text | Field description pada entity LabResult. |
| LabResult | labDate | DateTime? | No | - | Field lab date pada entity LabResult. |
| LabResult | uploadedBy | String | Yes | - | User yang mengunggah file. |
| LabResult | createdAt | DateTime | Yes | Default: now() | Timestamp saat data dibuat. |
| LabResult | updatedAt | DateTime | Yes | Auto update timestamp | Timestamp saat data terakhir diperbarui. |
