# Database & Backend Architecture Documentation

> Dokumentasi lengkap database schema, backend architecture, dan seeding data untuk Raho ERP Management System

## 📊 Database Overview

**Database**: PostgreSQL 14+  
**ORM**: Prisma  
**Total Tables**: 25+ tables  
**Total Enums**: 15+ enums  
**Migrations**: 10 migrations

---

## 🗄️ Database Schema

### 1. User & Authentication Tables

#### **User**
Tabel utama untuk semua user (staff & member)
- id - UUID primary key
- email - Unique email
- password - Hashed password (bcrypt)
- 
ole - UserRole enum
- isActive - Account status
- createdAt, updatedAt

**Relations:**
- 1-to-1 with Profile
- 1-to-many with StaffBranch
- 1-to-1 with Member (if role = MEMBER)

#### **Profile**
Profil user (nama, foto, kontak)
- id - UUID primary key
- userId - Foreign key to User
- ullName - Nama lengkap
- phone - Nomor telepon
- photoUrl - URL foto profil
- ddress, city, province, postalCode
- dateOfBirth, gender

---

### 2. Branch Management Tables

#### **Branch**
Cabang klinik
- id - UUID primary key
- ranchCode - Unique code (e.g., "SBY", "JKT")
- 
ame - Nama cabang
- 	ype - BranchType (PUSAT, CABANG)
- ddress, city, province
- phone, email
- isActive

**Relations:**
- 1-to-many with StaffBranch
- 1-to-many with MemberBranch
- 1-to-many with BranchInventory

#### **StaffBranch**
Assignment staff ke branch
- id - UUID primary key
- userId - Foreign key to User
- ranchId - Foreign key to Branch
- isActive

---

### 3. Member Management Tables

#### **Member**
Data member/pasien
- id - UUID primary key
- userId - Foreign key to User
- memberNo - Auto-generated (e.g., "M-SBY-001")
- 
egistrationDate
- emergencyContact, emergencyPhone
- loodType, llergies
- medicalHistory

**Relations:**
- 1-to-many with MemberBranch
- 1-to-many with MemberPackage
- 1-to-many with TherapySession

#### **MemberBranch**
Multi-branch access untuk member
- id - UUID primary key
- memberId - Foreign key to Member
- ranchId - Foreign key to Branch
- grantedBy - User ID yang memberikan akses
- grantedAt

---

### 4. Package Management Tables

#### **PackagePricing**
Harga paket per branch
- id - UUID primary key
- ranchId - Foreign key to Branch
- packageType - BASIC atau BOOSTER
- productCode - Kode produk (e.g., "TNB-P10-PM")
- 
ame - Nama paket
- description
- price - Harga
- 	otalSessions - Jumlah sesi
- isActive

**Relations:**
- 1-to-many with MemberPackage

#### **MemberPackage**
Paket yang dimiliki member
- id - UUID primary key
- packageCode - Auto-generated (e.g., "PKG-xxx")
- memberId - Foreign key to Member
- ranchId - Foreign key to Branch
- packagePricingId - Foreign key to PackagePricing
- packageType - BASIC atau BOOSTER
- productCode - Kode produk
- 	otalSessions - Total sesi
- usedSessions - Sesi terpakai
- inalPrice - Harga setelah diskon
- discountPercent - Diskon persen
- discountAmount - Total diskon (persen + amount)
- discountNote - Catatan diskon
- status - PENDING_PAYMENT, ACTIVE, EXPIRED, CANCELLED
- oosterType - Tipe booster (NO, GT, MB, dll)
- serviceType - Tipe layanan (PM, PS, dll)
- purchaseGroupId - Group ID untuk bundling
- ssignedBy, erifiedBy
- paidAt, ctivatedAt, expiredAt
- paymentProofUrl - URL bukti pembayaran
- 
otes

**Relations:**
- Many-to-1 with Member
- Many-to-1 with Branch
- Many-to-1 with PackagePricing
- 1-to-many with MemberAddOn
- 1-to-many with ReferralIncentiveRecord

#### **MemberAddOn**
Add-on services
- id - UUID primary key
- ddOnCode - Auto-generated
- memberId - Foreign key to Member
- ranchId - Foreign key to Branch
- packageId - Foreign key to MemberPackage (optional)
- ddOnType - AIR_NANO, KONSULTASI_GIZI, KONSULTASI_PSIKOLOG, ROKOK_KENKOU, LAINNYA
- quantity - Jumlah
- pricePerUnit - Harga per unit
- 	otalPrice - Total harga
- status - PENDING_PAYMENT, ACTIVE, CANCELLED
- 
otes
- ssignedBy, erifiedBy
- paidAt, erifiedAt
- paymentProofUrl

---

### 5. Treatment Session Tables

#### **TherapySession**
Sesi terapi
- id - UUID primary key
- sessionCode - Auto-generated
- memberId - Foreign key to Member
- ranchId - Foreign key to Branch
- packageId - Foreign key to MemberPackage
- sessionDate - Tanggal sesi
- sessionNumber - Nomor sesi ke-
- status - SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
- currentStep - Step saat ini (1-8)
- completedSteps - Array step yang sudah selesai
- 
otes
- createdBy

**Relations:**
- Many-to-1 with Member
- Many-to-1 with Branch
- Many-to-1 with MemberPackage
- 1-to-1 with Diagnosis
- 1-to-1 with TherapyPlan
- 1-to-many with VitalSigns
- 1-to-1 with Infusion
- 1-to-many with MaterialUsage
- 1-to-many with SessionPhoto
- 1-to-1 with Evaluation
- Many-to-many with User (doctors/nurses)

#### **Diagnosis**
Step 1: Diagnosis medis
- id - UUID primary key
- sessionId - Foreign key to TherapySession
- diagnosis - Diagnosis text
- icd10Code - ICD-10 code
- symptoms - Gejala
- doctorId - Foreign key to User
- createdAt

#### **TherapyPlan**
Step 2: Rencana terapi
- id - UUID primary key
- sessionId - Foreign key to TherapySession
- plan - Rencana terapi
- 
ecommendations - Rekomendasi
- doctorId - Foreign key to User
- createdAt

#### **VitalSigns**
Step 3 & 7: Vital signs (before & after)
- id - UUID primary key
- sessionId - Foreign key to TherapySession
- 	ype - BEFORE atau AFTER
- loodPressureSystolic, loodPressureDiastolic
- heartRate, 	emperature, weight, height
- oxygenSaturation
- 
otes
- 
urseId - Foreign key to User
- createdAt

#### **Infusion**
Step 4: Infusi
- id - UUID primary key
- sessionId - Foreign key to TherapySession
- oosterType - Tipe booster
- startTime, endTime
- lowRate - Kecepatan infus
- 	otalVolume - Volume total
- 
otes
- 
urseId - Foreign key to User

#### **MaterialUsage**
Step 5: Penggunaan material
- id - UUID primary key
- sessionId - Foreign key to TherapySession
- inventoryItemId - Foreign key to InventoryItem
- quantity - Jumlah digunakan
- 
otes
- 
ecordedBy - Foreign key to User

#### **SessionPhoto**
Step 6: Foto dokumentasi
- id - UUID primary key
- sessionId - Foreign key to TherapySession
- photoUrl - URL foto
- caption - Keterangan
- uploadedBy - Foreign key to User
- uploadedAt

#### **Evaluation**
Step 8: Evaluasi dokter
- id - UUID primary key
- sessionId - Foreign key to TherapySession
- evaluation - Evaluasi text
- 
ecommendations - Rekomendasi
- 
extSessionPlan - Rencana sesi berikutnya
- doctorId - Foreign key to User
- createdAt

---

### 6. Invoice & Payment Tables

#### **Invoice**
Invoice pembayaran
- id - UUID primary key
- invoiceNumber - Auto-generated (e.g., "INV-2024-001")
- memberId - Foreign key to Member
- ranchId - Foreign key to Branch
- invoiceDate
- dueDate
- subtotal - Subtotal sebelum diskon
- discountAmount - Total diskon
- 	axAmount - Pajak
- 	otalAmount - Total akhir
- status - DRAFT, PENDING_PAYMENT, PAID, CANCELLED
- paidAt, cancelledAt
- 
otes

**Relations:**
- Many-to-1 with Member
- Many-to-1 with Branch
- 1-to-many with InvoiceItem

#### **InvoiceItem**
Item dalam invoice
- id - UUID primary key
- invoiceId - Foreign key to Invoice
- itemType - PACKAGE, ADD_ON, NON_THERAPY_PRODUCT
- itemId - ID item (packageId, addOnId, dll)
- code - Kode item
- description - Deskripsi
- quantity - Jumlah
- pricePerUnit - Harga per unit
- subtotal - Subtotal
- discountAmount - Diskon
- 	otalAmount - Total

---

### 7. Inventory Management Tables

#### **InventoryItem**
Master inventory
- id - UUID primary key
- itemCode - Kode item
- 
ame - Nama item
- category - Kategori
- unit - Satuan (pcs, ml, box, dll)
- minStock - Minimum stock
- description
- isActive

**Relations:**
- 1-to-many with BranchInventory
- 1-to-many with MaterialUsage

#### **BranchInventory**
Stock per branch
- id - UUID primary key
- ranchId - Foreign key to Branch
- inventoryItemId - Foreign key to InventoryItem
- quantity - Jumlah stock
- lastRestockDate
- 
otes

#### **StockRequest**
Permintaan stock
- id - UUID primary key
- 
equestNumber - Auto-generated
- romBranchId - Branch peminta
- 	oBranchId - Branch tujuan (PUSAT)
- status - PENDING, APPROVED, REJECTED, SHIPPED, RECEIVED
- 
equestedBy, pprovedBy
- 
equestedAt, pprovedAt
- 
otes, 
ejectionReason

**Relations:**
- 1-to-many with StockRequestItem

#### **StockRequestItem**
Item dalam stock request
- id - UUID primary key
- stockRequestId - Foreign key to StockRequest
- inventoryItemId - Foreign key to InventoryItem
- 
equestedQuantity - Jumlah diminta
- pprovedQuantity - Jumlah disetujui

#### **Shipment**
Pengiriman barang
- id - UUID primary key
- shipmentNumber - Auto-generated
- stockRequestId - Foreign key to StockRequest
- romBranchId - Branch pengirim
- 	oBranchId - Branch penerima
- status - PENDING, SHIPPED, RECEIVED, APPROVED
- shippedBy, 
eceivedBy, pprovedBy
- shippedAt, 
eceivedAt, pprovedAt
- 
otes

**Relations:**
- Many-to-1 with StockRequest
- 1-to-many with ShipmentItem

#### **ShipmentItem**
Item dalam shipment
- id - UUID primary key
- shipmentId - Foreign key to Shipment
- inventoryItemId - Foreign key to InventoryItem
- quantity - Jumlah dikirim

---

### 8. Referral System Tables

#### **ReferralCode**
Kode referral
- id - UUID primary key
- code - Kode unik
- 
eferrerType - MEMBER, DOCTOR, STAFF, EXTERNAL
- 
eferrerId - ID referrer (optional)
- 
eferrerName - Nama referrer
- incentiveType - PERCENTAGE atau FIXED_AMOUNT
- incentiveValue - Nilai insentif
- isActive
- alidFrom, alidUntil

**Relations:**
- 1-to-many with ReferralIncentiveRecord

#### **ReferralIncentiveRecord**
Record insentif referral
- id - UUID primary key
- 
eferralCodeId - Foreign key to ReferralCode
- memberPackageId - Foreign key to MemberPackage
- incentiveAmount - Jumlah insentif
- incentiveType - PERCENTAGE atau FIXED_AMOUNT
- incentiveValue - Nilai insentif
- status - PENDING, PAID, CANCELLED
- paidAt
- createdAt

---

### 9. Audit & Logging Tables

#### **AuditLog**
Audit trail semua operasi
- id - UUID primary key
- userId - Foreign key to User
- ranchId - Foreign key to Branch (optional)
- ction - CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT
- 
esource - Nama resource (User, Member, Package, dll)
- 
esourceId - ID resource
- meta - JSON metadata
- ipAddress - IP address
- userAgent - User agent
- createdAt

---

## 🔑 Database Enums

### UserRole
`prisma
enum UserRole {
  SUPER_ADMIN      // Full system access
  ADMIN_MANAGER    // Multi-branch management
  ADMIN_LAYANAN    // Branch operations
  DOCTOR           // Medical operations
  NURSE            // Treatment execution
  MEMBER           // Patient portal
}
`

### BranchType
`prisma
enum BranchType {
  PUSAT   // Main branch
  CABANG  // Sub branch
}
`

### PackageType
`prisma
enum PackageType {
  BASIC    // Basic therapy package
  BOOSTER  // Booster package
}
`

### PackageStatus
`prisma
enum PackageStatus {
  PENDING_PAYMENT  // Waiting for payment
  ACTIVE           // Active package
  EXPIRED          // Expired package
  CANCELLED        // Cancelled package
}
`

### BoosterType
`prisma
enum BoosterType {
  NO    // Nitric Oxide
  GT    // Glutathione
  MB    // Methylene Blue
  KCL   // Potassium Chloride
  H2S   // Hydrogen Sulfide
  HK    // H2S Konsentrat
  O3    // Ozone
  HHO   // Legacy type
  NO2   // Legacy type
}
`

### ServiceType
`prisma
enum ServiceType {
  PM   // Premiere
  PS   // Partnership
  PTY  // Partnership Attiya
  PDA  // Partnership Dr. Abhi
  PHC  // Partnership Homecare
}
`

### AddOnType
`prisma
enum AddOnType {
  AIR_NANO
  KONSULTASI_GIZI
  KONSULTASI_PSIKOLOG
  ROKOK_KENKOU
  LAINNYA
}
`

### SessionStatus
`prisma
enum SessionStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
`

### SessionStep
`prisma
enum SessionStep {
  DIAGNOSIS
  THERAPY_PLAN
  VITAL_SIGNS_BEFORE
  INFUSION
  MATERIAL_USAGE
  PHOTO
  VITAL_SIGNS_AFTER
  EVALUATION
}
`

### InvoiceStatus
`prisma
enum InvoiceStatus {
  DRAFT
  PENDING_PAYMENT
  PAID
  CANCELLED
}
`

### InvoiceItemType
`prisma
enum InvoiceItemType {
  PACKAGE
  ADD_ON
  NON_THERAPY_PRODUCT
}
`

### StockRequestStatus
`prisma
enum StockRequestStatus {
  PENDING
  APPROVED
  REJECTED
  SHIPPED
  RECEIVED
}
`

### ShipmentStatus
`prisma
enum ShipmentStatus {
  PENDING
  SHIPPED
  RECEIVED
  APPROVED
}
`

### ReferrerType
`prisma
enum ReferrerType {
  MEMBER
  DOCTOR
  STAFF
  EXTERNAL
}
`

### IncentiveType
`prisma
enum IncentiveType {
  PERCENTAGE
  FIXED_AMOUNT
}
`

### AuditAction
`prisma
enum AuditAction {
  CREATE
  READ
  UPDATE
  DELETE
  LOGIN
  LOGOUT
}
`

---


## 🌱 Database Seeding

### Seed Structure

Sistem seeding menggunakan **modular approach** untuk maintainability dan reusability yang lebih baik.

**Location**: `apps/api/prisma/seeds/`

### Available Seed Modules

#### 1. **branches.seed.ts**
Seed data cabang klinik

**Data yang di-seed:**
- Branch Pusat (SBY) - Main branch
- Branch Bandung (BDG) - Sub branch
- Branch Jakarta (JKT) - Sub branch

**Returns:**
- `branchPusat` - Object branch pusat
- `branchBandung` - Object branch Bandung

**Usage:**
```typescript
const { branchPusat, branchBandung } = await seedBranches(prisma);
```

---

#### 2. **users.seed.ts**
Seed user staff (admin, doctor, nurse)

**Data yang di-seed:**
- Super Admin (full system access)
- Admin Manager (multi-branch management)
- Admin Layanan (branch operations)
- Doctor (medical operations)
- Nurse (treatment execution)
- Member (patient portal)

**Parameters:**
- `prisma` - PrismaClient instance
- `branchPusatId` - ID branch pusat

**Returns:**
- `superAdminUser` - Super admin user
- `adminLayananUser` - Admin layanan user
- `doctorUser` - Doctor user
- `nurseUser` - Nurse user
- `allUsers` - Array semua user

**Functions:**
- `seedUsers()` - Create users
- `assignStaffToBranches()` - Assign staff ke multiple branches
- `assignManagerToBranches()` - Assign manager ke multiple branches

**Usage:**
```typescript
const { doctorUser, nurseUser } = await seedUsers(prisma, branchPusat.id);
await assignStaffToBranches(prisma, doctorUser.id, [branchPusat.id, branchBandung.id]);
```

---

#### 3. **products.seed.ts**
Seed master products dan inventory

**Data yang di-seed:**
- Master products (medicines, devices, consumables)
- Inventory items per branch

**Functions:**
- `seedProducts(prisma)` - Seed master product catalog
- `seedInventory(prisma, products, branchId)` - Seed inventory untuk branch

**Returns:**
- `seedProducts` - Array of created products

**Usage:**
```typescript
const products = await seedProducts(prisma);
await seedInventory(prisma, products, branchPusat.id);
```

---

#### 4. **inventory-items.seed.ts**
Seed inventory items (legacy)

**Data yang di-seed:**
- Basic inventory items untuk testing

---

#### 5. **inventory-items-official.seed.ts**
Seed official inventory items

**Data yang di-seed:**
- Official inventory items dengan data real

**Function:**
- `seedOfficialInventoryItems(prisma, branchId)`

---

#### 6. **inventory-items-consolidated.seed.ts**
Seed consolidated inventory items

**Data yang di-seed:**
- Consolidated inventory dengan unit conversion
- Base unit (botol, box, pack)
- Usage unit (ml, tablet, gram)
- Conversion factor

**Function:**
- `seedConsolidatedInventoryItems(prisma, branchId)`

---

#### 7. **packages.seed.ts**
Seed package pricing

**Data yang di-seed:**
- Basic packages (TNB-P7, TNB-P10, TNB-P15, TNB-P20)
- Booster packages (NO, GT, MB, KCL, H2S, HK, O3, HHO, NO2)
- Service types (PM, PS, PTY, PDA, PHC)
- Pricing per branch

**Parameters:**
- `prisma` - PrismaClient instance
- `branches` - Array of branch objects

**Usage:**
```typescript
await seedPackagePricing(prisma, [branchPusat, branchBandung]);
```

---

#### 8. **non-therapy-products.seed.ts**
Seed non-therapy products

**Data yang di-seed:**
- Air Nano (berbagai warna, volume, unit)
- Rokok Kenkou

**Function:**
- `seedNonTherapyProducts(prisma)`

**Usage:**
```typescript
await seedNonTherapyProducts(prisma);
```

---

#### 9. **referrals.seed.ts**
Seed referral codes

**Data yang di-seed:**
- Referral codes untuk sales, doctor, member
- Incentive settings (percentage atau fixed amount)

**Function:**
- `seedReferralCodes(prisma)`

**Usage:**
```typescript
await seedReferralCodes(prisma);
```

---

#### 10. **members-multibranch.seed.ts**
Seed members dengan multi-branch access

**Data yang di-seed:**
- Test members
- Multi-branch access
- Member packages
- Add-ons

**Function:**
- `seedMembersMultiBranch(prisma, branchPusat, branchBandung, users)`

---

#### 11. **therapy-sessions.seed.ts**
Seed therapy sessions (legacy)

**Data yang di-seed:**
- Basic therapy sessions untuk testing

---

#### 12. **therapy-sessions-new.seed.ts**
Seed therapy sessions (new structure)

**Data yang di-seed:**
- Therapy sessions dengan encounter structure
- Diagnosis, therapy plan, vital signs
- Infusion execution, material usage
- Session photos, EMR notes, evaluation

---

#### 13. **complete-therapy-sessions.seed.ts**
Seed complete therapy sessions

**Data yang di-seed:**
- Complete therapy sessions dengan semua steps
- Multiple doctors/nurses per session
- Full EMR data

---

#### 14. **infusion-material-usage.seed.ts**
Seed infusion material usage

**Data yang di-seed:**
- Material usage untuk infusion
- Stock mutations

**Function:**
- `seedInfusionMaterialUsage(prisma, sessionId, branchId, nurseId)`

---

#### 15. **dashboard-test.seed.ts**
Seed dashboard test data

**Data yang di-seed:**
- Test data untuk dashboard analytics
- Revenue, sessions, members statistics

---

### Seed Execution Order

Seeding harus dilakukan dalam urutan yang benar karena foreign key dependencies:

1. **Branches** (no dependencies)
2. **Users** (depends on branches)
3. **Master Products** (no dependencies)
4. **Inventory Items** (depends on products + branches)
5. **Package Pricing** (depends on branches)
6. **Non-Therapy Products** (no dependencies)
7. **Referral Codes** (depends on branches)
8. **Members** (depends on users + branches + referral codes)
9. **Member Packages** (depends on members + branches + package pricing)
10. **Therapy Sessions** (depends on members + packages + users)

### Running Seeds

```bash
# Full seed (all modules)
npm run db:seed

# Reset database + seed
npm run db:reset

# Seed specific module (custom script)
npx tsx prisma/seeds/branches.seed.ts
```

### Seed Benefits

✅ **Modular**: ~100 lines per module (vs 800+ monolithic)  
✅ **Reusable**: Import dan gunakan function di mana saja  
✅ **Testable**: Test individual modules  
✅ **Maintainable**: Clear separation of concerns  
✅ **Flexible**: Seed specific domains only  

---

## 🏗️ Backend Architecture

### Architecture Overview

Backend menggunakan **modular service-oriented architecture** dengan separation of concerns yang jelas.

**Tech Stack:**
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL 14+
- **Authentication**: JWT (Access 15min, Refresh 7d)
- **File Storage**: MinIO (S3-compatible)
- **Logging**: Winston

---

### Project Structure

```
apps/api/
├── prisma/              # Database layer
│   ├── schema.prisma    # Database schema
│   ├── migrations/      # Database migrations
│   └── seeds/           # Seed data
├── src/
│   ├── app.ts           # Express app setup
│   ├── server.ts        # Server entry point
│   ├── config/          # Configuration
│   │   ├── env.ts       # Environment variables
│   │   └── minio.ts     # MinIO configuration
│   ├── lib/             # Core libraries
│   │   ├── prisma.ts    # Prisma client
│   │   ├── jwt.ts       # JWT utilities
│   │   └── logger.ts    # Winston logger
│   ├── middleware/      # Express middleware
│   │   ├── authenticate.ts      # JWT authentication
│   │   ├── authorize.ts         # Role-based authorization
│   │   ├── assertBranchAccess.ts # Branch access control
│   │   ├── validate.ts          # Zod validation
│   │   ├── errorHandler.ts      # Global error handler
│   │   └── upload.ts            # File upload (multer)
│   ├── modules/         # Feature modules
│   │   ├── auth/        # Authentication
│   │   ├── users/       # User management
│   │   ├── branches/    # Branch management
│   │   ├── members/     # Member management
│   │   ├── packages/    # Package management
│   │   ├── sessions/    # Therapy sessions
│   │   ├── invoices/    # Invoice management
│   │   ├── inventory/   # Inventory management
│   │   ├── dashboard/   # Dashboard analytics
│   │   ├── admin/       # Admin operations
│   │   ├── audit/       # Audit logs
│   │   ├── referrals/   # Referral system
│   │   ├── diagnosis/   # Diagnosis management
│   │   ├── me/          # Current user profile
│   │   └── uploads/     # File uploads
│   └── utils/           # Utility functions
│       ├── response.ts  # API response helpers
│       ├── auditLog.ts  # Audit logging
│       ├── codeGenerator.ts # Code generation
│       └── invoiceGenerator.ts # Invoice generation
└── scripts/             # Utility scripts
    └── sync-payment-proofs.ts # Sync payment proofs
```

---

### Module Architecture

Setiap module mengikuti struktur yang konsisten:

```
modules/[module-name]/
├── [module].controller.ts  # HTTP request handlers
├── [module].service.ts     # Business logic orchestrator
├── [module].routes.ts      # Route definitions
├── [module].schema.ts      # Zod validation schemas
└── services/               # Sub-services (optional)
    ├── [feature-1].service.ts
    ├── [feature-2].service.ts
    └── README.md
```

**Example: packages module**
```
modules/packages/
├── packages.controller.ts  # HTTP handlers
├── packages.service.ts     # Main orchestrator
├── packages.routes.ts      # Routes
├── packages.schema.ts      # Validation
└── services/
    ├── package-assignment.service.ts  # Assign packages
    ├── package-edit.service.ts        # Edit packages
    ├── package-refund.service.ts      # Refund packages
    ├── package-cancel.service.ts      # Cancel packages
    ├── package-retrieval.service.ts   # Get packages
    ├── package-verification.service.ts # Verify payments
    ├── payment-proof.service.ts       # Payment proofs
    └── README.md
```

---

### Backend Services (29 Services)

#### **1. Auth Module** (1 service)
- `auth.service.ts` - Login, logout, token refresh

#### **2. Users Module** (1 service)
- `users.service.ts` - User CRUD, profile management

#### **3. Branches Module** (1 service)
- `branches.service.ts` - Branch CRUD, staff assignment

#### **4. Members Module** (3 services)
- `member-creation.service.ts` - Create members
- `member-retrieval.service.ts` - Get members
- `member-update.service.ts` - Update members

#### **5. Packages Module** (8 services)
- `package-assignment.service.ts` - Assign packages to members
- `package-edit.service.ts` - Edit pending packages
- `package-refund.service.ts` - Refund active packages
- `package-cancel.service.ts` - Cancel pending packages
- `package-retrieval.service.ts` - Get package data
- `package-verification.service.ts` - Verify payments
- `payment-proof.service.ts` - Upload/view payment proofs
- `package-pricing.service.ts` - Package pricing management

#### **6. Sessions Module** (6 services)
- `session-creation.service.ts` - Create therapy sessions
- `session-retrieval.service.ts` - Get session data
- `session-export.service.ts` - Export session data
- `therapy-plan.service.ts` - Therapy plan management
- `vital-signs.service.ts` - Vital signs recording
- `infusion.service.ts` - Infusion execution

#### **7. Invoices Module** (2 services)
- `invoice-creation.service.ts` - Create invoices
- `invoice-retrieval.service.ts` - Get invoice data

#### **8. Inventory Module** (2 services)
- `inventory-items.service.ts` - Inventory CRUD
- `stock-mutations.service.ts` - Stock tracking

#### **9. Dashboard Module** (1 service)
- `dashboard.service.ts` - Analytics and statistics

#### **10. Admin Module** (7 services)
- `user-management.service.ts` - User management
- `branch-performance.service.ts` - Branch analytics
- `system-stats.service.ts` - System statistics
- `audit-logs.service.ts` - Audit log retrieval
- `master-product-admin.service.ts` - Master products
- `package-pricing-admin.service.ts` - Package pricing
- `non-therapy-product-admin.service.ts` - Non-therapy products
- `master-types-admin.service.ts` - Master types (booster, service)

#### **11. Referrals Module** (1 service)
- `referrals.service.ts` - Referral code management, incentive calculation

#### **12. Diagnosis Module** (1 service)
- `diagnosis.service.ts` - Diagnosis CRUD

#### **13. Me Module** (1 service)
- `me.service.ts` - Current user profile

#### **14. Audit Module** (1 service)
- `audit.controller.ts` - Audit log retrieval (direct controller)

#### **15. Uploads Module** (1 service)
- File upload handling (payment proofs, photos, documents)

---

### API Response Format

Semua API response menggunakan format standar:

**Success Response:**
```typescript
{
  success: true,
  data: { ... },
  message: "Operation successful"
}
```

**Error Response:**
```typescript
{
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "Error message",
    details: { ... }
  }
}
```

**Helper Functions:**
- `sendSuccess(res, data, message, statusCode)` - Send success response
- `sendError(res, code, message, statusCode, details)` - Send error response

---

### Authentication & Authorization

#### **JWT Authentication**
- Access Token: 15 minutes
- Refresh Token: 7 days
- Stored in HTTP-only cookies

#### **Role-Based Authorization**
```typescript
enum Role {
  SUPER_ADMIN      // Full system access
  ADMIN_MANAGER    // Multi-branch management
  ADMIN_LAYANAN    // Branch operations
  DOCTOR           // Medical operations
  NURSE            // Treatment execution
  MEMBER           // Patient portal
}
```

#### **Middleware**
- `authenticate` - Verify JWT token
- `authorize([roles])` - Check user role
- `assertBranchAccess` - Verify branch access

---

### Audit Logging

Semua operasi penting di-log ke `AuditLog` table:

**Actions:**
- CREATE, UPDATE, DELETE - Data operations
- LOGIN, LOGOUT - Authentication
- READ - Sensitive data access

**Logged Data:**
- userId - Who performed the action
- branchId - Where it happened
- action - What action
- resource - What resource (User, Member, Package, etc)
- resourceId - Which specific record
- meta - Additional metadata (JSON)
- ipAddress, userAgent - Request info
- createdAt - When it happened

**Helper Function:**
```typescript
await logAudit({
  userId: user.id,
  branchId: branch.id,
  action: 'CREATE',
  resource: 'MemberPackage',
  resourceId: package.id,
  meta: { packageType, finalPrice }
});
```

---

### File Storage (MinIO)

**Configuration:**
- S3-compatible object storage
- Buckets: `payment-proofs`, `session-photos`, `member-documents`

**Supported Files:**
- Payment proofs (JPG, PNG, PDF)
- Session photos (JPG, PNG)
- Member documents (PDF, JPG, PNG)

**Upload Flow:**
1. Client uploads file via multipart/form-data
2. Multer middleware processes upload
3. File saved to MinIO
4. URL stored in database
5. File accessible via signed URL

---

### Error Handling

**Global Error Handler:**
- Catches all errors
- Logs to Winston
- Returns formatted error response
- Handles Prisma errors, validation errors, JWT errors

**Error Types:**
- `ValidationError` - Zod validation failed
- `AuthenticationError` - JWT invalid/expired
- `AuthorizationError` - Insufficient permissions
- `NotFoundError` - Resource not found
- `BusinessLogicError` - Business rule violation
- `DatabaseError` - Prisma/database error

---

### Validation (Zod)

Semua input di-validate menggunakan Zod schemas:

**Example:**
```typescript
const assignPackageSchema = z.object({
  memberId: z.string().cuid(),
  packageType: z.enum(['BASIC', 'BOOSTER']),
  totalSessions: z.number().int().positive(),
  finalPrice: z.number().positive(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
});
```

**Middleware:**
```typescript
router.post('/packages', 
  authenticate,
  authorize(['ADMIN_LAYANAN']),
  validate(assignPackageSchema),
  packagesController.assignPackage
);
```

---

### Database Migrations

**Location**: `apps/api/prisma/migrations/`

**Migration History:**
1. `20260427101310_init_schema` - Initial schema
2. `20260427172352_add_staff_branch_multi_branch` - Multi-branch support
3. `20260427175010_increase_decimal_precision_for_stock` - Stock precision
4. `20260428031308_add_multiple_doctors_nurses_per_session` - Multiple staff per session
5. `20260428050629_add_pusat_branch_type` - PUSAT branch type
6. `20260429083851_add_referral_incentive_system` - Referral system
7. `20260429093500_move_incentive_to_member` - Move incentive to member
8. `20260504033954_add_login_logout_audit_actions` - Audit actions
9. `20260504040242_add_branch_to_audit_log` - Branch in audit log
10. `20260505095918_add_rokok_kenkou_addon_type` - ROKOK_KENKOU add-on

**Commands:**
```bash
# Create migration
npm run db:migrate:dev

# Apply migrations
npm run db:migrate:deploy

# Reset database
npm run db:reset
```

---

### Performance Optimizations

#### **Database Indexes**
- Primary keys (CUID)
- Foreign keys
- Frequently queried fields (status, dates, codes)
- Composite indexes untuk complex queries

#### **Query Optimization**
- Use `select` untuk limit fields
- Use `include` dengan selective relations
- Pagination untuk large datasets
- Caching untuk frequently accessed data

#### **Connection Pooling**
- Prisma connection pool
- Max connections: 10 (configurable)

---

### Security Features

✅ **Authentication**: JWT with refresh tokens  
✅ **Authorization**: Role-based access control  
✅ **Branch Access Control**: Multi-branch isolation  
✅ **Input Validation**: Zod schemas  
✅ **SQL Injection Prevention**: Prisma ORM  
✅ **XSS Prevention**: Input sanitization  
✅ **CORS**: Configured for frontend origin  
✅ **Rate Limiting**: (TODO)  
✅ **Audit Logging**: All operations logged  
✅ **Password Hashing**: bcrypt  
✅ **File Upload Validation**: Type and size limits  

---

### API Endpoints Summary

**Total Endpoints**: 100+ endpoints across 15 modules

**Main Endpoint Groups:**
- `/api/v1/auth` - Authentication (3 endpoints)
- `/api/v1/users` - User management (5 endpoints)
- `/api/v1/branches` - Branch management (6 endpoints)
- `/api/v1/members` - Member management (8 endpoints)
- `/api/v1/packages` - Package management (12 endpoints)
- `/api/v1/sessions` - Therapy sessions (15 endpoints)
- `/api/v1/invoices` - Invoice management (8 endpoints)
- `/api/v1/inventory` - Inventory management (10 endpoints)
- `/api/v1/dashboard` - Dashboard analytics (5 endpoints)
- `/api/v1/admin` - Admin operations (20 endpoints)
- `/api/v1/audit` - Audit logs (2 endpoints)
- `/api/v1/referrals` - Referral system (5 endpoints)
- `/api/v1/diagnosis` - Diagnosis management (4 endpoints)
- `/api/v1/me` - Current user (3 endpoints)
- `/api/v1/uploads` - File uploads (3 endpoints)

---

### Testing Strategy

**Unit Tests**: (TODO)
- Service layer tests
- Utility function tests

**Integration Tests**: (TODO)
- API endpoint tests
- Database integration tests

**E2E Tests**: (TODO)
- Full workflow tests

**Manual Testing**:
- Postman collections
- Test accounts from seeds

---

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - Refresh token secret
- `MINIO_ENDPOINT` - MinIO endpoint
- `MINIO_ACCESS_KEY` - MinIO access key
- `MINIO_SECRET_KEY` - MinIO secret key
- `MINIO_BUCKET` - MinIO bucket name
- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment (development, production)

**Optional:**
- `CORS_ORIGIN` - CORS allowed origin
- `LOG_LEVEL` - Winston log level

---

### Dependencies

**Core:**
- `express` - Web framework
- `@prisma/client` - Database ORM
- `typescript` - Type safety
- `zod` - Validation
- `bcrypt` - Password hashing
- `jsonwebtoken` - JWT authentication
- `winston` - Logging
- `multer` - File uploads
- `minio` - Object storage

**Dev:**
- `tsx` - TypeScript execution
- `prisma` - Database toolkit
- `@types/*` - TypeScript types

---

## 📈 System Statistics

**Database:**
- 25+ tables
- 15+ enums
- 10 migrations
- 100+ indexes

**Backend:**
- 15 modules
- 29 services
- 100+ API endpoints
- 15 seed modules

**Code Quality:**
- TypeScript strict mode
- Zod validation on all inputs
- Comprehensive error handling
- Audit logging on all operations

---

## 🔄 Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Setup database
npm run db:migrate:dev
npm run db:seed

# Start development server
npm run dev
```

### Database Changes

```bash
# 1. Update schema.prisma
# 2. Create migration
npm run db:migrate:dev --name migration_name

# 3. Update seed if needed
# 4. Test migration
npm run db:reset
```

### Adding New Feature

1. Create module folder in `src/modules/[feature]`
2. Create controller, service, routes, schema files
3. Add routes to `app.ts`
4. Add validation schemas
5. Add audit logging
6. Test endpoints
7. Update documentation

---

## 📚 Additional Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **Express Docs**: https://expressjs.com
- **Zod Docs**: https://zod.dev
- **MinIO Docs**: https://min.io/docs

---

**Last Updated**: 2026-05-07  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
