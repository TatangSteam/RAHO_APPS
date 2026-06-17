# UML Aplikasi RAHO ERP Management System

Dokumen ini berisi kumpulan UML aplikasi RAHO ERP dalam format Mermaid agar dapat langsung dirender di Markdown viewer yang mendukung Mermaid, seperti GitHub, GitLab, atau VS Code extension.

Sumber utama penyusunan:

- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.ts`
- `docs/BUSINESS-FLOW.md`
- `docs/API-FILE-STRUCTURE.md`
- `docs/WEB-FILE-STRUCTURE.md`

Tanggal penyusunan: 15 Juni 2026.

## Daftar Isi

1. [Use Case Diagram](#1-use-case-diagram)
2. [Component Diagram](#2-component-diagram)
3. [Class Diagram - Identity dan Cabang](#3-class-diagram---identity-dan-cabang)
4. [Class Diagram - Member, Paket, Invoice, Referral](#4-class-diagram---member-paket-invoice-referral)
5. [Class Diagram - Treatment dan EMR](#5-class-diagram---treatment-dan-emr)
6. [Class Diagram - Inventory dan Procurement](#6-class-diagram---inventory-dan-procurement)
7. [Sequence Diagram - Login dan Protected Request](#7-sequence-diagram---login-dan-protected-request)
8. [Sequence Diagram - Registrasi Member, Paket, dan Pembayaran](#8-sequence-diagram---registrasi-member-paket-dan-pembayaran)
9. [Activity Diagram - Workflow Treatment](#9-activity-diagram---workflow-treatment)
10. [State Diagram - Status Paket](#10-state-diagram---status-paket)
11. [State Diagram - Stock Request dan Shipment](#11-state-diagram---stock-request-dan-shipment)
12. [Sequence Diagram - Stock Request dan Pengiriman](#12-sequence-diagram---stock-request-dan-pengiriman)
13. [Deployment Diagram](#13-deployment-diagram)

## 1. Use Case Diagram

Diagram ini menunjukkan aktor utama dan fitur yang mereka gunakan di aplikasi.

```mermaid
flowchart LR
    SA[Super Admin]
    AM[Admin Manager]
    AC[Admin Cabang]
    AL[Admin Layanan]
    DR[Dokter]
    NR[Perawat]
    MB[Member]

    subgraph SYS[RAHO ERP Management System]
        UC_LOGIN((Login dan logout))
        UC_DASH((Lihat dashboard))
        UC_BRANCH((Kelola cabang))
        UC_MANAGER((Kelola admin manager))
        UC_USER((Kelola user dan staff))
        UC_IMP((Impersonasi user))
        UC_MEMBER((Kelola member))
        UC_ACCESS((Kelola akses multi-cabang))
        UC_PACKAGE((Assign paket dan add-on))
        UC_PAY((Upload dan verifikasi pembayaran))
        UC_INVOICE((Kelola invoice))
        UC_DIAG((Input diagnosis))
        UC_PLAN((Buat dan edit therapy plan))
        UC_SESSION((Kelola sesi treatment))
        UC_VITAL((Catat vital sign))
        UC_INFUSION((Catat eksekusi infus))
        UC_MATERIAL((Catat material usage))
        UC_PHOTO((Upload foto sesi dan dokumen))
        UC_EVAL((Input evaluasi dokter))
        UC_INV((Kelola inventory))
        UC_STOCK_REQ((Stock request))
        UC_SHIP((Shipment dan penerimaan stok))
        UC_REF((Kelola referral dan insentif))
        UC_AUDIT((Lihat audit log))
        UC_PORTAL((Portal member))
        UC_CHAT((Chat dan notifikasi))
    end

    SA --> UC_LOGIN
    SA --> UC_DASH
    SA --> UC_BRANCH
    SA --> UC_MANAGER
    SA --> UC_USER
    SA --> UC_IMP
    SA --> UC_INV
    SA --> UC_SHIP
    SA --> UC_REF
    SA --> UC_AUDIT

    AM --> UC_LOGIN
    AM --> UC_DASH
    AM --> UC_BRANCH
    AM --> UC_USER
    AM --> UC_ACCESS
    AM --> UC_INV
    AM --> UC_STOCK_REQ
    AM --> UC_SHIP
    AM --> UC_AUDIT

    AC --> UC_LOGIN
    AC --> UC_DASH
    AC --> UC_USER
    AC --> UC_INV
    AC --> UC_STOCK_REQ
    AC --> UC_PAY

    AL --> UC_LOGIN
    AL --> UC_DASH
    AL --> UC_MEMBER
    AL --> UC_PACKAGE
    AL --> UC_PAY
    AL --> UC_INVOICE
    AL --> UC_SESSION
    AL --> UC_PHOTO
    AL --> UC_REF

    DR --> UC_LOGIN
    DR --> UC_DASH
    DR --> UC_DIAG
    DR --> UC_PLAN
    DR --> UC_EVAL
    DR --> UC_SESSION

    NR --> UC_LOGIN
    NR --> UC_DASH
    NR --> UC_VITAL
    NR --> UC_INFUSION
    NR --> UC_MATERIAL
    NR --> UC_PHOTO
    NR --> UC_SESSION

    MB --> UC_LOGIN
    MB --> UC_PORTAL
    MB --> UC_PAY
    MB --> UC_INVOICE
    MB --> UC_CHAT
```

## 2. Component Diagram

Diagram ini menggambarkan komponen runtime utama dari frontend, API, modul bisnis, dan data layer.

```mermaid
flowchart TB
    subgraph CLIENT[Client Layer]
        BROWSER[Browser]
        STAFF_WEB[Staff Web App<br/>Next.js 14 App Router]
        MEMBER_WEB[Member Portal<br/>Next.js 14 App Router]
    end

    subgraph WEB[Frontend Application]
        WEB_MW[Next.js middleware<br/>auth redirect]
        STORE[Zustand auth store]
        API_CLIENT[Axios API clients<br/>src/lib API wrappers]
        UI[React pages and components]
    end

    subgraph API[Express API]
        APP[app.ts]
        SECURITY[Helmet, CORS, compression, rate limit]
        AUTH_MW[authenticate JWT]
        ROLE_MW[authorize roles]
        BRANCH_MW[assertBranchAccess]
        VALIDATE[Zod validation]
        UPLOAD[Multer upload middleware]
        ERR[Global error handler]
    end

    subgraph ROUTES[Route Modules]
        R_AUTH[/auth/]
        R_DASH[/dashboard/]
        R_USERS[/users/]
        R_ADMIN[/admin and audit/]
        R_BRANCH[/branches/]
        R_MEMBER[/members and me/]
        R_PACKAGE[/packages/]
        R_SESSION[/treatment-sessions/]
        R_DIAG[/diagnosis/]
        R_INV[/inventory/]
        R_INVOICE[/invoices/]
        R_REF[/referrals/]
        R_FILE[/files/]
    end

    subgraph SERVICES[Service Layer]
        S_AUTH[Auth service]
        S_MEMBER[Member services]
        S_PACKAGE[Package services]
        S_SESSION[Session services]
        S_INV[Inventory services]
        S_INVOICE[Invoice services]
        S_ADMIN[Admin services]
        S_FILE[File service]
        S_AUDIT[Audit log utility]
    end

    subgraph DATA[Data Layer]
        PRISMA[Prisma Client]
        PG[(PostgreSQL)]
        MINIO[(MinIO object storage)]
    end

    BROWSER --> STAFF_WEB
    BROWSER --> MEMBER_WEB
    STAFF_WEB --> WEB_MW
    MEMBER_WEB --> WEB_MW
    WEB_MW --> UI
    UI --> STORE
    UI --> API_CLIENT
    API_CLIENT --> APP

    APP --> SECURITY
    SECURITY --> AUTH_MW
    AUTH_MW --> ROLE_MW
    ROLE_MW --> BRANCH_MW
    BRANCH_MW --> VALIDATE
    VALIDATE --> ROUTES
    UPLOAD --> ROUTES
    ROUTES --> SERVICES
    SERVICES --> PRISMA
    SERVICES --> MINIO
    SERVICES --> S_AUDIT
    PRISMA --> PG
    APP --> ERR
```

## 3. Class Diagram - Identity dan Cabang

```mermaid
classDiagram
    direction LR

    class User {
        +String id
        +String email
        +String password
        +Role role
        +String staffCode
        +String branchId
        +Boolean isActive
        +DateTime lastLoginAt
    }

    class UserProfile {
        +String id
        +String userId
        +String fullName
        +String phone
        +String avatarUrl
    }

    class Branch {
        +String id
        +String branchCode
        +String name
        +String address
        +String city
        +String phone
        +BranchType type
        +Boolean isActive
    }

    class ManagerBranch {
        +String id
        +String userId
        +String branchId
    }

    class StaffBranch {
        +String id
        +String userId
        +String branchId
    }

    class AuditLog {
        +String id
        +String userId
        +String branchId
        +AuditAction action
        +String resource
        +String resourceId
        +Json meta
        +DateTime createdAt
    }

    class Notification {
        +String id
        +String userId
        +NotificationType type
        +String title
        +String body
        +NotificationStatus status
    }

    User "1" --> "0..1" UserProfile : profile
    Branch "1" --> "0..*" User : home branch
    User "1" --> "0..*" ManagerBranch : manages
    Branch "1" --> "0..*" ManagerBranch : assigned manager
    User "1" --> "0..*" StaffBranch : assigned staff
    Branch "1" --> "0..*" StaffBranch : staff pool
    User "1" --> "0..*" AuditLog : writes
    Branch "0..1" --> "0..*" AuditLog : scope
    User "1" --> "0..*" Notification : receives
```

## 4. Class Diagram - Member, Paket, Invoice, Referral

```mermaid
classDiagram
    direction LR

    class Member {
        +String id
        +String userId
        +String memberNo
        +String registrationBranchId
        +String referralCodeId
        +Int voucherCount
        +String nik
        +Gender jenisKelamin
        +Boolean isActive
    }

    class MemberDocument {
        +String id
        +String memberId
        +DocumentType documentType
        +String fileUrl
        +String fileName
        +Int fileSize
    }

    class BranchMemberAccess {
        +String id
        +String memberId
        +String branchId
        +String grantedBy
        +String notes
    }

    class PackagePricing {
        +String id
        +String branchId
        +PackageType packageType
        +String boosterType
        +String serviceType
        +String productCode
        +String name
        +Int totalSessions
        +Decimal price
    }

    class MemberPackage {
        +String id
        +String packageCode
        +String memberId
        +String branchId
        +PackageType packageType
        +Int totalSessions
        +Int usedSessions
        +Decimal finalPrice
        +PackageStatus status
        +String purchaseGroupId
        +String paymentProofUrl
        +DateTime activatedAt
    }

    class MemberAddOn {
        +String id
        +String addOnCode
        +String memberId
        +String branchId
        +AddOnType addOnType
        +Int quantity
        +Decimal totalPrice
        +PackageStatus status
    }

    class NonTherapyProduct {
        +String id
        +String productCode
        +ProductType productType
        +String name
        +Decimal pricePerUnit
    }

    class MemberNonTherapyPurchase {
        +String id
        +String purchaseCode
        +String memberId
        +String productId
        +Int quantity
        +Decimal totalPrice
        +PackageStatus status
    }

    class Invoice {
        +String id
        +String invoiceNumber
        +String memberId
        +String branchId
        +Decimal subtotal
        +Decimal totalAmount
        +InvoiceStatus status
        +PaymentMethod paymentMethod
    }

    class InvoiceItem {
        +String id
        +String invoiceId
        +String itemType
        +String itemId
        +String description
        +Int quantity
        +Decimal totalAmount
    }

    class InvoicePayment {
        +String id
        +String invoiceId
        +Decimal amount
        +PaymentMethod paymentMethod
        +String proofFileUrl
        +String receivedBy
    }

    class ReferralCode {
        +String id
        +String code
        +String referrerName
        +ReferrerType referrerType
        +String branchId
        +Int totalReferrals
        +Decimal totalIncentiveEarned
    }

    class ReferralIncentiveRecord {
        +String id
        +String referralCodeId
        +String memberId
        +String memberPackageId
        +Boolean isFirstPackage
        +IncentiveType incentiveType
        +Decimal incentiveAmount
    }

    User "1" --> "0..1" Member : member account
    Branch "1" --> "0..*" Member : registration branch
    Member "1" --> "0..*" MemberDocument : documents
    Member "1" --> "0..*" BranchMemberAccess : branch access
    Branch "1" --> "0..*" BranchMemberAccess : grants access
    Branch "0..1" --> "0..*" PackagePricing : pricing
    Member "1" --> "0..*" MemberPackage : packages
    Branch "1" --> "0..*" MemberPackage : sold at
    PackagePricing "0..1" --> "0..*" MemberPackage : selected price
    MemberPackage "1" --> "0..*" MemberAddOn : bundled add-ons
    Member "1" --> "0..*" MemberAddOn : add-ons
    NonTherapyProduct "1" --> "0..*" MemberNonTherapyPurchase : purchased product
    Member "1" --> "0..*" MemberNonTherapyPurchase : purchases
    Member "1" --> "0..*" Invoice : billed
    Branch "1" --> "0..*" Invoice : issued at
    Invoice "1" --> "1..*" InvoiceItem : line items
    Invoice "1" --> "0..*" InvoicePayment : payments
    Branch "1" --> "0..*" ReferralCode : referral source
    ReferralCode "1" --> "0..*" Member : referred members
    ReferralCode "1" --> "0..*" ReferralIncentiveRecord : incentives
    MemberPackage "1" --> "0..*" ReferralIncentiveRecord : package incentive
```

## 5. Class Diagram - Treatment dan EMR

```mermaid
classDiagram
    direction LR

    class Encounter {
        +String id
        +String encounterCode
        +String memberId
        +String branchId
        +String memberPackageId
        +String adminLayananId
        +String doctorId
        +String nurseId
        +EncounterStatus status
    }

    class TreatmentSession {
        +String id
        +String sessionCode
        +String encounterId
        +Int infusKe
        +SessionType pelaksanaan
        +DateTime treatmentDate
        +Boolean isCompleted
        +String boosterType
    }

    class SessionDoctor {
        +String id
        +String sessionId
        +String doctorId
        +Boolean isPrimary
    }

    class SessionNurse {
        +String id
        +String sessionId
        +String nurseId
        +Boolean isPrimary
    }

    class Diagnosis {
        +String id
        +String diagnosisCode
        +String memberId
        +String encounterId
        +String diagnosa
        +DiagnosisCategory kategoriDiagnosa
        +String icdPrimer
        +String icdSekunder
        +String icdTersier
    }

    class TherapyPlan {
        +String id
        +String planCode
        +String memberId
        +String treatmentSessionId
        +String keterangan
        +Decimal ifa250
        +Decimal ifa500
        +Decimal hho
        +Decimal h2
        +Decimal no
        +Decimal o3
        +Decimal edta
        +Decimal mb
        +Decimal h2s
        +Decimal kcl
        +Int version
        +String supersededById
    }

    class VitalSign {
        +String id
        +String treatmentSessionId
        +VitalType pencatatan
        +VitalTiming waktuCatat
        +Decimal value
        +String unit
        +String recordedBy
    }

    class InfusionExecution {
        +String id
        +String treatmentSessionId
        +Decimal ifa250
        +Decimal ifa500
        +Decimal hho
        +Decimal h2
        +Decimal no
        +Decimal o3
        +Decimal edta
        +Decimal mb
        +Decimal h2s
        +Decimal kcl
        +BottleType bottleType
        +String deviationNotes
    }

    class MaterialUsage {
        +String id
        +String treatmentSessionId
        +String inventoryItemId
        +Decimal quantity
        +String unit
        +String recordedBy
    }

    class SessionPhoto {
        +String id
        +String treatmentSessionId
        +String fileUrl
        +String fileName
        +String uploadedBy
    }

    class EMRNote {
        +String id
        +String treatmentSessionId
        +EMRNoteType noteType
        +String content
        +String writtenBy
    }

    class DoctorEvaluation {
        +String id
        +String evaluationCode
        +String treatmentSessionId
        +String subjective
        +String objective
        +String assessment
        +String plan
        +String writtenBy
    }

    class DoctorEvaluationHistory {
        +String id
        +String evaluationId
        +String fieldName
        +String oldValue
        +String newValue
        +String changedBy
    }

    Member "1" --> "0..*" Encounter : encounters
    Branch "1" --> "0..*" Encounter : branch
    MemberPackage "1" --> "0..*" Encounter : basic package
    Encounter "1" --> "0..*" Diagnosis : diagnoses
    Encounter "1" --> "1..*" TreatmentSession : sessions
    Member "1" --> "0..*" Diagnosis : direct diagnoses
    Member "1" --> "0..*" TherapyPlan : prepared plans
    TreatmentSession "1" --> "0..1" TherapyPlan : active plan
    TherapyPlan "0..1" --> "0..*" TherapyPlan : supersedes
    TreatmentSession "1" --> "0..*" VitalSign : before and after
    TreatmentSession "1" --> "0..1" InfusionExecution : infusion
    TreatmentSession "1" --> "0..*" MaterialUsage : materials
    TreatmentSession "1" --> "0..1" SessionPhoto : photo
    TreatmentSession "1" --> "0..*" EMRNote : notes
    TreatmentSession "1" --> "0..1" DoctorEvaluation : evaluation
    DoctorEvaluation "1" --> "0..*" DoctorEvaluationHistory : changes
    TreatmentSession "1" --> "0..*" SessionDoctor : doctors
    TreatmentSession "1" --> "0..*" SessionNurse : nurses
    User "1" --> "0..*" SessionDoctor : doctor staff
    User "1" --> "0..*" SessionNurse : nurse staff
    InventoryItem "1" --> "0..*" MaterialUsage : used stock
```

## 6. Class Diagram - Inventory dan Procurement

```mermaid
classDiagram
    direction LR

    class MasterProduct {
        +String id
        +String sku
        +String name
        +ProductCategory category
        +String baseUnit
        +String usageUnit
        +Decimal conversionFactor
        +Boolean isAutoUsedPerSession
        +Boolean isAutoAddedToBranch
    }

    class InventoryItem {
        +String id
        +String masterProductId
        +String branchId
        +Decimal stock
        +Decimal minThreshold
        +String storageLocation
    }

    class StockMutation {
        +String id
        +String inventoryItemId
        +StockMutationType type
        +Decimal quantity
        +Decimal stockBefore
        +Decimal stockAfter
        +String referenceType
        +String referenceId
        +String createdBy
    }

    class StockRequest {
        +String id
        +String requestCode
        +String branchId
        +String requestedBy
        +StockRequestStatus status
        +String reviewedBy
        +String paymentProofUrl
        +String paymentVerifiedBy
        +String shippedBy
        +String receivedBy
    }

    class StockRequestItem {
        +String id
        +String stockRequestId
        +String inventoryItemId
        +String masterProductId
        +Decimal requestedQty
        +Decimal approvedQty
        +Decimal overstockDeducted
        +Decimal finalQty
    }

    class Shipment {
        +String id
        +String shipmentCode
        +String stockRequestId
        +String fromBranchId
        +String toBranchId
        +ShipmentStatus status
        +String shipmentPhotoUrl
        +String shippedBy
        +String receivedBy
        +String approvedBy
    }

    class ShipmentItem {
        +String id
        +String shipmentId
        +String masterProductId
        +Decimal sentQty
        +Decimal receivedQty
        +Decimal requestedQty
        +Decimal overstockQty
    }

    class StockRequestInvoice {
        +String id
        +String invoiceNumber
        +String stockRequestId
        +String branchId
        +Decimal subtotal
        +Decimal totalAmount
        +InvoiceStatus status
        +PaymentVerificationStatus paymentVerificationStatus
    }

    class StockRequestInvoiceItem {
        +String id
        +String invoiceId
        +String masterProductId
        +String sku
        +String productName
        +Decimal quantity
        +Decimal pricePerUnit
    }

    class ShipmentDiscrepancy {
        +String id
        +String shipmentId
        +String masterProductId
        +Decimal expectedQty
        +Decimal receivedQty
        +DiscrepancyType discrepancyType
        +String photoUrl
        +String reportedBy
    }

    class BranchOverstock {
        +String id
        +String branchId
        +String masterProductId
        +Decimal quantity
        +Decimal originalQty
        +String sourceShipmentId
        +OverstockStatus status
    }

    class OverstockUsage {
        +String id
        +String overstockId
        +String stockRequestId
        +String stockRequestItemId
        +Decimal quantityUsed
    }

    Branch "1" --> "0..*" InventoryItem : stocks
    MasterProduct "1" --> "0..*" InventoryItem : per branch item
    InventoryItem "1" --> "0..*" StockMutation : stock ledger
    Branch "1" --> "0..*" StockRequest : requests
    StockRequest "1" --> "1..*" StockRequestItem : requested items
    MasterProduct "1" --> "0..*" StockRequestItem : product
    InventoryItem "0..1" --> "0..*" StockRequestItem : existing stock
    StockRequest "1" --> "0..1" StockRequestInvoice : partnership invoice
    StockRequestInvoice "1" --> "1..*" StockRequestInvoiceItem : invoice items
    StockRequest "1" --> "0..1" Shipment : shipment
    Shipment "1" --> "1..*" ShipmentItem : shipped items
    Shipment "1" --> "0..*" ShipmentDiscrepancy : discrepancies
    MasterProduct "1" --> "0..*" ShipmentItem : product
    MasterProduct "1" --> "0..*" ShipmentDiscrepancy : product
    Branch "1" --> "0..*" BranchOverstock : excess stock
    MasterProduct "1" --> "0..*" BranchOverstock : product
    Shipment "1" --> "0..*" BranchOverstock : source
    BranchOverstock "1" --> "0..*" OverstockUsage : consumed by request
    StockRequest "1" --> "0..*" OverstockUsage : uses overstock
    StockRequestItem "1" --> "0..*" OverstockUsage : item allocation
```

## 7. Sequence Diagram - Login dan Protected Request

```mermaid
sequenceDiagram
    autonumber
    actor Pengguna
    participant WEB as Next.js Web
    participant API as Express API
    participant AUTH as AuthService
    participant JWT as JWT Utility
    participant DB as PostgreSQL via Prisma
    participant AUD as AuditLog

    Pengguna->>WEB: Input email dan password
    WEB->>API: POST /api/auth/login
    API->>AUTH: validate credential
    AUTH->>DB: find user by email
    DB-->>AUTH: user + profile + role
    AUTH->>AUTH: compare bcrypt password
    alt credential invalid
        AUTH->>AUD: record FAILED_LOGIN
        AUTH-->>API: 401 invalid credentials
        API-->>WEB: error response
        WEB-->>Pengguna: tampilkan pesan gagal login
    else credential valid
        AUTH->>JWT: generate access token
        AUTH->>DB: update lastLoginAt
        AUTH->>AUD: record LOGIN
        AUTH-->>API: token + user profile
        API-->>WEB: 200 login success
        WEB->>WEB: simpan session dan redirect sesuai role
        WEB-->>Pengguna: dashboard role aktif
    end

    Pengguna->>WEB: Buka halaman terlindungi
    WEB->>API: Request API dengan Authorization Bearer token
    API->>JWT: verify token
    alt token invalid atau expired
        API-->>WEB: 401 Unauthorized
        WEB-->>Pengguna: redirect login
    else token valid
        API->>API: authorize role
        API->>API: assert branch access jika perlu
        API->>DB: query data sesuai scope user
        DB-->>API: result
        API-->>WEB: 200 JSON
        WEB-->>Pengguna: tampilkan data
    end
```

## 8. Sequence Diagram - Registrasi Member, Paket, dan Pembayaran

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin Layanan
    participant WEB as Staff Web App
    participant MEM as Members API
    participant PKG as Packages API
    participant INV as Invoices API
    participant FILE as File Service / MinIO
    participant DB as PostgreSQL via Prisma
    participant AUD as Audit Log

    Admin->>WEB: Input data member baru
    WEB->>MEM: POST /api/members
    MEM->>DB: transaction create User, UserProfile, Member
    MEM->>DB: create BranchMemberAccess
    MEM->>AUD: record CREATE member
    DB-->>MEM: memberNo dan member detail
    MEM-->>WEB: 201 member created

    Admin->>WEB: Assign paket, add-on, diskon, bukti bayar
    opt Upload bukti bayar
        WEB->>FILE: upload payment proof
        FILE->>FILE: store object in MinIO
        FILE-->>WEB: fileUrl
    end
    WEB->>PKG: POST assign package
    PKG->>DB: transaction create MemberPackage dan MemberAddOn
    PKG->>INV: generate invoice jika diperlukan
    INV->>DB: create Invoice dan InvoiceItem
    PKG->>AUD: record CREATE package
    PKG-->>WEB: package PENDING_PAYMENT atau WAITING_VERIFICATION

    Admin->>WEB: Verifikasi pembayaran
    WEB->>PKG: PATCH verify payment
    PKG->>DB: transaction update package status ACTIVE
    PKG->>DB: update paidAt, verifiedAt, activatedAt
    opt Member punya referral
        PKG->>DB: create ReferralIncentiveRecord
        PKG->>DB: update ReferralCode statistics
    end
    PKG->>INV: update invoice payment status
    INV->>DB: create InvoicePayment
    PKG->>AUD: record VERIFY payment
    PKG-->>WEB: payment verified
    WEB-->>Admin: paket aktif dan siap digunakan
```

## 9. Activity Diagram - Workflow Treatment

Workflow treatment menggunakan `Encounter` sebagai payung kunjungan dan `TreatmentSession` sebagai sesi infus per pelaksanaan.

```mermaid
flowchart TD
    START([Mulai])
    PICK_MEMBER[Pilih member]
    PICK_PACKAGE[Pilih paket BASIC aktif]
    CREATE_ENC[Create Encounter status ONGOING]
    CREATE_SESSION[Create TreatmentSession]
    ASSIGN_STAFF[Assign admin layanan, dokter, perawat]
    DIAG[Step 1 - Diagnosis dokter]
    PLAN[Step 2 - Therapy plan]
    VITAL_BEFORE[Step 3 - Vital sign sebelum]
    INFUSION[Step 4 - Eksekusi infus]
    MATERIAL[Step 5 - Material usage dan pengurangan stok]
    PHOTO[Step 6 - Upload foto sesi]
    VITAL_AFTER[Step 7 - Vital sign sesudah]
    EVAL[Step 8 - Evaluasi dokter SOAP]
    COMPLETE_SESSION[Set TreatmentSession isCompleted true]
    UPDATE_PACKAGE[Increment usedSessions pada MemberPackage]
    CLOSE_CHECK{Semua sesi paket selesai?}
    CLOSE_ENC[Close Encounter]
    END([Selesai])

    START --> PICK_MEMBER
    PICK_MEMBER --> PICK_PACKAGE
    PICK_PACKAGE --> CREATE_ENC
    CREATE_ENC --> CREATE_SESSION
    CREATE_SESSION --> ASSIGN_STAFF
    ASSIGN_STAFF --> DIAG
    DIAG --> PLAN
    PLAN --> VITAL_BEFORE
    VITAL_BEFORE --> INFUSION
    INFUSION --> MATERIAL
    MATERIAL --> PHOTO
    PHOTO --> VITAL_AFTER
    VITAL_AFTER --> EVAL
    EVAL --> COMPLETE_SESSION
    COMPLETE_SESSION --> UPDATE_PACKAGE
    UPDATE_PACKAGE --> CLOSE_CHECK
    CLOSE_CHECK -- Tidak --> END
    CLOSE_CHECK -- Ya --> CLOSE_ENC
    CLOSE_ENC --> END
```

## 10. State Diagram - Status Paket

```mermaid
stateDiagram-v2
    [*] --> PENDING_PAYMENT: assign package

    PENDING_PAYMENT --> WAITING_VERIFICATION: payment proof uploaded
    WAITING_VERIFICATION --> ACTIVE: payment verified
    PENDING_PAYMENT --> ACTIVE: direct verification
    WAITING_VERIFICATION --> PENDING_PAYMENT: payment rejected

    PENDING_PAYMENT --> CANCELLED: cancel before payment
    WAITING_VERIFICATION --> CANCELLED: cancel request
    ACTIVE --> EXPIRED: all sessions used or validity ended
    ACTIVE --> CANCELLED: refund or administrative cancellation

    CANCELLED --> [*]
    EXPIRED --> [*]
```

## 11. State Diagram - Stock Request dan Shipment

```mermaid
stateDiagram-v2
    [*] --> PENDING: stock request created

    PENDING --> APPROVED: approved for Premier branch
    PENDING --> WAITING_PAYMENT: invoice issued for Partnership branch
    PENDING --> REJECTED: rejected

    WAITING_PAYMENT --> PAYMENT_UPLOADED: branch uploads proof
    PAYMENT_UPLOADED --> PAYMENT_CONFIRMED: manager verifies payment
    PAYMENT_UPLOADED --> WAITING_PAYMENT: payment rejected

    APPROVED --> SHIPPED: shipment sent
    PAYMENT_CONFIRMED --> SHIPPED: shipment sent

    SHIPPED --> COMPLETED: received without issue
    SHIPPED --> COMPLETED_WITH_ISSUE: discrepancy reported

    REJECTED --> [*]
    COMPLETED --> [*]
    COMPLETED_WITH_ISSUE --> [*]
```

## 12. Sequence Diagram - Stock Request dan Pengiriman

```mermaid
sequenceDiagram
    autonumber
    actor Cabang as Admin Cabang
    actor Manager as Admin Manager
    participant WEB as Staff Web App
    participant INV as Inventory API
    participant DB as PostgreSQL via Prisma
    participant FILE as File Service / MinIO
    participant AUD as Audit Log

    Cabang->>WEB: Buat stock request
    WEB->>INV: POST /api/inventory/stock-requests
    INV->>DB: create StockRequest dan StockRequestItem
    INV->>AUD: record CREATE stock request
    INV-->>WEB: request status PENDING

    Manager->>WEB: Review request
    WEB->>INV: PATCH approve or reject
    alt rejected
        INV->>DB: update status REJECTED
        INV->>AUD: record UPDATE rejected
        INV-->>WEB: request rejected
    else approved Premier
        INV->>DB: update status APPROVED
        INV-->>WEB: ready to ship
    else Partnership needs payment
        INV->>DB: create StockRequestInvoice
        INV->>DB: update status WAITING_PAYMENT
        INV-->>WEB: invoice ready
    end

    opt Partnership payment proof
        Cabang->>WEB: Upload bukti pembayaran
        WEB->>FILE: upload proof
        FILE-->>WEB: fileUrl
        WEB->>INV: PATCH upload payment proof
        INV->>DB: update status PAYMENT_UPLOADED
        Manager->>WEB: Verifikasi pembayaran
        WEB->>INV: PATCH verify payment
        INV->>DB: update status PAYMENT_CONFIRMED
    end

    Manager->>WEB: Buat dan kirim shipment
    WEB->>INV: POST shipment / ship
    INV->>DB: create Shipment dan ShipmentItem
    INV->>DB: update StockRequest status SHIPPED
    INV->>AUD: record SHIPPED

    Cabang->>WEB: Terima barang
    WEB->>INV: PATCH receive shipment
    alt sesuai
        INV->>DB: update InventoryItem stock
        INV->>DB: create StockMutation RECEIVED
        INV->>DB: update status COMPLETED
    else ada selisih
        INV->>DB: create ShipmentDiscrepancy
        INV->>DB: create BranchOverstock jika barang lebih
        INV->>DB: update status COMPLETED_WITH_ISSUE
    end
    INV->>AUD: record RECEIVE shipment
    INV-->>WEB: receiving result
```

## 13. Deployment Diagram

```mermaid
flowchart TB
    subgraph INTERNET[Internet]
        USER[Browser pengguna]
    end

    subgraph HOST[Server / Docker Host]
        subgraph NET[Docker network]
            NGINX[Nginx reverse proxy<br/>HTTP/HTTPS]
            FE[fe-app<br/>Next.js 14<br/>port 3000 internal]
            BE[api-server<br/>Express TypeScript<br/>port 4000 internal]
            PG[(PostgreSQL 15<br/>volume pgdata)]
            MN[(MinIO<br/>S3-compatible storage<br/>volume miniodata)]
        end
    end

    USER -->|HTTPS| NGINX
    NGINX -->|web routes| FE
    NGINX -->|API routes /api/*| BE
    FE -->|Axios HTTP| BE
    BE -->|Prisma ORM| PG
    BE -->|S3 SDK| MN
```

## Catatan Implementasi

- Use case dibuat berdasarkan role yang ada di enum `Role`: `SUPER_ADMIN`, `ADMIN_MANAGER`, `ADMIN_CABANG`, `ADMIN_LAYANAN`, `DOCTOR`, `NURSE`, dan `MEMBER`.
- Class diagram disusun dari model aktual pada `schema.prisma`, sehingga nama entity mengikuti database saat ini, misalnya `TreatmentSession`, `Encounter`, `TherapyPlan`, `StockRequest`, dan `BranchOverstock`.
- Mermaid belum menyediakan notasi use case UML native, jadi bagian use case memakai `flowchart` dengan node oval untuk menggambarkan use case.
- Diagram ini dapat dikembangkan menjadi PlantUML bila dibutuhkan untuk dokumentasi formal skripsi, SRS, atau laporan akademik.
