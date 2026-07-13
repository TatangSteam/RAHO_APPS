# RAHO ERD Mermaid

Kode berikut adalah ERD logical dari schema Prisma RAHO. Fokusnya pada relasi utama antar modul: cabang, user/staff, member, paket, invoice, sesi terapi, inventory, homecare, komunikasi, audit, dan dokumen.

```mermaid
erDiagram
  BRANCH {
    string id PK
    string branchCode UK
    string name
    string city
    string type
    boolean isActive
  }

  USER {
    string id PK
    string email UK
    string password
    string role
    string staffCode UK
    string branchId FK
    boolean isActive
  }

  USER_PROFILE {
    string id PK
    string userId FK UK
    string fullName
    string phone
    string avatarUrl
  }

  MANAGER_BRANCH {
    string id PK
    string userId FK
    string branchId FK
  }

  STAFF_BRANCH {
    string id PK
    string userId FK
    string branchId FK
  }

  MEMBER {
    string id PK
    string userId FK UK
    string memberNo UK
    string registrationBranchId FK
    string referralCodeId FK
    string nik UK
    date dateOfBirth
    boolean isConsentToPhoto
    boolean isActive
  }

  BRANCH_MEMBER_ACCESS {
    string id PK
    string memberId FK
    string branchId FK
    string grantedBy
  }

  MEMBER_DOCUMENT {
    string id PK
    string memberId FK
    string documentType
    string fileUrl
    string uploadedBy
  }

  REFERRAL_CODE {
    string id PK
    string branchId FK
    string code UK
    string referrerName
    string referrerType
    boolean isActive
  }

  REFERRAL_INCENTIVE_RECORD {
    string id PK
    string referralCodeId FK
    string memberId FK
    string memberPackageId FK
    decimal incentiveAmount
  }

  PACKAGE_PRICING {
    string id PK
    string branchId FK
    string packageType
    string boosterType
    string serviceType
    string productCode
    int totalSessions
    decimal price
  }

  MEMBER_PACKAGE {
    string id PK
    string packageCode UK
    string memberId FK
    string branchId FK
    string packagePricingId FK
    string packageType
    int totalSessions
    int usedSessions
    decimal finalPrice
    string status
    string assignedBy FK
    string verifiedBy FK
  }

  MEMBER_ADD_ON {
    string id PK
    string addOnCode UK
    string memberId FK
    string branchId FK
    string packageId FK
    string addOnType
    int quantity
    decimal totalPrice
    string status
  }

  NON_THERAPY_PRODUCT {
    string id PK
    string productCode UK
    string productType
    string name
    decimal pricePerUnit
    boolean isActive
  }

  MEMBER_NON_THERAPY_PURCHASE {
    string id PK
    string purchaseCode UK
    string memberId FK
    string branchId FK
    string productId FK
    int quantity
    decimal totalPrice
    string status
  }

  INVOICE {
    string id PK
    string invoiceNumber UK
    string memberId FK
    string branchId FK
    decimal totalAmount
    string status
    string createdBy FK
    string verifiedBy FK
  }

  INVOICE_ITEM {
    string id PK
    string invoiceId FK
    string itemType
    string description
    int quantity
    decimal subtotal
  }

  INVOICE_PAYMENT {
    string id PK
    string invoiceId FK
    decimal amount
    string proofFileUrl
    string receivedBy FK
  }

  ENCOUNTER {
    string id PK
    string encounterCode UK
    string memberId FK
    string branchId FK
    string memberPackageId FK
    string status
  }

  TREATMENT_SESSION {
    string id PK
    string sessionCode UK
    string encounterId FK
    string branchId FK
    string adminLayananId FK
    string doctorId FK
    string nurseId FK
    string boosterPackageId FK
    int infusKe
    int branchInfusKe
    boolean isCompleted
  }

  SESSION_DOCTOR {
    string id PK
    string sessionId FK
    string doctorId FK
  }

  SESSION_NURSE {
    string id PK
    string sessionId FK
    string nurseId FK
  }

  DIAGNOSIS {
    string id PK
    string memberId FK
    string encounterId FK
    string diagnosisCode UK
    string category
  }

  THERAPY_PLAN_SET {
    string id PK
    string memberId FK
    string name
    int version
  }

  THERAPY_PLAN {
    string id PK
    string memberId FK
    string therapyPlanSetId FK
    string treatmentSessionId FK
    int infusKe
  }

  VITAL_SIGN {
    string id PK
    string treatmentSessionId FK
    string vitalType
    string timing
  }

  INFUSION_EXECUTION {
    string id PK
    string treatmentSessionId FK
    string therapyPlanId FK
  }

  MATERIAL_USAGE {
    string id PK
    string treatmentSessionId FK
    string masterProductId FK
    decimal quantity
  }

  SESSION_PHOTO {
    string id PK
    string treatmentSessionId FK UK
    string fileUrl
  }

  SESSION_SUPPORTING_PHOTO {
    string id PK
    string treatmentSessionId FK
    string fileUrl
  }

  EMR_NOTE {
    string id PK
    string treatmentSessionId FK
    string noteType
  }

  DOCTOR_EVALUATION {
    string id PK
    string treatmentSessionId FK UK
    string doctorId FK
  }

  DOCTOR_EVALUATION_HISTORY {
    string id PK
    string doctorEvaluationId FK
    string editedBy FK
  }

  MASTER_PRODUCT {
    string id PK
    string sku UK
    string name
    string category
    string unit
    boolean isActive
  }

  INVENTORY_ITEM {
    string id PK
    string branchId FK
    string masterProductId FK
    decimal stock
    decimal minStock
  }

  STOCK_MUTATION {
    string id PK
    string branchId FK
    string masterProductId FK
    string type
    decimal quantity
  }

  STOCK_REQUEST {
    string id PK
    string requestCode UK
    string branchId FK
    string requestedBy FK
    string status
  }

  STOCK_REQUEST_ITEM {
    string id PK
    string stockRequestId FK
    string masterProductId FK
    decimal requestedQty
    decimal approvedQty
  }

  SHIPMENT {
    string id PK
    string shipmentCode UK
    string fromBranchId FK
    string toBranchId FK
    string status
  }

  SHIPMENT_ITEM {
    string id PK
    string shipmentId FK
    string masterProductId FK
    decimal sentQty
    decimal receivedQty
  }

  SHIPMENT_DISCREPANCY {
    string id PK
    string shipmentId FK
    string masterProductId FK
    decimal expectedQty
    decimal receivedQty
  }

  STOCK_REQUEST_INVOICE {
    string id PK
    string stockRequestId FK UK
    string invoiceNumber UK
    decimal totalAmount
    string status
  }

  STOCK_REQUEST_INVOICE_ITEM {
    string id PK
    string invoiceId FK
    string masterProductId FK
    decimal quantity
    decimal subtotal
  }

  STOCK_REQUEST_INVOICE_PAYMENT {
    string id PK
    string invoiceId FK
    decimal amount
    string uploadedBy
  }

  BRANCH_OVERSTOCK {
    string id PK
    string branchId FK
    string masterProductId FK
    string sourceShipmentId FK
    decimal quantity
    string status
  }

  OVERSTOCK_USAGE {
    string id PK
    string overstockId FK
    string stockRequestId FK
    string stockRequestItemId FK
    decimal quantityUsed
  }

  HOMECARE_TEAM {
    string id PK
    string teamCode UK
    string name
    string branchId FK
  }

  HOMECARE_TEAM_MEMBER {
    string id PK
    string teamId FK
    string userId FK
    string role
    boolean isActive
  }

  HOMECARE_BAG {
    string id PK
    string bagCode UK
    string teamId FK
    string branchId FK
    string status
  }

  HOMECARE_BAG_STOCK {
    string id PK
    string bagId FK
    string masterProductId FK
    decimal stock
  }

  HOMECARE_BAG_STOCK_REQUEST {
    string id PK
    string requestCode UK
    string teamId FK
    string bagId FK
    string branchId FK
    string requestedBy FK
    string status
  }

  HOMECARE_BAG_STOCK_REQUEST_ITEM {
    string id PK
    string requestId FK
    string masterProductId FK
    decimal requestedQty
  }

  HOMECARE_BAG_SHIPMENT {
    string id PK
    string shipmentCode UK
    string requestId FK UK
    string toBagId FK
    string status
  }

  HOMECARE_BAG_SHIPMENT_ITEM {
    string id PK
    string shipmentId FK
    string masterProductId FK
    decimal sentQty
  }

  HOMECARE_BAG_USAGE {
    string id PK
    string usageCode UK
    string bagId FK
    string teamId FK
    string treatmentSessionId FK
    string usedBy FK
  }

  HOMECARE_BAG_USAGE_ITEM {
    string id PK
    string usageId FK
    string masterProductId FK
    decimal quantity
  }

  HOMECARE_BAG_RETURN {
    string id PK
    string returnCode UK
    string bagId FK
    string teamId FK
    string toBranchId FK
    string returnedBy FK
  }

  HOMECARE_BAG_RETURN_ITEM {
    string id PK
    string returnId FK
    string masterProductId FK
    decimal quantity
  }

  HOMECARE_BAG_OPNAME {
    string id PK
    string opnameCode UK
    string bagId FK
    string teamId FK
    string checkedBy FK
    string status
  }

  HOMECARE_BAG_OPNAME_ITEM {
    string id PK
    string opnameId FK
    string masterProductId FK
    decimal systemQty
    decimal physicalQty
  }

  LOGISTIC_STOCK_TRANSACTION {
    string id PK
    string transactionCode UK
    string type
    string status
    string createdBy FK
  }

  LOGISTIC_STOCK_TRANSACTION_ITEM {
    string id PK
    string transactionId FK
    string masterProductId FK
    decimal quantity
  }

  LOGISTIC_STOCK_MUTATION {
    string id PK
    string mutationCode UK
    string homecareBagId FK
    string masterProductId FK
    string type
    decimal quantity
  }

  NOTIFICATION {
    string id PK
    string userId FK
    string type
    string title
    string status
  }

  CHAT_ROOM {
    string id PK
    string memberId FK UK
    string staffId FK
    boolean isActive
  }

  CHAT_MESSAGE {
    string id PK
    string chatRoomId FK
    string senderId FK
    string content
  }

  AUDIT_LOG {
    string id PK
    string userId FK
    string branchId FK
    string action
    string resource
    string resourceId
  }

  LAB_RESULT {
    string id PK
    string memberId FK
    string uploadedBy FK
    string fileName
    string fileUrl
  }

  BRANCH ||--o{ USER : has_primary_staff
  USER ||--|| USER_PROFILE : has_profile
  USER ||--o{ MANAGER_BRANCH : manages
  BRANCH ||--o{ MANAGER_BRANCH : managed_by
  USER ||--o{ STAFF_BRANCH : assigned_to
  BRANCH ||--o{ STAFF_BRANCH : has_staff

  USER ||--o| MEMBER : login_account
  BRANCH ||--o{ MEMBER : registers
  MEMBER ||--o{ BRANCH_MEMBER_ACCESS : has_access
  BRANCH ||--o{ BRANCH_MEMBER_ACCESS : grants_access
  MEMBER ||--o{ MEMBER_DOCUMENT : owns
  BRANCH ||--o{ REFERRAL_CODE : has
  REFERRAL_CODE ||--o{ MEMBER : refers
  REFERRAL_CODE ||--o{ REFERRAL_INCENTIVE_RECORD : earns
  MEMBER ||--o{ REFERRAL_INCENTIVE_RECORD : triggers

  BRANCH ||--o{ PACKAGE_PRICING : has
  PACKAGE_PRICING ||--o{ MEMBER_PACKAGE : priced_by
  MEMBER ||--o{ MEMBER_PACKAGE : buys
  BRANCH ||--o{ MEMBER_PACKAGE : sold_at
  USER ||--o{ MEMBER_PACKAGE : assigns
  MEMBER_PACKAGE ||--o{ MEMBER_ADD_ON : includes
  MEMBER ||--o{ MEMBER_ADD_ON : buys
  BRANCH ||--o{ MEMBER_ADD_ON : sold_at
  NON_THERAPY_PRODUCT ||--o{ MEMBER_NON_THERAPY_PURCHASE : purchased_as
  MEMBER ||--o{ MEMBER_NON_THERAPY_PURCHASE : buys
  BRANCH ||--o{ MEMBER_NON_THERAPY_PURCHASE : sold_at

  MEMBER ||--o{ INVOICE : billed
  BRANCH ||--o{ INVOICE : issues
  USER ||--o{ INVOICE : creates
  INVOICE ||--o{ INVOICE_ITEM : contains
  INVOICE ||--o{ INVOICE_PAYMENT : paid_by
  USER ||--o{ INVOICE_PAYMENT : receives

  MEMBER ||--o{ ENCOUNTER : has
  BRANCH ||--o{ ENCOUNTER : hosts
  MEMBER_PACKAGE ||--o{ ENCOUNTER : uses_basic_package
  ENCOUNTER ||--o{ TREATMENT_SESSION : contains
  BRANCH ||--o{ TREATMENT_SESSION : hosts
  USER ||--o{ TREATMENT_SESSION : admin_layanan
  USER ||--o{ TREATMENT_SESSION : doctor
  USER ||--o{ TREATMENT_SESSION : nurse
  MEMBER_PACKAGE ||--o{ TREATMENT_SESSION : booster_package
  TREATMENT_SESSION ||--o{ SESSION_DOCTOR : doctor_assignments
  USER ||--o{ SESSION_DOCTOR : assigned_doctor
  TREATMENT_SESSION ||--o{ SESSION_NURSE : nurse_assignments
  USER ||--o{ SESSION_NURSE : assigned_nurse

  MEMBER ||--o{ DIAGNOSIS : has
  ENCOUNTER ||--o{ DIAGNOSIS : session_copy
  MEMBER ||--o{ THERAPY_PLAN_SET : has
  THERAPY_PLAN_SET ||--o{ THERAPY_PLAN : contains
  MEMBER ||--o{ THERAPY_PLAN : owns
  TREATMENT_SESSION ||--o| THERAPY_PLAN : uses
  TREATMENT_SESSION ||--o{ VITAL_SIGN : records
  TREATMENT_SESSION ||--o{ INFUSION_EXECUTION : executes
  THERAPY_PLAN ||--o{ INFUSION_EXECUTION : planned_by
  TREATMENT_SESSION ||--o{ MATERIAL_USAGE : consumes
  MASTER_PRODUCT ||--o{ MATERIAL_USAGE : used_as_material
  TREATMENT_SESSION ||--o| SESSION_PHOTO : has_main_photo
  TREATMENT_SESSION ||--o{ SESSION_SUPPORTING_PHOTO : has_supporting_photos
  TREATMENT_SESSION ||--o{ EMR_NOTE : has_notes
  TREATMENT_SESSION ||--o| DOCTOR_EVALUATION : evaluated_by_doctor
  DOCTOR_EVALUATION ||--o{ DOCTOR_EVALUATION_HISTORY : changes
  USER ||--o{ DOCTOR_EVALUATION : writes

  MASTER_PRODUCT ||--o{ INVENTORY_ITEM : stocked_as
  BRANCH ||--o{ INVENTORY_ITEM : stores
  BRANCH ||--o{ STOCK_MUTATION : records
  MASTER_PRODUCT ||--o{ STOCK_MUTATION : mutated
  BRANCH ||--o{ STOCK_REQUEST : requests
  USER ||--o{ STOCK_REQUEST : requested_by
  STOCK_REQUEST ||--o{ STOCK_REQUEST_ITEM : contains
  MASTER_PRODUCT ||--o{ STOCK_REQUEST_ITEM : requested_product
  BRANCH ||--o{ SHIPMENT : ships_from
  BRANCH ||--o{ SHIPMENT : ships_to
  SHIPMENT ||--o{ SHIPMENT_ITEM : contains
  MASTER_PRODUCT ||--o{ SHIPMENT_ITEM : shipped_product
  SHIPMENT ||--o{ SHIPMENT_DISCREPANCY : reports
  STOCK_REQUEST ||--o| STOCK_REQUEST_INVOICE : billed
  STOCK_REQUEST_INVOICE ||--o{ STOCK_REQUEST_INVOICE_ITEM : contains
  STOCK_REQUEST_INVOICE ||--o{ STOCK_REQUEST_INVOICE_PAYMENT : paid_by
  BRANCH ||--o{ BRANCH_OVERSTOCK : has
  MASTER_PRODUCT ||--o{ BRANCH_OVERSTOCK : overstocked
  SHIPMENT ||--o{ BRANCH_OVERSTOCK : source
  BRANCH_OVERSTOCK ||--o{ OVERSTOCK_USAGE : used
  STOCK_REQUEST ||--o{ OVERSTOCK_USAGE : consumes_overstock

  HOMECARE_TEAM ||--o{ HOMECARE_TEAM_MEMBER : has
  USER ||--o{ HOMECARE_TEAM_MEMBER : joins
  HOMECARE_TEAM ||--o{ HOMECARE_BAG : owns
  BRANCH ||--o{ HOMECARE_BAG : hosts
  HOMECARE_BAG ||--o{ HOMECARE_BAG_STOCK : stores
  MASTER_PRODUCT ||--o{ HOMECARE_BAG_STOCK : stocked_in_bag
  HOMECARE_TEAM ||--o{ HOMECARE_BAG_STOCK_REQUEST : requests
  HOMECARE_BAG ||--o{ HOMECARE_BAG_STOCK_REQUEST : requests_for
  HOMECARE_BAG_STOCK_REQUEST ||--o{ HOMECARE_BAG_STOCK_REQUEST_ITEM : contains
  HOMECARE_BAG_STOCK_REQUEST ||--o| HOMECARE_BAG_SHIPMENT : fulfilled_by
  HOMECARE_BAG_SHIPMENT ||--o{ HOMECARE_BAG_SHIPMENT_ITEM : contains
  HOMECARE_BAG ||--o{ HOMECARE_BAG_USAGE : used_from
  TREATMENT_SESSION ||--o{ HOMECARE_BAG_USAGE : related_session
  HOMECARE_BAG_USAGE ||--o{ HOMECARE_BAG_USAGE_ITEM : contains
  HOMECARE_BAG ||--o{ HOMECARE_BAG_RETURN : returned_from
  HOMECARE_BAG_RETURN ||--o{ HOMECARE_BAG_RETURN_ITEM : contains
  HOMECARE_BAG ||--o{ HOMECARE_BAG_OPNAME : checked
  HOMECARE_BAG_OPNAME ||--o{ HOMECARE_BAG_OPNAME_ITEM : contains
  HOMECARE_BAG ||--o{ LOGISTIC_STOCK_MUTATION : mutates
  LOGISTIC_STOCK_TRANSACTION ||--o{ LOGISTIC_STOCK_TRANSACTION_ITEM : contains
  MASTER_PRODUCT ||--o{ LOGISTIC_STOCK_TRANSACTION_ITEM : moved

  USER ||--o{ NOTIFICATION : receives
  MEMBER ||--o| CHAT_ROOM : has
  USER ||--o{ CHAT_ROOM : handles
  CHAT_ROOM ||--o{ CHAT_MESSAGE : contains
  USER ||--o{ CHAT_MESSAGE : sends
  USER ||--o{ AUDIT_LOG : creates
  BRANCH ||--o{ AUDIT_LOG : scoped_to
  MEMBER ||--o{ LAB_RESULT : has
  USER ||--o{ LAB_RESULT : uploads
```
