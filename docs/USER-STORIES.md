# Requirements & User Stories - RAHO Klinik Management System

> Dokumentasi lengkap functional requirements dan user stories untuk sistem manajemen klinik RAHO

---

## 📋 Daftar Isi

1. [Project Overview](#project-overview)
2. [Functional Requirements](#functional-requirements)
3. [Non-Functional Requirements](#non-functional-requirements)
4. [User Stories by Role](#user-stories-by-role)
5. [Epic Stories](#epic-stories)
6. [Acceptance Criteria](#acceptance-criteria)
7. [Technical Requirements](#technical-requirements)

---

## 🎯 Project Overview

### Project Name
**RAHO Klinik Management System**

### Project Description
Sistem manajemen klinik terintegrasi untuk mengelola operasional klinik terapi infus, mencakup manajemen member, paket terapi, sesi treatment, inventory, dan multi-branch operations.

### Target Users
- **Super Admin** - System administrator
- **Admin Manager** - Multi-branch manager
- **Admin Layanan** - Branch operations staff
- **Doctor** - Medical practitioners
- **Nurse** - Treatment executors
- **Member** - Patients/clients

### Business Goals
- Digitalisasi operasional klinik
- Meningkatkan efisiensi treatment workflow
- Tracking inventory dan stock management
- Multi-branch operations support
- Referral dan incentive system
- Audit trail dan compliance

---

## 📋 Functional Requirements

### FR-001: Authentication & Authorization
**Priority**: High  
**Description**: Sistem harus menyediakan authentication dan role-based authorization

**Requirements:**
- FR-001.1: Login dengan email dan password
- FR-001.2: JWT-based authentication (Access 15min, Refresh 7d)
- FR-001.3: Role-based access control (6 roles)
- FR-001.4: Branch-level access control
- FR-001.5: Session management dan logout
- FR-001.6: Password reset functionality

---

### FR-002: User Management
**Priority**: High  
**Description**: Manajemen user dan staff

**Requirements:**
- FR-002.1: CRUD operations untuk users
- FR-002.2: User profile management
- FR-002.3: Staff assignment ke branches
- FR-002.4: Multi-branch access untuk managers
- FR-002.5: User activation/deactivation
- FR-002.6: Audit logging untuk user operations

---

### FR-003: Branch Management
**Priority**: High  
**Description**: Manajemen cabang klinik

**Requirements:**
- FR-003.1: CRUD operations untuk branches
- FR-003.2: Branch hierarchy (Pusat vs Cabang)
- FR-003.3: Staff assignment per branch
- FR-003.4: Branch-specific configurations
- FR-003.5: Branch performance tracking
- FR-003.6: Multi-branch reporting

---

### FR-004: Member Management
**Priority**: High  
**Description**: Manajemen member/pasien

**Requirements:**
- FR-004.1: Member registration dengan data lengkap
- FR-004.2: Member profile management
- FR-004.3: Multi-branch access untuk members
- FR-004.4: Member search dan filtering
- FR-004.5: Member history tracking
- FR-004.6: Emergency contact management
- FR-004.7: Document upload (consent forms, photos)

---

### FR-005: Package Management
**Priority**: High  
**Description**: Manajemen paket terapi

**Requirements:**
- FR-005.1: Package pricing per branch
- FR-005.2: Package assignment ke members
- FR-005.3: Package bundling (BASIC + BOOSTER)
- FR-005.4: Discount management (percentage + amount)
- FR-005.5: Package status tracking (PENDING_PAYMENT, ACTIVE, EXPIRED, CANCELLED)
- FR-005.6: Package editing (PENDING_PAYMENT only)
- FR-005.7: Package refund (ACTIVE packages)
- FR-005.8: Package cancellation
- FR-005.9: Payment proof upload dan verification
- FR-005.10: Add-on services management

---

### FR-006: Treatment Sessions
**Priority**: High  
**Description**: Manajemen sesi terapi

**Requirements:**
- FR-006.1: Encounter creation dan management
- FR-006.2: Treatment session scheduling
- FR-006.3: 8-step treatment workflow:
  - Step 1: Diagnosis
  - Step 2: Therapy Plan
  - Step 3: Vital Signs (Before)
  - Step 4: Infusion Execution
  - Step 5: Material Usage
  - Step 6: Session Photo
  - Step 7: Vital Signs (After)
  - Step 8: Doctor Evaluation
- FR-006.4: Multiple doctors/nurses assignment
- FR-006.5: Session completion tracking
- FR-006.6: Package usage tracking
- FR-006.7: Session export dan reporting

---

### FR-007: Inventory Management
**Priority**: High  
**Description**: Manajemen inventory dan stock

**Requirements:**
- FR-007.1: Master product management
- FR-007.2: Branch-specific inventory
- FR-007.3: Stock tracking dan mutations
- FR-007.4: Material usage recording
- FR-007.5: Stock request system (Cabang → Pusat)
- FR-007.6: Shipment tracking
- FR-007.7: Low stock alerts
- FR-007.8: Unit conversion (base unit vs usage unit)

---

### FR-008: Invoice & Billing
**Priority**: Medium  
**Description**: Manajemen invoice dan billing

**Requirements:**
- FR-008.1: Invoice generation
- FR-008.2: Invoice items management
- FR-008.3: Payment recording
- FR-008.4: Multiple payment methods
- FR-008.5: Invoice PDF generation
- FR-008.6: Payment proof management
- FR-008.7: Invoice status tracking

---

### FR-009: Referral System
**Priority**: Medium  
**Description**: Sistem referral dan incentive

**Requirements:**
- FR-009.1: Referral code management
- FR-009.2: Referrer types (SALES, DOKTER, MEMBER)
- FR-009.3: Incentive calculation (percentage/fixed amount)
- FR-009.4: First package vs next packages incentive
- FR-009.5: Incentive tracking dan reporting
- FR-009.6: Referral statistics

---

### FR-010: Dashboard & Analytics
**Priority**: Medium  
**Description**: Dashboard dan reporting

**Requirements:**
- FR-010.1: Role-based dashboard
- FR-010.2: Key metrics display
- FR-010.3: Branch performance analytics
- FR-010.4: Revenue tracking
- FR-010.5: Member statistics
- FR-010.6: Session analytics
- FR-010.7: Inventory reports

---

### FR-011: Audit & Logging
**Priority**: High  
**Description**: Audit trail dan logging

**Requirements:**
- FR-011.1: Comprehensive audit logging
- FR-011.2: User action tracking
- FR-011.3: Data change history
- FR-011.4: Login/logout tracking
- FR-011.5: Audit log viewing dan filtering
- FR-011.6: Compliance reporting

---

### FR-012: File Management
**Priority**: Medium  
**Description**: File upload dan management

**Requirements:**
- FR-012.1: Payment proof upload
- FR-012.2: Session photo upload
- FR-012.3: Member document upload
- FR-012.4: File type validation
- FR-012.5: File size limits
- FR-012.6: Secure file storage (MinIO)

---

## ⚡ Non-Functional Requirements

### NFR-001: Performance
- Response time < 2 seconds untuk most operations
- Database query optimization
- Efficient pagination untuk large datasets
- Connection pooling

### NFR-002: Security
- JWT-based authentication
- Role-based authorization
- Input validation (Zod schemas)
- SQL injection prevention (Prisma ORM)
- XSS prevention
- Audit logging
- Secure file upload

### NFR-003: Scalability
- Multi-branch architecture
- Modular backend services
- Database indexing
- Horizontal scaling capability

### NFR-004: Reliability
- Error handling dan recovery
- Data backup strategies
- System monitoring
- Uptime > 99%

### NFR-005: Usability
- Intuitive user interface
- Responsive design
- Dark theme (RAHO theme)
- Minimal clicks per operation
- Clear error messages

### NFR-006: Maintainability
- Modular architecture
- TypeScript untuk type safety
- Comprehensive documentation
- Code standards dan conventions
- Automated testing (future)

---

## 👥 User Stories by Role

### 🔧 Super Admin Stories

#### SA-001: System Management
**As a** Super Admin  
**I want to** manage the entire system  
**So that** I can ensure proper system operation and configuration

**Acceptance Criteria:**
- ✅ Can access all modules and features
- ✅ Can manage all branches and users
- ✅ Can view system-wide analytics
- ✅ Can configure master data
- ✅ Can view audit logs

#### SA-002: User Management
**As a** Super Admin  
**I want to** create and manage all user accounts  
**So that** I can control system access and permissions

**Acceptance Criteria:**
- ✅ Can create users with any role
- ✅ Can assign users to branches
- ✅ Can activate/deactivate users
- ✅ Can reset user passwords
- ✅ Can view user activity logs

#### SA-003: Master Data Management
**As a** Super Admin  
**I want to** manage master products and configurations  
**So that** the system has accurate reference data

**Acceptance Criteria:**
- ✅ Can CRUD master products
- ✅ Can manage product categories
- ✅ Can set unit conversions
- ✅ Can configure system settings
- ✅ Changes are logged in audit trail

---

### 👨‍💼 Admin Manager Stories

#### AM-001: Multi-Branch Management
**As an** Admin Manager  
**I want to** manage multiple branches  
**So that** I can oversee operations across locations

**Acceptance Criteria:**
- ✅ Can view all assigned branches
- ✅ Can switch between branches
- ✅ Can view cross-branch reports
- ✅ Can manage staff assignments
- ✅ Can grant member multi-branch access

#### AM-002: Staff Management
**As an** Admin Manager  
**I want to** manage staff across branches  
**So that** I can ensure proper staffing and access control

**Acceptance Criteria:**
- ✅ Can create staff accounts
- ✅ Can assign staff to branches
- ✅ Can manage staff permissions
- ✅ Can view staff performance
- ✅ Can transfer staff between branches

#### AM-003: Performance Analytics
**As an** Admin Manager  
**I want to** view branch performance analytics  
**So that** I can make informed business decisions

**Acceptance Criteria:**
- ✅ Can view revenue by branch
- ✅ Can compare branch performance
- ✅ Can view member statistics
- ✅ Can export performance reports
- ✅ Can set performance targets

---

### 🏥 Admin Layanan Stories

#### AL-001: Member Registration
**As an** Admin Layanan  
**I want to** register new members  
**So that** they can access our services

**Acceptance Criteria:**
- ✅ Can input complete member data
- ✅ Can select referral code (optional)
- ✅ System generates unique member number
- ✅ Member account is created automatically
- ✅ Registration is logged in audit trail

#### AL-002: Package Assignment
**As an** Admin Layanan  
**I want to** assign therapy packages to members  
**So that** they can receive treatments

**Acceptance Criteria:**
- ✅ Can select package type (BASIC/BOOSTER)
- ✅ Can bundle multiple packages
- ✅ Can apply discounts (percentage + amount)
- ✅ Can add add-on services
- ✅ Package status starts as PENDING_PAYMENT
- ✅ Can upload payment proof

#### AL-003: Payment Verification
**As an** Admin Layanan  
**I want to** verify member payments  
**So that** packages can be activated

**Acceptance Criteria:**
- ✅ Can view payment proofs
- ✅ Can verify payment amounts
- ✅ Can activate packages after verification
- ✅ System calculates incentives automatically
- ✅ Invoice is generated after verification

#### AL-004: Package Management
**As an** Admin Layanan  
**I want to** manage member packages  
**So that** I can handle changes and issues

**Acceptance Criteria:**
- ✅ Can edit PENDING_PAYMENT packages
- ✅ Can cancel PENDING_PAYMENT packages
- ✅ Can refund ACTIVE packages (with approval)
- ✅ Can view package usage history
- ✅ All changes are logged

#### AL-005: Session Management
**As an** Admin Layanan  
**I want to** manage treatment sessions  
**So that** members receive proper care

**Acceptance Criteria:**
- ✅ Can create encounters
- ✅ Can schedule treatment sessions
- ✅ Can assign doctors and nurses
- ✅ Can track session progress
- ✅ Can view session history

---

### 👨‍⚕️ Doctor Stories

#### DR-001: Medical Diagnosis
**As a** Doctor  
**I want to** input medical diagnosis  
**So that** treatment can be properly planned

**Acceptance Criteria:**
- ✅ Can input diagnosis text
- ✅ Can select ICD-10 codes
- ✅ Can categorize diagnosis
- ✅ Can record symptoms and history
- ✅ Can document physical examination
- ✅ Diagnosis is saved and timestamped

#### DR-002: Therapy Planning
**As a** Doctor  
**I want to** create therapy plans  
**So that** nurses can execute treatments properly

**Acceptance Criteria:**
- ✅ Can specify material dosages
- ✅ Can add therapy notes
- ✅ Can modify existing plans
- ✅ Plan is linked to treatment session
- ✅ Nurses can view the plan during treatment

#### DR-003: Treatment Evaluation
**As a** Doctor  
**I want to** evaluate treatment results  
**So that** I can assess patient progress

**Acceptance Criteria:**
- ✅ Can write SOAP evaluation
- ✅ Can review vital signs changes
- ✅ Can plan next session
- ✅ Can add recommendations
- ✅ Evaluation is saved permanently

#### DR-004: Patient History Review
**As a** Doctor  
**I want to** review patient treatment history  
**So that** I can make informed medical decisions

**Acceptance Criteria:**
- ✅ Can view all patient sessions
- ✅ Can see previous diagnoses
- ✅ Can review treatment responses
- ✅ Can access medical documents
- ✅ Can export patient reports

---

### 👩‍⚕️ Nurse Stories

#### NR-001: Vital Signs Recording
**As a** Nurse  
**I want to** record patient vital signs  
**So that** we can monitor treatment effects

**Acceptance Criteria:**
- ✅ Can record before-treatment vitals
- ✅ Can record after-treatment vitals
- ✅ Can input all vital parameters
- ✅ System validates input ranges
- ✅ Can compare before/after values

#### NR-002: Infusion Execution
**As a** Nurse  
**I want to** execute infusion treatments  
**So that** patients receive proper therapy

**Acceptance Criteria:**
- ✅ Can follow doctor's therapy plan
- ✅ Can record actual material usage
- ✅ Can note deviations from plan
- ✅ Can specify infusion details
- ✅ Can record start/end times

#### NR-003: Material Usage Tracking
**As a** Nurse  
**I want to** record material usage  
**So that** inventory is accurately tracked

**Acceptance Criteria:**
- ✅ Can select inventory items
- ✅ Can input quantities used
- ✅ System updates stock automatically
- ✅ Can add usage notes
- ✅ Usage is linked to session

#### NR-004: Session Documentation
**As a** Nurse  
**I want to** document treatment sessions  
**So that** we have complete records

**Acceptance Criteria:**
- ✅ Can upload session photos
- ✅ Can add photo captions
- ✅ Can write nursing notes
- ✅ Can mark session steps complete
- ✅ Documentation is timestamped

---

### 👤 Member Stories

#### MB-001: Profile Management
**As a** Member  
**I want to** manage my profile  
**So that** my information is up to date

**Acceptance Criteria:**
- ✅ Can view my profile information
- ✅ Can update contact details
- ✅ Can upload profile photo
- ✅ Can view my member number
- ✅ Can see branch access permissions

#### MB-002: Package Viewing
**As a** Member  
**I want to** view my therapy packages  
**So that** I can track my treatments

**Acceptance Criteria:**
- ✅ Can see all my packages
- ✅ Can view package details
- ✅ Can see usage progress
- ✅ Can view payment status
- ✅ Can see expiration dates

#### MB-003: Session History
**As a** Member  
**I want to** view my treatment history  
**So that** I can track my progress

**Acceptance Criteria:**
- ✅ Can see all my sessions
- ✅ Can view session details
- ✅ Can see treatment photos
- ✅ Can view doctor evaluations
- ✅ Can export session reports

#### MB-004: Invoice Access
**As a** Member  
**I want to** view my invoices  
**So that** I can track my payments

**Acceptance Criteria:**
- ✅ Can see all my invoices
- ✅ Can view invoice details
- ✅ Can download invoice PDFs
- ✅ Can see payment history
- ✅ Can view outstanding amounts

---

## 📚 Epic Stories

### Epic 1: Member Onboarding Journey
**Goal**: Streamline the complete member onboarding process

**Stories Included:**
- Member registration
- Package selection and assignment
- Payment processing
- First treatment scheduling
- Treatment execution
- Follow-up planning

**Success Metrics:**
- Registration time < 5 minutes
- Package activation within 24 hours
- First treatment scheduled within 48 hours
- 95% member satisfaction

---

### Epic 2: Treatment Workflow Optimization
**Goal**: Optimize the 8-step treatment workflow for efficiency

**Stories Included:**
- Encounter creation
- Session scheduling
- Step-by-step treatment execution
- Real-time progress tracking
- Session completion
- Package usage updates

**Success Metrics:**
- Treatment time < 60 minutes
- 100% step completion rate
- Real-time inventory updates
- Zero data loss

---

### Epic 3: Multi-Branch Operations
**Goal**: Enable seamless multi-branch operations

**Stories Included:**
- Branch hierarchy setup
- Staff multi-branch assignment
- Member cross-branch access
- Inventory transfer system
- Cross-branch reporting
- Centralized management

**Success Metrics:**
- Staff can work across branches
- Members can access any branch
- Real-time inventory sync
- Unified reporting

---

### Epic 4: Referral & Incentive System
**Goal**: Implement comprehensive referral and incentive tracking

**Stories Included:**
- Referral code management
- Member referral tracking
- Incentive calculation
- Incentive reporting
- Referrer performance tracking
- Payout management

**Success Metrics:**
- Accurate incentive calculation
- Real-time referral tracking
- Automated incentive records
- Transparent reporting

---

## ✅ Acceptance Criteria Templates

### Template 1: CRUD Operations
**Given** I am a [Role] with proper permissions  
**When** I perform [Create/Read/Update/Delete] operation on [Entity]  
**Then** the operation should succeed  
**And** the change should be logged in audit trail  
**And** other users should see the updated data  

### Template 2: Workflow Steps
**Given** I am at step [N] of [Workflow]  
**When** I complete the required actions  
**Then** I should be able to proceed to step [N+1]  
**And** the previous step should be marked as complete  
**And** the data should be saved automatically  

### Template 3: Permission Checks
**Given** I am a [Role]  
**When** I try to access [Feature/Data]  
**Then** I should [be allowed/be denied] based on my permissions  
**And** appropriate error message should be shown if denied  

### Template 4: Data Validation
**Given** I am entering data in [Form/Field]  
**When** I input [valid/invalid] data  
**Then** the system should [accept/reject] the input  
**And** show appropriate validation messages  

---

## 🔧 Technical Requirements

### TR-001: Architecture
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Frontend**: Next.js + TypeScript + CSS Modules
- **Authentication**: JWT (Access 15min, Refresh 7d)
- **File Storage**: MinIO (S3-compatible)

### TR-002: API Standards
- RESTful API design
- Consistent response format
- Comprehensive error handling
- Input validation (Zod schemas)
- API documentation (OpenAPI/Swagger)

### TR-003: Database Design
- Normalized database schema
- Proper indexing for performance
- Foreign key constraints
- Audit trail tables
- Data migration scripts

### TR-004: Security Requirements
- JWT-based authentication
- Role-based authorization
- Input sanitization
- SQL injection prevention
- XSS protection
- Secure file uploads
- HTTPS enforcement

### TR-005: Performance Requirements
- Response time < 2 seconds
- Database query optimization
- Efficient pagination
- Connection pooling
- Caching strategies

### TR-006: Monitoring & Logging
- Application logging (Winston)
- Error tracking
- Performance monitoring
- Audit trail logging
- System health checks

---

## 📊 Success Metrics

### User Experience Metrics
- **Registration Time**: < 5 minutes
- **Package Assignment**: < 3 minutes
- **Payment Verification**: < 2 minutes
- **Session Completion**: < 60 minutes
- **User Satisfaction**: > 90%

### System Performance Metrics
- **Response Time**: < 2 seconds
- **Uptime**: > 99%
- **Error Rate**: < 1%
- **Data Accuracy**: 100%

### Business Metrics
- **Member Growth**: Track monthly
- **Revenue Growth**: Track monthly
- **Treatment Efficiency**: Sessions per day
- **Inventory Turnover**: Monthly
- **Referral Conversion**: Percentage

---

## 🚀 Implementation Phases

### Phase 1: Core System (Completed)
- ✅ Authentication & Authorization
- ✅ User Management
- ✅ Branch Management
- ✅ Member Management
- ✅ Basic Package Management

### Phase 2: Treatment Workflow (Completed)
- ✅ Package Assignment & Payment
- ✅ Treatment Sessions (8 steps)
- ✅ Inventory Management
- ✅ Invoice Generation

### Phase 3: Advanced Features (Completed)
- ✅ Referral System
- ✅ Multi-Branch Operations
- ✅ Dashboard & Analytics
- ✅ Audit Logging

### Phase 4: Enhancements (Future)
- 🔄 Mobile Application
- 🔄 WhatsApp Integration
- 🔄 Payment Gateway Integration
- 🔄 Advanced Reporting
- 🔄 Automated Testing

---

## 📝 Change Log

### Version 1.0.0 (2026-05-07)
- ✅ Complete system implementation
- ✅ All core features delivered
- ✅ 29 backend services
- ✅ 100+ API endpoints
- ✅ Comprehensive frontend
- ✅ Multi-branch support
- ✅ Referral system
- ✅ Audit logging

---

**Last Updated**: 2026-05-07  
**Version**: 1.0.0  
**Status**: ✅ Production Ready  
**Total User Stories**: 50+  
**Total Requirements**: 60+

---

## 📝 Detailed Acceptance Criteria

### 🔐 AC-001: Authentication & Authorization

#### AC-001.1: User Login
**Given** a user with valid credentials  
**When** they enter email and password  
**Then** they should be logged in successfully  
**And** JWT tokens should be generated  
**And** they should be redirected to role-appropriate dashboard  
**And** login activity should be logged in audit trail  

**Edge Cases:**
- ❌ Invalid email format should show validation error
- ❌ Wrong password should show "Invalid credentials" error
- ❌ Inactive user should show "Account deactivated" error
- ❌ Multiple failed attempts should trigger rate limiting

#### AC-001.2: Role-Based Access Control
**Given** a user with specific role  
**When** they try to access a feature  
**Then** access should be granted/denied based on role permissions  
**And** unauthorized access should show appropriate error message  
**And** access attempts should be logged  

**Permission Matrix:**
- ✅ Super Admin: All features
- ✅ Admin Manager: Multi-branch features
- ✅ Admin Layanan: Branch-specific features
- ✅ Doctor: Medical features only
- ✅ Nurse: Treatment execution only
- ✅ Member: Personal data only

#### AC-001.3: Session Management
**Given** a logged-in user  
**When** access token expires (15 minutes)  
**Then** system should automatically refresh using refresh token  
**And** if refresh token expires (7 days), user should be logged out  
**And** logout should clear all tokens  

---

### 👥 AC-002: Member Management

#### AC-002.1: Member Registration
**Given** an Admin Layanan  
**When** they register a new member  
**Then** all required fields must be filled  
**And** email must be unique across system  
**And** member number should be auto-generated (M-[BRANCH]-XXX)  
**And** referral code is optional but validated if provided  
**And** member account should be created with MEMBER role  
**And** registration should be logged in audit trail  

**Validation Rules:**
- ✅ Email format validation
- ✅ Phone number format validation
- ✅ NIK format validation (16 digits)
- ✅ Date of birth cannot be future date
- ✅ Required fields: email, password, fullName, phone, dateOfBirth, gender

#### AC-002.2: Member Profile Update
**Given** a user with member update permissions  
**When** they update member profile  
**Then** changes should be saved successfully  
**And** email cannot be changed after registration  
**And** changes should be logged in audit trail  
**And** updated data should be immediately visible  

#### AC-002.3: Multi-Branch Access
**Given** an Admin Manager  
**When** they grant member access to additional branches  
**Then** member should be able to receive treatment at those branches  
**And** access grant should be logged with granter information  
**And** member should see all accessible branches in their profile  

---

### 💼 AC-003: Package Management

#### AC-003.1: Package Assignment
**Given** an Admin Layanan  
**When** they assign a package to a member  
**Then** they must select package type (BASIC or BOOSTER)  
**And** they can bundle multiple packages with same purchaseGroupId  
**And** system should calculate total price automatically  
**And** discount can be applied (percentage + amount)  
**And** final price = total price - (percent discount + amount discount)  
**And** package status should start as PENDING_PAYMENT  
**And** assignment should be logged in audit trail  

**Business Rules:**
- ✅ BASIC packages: TNB-P7, TNB-P10, TNB-P15, TNB-P20
- ✅ BOOSTER packages: NO, GT, MB, KCL, H2S, HK, O3, HHO, NO2
- ✅ Service types: PM, PS, PTY, PDA, PHC
- ✅ Discount percentage: 0-100%
- ✅ Discount amount: >= 0
- ✅ Final price cannot be negative

#### AC-003.2: Package Bundling
**Given** an Admin Layanan assigning multiple packages  
**When** they select "Bundle packages" option  
**Then** all packages should have same purchaseGroupId  
**And** discount should apply to total bundle price  
**And** all packages should have same status  
**And** bundle should be treated as single purchase unit  

#### AC-003.3: Add-On Services
**Given** an Admin Layanan assigning packages  
**When** they add add-on services  
**Then** they can select from available add-on types  
**And** quantity and price per unit must be specified  
**And** total price should be calculated automatically  
**And** add-ons can be linked to specific package or standalone  

**Add-On Types:**
- ✅ AIR_NANO (various colors, volumes, units)
- ✅ KONSULTASI_GIZI
- ✅ KONSULTASI_PSIKOLOG
- ✅ ROKOK_KENKOU
- ✅ LAINNYA

#### AC-003.4: Payment Proof Upload
**Given** a user uploading payment proof  
**When** they select a file  
**Then** file must be JPG, PNG, or PDF format  
**And** file size must be <= 5MB  
**And** file should be uploaded to MinIO storage  
**And** file URL should be stored in database  
**And** upload should be logged in audit trail  

#### AC-003.5: Payment Verification
**Given** an Admin Layanan with payment proof  
**When** they verify the payment  
**Then** they must confirm the payment amount  
**And** package status should change from PENDING_PAYMENT to ACTIVE  
**And** paidAt and verifiedAt timestamps should be set  
**And** verifiedBy should be set to current user  
**And** if member has referral, incentive should be calculated  
**And** invoice should be auto-generated  
**And** verification should be logged in audit trail  

#### AC-003.6: Package Editing
**Given** a package with PENDING_PAYMENT status  
**When** Admin Layanan edits the package  
**Then** they can modify package details, pricing, and discounts  
**And** system should recalculate total price  
**And** changes should be saved immediately  
**And** edit should be logged in audit trail  

**Restrictions:**
- ❌ Cannot edit ACTIVE packages
- ❌ Cannot edit EXPIRED packages
- ❌ Cannot edit CANCELLED packages

#### AC-003.7: Package Cancellation
**Given** a package with PENDING_PAYMENT status  
**When** Admin Layanan cancels the package  
**Then** package status should change to CANCELLED  
**And** cancelledAt timestamp should be set  
**And** package cannot be used for treatments  
**And** cancellation should be logged in audit trail  

#### AC-003.8: Package Refund
**Given** a package with ACTIVE status  
**When** Admin Layanan processes refund  
**Then** refund amount cannot exceed final price  
**And** package status should change to CANCELLED  
**And** remaining sessions should be forfeited  
**And** refund should be logged in audit trail  
**And** package cannot be used for future treatments  

**Validation:**
- ✅ Refund amount > 0
- ✅ Refund amount <= package final price
- ✅ Package must be ACTIVE status
- ✅ Refund reason must be provided

---

### 🏥 AC-004: Treatment Sessions

#### AC-004.1: Encounter Creation
**Given** an Admin Layanan  
**When** they create an encounter for a member  
**Then** member must have at least one ACTIVE BASIC package  
**And** encounter code should be auto-generated  
**And** doctor and nurse must be assigned  
**And** encounter status should be ONGOING  
**And** creation should be logged in audit trail  

#### AC-004.2: Treatment Session Creation
**Given** an existing encounter  
**When** Admin Layanan creates a treatment session  
**Then** session code should be auto-generated  
**And** infusKe (session number) should auto-increment  
**And** treatment date must be specified  
**And** pelaksanaan type (ON_SITE/HOME_CARE) must be selected  
**And** admin, doctor, and nurse must be assigned  
**And** booster package can be optionally linked  
**And** creation should be logged in audit trail  

#### AC-004.3: Step 1 - Diagnosis
**Given** a doctor assigned to the session  
**When** they input diagnosis  
**Then** diagnosis text is required  
**And** ICD-10 codes can be specified (primer, sekunder, tersier)  
**And** diagnosis category can be selected  
**And** keluhan, riwayat, and pemeriksaan fisik can be documented  
**And** diagnosis should be saved with timestamp  
**And** step should be marked as completed  

**Validation:**
- ✅ Diagnosis text: required, max 1000 characters
- ✅ ICD codes: optional, valid ICD-10 format
- ✅ Category: optional, from predefined list

#### AC-004.4: Step 2 - Therapy Plan
**Given** a doctor assigned to the session  
**When** they create therapy plan  
**Then** they can specify dosage for each material type  
**And** plan code should be auto-generated  
**And** keterangan (notes) can be added  
**And** plan should be linked to treatment session  
**And** plan should be accessible to nurses  
**And** step should be marked as completed  

**Material Types:**
- ✅ IFA, HHO, H2, NO, GASO, O2, O3
- ✅ EDTA, MB, H2S, KCL
- ✅ JmlNb (total volume)

#### AC-004.5: Step 3 - Vital Signs (Before)
**Given** a nurse assigned to the session  
**When** they record vital signs before treatment  
**Then** they must record all required vital parameters  
**And** values must be within reasonable ranges  
**And** timing should be marked as SEBELUM (BEFORE)  
**And** recordedBy should be set to current nurse  
**And** vital signs should be saved with timestamp  
**And** step should be marked as completed  

**Required Parameters:**
- ✅ Sistol (80-200 mmHg)
- ✅ Diastol (50-120 mmHg)
- ✅ HR (40-150 bpm)
- ✅ Saturasi (80-100%)
- ✅ PI (0-20%)

#### AC-004.6: Step 4 - Infusion Execution
**Given** a nurse assigned to the session  
**When** they execute infusion  
**Then** they should follow the therapy plan dosages  
**And** they can record actual usage (may differ from plan)  
**And** deviation notes can be added if actual differs from plan  
**And** bottle type (IFA/EDTA) must be specified  
**And** infusion details (jenis cairan, volume, jarum, tanggal produksi) can be recorded  
**And** execution should be saved with timestamp  
**And** step should be marked as completed  

#### AC-004.7: Step 5 - Material Usage
**Given** a nurse assigned to the session  
**When** they record material usage  
**Then** they must select from available inventory items  
**And** quantity used must be specified  
**And** system should automatically update inventory stock  
**And** stock mutation should be created with type USED  
**And** usage should be linked to treatment session  
**And** recordedBy should be set to current nurse  
**And** step should be marked as completed  

**Business Rules:**
- ✅ Quantity must be > 0
- ✅ Quantity cannot exceed available stock
- ✅ Stock update is immediate and atomic
- ✅ Usage cannot be deleted after session completion

#### AC-004.8: Step 6 - Session Photo
**Given** a nurse assigned to the session  
**When** they upload session photos  
**Then** multiple photos can be uploaded  
**And** each photo can have a caption  
**And** file must be JPG or PNG format  
**And** file size must be <= 5MB  
**And** photos should be stored in MinIO  
**And** uploadedBy should be set to current nurse  
**And** step should be marked as completed  

#### AC-004.9: Step 7 - Vital Signs (After)
**Given** a nurse assigned to the session  
**When** they record vital signs after treatment  
**Then** they must record all required vital parameters  
**And** timing should be marked as SESUDAH (AFTER)  
**And** system should show comparison with before values  
**And** significant changes should be highlighted  
**And** vital signs should be saved with timestamp  
**And** step should be marked as completed  

#### AC-004.10: Step 8 - Doctor Evaluation
**Given** a doctor assigned to the session  
**When** they write evaluation  
**Then** they can use SOAP format (Subjective, Objective, Assessment, Plan)  
**And** general notes can be added  
**And** evaluation code should be auto-generated  
**And** writtenBy should be set to current doctor  
**And** evaluation should be saved with timestamp  
**And** step should be marked as completed  

#### AC-004.11: Session Completion
**Given** all 8 steps are completed  
**When** session is marked as completed  
**Then** isCompleted should be set to true  
**And** package usedSessions should be incremented  
**And** if usedSessions >= totalSessions, package should be marked as EXPIRED  
**And** session data should become immutable  
**And** completion should be logged in audit trail  

#### AC-004.12: Multiple Staff Assignment
**Given** a treatment session  
**When** multiple doctors or nurses are assigned  
**Then** one should be marked as primary  
**And** all assigned staff can access the session  
**And** actions should be attributed to the performing staff member  
**And** assignments should be logged in audit trail  

---

### 📦 AC-005: Inventory Management

#### AC-005.1: Master Product Management
**Given** a Super Admin  
**When** they manage master products  
**Then** they can create products with category (MEDICINE, DEVICE, CONSUMABLE)  
**And** they must specify base unit and usage unit  
**And** conversion factor must be defined  
**And** product name must be unique  
**And** changes should be logged in audit trail  

#### AC-005.2: Branch Inventory
**Given** a branch with inventory items  
**When** inventory is accessed  
**Then** each item should show current stock quantity  
**And** minimum threshold should be configurable  
**And** storage location can be specified  
**And** stock history should be available  
**And** low stock items should be highlighted  

#### AC-005.3: Stock Mutations
**Given** any stock-affecting operation  
**When** stock quantity changes  
**Then** stock mutation should be created automatically  
**And** mutation should record type (USED, RECEIVED, ADJUSTMENT)  
**And** stock before and after should be recorded  
**And** reference to source operation should be stored  
**And** mutation should be immutable after creation  

#### AC-005.4: Stock Requests
**Given** a branch needing inventory  
**When** they create stock request to Pusat  
**Then** request code should be auto-generated  
**And** multiple items can be requested  
**And** requested quantities must be specified  
**And** request status should start as PENDING  
**And** Pusat admin should be notified  
**And** request should be logged in audit trail  

#### AC-005.5: Stock Request Approval
**Given** a Pusat admin reviewing stock request  
**When** they approve/reject the request  
**Then** status should change to APPROVED/REJECTED  
**And** approval/rejection reason can be provided  
**And** reviewedBy and reviewedAt should be set  
**And** requesting branch should be notified  
**And** if approved, shipment should be created  

#### AC-005.6: Shipment Management
**Given** an approved stock request  
**When** shipment is created  
**Then** shipment code should be auto-generated  
**And** status should start as PREPARING  
**And** items and quantities should match approved request  
**And** shipment can progress through PREPARING → SHIPPED → RECEIVED → APPROVED  
**And** each status change should be timestamped  
**And** receiving branch should update their stock upon approval  

---

### 🎁 AC-006: Referral System

#### AC-006.1: Referral Code Creation
**Given** an admin creating referral code  
**When** they input referral details  
**Then** code must be unique across system  
**And** referrer type must be specified (SALES, DOKTER, MEMBER)  
**And** referrer name and contact info must be provided  
**And** code should be linked to specific branch  
**And** creation should be logged in audit trail  

#### AC-006.2: Member Referral Assignment
**Given** a member registration with referral code  
**When** referral code is selected  
**Then** code must exist and be active  
**And** member should be linked to referral code  
**And** referral statistics should be updated  
**And** assignment should be logged in audit trail  

#### AC-006.3: Incentive Settings
**Given** a member with referral code  
**When** incentive settings are configured  
**Then** first package incentive can be set (type and value)  
**And** next packages incentive can be set (type and value)  
**And** incentive type can be PERCENTAGE or FIXED_AMOUNT  
**And** percentage values must be 0-100%  
**And** fixed amounts must be >= 0  
**And** settings should be stored per member  

#### AC-006.4: Incentive Calculation
**Given** a member with referral purchasing package  
**When** payment is verified  
**Then** system should detect if this is first package or subsequent  
**And** appropriate incentive settings should be used  
**And** incentive amount should be calculated correctly  
**And** incentive record should be created immutably  
**And** referral code statistics should be updated  
**And** calculation should be logged in audit trail  

**Calculation Logic:**
```
If first package:
  If firstIncentiveType == PERCENTAGE:
    incentiveAmount = packageValue * (firstIncentiveValue / 100)
  Else:
    incentiveAmount = firstIncentiveValue
Else:
  If nextIncentiveType == PERCENTAGE:
    incentiveAmount = packageValue * (nextIncentiveValue / 100)
  Else:
    incentiveAmount = nextIncentiveValue
```

---

### 🧾 AC-007: Invoice & Billing

#### AC-007.1: Invoice Generation
**Given** packages with ACTIVE status  
**When** invoice is generated  
**Then** invoice number should be auto-generated (INV-YYYY-NNNN)  
**And** all ACTIVE packages and add-ons should be included  
**And** subtotal should be sum of all item prices  
**And** discount should be applied if specified  
**And** tax should be calculated (default 0%)  
**And** total should be subtotal - discount + tax  
**And** invoice status should be PAID (if auto-generated after payment)  

#### AC-007.2: Invoice Items
**Given** an invoice being created  
**When** items are added  
**Then** each item should have type (PACKAGE, ADD_ON, NON_THERAPY_PRODUCT)  
**And** item details (code, description, quantity, price) should be recorded  
**And** subtotal should be quantity * pricePerUnit  
**And** discount can be applied per item  
**And** total should be subtotal - discount  

#### AC-007.3: Payment Recording
**Given** an invoice with payment  
**When** payment is recorded  
**Then** payment method must be specified  
**And** payment amount must be > 0  
**And** payment reference can be provided  
**And** payment proof can be uploaded  
**And** receivedBy should be set to current user  
**And** receivedAt should be set to current timestamp  

#### AC-007.4: Invoice PDF Generation
**Given** a completed invoice  
**When** PDF is requested  
**Then** PDF should include all invoice details  
**And** branch information should be displayed  
**And** member information should be displayed  
**And** itemized list should be shown  
**And** payment details should be included  
**And** PDF should be downloadable  

---

### 📊 AC-008: Dashboard & Analytics

#### AC-008.1: Role-Based Dashboard
**Given** a user accessing dashboard  
**When** dashboard loads  
**Then** content should be filtered based on user role  
**And** Super Admin should see system-wide metrics  
**And** Admin Manager should see multi-branch analytics  
**And** Admin Layanan should see branch-specific data  
**And** Doctor should see medical-related metrics  
**And** Nurse should see treatment-related data  
**And** Member should see personal progress  

#### AC-008.2: Key Metrics Display
**Given** dashboard with appropriate permissions  
**When** metrics are displayed  
**Then** member statistics should show total, active, new members  
**And** package statistics should show sold, active, revenue  
**And** session statistics should show completed, scheduled sessions  
**And** financial metrics should show revenue, outstanding payments  
**And** inventory metrics should show stock levels, low stock alerts  
**And** all metrics should be real-time or near real-time  

#### AC-008.3: Branch Performance Analytics
**Given** an Admin Manager  
**When** they view branch performance  
**Then** they should see revenue comparison across branches  
**And** member growth per branch should be displayed  
**And** session completion rates should be shown  
**And** staff performance metrics should be available  
**And** data should be filterable by date range  
**And** reports should be exportable  

---

### 🔍 AC-009: Audit & Logging

#### AC-009.1: Comprehensive Audit Logging
**Given** any system operation  
**When** operation is performed  
**Then** audit log should be created if operation is significant  
**And** log should include userId, action, resource, resourceId  
**And** timestamp should be recorded  
**And** IP address and user agent should be captured  
**And** metadata should be stored as JSON  
**And** branch context should be recorded if applicable  

**Logged Actions:**
- ✅ CREATE, UPDATE, DELETE operations
- ✅ LOGIN, LOGOUT events
- ✅ Payment verifications
- ✅ Package assignments, edits, refunds
- ✅ Session completions
- ✅ Permission grants

#### AC-009.2: Audit Log Viewing
**Given** a user with audit log permissions  
**When** they access audit logs  
**Then** logs should be displayed in reverse chronological order  
**And** logs should be filterable by user, action, resource, date range  
**And** log details should be expandable  
**And** sensitive information should be masked appropriately  
**And** logs should be paginated for performance  
**And** export functionality should be available  

---

### 🔒 AC-010: Security & Validation

#### AC-010.1: Input Validation
**Given** any form input  
**When** data is submitted  
**Then** all inputs should be validated using Zod schemas  
**And** validation errors should be displayed clearly  
**And** malicious input should be sanitized  
**And** SQL injection attempts should be prevented  
**And** XSS attempts should be blocked  

#### AC-010.2: File Upload Security
**Given** a file upload operation  
**When** file is selected  
**Then** file type should be validated against allowed types  
**And** file size should not exceed limits  
**And** file content should be scanned for malicious code  
**And** files should be stored securely in MinIO  
**And** file URLs should be signed for security  

#### AC-010.3: API Security
**Given** any API request  
**When** request is made  
**Then** authentication should be verified via JWT  
**And** authorization should be checked based on user role  
**And** branch access should be validated if applicable  
**And** rate limiting should be applied to prevent abuse  
**And** CORS should be configured properly  

---

### ⚡ AC-011: Performance & Reliability

#### AC-011.1: Response Time Requirements
**Given** any user operation  
**When** operation is performed  
**Then** response time should be < 2 seconds for most operations  
**And** database queries should be optimized  
**And** large datasets should be paginated  
**And** connection pooling should be utilized  
**And** caching should be implemented where appropriate  

#### AC-011.2: Error Handling
**Given** any system error  
**When** error occurs  
**Then** error should be caught and handled gracefully  
**And** user-friendly error message should be displayed  
**And** technical details should be logged for debugging  
**And** system should remain stable and recoverable  
**And** critical errors should trigger alerts  

#### AC-011.3: Data Consistency
**Given** any data operation  
**When** operation involves multiple tables  
**Then** database transactions should ensure ACID properties  
**And** foreign key constraints should be enforced  
**And** data validation should prevent inconsistent states  
**And** concurrent operations should be handled safely  
**And** backup and recovery procedures should be in place  

---

## 🎯 Testing Scenarios

### Scenario 1: Complete Member Journey
1. **Setup**: Admin Layanan logged in
2. **Action**: Register new member with referral code
3. **Verify**: Member created, referral linked, audit logged
4. **Action**: Assign BASIC + BOOSTER package bundle with discount
5. **Verify**: Packages created with PENDING_PAYMENT status, discount calculated correctly
6. **Action**: Upload payment proof and verify payment
7. **Verify**: Packages activated, incentive calculated, invoice generated
8. **Action**: Create encounter and treatment session
9. **Verify**: Session created, staff assigned
10. **Action**: Complete all 8 treatment steps
11. **Verify**: Session completed, package usage updated, audit logged

### Scenario 2: Multi-Branch Operations
1. **Setup**: Admin Manager logged in
2. **Action**: Grant member access to multiple branches
3. **Verify**: Access granted, logged in audit trail
4. **Action**: Member receives treatment at different branch
5. **Verify**: Treatment recorded, package usage updated correctly
6. **Action**: View cross-branch analytics
7. **Verify**: Data aggregated correctly across branches

### Scenario 3: Inventory Management Flow
1. **Setup**: Branch with low stock items
2. **Action**: Create stock request to Pusat
3. **Verify**: Request created with PENDING status
4. **Action**: Pusat admin approves request
5. **Verify**: Status changed to APPROVED, shipment created
6. **Action**: Process shipment through all stages
7. **Verify**: Stock updated at receiving branch, mutations recorded

### Scenario 4: Error Handling & Security
1. **Setup**: Various invalid inputs and unauthorized access attempts
2. **Action**: Submit invalid data, attempt unauthorized operations
3. **Verify**: Appropriate errors shown, security violations logged
4. **Action**: Exceed rate limits, upload malicious files
5. **Verify**: Requests blocked, security measures activated

---

**Last Updated**: 2026-05-07  
**Version**: 1.0.0  
**Total Acceptance Criteria**: 100+  
**Coverage**: All major features and edge cases