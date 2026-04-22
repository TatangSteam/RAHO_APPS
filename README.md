# RAHO Klinik - Clinic Management System

> Sistem manajemen klinik terintegrasi untuk RAHO Klinik dengan dukungan multi-cabang, manajemen paket terapi, inventory, dan electronic medical records (EMR).

## 📋 Daftar Isi

- [Tentang Project](#tentang-project)
- [Fitur Utama](#fitur-utama)
- [Teknologi](#teknologi)
- [Struktur Project](#struktur-project)
- [Instalasi](#instalasi)
- [Konfigurasi](#konfigurasi)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Database](#database)
- [API Documentation](#api-documentation)
- [Arsitektur](#arsitektur)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## 🎯 Tentang Project

RAHO Klinik Management System adalah aplikasi full-stack untuk mengelola operasional klinik kesehatan dengan fitur:
- Multi-branch management
- Member & package management
- Treatment session workflow (8 steps)
- Inventory & stock management
- Invoice & payment processing
- Electronic Medical Records (EMR)
- Audit logging & reporting

### Tech Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: MinIO (S3-compatible)
- **Authentication**: JWT

---

## ✨ Fitur Utama

### 👥 Member Management
- Registrasi member dengan auto-generate member number
- Multi-branch access management
- Photo upload & document management
- Medical history tracking
- Voucher & package tracking

### 📦 Package Management
- Basic therapy packages
- Booster packages (5 types: OZON, OXYCAN, CHELATION, GLUTATHIONE, VITAMIN_C)
- Add-on services
- Non-therapy products
- Dynamic pricing per branch
- Discount management (percentage & fixed amount)

### 🏥 Treatment Session Workflow
8-step treatment process:
1. **Diagnosis** - Medical diagnosis
2. **Therapy Plan** - Treatment planning
3. **Vital Signs (Before)** - Pre-treatment vitals
4. **Infusion** - Infusion execution with booster
5. **Material Usage** - Inventory tracking
6. **Photo** - Session documentation
7. **Vital Signs (After)** - Post-treatment vitals
8. **Evaluation** - Doctor evaluation

### 📊 Inventory Management
- Master product management
- Branch inventory tracking
- Stock request workflow
- Shipment management (ship, receive, approve)
- Low stock alerts
- Material usage tracking

### 💰 Invoice & Payment
- Auto-generate invoice numbers
- Multiple item types (package, add-on, non-therapy)
- Discount & tax calculation
- Payment verification with proof upload
- Payment history tracking
- Professional invoice printing

### 📈 Admin Dashboard
- System statistics
- Branch performance analytics
- User management
- Package pricing management
- Audit logs
- System health monitoring

### 🔐 Role-Based Access Control
- **SUPER_ADMIN** - Full system access
- **ADMIN_MANAGER** - Multi-branch management
- **ADMIN_LAYANAN** - Branch operations
- **DOCTOR** - Medical operations
- **NURSE** - Treatment execution
- **MEMBER** - Patient portal

---

## 🛠 Teknologi

### Frontend (`apps/web`)
```json
{
  "framework": "Next.js 14",
  "language": "TypeScript",
  "styling": "Tailwind CSS",
  "ui-components": "shadcn/ui",
  "state-management": "React Hooks",
  "forms": "React Hook Form + Zod",
  "http-client": "Fetch API"
}
```

### Backend (`apps/api`)
```json
{
  "runtime": "Node.js",
  "framework": "Express",
  "language": "TypeScript",
  "orm": "Prisma",
  "database": "PostgreSQL",
  "authentication": "JWT",
  "validation": "Zod",
  "file-storage": "MinIO"
}
```

### Database
- **PostgreSQL 14+** - Main database
- **Prisma ORM** - Type-safe database access
- **Migrations** - Version-controlled schema changes

### Storage
- **MinIO** - S3-compatible object storage
- Buckets: `raho-documents`, `raho-photos`, `raho-invoices`

---

## 📁 Struktur Project

```
raho-clinic/
├── apps/
│   ├── api/                          # Backend API
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Database schema
│   │   │   ├── migrations/           # Database migrations
│   │   │   └── seeds/                # Seed data
│   │   ├── src/
│   │   │   ├── config/               # Configuration
│   │   │   ├── lib/                  # Libraries (prisma, jwt, logger)
│   │   │   ├── middleware/           # Express middleware
│   │   │   ├── modules/              # Feature modules
│   │   │   │   ├── admin/
│   │   │   │   │   ├── services/     # Modular services
│   │   │   │   │   ├── admin.controller.ts
│   │   │   │   │   ├── admin.service.ts
│   │   │   │   │   ├── admin.routes.ts
│   │   │   │   │   └── admin.schema.ts
│   │   │   │   ├── auth/
│   │   │   │   ├── branches/
│   │   │   │   ├── members/
│   │   │   │   │   └── services/     # Member services
│   │   │   │   ├── packages/
│   │   │   │   │   └── services/     # Package services
│   │   │   │   ├── sessions/
│   │   │   │   │   └── services/     # Session services (12 services)
│   │   │   │   ├── invoices/
│   │   │   │   │   └── services/     # Invoice services
│   │   │   │   ├── inventory/
│   │   │   │   │   └── services/     # Inventory services
│   │   │   │   └── ...
│   │   │   ├── utils/                # Utilities
│   │   │   └── app.ts                # Express app
│   │   └── package.json
│   │
│   └── web/                          # Frontend Next.js
│       ├── src/
│       │   ├── app/                  # App router
│       │   │   ├── (auth)/           # Auth pages
│       │   │   ├── (staff)/          # Staff pages
│       │   │   └── (member)/         # Member portal
│       │   ├── components/           # React components
│       │   │   ├── ui/               # shadcn/ui components
│       │   │   ├── members/
│       │   │   ├── invoices/
│       │   │   └── ...
│       │   ├── lib/                  # Utilities
│       │   ├── types/                # TypeScript types
│       │   └── middleware.ts         # Next.js middleware
│       └── package.json
│
├── docs/                             # Documentation
│   ├── MODULARIZATION-SUMMARY.md     # Service modularization
│   ├── SESSIONS-MODULARIZATION-COMPLETE.md
│   ├── ADMIN-CONTROLLER-FIX.md
│   └── ...
│
├── package.json                      # Root package.json
├── turbo.json                        # Turborepo config
└── README.md                         # This file
```

---

## 🚀 Instalasi

### Prerequisites
- Node.js 18+ dan npm/yarn
- PostgreSQL 14+
- MinIO (optional, untuk file storage)

### 1. Clone Repository
```bash
git clone <repository-url>
cd raho-clinic
```

### 2. Install Dependencies
```bash
# Install semua dependencies (root + apps)
npm install
```

### 3. Setup Database
```bash
# Buat database PostgreSQL
createdb raho_clinic

# Copy environment file
cp apps/api/.env.example apps/api/.env

# Edit .env dengan database credentials
nano apps/api/.env
```

### 4. Setup MinIO (Optional)
```bash
# Install MinIO atau gunakan Docker
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

---

## ⚙️ Konfigurasi

### Backend Environment (`apps/api/.env`)
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/raho_clinic"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this"
JWT_EXPIRES_IN="7d"

# MinIO
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET_DOCUMENTS="raho-documents"
MINIO_BUCKET_PHOTOS="raho-photos"
MINIO_BUCKET_INVOICES="raho-invoices"

# Server
PORT=4000
NODE_ENV="development"
```

### Frontend Environment (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"
```

---

## 🏃 Menjalankan Aplikasi

### Development Mode

#### Menjalankan Semua Services (Recommended)
```bash
# Dari root directory
npm run dev
```

#### Menjalankan Individual Services
```bash
# Backend only
npm run dev --workspace=@raho/api

# Frontend only
npm run dev --workspace=@raho/web
```

### Production Build
```bash
# Build semua apps
npm run build

# Start production
npm run start
```

### Akses Aplikasi
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:4000
- **MinIO Console**: http://localhost:9001

---

## 🗄️ Database

### Migrations
```bash
cd apps/api

# Generate migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database (DANGER!)
npx prisma migrate reset
```

### Seeding
```bash
cd apps/api

# Run all seeds
npm run seed

# Seed specific data
npx ts-node prisma/seeds/branches.seed.ts
```

### Prisma Studio
```bash
cd apps/api
npx prisma studio
```

---

## 📚 API Documentation

### Base URL
```
http://localhost:4000/api/v1
```

### Authentication
Semua endpoint (kecuali `/auth/login` dan `/auth/register`) memerlukan JWT token:
```
Authorization: Bearer <token>
```

### Main Endpoints

#### Authentication
- `POST /auth/login` - Login
- `POST /auth/register` - Register member
- `GET /auth/me` - Get current user

#### Members
- `GET /members` - Get all members
- `POST /members` - Create member
- `GET /members/:id` - Get member detail
- `PUT /members/:id` - Update member
- `POST /members/grant-access` - Grant branch access

#### Packages
- `GET /packages` - Get available packages
- `POST /packages/assign` - Assign package to member
- `POST /packages/verify-payment` - Verify payment
- `GET /packages/member/:memberId` - Get member packages

#### Sessions
- `POST /sessions` - Create treatment session
- `GET /sessions/:id` - Get session detail
- `POST /sessions/:id/diagnosis` - Add diagnosis
- `POST /sessions/:id/therapy-plan` - Add therapy plan
- `POST /sessions/:id/vital-signs` - Add vital signs
- `POST /sessions/:id/infusion` - Add infusion
- `POST /sessions/:id/materials` - Add material usage
- `POST /sessions/:id/photo` - Upload photo
- `POST /sessions/:id/evaluation` - Add evaluation
- `POST /sessions/:id/complete` - Complete session

#### Invoices
- `GET /invoices` - Get invoices
- `POST /invoices` - Create invoice
- `GET /invoices/:id` - Get invoice detail
- `POST /invoices/:id/payment` - Record payment
- `GET /invoices/package/:packageId` - Get invoice by package

#### Inventory
- `GET /inventory` - Get inventory items
- `POST /inventory/stock-request` - Create stock request
- `POST /inventory/shipment` - Create shipment
- `PUT /inventory/shipment/:id/ship` - Ship items
- `PUT /inventory/shipment/:id/receive` - Receive items

#### Admin
- `GET /admin/stats` - System statistics
- `GET /admin/health` - System health
- `GET /admin/branches/performance` - Branch performance
- `GET /admin/audit-logs` - Audit logs
- `GET /admin/users` - Get all users
- `POST /admin/users/admin-manager` - Create admin manager

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
```

### Error Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

---

## 🏗️ Arsitektur

### Modular Service Architecture

Project ini menggunakan **modular service architecture** untuk meningkatkan maintainability dan scalability:

#### Pattern
```
module/
├── module.controller.ts      # HTTP handlers
├── module.service.ts         # Main orchestrator (100-200 lines)
├── module.routes.ts          # Route definitions
├── module.schema.ts          # Zod validation schemas
└── services/                 # Specialized services
    ├── service-1.service.ts  # Domain-specific logic
    ├── service-2.service.ts
    └── README.md             # Service documentation
```

#### Modularized Modules
1. **Admin Module** (5 services)
   - SystemStatsService
   - BranchPerformanceService
   - AuditLogsService
   - PackagePricingAdminService
   - UserManagementService

2. **Members Module** (5 services)
   - MemberRetrievalService
   - MemberRegistrationService
   - MemberUpdateService
   - MemberBranchAccessService
   - MemberMedicalRecordsService

3. **Packages Module** (5 services)
   - PackageAssignmentService
   - PaymentVerificationService
   - InvoiceGenerationService
   - PackageRetrievalService
   - PackagePricingService

4. **Sessions Module** (12 services)
   - SessionCreationService
   - SessionRetrievalService
   - DiagnosisService
   - TherapyPlanService
   - VitalSignsService
   - InfusionService
   - MaterialUsageService
   - PhotoService
   - EvaluationService
   - SessionCompletionService
   - BoosterService
   - EMRNotesService

5. **Invoices Module** (4 services)
   - InvoiceCreationService
   - InvoiceRetrievalService
   - InvoicePaymentService
   - InvoiceCancellationService

6. **Inventory Module** (6 services)
   - InventoryItemsService
   - StockRequestCreationService
   - StockRequestApprovalService
   - StockRequestRetrievalService
   - ShipmentProcessingService
   - ShipmentRetrievalService

### Benefits
- ✅ Single Responsibility Principle
- ✅ Easier testing & maintenance
- ✅ Better code organization
- ✅ Reusable components
- ✅ Clear dependencies

---

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run tests for specific module
npm test -- members.service

# Watch mode
npm test -- --watch
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

---

## 🚢 Deployment

### Docker Deployment
```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Manual Deployment

#### Backend
```bash
cd apps/api
npm run build
npm run start
```

#### Frontend
```bash
cd apps/web
npm run build
npm run start
```

### Environment Variables
Pastikan semua environment variables sudah di-set untuk production:
- Database connection
- JWT secret (gunakan secret yang kuat!)
- MinIO credentials
- CORS settings

---

## 📖 Documentation

### Additional Docs
- [Modularization Summary](./MODULARIZATION-SUMMARY.md) - Service architecture
- [Sessions Modularization](./SESSIONS-MODULARIZATION-COMPLETE.md) - Session services
- [Admin Controller Fix](./ADMIN-CONTROLLER-FIX.md) - TypeScript fixes
- [Invoice Improvements](./INVOICE-IMPROVEMENTS.md) - Invoice features
- [Migration Guides](./docs/) - Various migration guides

### Service READMEs
- [Admin Services](./apps/api/src/modules/admin/services/README.md)
- [Members Services](./apps/api/src/modules/members/services/README.md)
- [Packages Services](./apps/api/src/modules/packages/services/README.md)
- [Sessions Services](./apps/api/src/modules/sessions/services/README.md)
- [Invoices Services](./apps/api/src/modules/invoices/services/README.md)
- [Inventory Services](./apps/api/src/modules/inventory/services/README.md)

---

## 🤝 Contributing

### Development Workflow
1. Create feature branch: `git checkout -b feature/nama-fitur`
2. Make changes
3. Run tests: `npm test`
4. Build: `npm run build`
5. Commit: `git commit -m "feat: deskripsi fitur"`
6. Push: `git push origin feature/nama-fitur`
7. Create Pull Request

### Commit Convention
Gunakan [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style (formatting)
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

### Code Style
- TypeScript strict mode
- ESLint + Prettier
- Modular service architecture
- Comprehensive error handling
- Audit logging for all mutations

---

## 📝 License

Proprietary - RAHO Klinik

---

## 👥 Team

- **Backend Development** - API, Database, Services
- **Frontend Development** - UI/UX, Components
- **DevOps** - Deployment, Infrastructure

---

## 📞 Support

Untuk pertanyaan atau issue, silakan hubungi tim development atau buat issue di repository.

---

## 🎉 Changelog

### v1.0.0 (2026-04-22)
- ✅ Complete service modularization (21 services)
- ✅ Multi-branch support
- ✅ 8-step treatment workflow
- ✅ Invoice system with payment proof
- ✅ Inventory management
- ✅ Admin dashboard
- ✅ Audit logging
- ✅ Role-based access control

---

**Built with ❤️ for RAHO Klinik**
