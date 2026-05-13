# API File Structure Documentation

> Dokumentasi lengkap struktur file dan penjelasan singkat setiap file dalam `apps/api`

## 📁 Root Files

### Configuration Files
- **`package.json`** - Dependencies, scripts, dan metadata project API
- **`tsconfig.json`** - Konfigurasi TypeScript compiler
- **`.env`** - Environment variables (database, JWT, MinIO, dll)
- **`.env.example`** - Template environment variables
- **`Dockerfile`** - Docker image configuration untuk deployment
- **`entrypoint.sh`** - Docker entrypoint script

---

## 📂 `/prisma` - Database Layer

### Schema & Migrations
- **`schema.prisma`** - Database schema definition (models, relations, enums)
- **`migrations/`** - Database migration history (version control)
  - `20260427101310_init_schema/` - Initial database schema
  - `20260427172352_add_staff_branch_multi_branch/` - Multi-branch support
  - `20260427175010_increase_decimal_precision_for_stock/` - Stock precision fix
  - `20260428031308_add_multiple_doctors_nurses_per_session/` - Session staff support
  - `20260428050629_add_pusat_branch_type/` - Branch type PUSAT
  - `20260429083851_add_referral_incentive_system/` - Referral system
  - `20260429093500_move_incentive_to_member/` - Incentive refactoring
  - `20260504033954_add_login_logout_audit_actions/` - Audit actions
  - `20260504040242_add_branch_to_audit_log/` - Branch audit tracking
  - `20260505095918_add_rokok_kenkou_addon_type/` - Rokok Kenkou add-on

### Seeding
- **`seed.ts`** - Main seed orchestrator
- **`seeds/`** - Seed data files
  - `README.md` - Seed documentation
  - `index.ts` - Seed exports
  - `branches.seed.ts` - Branch data (3 branches)
  - `users.seed.ts` - User accounts (all roles)
  - `inventory-items.seed.ts` - Inventory items
  - `inventory-items-official.seed.ts` - Official inventory list
  - `inventory-items-consolidated.seed.ts` - Consolidated inventory
  - `products.seed.ts` - Product master data
  - `packages.seed.ts` - Package pricing data
  - `non-therapy-products.seed.ts` - Non-therapy products
  - `referrals.seed.ts` - Referral codes
  - `members-multibranch.seed.ts` - Multi-branch members
  - `therapy-sessions.seed.ts` - Sample therapy sessions
  - `therapy-sessions-new.seed.ts` - New session format
  - `complete-therapy-sessions.seed.ts` - Complete session workflow
  - `infusion-material-usage.seed.ts` - Material usage data
  - `dashboard-test.seed.ts` - Dashboard test data

---

## 📂 `/src` - Source Code

### Entry Points
- **`server.ts`** - HTTP server initialization
- **`app.ts`** - Express app configuration, middleware, routes

---

## 📂 `/src/config` - Configuration

- **`env.ts`** - Environment variable validation & export
- **`minio.ts`** - MinIO client configuration (S3-compatible storage)

---

## 📂 `/src/lib` - Core Libraries

- **`prisma.ts`** - Prisma client singleton instance
- **`jwt.ts`** - JWT token generation & verification utilities
- **`logger.ts`** - Winston logger configuration

---

## 📂 `/src/middleware` - Express Middleware

- **`authenticate.ts`** - JWT authentication middleware
- **`authorize.ts`** - Role-based authorization middleware
- **`assertBranchAccess.ts`** - Branch access validation middleware
- **`errorHandler.ts`** - Global error handling middleware
- **`validate.ts`** - Zod schema validation middleware
- **`upload.ts`** - Multer file upload middleware

---

## 📂 `/src/utils` - Utility Functions

- **`response.ts`** - Standardized API response helpers
- **`auditLog.ts`** - Audit logging utility
- **`codeGenerator.ts`** - Auto-generate codes (member, package, invoice)
- **`invoiceGenerator.ts`** - Invoice number generation

---

## 📂 `/src/modules` - Feature Modules

### Module Pattern
Setiap module mengikuti pattern:
```
module/
├── module.controller.ts    # HTTP request handlers
├── module.service.ts       # Business logic orchestrator
├── module.routes.ts        # Route definitions
├── module.schema.ts        # Zod validation schemas
└── services/               # Specialized services (optional)
    ├── service-1.service.ts
    ├── service-2.service.ts
    └── README.md
```

---

## 🔐 `/src/modules/auth` - Authentication

### Files
- **`auth.controller.ts`** - Login, register, logout handlers
- **`auth.service.ts`** - Authentication business logic
- **`auth.routes.ts`** - Auth endpoints (`/auth/login`, `/auth/register`)
- **`auth.schema.ts`** - Login & register validation schemas

### Features
- JWT-based authentication
- Password hashing with bcrypt
- Token refresh mechanism
- Audit logging for login/logout

---

## 👥 `/src/modules/users` - User Management

### Files
- **`users.controller.ts`** - User CRUD handlers
- **`users.service.ts`** - User management logic
- **`users.routes.ts`** - User endpoints
- **`users.schema.ts`** - User validation schemas

### Features
- Create/update/delete users
- Role management
- Profile management
- Password reset

---

## 🏢 `/src/modules/branches` - Branch Management

### Files
- **`branches.controller.ts`** - Branch CRUD handlers
- **`branches.service.ts`** - Branch management logic
- **`branches.routes.ts`** - Branch endpoints
- **`branches.schema.ts`** - Branch validation schemas

### Features
- Multi-branch support
- Branch types (PUSAT, CABANG)
- Staff assignment to branches
- Branch-specific inventory

---

## 👤 `/src/modules/members` - Member Management

### Files
- **`members.controller.ts`** - Member CRUD handlers
- **`members.service.ts`** - Main orchestrator
- **`members.routes.ts`** - Member endpoints
- **`members.schema.ts`** - Member validation schemas

### Specialized Services (`services/`)
1. **`member-retrieval.service.ts`** - Get member data
2. **`member-registration.service.ts`** - Register new members
3. **`member-update.service.ts`** - Update member info
4. **`member-branch-access.service.ts`** - Multi-branch access
5. **`member-medical-records.service.ts`** - Medical history

### Features
- Auto-generate member number
- Photo upload
- Multi-branch access
- Medical history tracking
- Package & session history
- Consent document viewing and download

---

## 📦 `/src/modules/packages` - Package Management

### Files
- **`packages.controller.ts`** - Package operation handlers
- **`packages.service.ts`** - Main orchestrator
- **`packages.routes.ts`** - Package endpoints
- **`packages.schema.ts`** - Package validation schemas

### Specialized Services (`services/`)
1. **`package-assignment.service.ts`** - Assign packages to members
2. **`payment-verification.service.ts`** - Verify payments
3. **`invoice-generation.service.ts`** - Generate invoices
4. **`package-retrieval.service.ts`** - Get package data
5. **`package-pricing.service.ts`** - Manage pricing
6. **`package-edit.service.ts`** - Edit PENDING_PAYMENT packages
7. **`package-refund.service.ts`** - Refund ACTIVE packages
8. **`package-cancel.service.ts`** - Cancel PENDING_PAYMENT packages

### Features
- Package bundling (multiple packages in one purchase)
- Discount system (percentage + fixed amount)
- Payment proof upload
- Package editing before payment
- Refund with reason tracking
- Cancellation workflow
- Referral incentive tracking

---

## 🏥 `/src/modules/sessions` - Treatment Sessions

### Files
- **`sessions.controller.ts`** - Session operation handlers
- **`sessions.service.ts`** - Main orchestrator
- **`sessions.routes.ts`** - Session endpoints
- **`sessions.schema.ts`** - Session validation schemas
- **`sessions.service.backup.ts`** - Backup before modularization

### Specialized Services (`services/`)
1. **`session-creation.service.ts`** - Create new sessions
2. **`session-retrieval.service.ts`** - Get session data
3. **`diagnosis.service.ts`** - Step 1: Diagnosis
4. **`therapy-plan.service.ts`** - Step 2: Therapy plan
5. **`vital-signs.service.ts`** - Step 3 & 7: Vital signs
6. **`infusion.service.ts`** - Step 4: Infusion execution
7. **`material-usage.service.ts`** - Step 5: Material tracking
8. **`photo.service.ts`** - Step 6: Photo upload
9. **`evaluation.service.ts`** - Step 8: Evaluation
10. **`session-completion.service.ts`** - Complete session
11. **`booster.service.ts`** - Booster management
12. **`emr-notes.service.ts`** - EMR notes
13. **`session-export.service.ts`** - Export session data

### Features
- 8-step treatment workflow
- Multiple doctors/nurses per session
- Booster selection (7 types)
- Material usage tracking
- Photo documentation
- EMR integration
- Session export

---

## 💰 `/src/modules/invoices` - Invoice Management

### Files
- **`invoices.controller.ts`** - Invoice operation handlers
- **`invoices.service.ts`** - Main orchestrator
- **`invoices.routes.ts`** - Invoice endpoints
- **`invoices.schema.ts`** - Invoice validation schemas

### Specialized Services (`services/`)
1. **`invoice-creation.service.ts`** - Create invoices
2. **`invoice-retrieval.service.ts`** - Get invoice data
3. **`invoice-payment.service.ts`** - Process payments
4. **`invoice-cancellation.service.ts`** - Cancel invoices

### Features
- Auto-generate invoice numbers
- Multiple item types (package, add-on, non-therapy)
- Discount & tax calculation
- Payment verification
- Payment proof upload
- Professional invoice printing

---

## 📊 `/src/modules/inventory` - Inventory Management

### Files
- **`inventory.controller.ts`** - Inventory operation handlers
- **`inventory.service.ts`** - Main orchestrator
- **`inventory.routes.ts`** - Inventory endpoints
- **`inventory.schema.ts`** - Inventory validation schemas

### Specialized Services (`services/`)
1. **`inventory-items.service.ts`** - Manage inventory items
2. **`stock-request-creation.service.ts`** - Create stock requests
3. **`stock-request-approval.service.ts`** - Approve requests
4. **`stock-request-retrieval.service.ts`** - Get request data
5. **`shipment-processing.service.ts`** - Process shipments
6. **`shipment-retrieval.service.ts`** - Get shipment data

### Features
- Master product management
- Branch inventory tracking
- Stock request workflow
- Shipment management (ship, receive, approve)
- Low stock alerts
- Material usage tracking

---

## 🎯 `/src/modules/referrals` - Referral System

### Files
- **`referrals.controller.ts`** - Referral operation handlers
- **`referrals.service.ts`** - Referral management logic
- **`referrals.routes.ts`** - Referral endpoints
- **`referrals.schema.ts`** - Referral validation schemas

### Features
- Referral code generation
- Incentive tracking (percentage or fixed amount)
- Referrer types (MEMBER, DOCTOR, STAFF, EXTERNAL)
- Incentive calculation on package purchase

---

## 📈 `/src/modules/dashboard` - Dashboard & Analytics

### Files
- **`dashboard.controller.ts`** - Dashboard data handlers
- **`dashboard.service.ts`** - Dashboard logic
- **`dashboard.routes.ts`** - Dashboard endpoints

### Features
- System statistics
- Revenue analytics
- Member growth tracking
- Session statistics
- Branch performance

---

## 🔧 `/src/modules/admin` - Admin Operations

### Files
- **`admin.controller.ts`** - Admin operation handlers
- **`admin.service.ts`** - Main orchestrator
- **`admin.routes.ts`** - Admin endpoints
- **`admin.schema.ts`** - Admin validation schemas
- **`admin.service.backup.ts`** - Backup before modularization

### Specialized Services (`services/`)
1. **`system-stats.service.ts`** - System statistics
2. **`branch-performance.service.ts`** - Branch analytics
3. **`audit-logs.service.ts`** - Audit log retrieval
4. **`package-pricing-admin.service.ts`** - Package pricing management
5. **`user-management.service.ts`** - User administration
6. **`master-product-admin.service.ts`** - Product master data
7. **`master-types-admin.service.ts`** - Master type data
8. **`non-therapy-product-admin.service.ts`** - Non-therapy products

### Features
- System health monitoring
- User management (all roles)
- Package pricing management
- Master data management
- Audit log viewing
- Branch performance analytics

---

## 👨‍⚕️ `/src/modules/diagnosis` - Diagnosis Management

### Files
- **`diagnosis.controller.ts`** - Diagnosis handlers
- **`diagnosis.service.ts`** - Diagnosis logic
- **`diagnosis.routes.ts`** - Diagnosis endpoints

### Features
- Medical diagnosis recording
- Diagnosis history
- ICD-10 code support

---

## 💊 `/src/modules/therapy-plans` - Therapy Plan Management

### Files
- **`therapy-plans.controller.ts`** - Therapy plan handlers
- **`therapy-plans.service.ts`** - Therapy plan logic
- **`therapy-plans.routes.ts`** - Therapy plan endpoints

### Features
- Treatment planning
- Therapy recommendations
- Plan history tracking

---

## 👤 `/src/modules/me` - Current User Profile

### Files
- **`me.controller.ts`** - Profile handlers
- **`me.service.ts`** - Profile logic
- **`me.routes.ts`** - Profile endpoints

### Features
- Get current user profile
- Update own profile
- Change password
- View own sessions & packages

---

## 📂 `/scripts` - Utility Scripts

- **`sync-payment-proofs.ts`** - Sync payment proof files from old system

---

## 🗂️ Database Models (Prisma Schema)

### Core Models
- **User** - User accounts
- **Profile** - User profile data
- **Branch** - Clinic branches
- **StaffBranch** - Staff-branch assignments

### Member Models
- **Member** - Member/patient data
- **MemberBranch** - Member-branch access

### Package Models
- **PackagePricing** - Package pricing configuration
- **MemberPackage** - Assigned packages
- **MemberAddOn** - Add-on services

### Session Models
- **TherapySession** - Treatment sessions
- **Diagnosis** - Medical diagnosis
- **TherapyPlan** - Treatment plans
- **VitalSigns** - Vital signs records
- **Infusion** - Infusion records
- **MaterialUsage** - Material tracking
- **SessionPhoto** - Session photos
- **Evaluation** - Doctor evaluation

### Invoice Models
- **Invoice** - Invoice headers
- **InvoiceItem** - Invoice line items

### Inventory Models
- **InventoryItem** - Inventory master
- **BranchInventory** - Branch stock
- **StockRequest** - Stock requests
- **Shipment** - Shipments
- **ShipmentItem** - Shipment items

### Referral Models
- **ReferralCode** - Referral codes
- **ReferralIncentiveRecord** - Incentive tracking

### Audit Models
- **AuditLog** - System audit trail

---

## 🔑 Key Enums

### User & Access
- **UserRole** - SUPER_ADMIN, ADMIN_MANAGER, ADMIN_LAYANAN, DOCTOR, NURSE, MEMBER
- **BranchType** - PUSAT, CABANG

### Package & Payment
- **PackageType** - BASIC, BOOSTER
- **PackageStatus** - PENDING_PAYMENT, ACTIVE, EXPIRED, CANCELLED
- **BoosterType** - NO, GT, MB, KCL, H2S, HK, O3, HHO (legacy), NO2 (legacy)
- **ServiceType** - PM (Premiere), PS (Partnership), PTY, PDA, PHC
- **AddOnType** - AIR_NANO, KONSULTASI_GIZI, KONSULTASI_PSIKOLOG, ROKOK_KENKOU, LAINNYA

### Session
- **SessionStatus** - SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
- **SessionStep** - DIAGNOSIS, THERAPY_PLAN, VITAL_SIGNS_BEFORE, INFUSION, MATERIAL_USAGE, PHOTO, VITAL_SIGNS_AFTER, EVALUATION

### Invoice
- **InvoiceStatus** - DRAFT, PENDING_PAYMENT, PAID, CANCELLED
- **InvoiceItemType** - PACKAGE, ADD_ON, NON_THERAPY_PRODUCT

### Inventory
- **StockRequestStatus** - PENDING, APPROVED, REJECTED, SHIPPED, RECEIVED
- **ShipmentStatus** - PENDING, SHIPPED, RECEIVED, APPROVED

### Referral
- **ReferrerType** - MEMBER, DOCTOR, STAFF, EXTERNAL
- **IncentiveType** - PERCENTAGE, FIXED_AMOUNT

---

## 📊 API Response Standards

### Success Response
```typescript
{
  success: true,
  data: { ... },
  message: "Success message"
}
```

### Error Response
```typescript
{
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "Error message",
    details: [ ... ] // Optional validation errors
  }
}
```

---

## 🔒 Security Features

1. **JWT Authentication** - Token-based auth with 15min access + 7day refresh
2. **Role-Based Access Control** - 6 roles with granular permissions
3. **Branch Access Control** - Multi-branch access validation
4. **Password Hashing** - bcrypt with salt rounds
5. **Audit Logging** - All mutations logged with user & timestamp
6. **Input Validation** - Zod schema validation on all endpoints
7. **Error Handling** - Sanitized error messages (no stack traces in production)

---

## 📈 Performance Optimizations

1. **Prisma Connection Pooling** - Efficient database connections
2. **Selective Field Loading** - Only load required fields
3. **Pagination** - Limit large result sets
4. **Indexing** - Database indexes on frequently queried fields
5. **Caching** - MinIO for file storage (offload from DB)

---

## 🧪 Testing

### Test Files (if exists)
- **`test-with-auth.ts`** - Authentication testing utility

### Testing Strategy
- Unit tests for services
- Integration tests for controllers
- E2E tests for critical workflows

---

## 📝 Documentation Files

- **`README.md`** - Main project documentation
- **`MODULARIZATION-SUMMARY.md`** - Service modularization guide
- **`SESSIONS-MODULARIZATION-COMPLETE.md`** - Session services guide
- **`ADMIN-CONTROLLER-FIX.md`** - TypeScript fixes
- **`INVOICE-IMPROVEMENTS.md`** - Invoice features
- **`API-FILE-STRUCTURE.md`** - This file

---

## 🚀 Deployment Files

- **`Dockerfile`** - Docker image configuration
- **`entrypoint.sh`** - Docker startup script
- **`.dockerignore`** - Files to exclude from Docker build

---

## 📦 Dependencies Highlights

### Production
- **express** - Web framework
- **@prisma/client** - Database ORM
- **zod** - Schema validation
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT tokens
- **minio** - S3-compatible storage
- **winston** - Logging
- **cors** - CORS middleware
- **helmet** - Security headers
- **multer** - File uploads

### Development
- **typescript** - Type safety
- **ts-node** - TypeScript execution
- **prisma** - Database toolkit
- **nodemon** - Auto-restart
- **@types/** - TypeScript definitions

---

**Last Updated:** 2026-05-05  
**Total Files:** 100+ files  
**Total Services:** 29 specialized services  
**Total Modules:** 15 feature modules

