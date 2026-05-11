# Web/Frontend File Structure Documentation

> Dokumentasi lengkap struktur file dan penjelasan singkat setiap file dalam `apps/web`

## 📁 Root Files

### Configuration Files
- **`package.json`** - Dependencies, scripts, dan metadata project web
- **`tsconfig.json`** - TypeScript compiler configuration
- **`next.config.js`** - Next.js configuration
- **`.env.local`** - Environment variables (API URL, etc)
- **`.env.local.example`** - Template environment variables
- **`.eslintrc.json`** - ESLint configuration
- **`postcss.config.js`** - PostCSS configuration (if exists)

---

## 📂 `/public` - Static Assets

- **`favicon.ico`** - Website favicon
- **`logo.png`** - RAHO logo
- **`images/`** - Static images
- **`fonts/`** - Custom fonts (if any)

---

## 📂 `/src` - Source Code

### Entry Point
- **`middleware.ts`** - Next.js middleware (authentication, redirects)

---

## 📂 `/src/app` - App Router (Next.js 14)

### Root Layout
- **`layout.tsx`** - Root layout wrapper
- **`page.tsx`** - Home page (redirect to login/dashboard)
- **`globals.css`** - Global CSS styles
- **`not-found.tsx`** - 404 page

---

## 🔐 `/src/app/(auth)` - Authentication Pages

### Layout
- **`layout.tsx`** - Auth layout (centered, no sidebar)

### Pages
- **`login/page.tsx`** - Login page
  - Email/password form
  - JWT token storage
  - Role-based redirect
  - Remember me functionality

- **`register/page.tsx`** - Member registration page (if exists)
  - Member self-registration
  - Auto-generate member number
  - Profile creation

---

## 👥 `/src/app/(staff)` - Staff Portal

### Layout
- **`layout.tsx`** - Staff layout with sidebar & header
  - Role-based navigation
  - Branch selector
  - User profile dropdown
  - Logout functionality

### Dashboard
- **`dashboard/page.tsx`** - Main dashboard
  - System statistics cards
  - Revenue charts
  - Member growth
  - Session statistics
  - Quick actions

---

## 👤 `/src/app/(staff)/members` - Member Management

### Pages
- **`page.tsx`** - Member list
  - Search & filter
  - Pagination
  - Member cards with photo
  - Quick actions (view, edit)

- **`new/page.tsx`** - Create new member
  - Registration form
  - Photo upload
  - Branch assignment
  - Auto-generate member number

- **`[memberId]/page.tsx`** - Member detail
  - **5 tabs**: Profil, Paket, Sesi Terapi, Diagnosa, Therapy Plan
  - Member info & photo
  - Package management
  - Session history
  - Medical records
  - Actions: Edit, Send Notification

- **`[memberId]/edit/page.tsx`** - Edit member
  - Update profile
  - Change photo
  - Update medical info

---

## 📦 `/src/app/(staff)/packages` - Package Management (if exists)

### Pages
- **`page.tsx`** - Package list
- **`pricing/page.tsx`** - Package pricing management

---

## 🏥 `/src/app/(staff)/sessions` - Treatment Sessions

### Pages
- **`page.tsx`** - Session list
  - Filter by status, date, member
  - Session cards
  - Quick view

- **`[sessionId]/page.tsx`** - Session detail
  - 8-step workflow display
  - Step completion status
  - Edit each step
  - Complete session

- **`new/page.tsx`** - Create new session (if exists)
  - Select member
  - Select package
  - Assign doctor/nurse

---

## 🏢 `/src/app/(staff)/branches` - Branch Management

### Pages
- **`page.tsx`** - Branch list
  - Branch cards
  - Statistics per branch
  - Quick actions

- **`[branchId]/page.tsx`** - Branch detail
  - Branch info
  - Staff list
  - Member list
  - Inventory
  - Performance metrics

- **`[branchId]/edit/page.tsx`** - Edit branch
  - Update branch info
  - Manage staff
  - Configure settings

- **`create/page.tsx`** - Create new branch
  - Branch registration form
  - Initial setup

---

## 📊 `/src/app/(staff)/inventory` - Inventory Management

### Pages
- **`page.tsx`** - Inventory list
  - Branch inventory view
  - Stock levels
  - Low stock alerts
  - CRUD operations

- **`stock-requests/page.tsx`** - Stock requests
  - Create request
  - Approve/reject
  - Request history

- **`shipments/page.tsx`** - Shipments
  - Create shipment
  - Ship items
  - Receive items
  - Shipment tracking

---

## 🔧 `/src/app/(staff)/admin` - Admin Pages

### Super Admin
- **`super-admin/page.tsx`** - Super admin dashboard
  - System overview
  - User management
  - System settings

### Admin Manager
- **`admin-manager/page.tsx`** - Admin manager dashboard (if exists)
  - Multi-branch overview
  - Manager-specific features

### Master Data
- **`master-products/page.tsx`** - Product master data
  - CRUD products
  - Product categories
  - Pricing

- **`package-pricing/page.tsx`** - Package pricing
  - Manage pricing per branch
  - Discount rules
  - Price history

### System
- **`audit-logs/page.tsx`** - Audit logs
  - View all system activities
  - Filter by user, action, date
  - Export logs

- **`users/page.tsx`** - User management
  - Create/edit users
  - Role assignment
  - Branch access

### Branch Management
- **`branches/page.tsx`** - Branch management (admin view)
  - All branches overview
  - Performance comparison

- **`cabang/stock-request/page.tsx`** - Branch stock requests (admin view)

---

## 📄 `/src/app/(staff)/invoices` - Invoice Management (if exists)

### Pages
- **`page.tsx`** - Invoice list
- **`[invoiceId]/page.tsx`** - Invoice detail

---

## 🎯 `/src/app/(staff)/referrals` - Referral Management (if exists)

### Pages
- **`page.tsx`** - Referral list
- **`[referralId]/page.tsx`** - Referral detail

---

## 👨‍⚕️ `/src/app/(member)` - Member Portal (if exists)

### Layout
- **`layout.tsx`** - Member portal layout

### Pages
- **`dashboard/page.tsx`** - Member dashboard
- **`profile/page.tsx`** - Member profile
- **`packages/page.tsx`** - My packages
- **`sessions/page.tsx`** - My sessions

---

## 🧩 `/src/components` - React Components

### Layout Components
- **`layout/`**
  - `Sidebar.tsx` - Navigation sidebar
    - Role-based menu items
    - Branch selector
    - Collapsible sections
  - `Header.tsx` - Top header bar (if exists)
  - `Footer.tsx` - Footer (if exists)

### Member Components
- **`members/`**
  - `MemberCard.tsx` - Member card display
  - `MemberHeader.tsx` - Member detail header
  - `MemberStatusCards.tsx` - Status overview cards
  - `MemberProfileTab.tsx` - Profile tab content
  - `MemberPackagesTab.tsx` - Packages tab content
  - `MemberSessionsTab.tsx` - Sessions tab content
  - `MemberDiagnosesTab.tsx` - Diagnoses tab content
  - `MemberTherapyPlansTab.tsx` - Therapy plans tab content
  - `MemberIncentiveCard.tsx` - Referral incentive display
  - `SendNotificationModal.tsx` - Send notification modal
  - `ViewPaymentProofButton.tsx` - View payment proof button

### Package Components
- **`members/`** (Package-related)
  - `PackageCard.tsx` - Package display card
    - Bundle support
    - Discount display (percentage + amount)
    - Status badges
    - Actions (Edit, Refund, Cancel)
  - `AssignPackageModal/` - Assign package modal
    - `index.tsx` - Main modal
    - `BasicPackageSection.tsx` - Basic package selection
    - `BoosterPackageSection.tsx` - Booster package selection
    - `AddOnSection.tsx` - Add-on selection
    - `DiscountSection.tsx` - Discount input
    - `PreviewSection.tsx` - Order preview
  - `EditPackageModal/` - Edit package modal
    - `index.tsx` - Main modal (reuses AssignPackageModal components)
  - `VerifyPaymentModal.tsx` - Payment verification modal
  - `PackageRefundModal.tsx` - Refund modal
  - `PackageCancelModal.tsx` - Cancel modal

### Session Components
- **`sessions/`**
  - `SessionCard.tsx` - Session card display
  - `CreateSessionModal.tsx` - Create session modal
    - 8-step workflow
    - Step navigation
  - `Step1Diagnosis.tsx` - Diagnosis step
  - `Step2TherapyPlan.tsx` - Therapy plan step
  - `Step3VitalSignsBefore.tsx` - Pre-treatment vitals
  - `Step4Infusion.tsx` - Infusion step
  - `Step5MaterialUsage.tsx` - Material usage step (if exists)
  - `Step6Materials.tsx` - Material selection
  - `Step7VitalSignsAfter.tsx` - Post-treatment vitals
  - `Step8Evaluation.tsx` - Evaluation step

### Invoice Components
- **`invoices/`**
  - `InvoiceCard.tsx` - Invoice card display (if exists)
  - `InvoiceDocument.tsx` - Printable invoice
    - Professional layout
    - Company header
    - Line items
    - Discount & tax
    - Payment info
  - `InvoiceDocument.module.css` - Invoice styles
  - `InvoiceView.module.css` - Invoice view styles
  - `ViewInvoiceButton.tsx` - View invoice button
  - `PaymentProofModal.tsx` - Payment proof modal

### Branch Components
- **`branches/`**
  - `BranchCard.tsx` - Branch card display
  - `StaffCrudModal.tsx` - Staff CRUD modal
  - `MemberCrudModal.tsx` - Member CRUD modal
  - `InventoryCrudModal.tsx` - Inventory CRUD modal

### Inventory Components
- **`inventory/`** (if exists)
  - `InventoryCard.tsx` - Inventory item card
  - `StockRequestModal.tsx` - Stock request modal
  - `ShipmentModal.tsx` - Shipment modal

### Admin Components
- **`admin/`** (if exists)
  - `UserManagementTable.tsx` - User management table
  - `AuditLogTable.tsx` - Audit log table
  - `SystemStatsCards.tsx` - System statistics cards

### UI Components
- **`ui/`** (Reusable components)
  - `Button.tsx` - Button component
  - `Input.tsx` - Input component
  - `Select.tsx` - Select dropdown
  - `Modal.tsx` - Modal wrapper
  - `Card.tsx` - Card wrapper
  - `Badge.tsx` - Badge component
  - `Spinner.tsx` - Loading spinner
  - `Toast.tsx` - Toast notification
  - `Tabs.tsx` - Tab component
  - `Table.tsx` - Table component
  - `Pagination.tsx` - Pagination component

---

## 📚 `/src/lib` - Utility Libraries

### API Clients
- **`api.ts`** - Base Axios instance
  - Base URL configuration
  - Request/response interceptors
  - Error handling
  - Token injection

- **`membersApi.ts`** - Member API calls
  - getMembersList()
  - getMemberDetailApi()
  - createMemberApi()
  - updateMemberApi()
  - sendNotificationApi()

- **`packagesApi.ts`** - Package API calls
  - getPackagePricings()
  - getMemberPackages()
  - assignPackage()
  - editPackage()
  - refundPackage()
  - cancelPackage()
  - verifyPayment()
  - uploadPaymentProof()

- **`dashboardApi.ts`** - Dashboard API calls
  - getSystemStats()
  - getRevenueData()
  - getMemberGrowth()

- **`api/`** - Organized API clients
  - `branchesApi.ts` - Branch operations
  - `inventoryApi.ts` - Inventory operations
  - `sessionsApi.ts` - Session operations
  - `invoicesApi.ts` - Invoice operations
  - `adminApi.ts` - Admin operations

### Utilities
- **`formatNumber.ts`** - Number formatting
  - formatCurrency() - Format to Rupiah
  - formatNumberWithDots() - Thousand separator

- **`formatDate.ts`** - Date formatting
  - formatDate() - Format date
  - formatDateTime() - Format date & time
  - formatRelativeTime() - Relative time (e.g., "2 hours ago")

- **`toast.ts`** - Toast notifications
  - showToast.success()
  - showToast.error()
  - showToast.info()
  - showToast.warning()

- **`pdfGenerator.ts`** - PDF generation
  - generateInvoicePDF() - Generate invoice PDF
  - downloadPDF() - Download PDF file

- **`validation.ts`** - Form validation helpers (if exists)

- **`constants.ts`** - App constants (if exists)

---

## 🗂️ `/src/types` - TypeScript Types

### Core Types
- **`user.ts`** - User types
  - User
  - UserRole
  - Profile

- **`member.ts`** - Member types
  - Member
  - MemberDetail
  - MemberBranch

- **`package.ts`** - Package types
  - PackagePricing
  - MemberPackage
  - PackageDisplay
  - BoosterType
  - ExtendedBoosterType
  - ServiceType
  - AddOnType
  - PackageStatus

- **`session.ts`** - Session types
  - TherapySession
  - SessionStep
  - SessionStatus
  - Diagnosis
  - TherapyPlan
  - VitalSigns
  - Infusion
  - Evaluation

- **`invoice.ts`** - Invoice types
  - Invoice
  - InvoiceItem
  - InvoiceStatus
  - InvoiceItemType

- **`branch.ts`** - Branch types
  - Branch
  - BranchType
  - StaffBranch

- **`inventory.ts`** - Inventory types
  - InventoryItem
  - BranchInventory
  - StockRequest
  - Shipment

- **`referral.ts`** - Referral types (if exists)
  - ReferralCode
  - ReferrerType
  - IncentiveType

- **`api.ts`** - API response types
  - ApiResponse<T>
  - ApiError
  - PaginatedResponse<T>

---

## 🎨 `/src/styles` - CSS Modules

### Global Styles
- **`globals.css`** - Global CSS variables & resets
  - CSS custom properties (colors, spacing, etc)
  - Dark theme variables
  - Typography
  - Utility classes

### Component Styles
- **`dashboard.module.css`** - Dashboard styles
- **`members.module.css`** - Member list styles
- **`member-detail.module.css`** - Member detail styles
- **`branches.module.css`** - Branch styles
- **`branch-detail.module.css`** - Branch detail styles
- **`sessions.module.css`** - Session styles
- **`inventory.module.css`** - Inventory styles
- **`crud-modal.module.css`** - CRUD modal styles
- **`MemberPackagesTab.module.css`** - Package tab styles

### Layout Styles
- **`sidebar.module.css`** - Sidebar styles
- **`header.module.css`** - Header styles (if exists)

---

## 🏪 `/src/stores` - State Management (Zustand)

- **`authStore.ts`** - Authentication state
  - user
  - token
  - isAuthenticated
  - login()
  - logout()
  - setUser()

- **`branchStore.ts`** - Branch selection state (if exists)
  - selectedBranch
  - setSelectedBranch()

- **`uiStore.ts`** - UI state (if exists)
  - sidebarOpen
  - toggleSidebar()

---

## 🔧 `/src/hooks` - Custom React Hooks (if exists)

- **`useAuth.ts`** - Authentication hook
- **`useBranch.ts`** - Branch selection hook
- **`useDebounce.ts`** - Debounce hook
- **`useLocalStorage.ts`** - LocalStorage hook
- **`usePagination.ts`** - Pagination hook

---

## 🎨 Design System - RAHO Dark Theme

### Color Palette (CSS Variables)
```css
--color-primary-400: #60a5fa
--color-primary-500: #3b82f6
--color-primary-600: #2563eb

--surface-primary: #1a1d29
--surface-secondary: #22252f
--surface-tertiary: #2a2d37
--surface-border: #3a3d47

--text-primary: #e5e7eb
--text-secondary: #9ca3af
--text-tertiary: #6b7280

--success: #10b981
--warning: #f59e0b
--error: #ef4444
--info: #3b82f6
```

### Typography
- **Font Family**: System fonts (San Francisco, Segoe UI, etc)
- **Font Sizes**: 12px - 48px
- **Font Weights**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

### Spacing
- **Base Unit**: 4px
- **Scale**: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px

### Border Radius
- **Small**: 4px
- **Medium**: 8px
- **Large**: 12px
- **XLarge**: 16px

### Shadows
- **Small**: 0 1px 2px rgba(0, 0, 0, 0.05)
- **Medium**: 0 4px 6px rgba(0, 0, 0, 0.1)
- **Large**: 0 10px 15px rgba(0, 0, 0, 0.1)

---

## 🔐 Authentication Flow

### Login Process
1. User enters email & password
2. POST `/api/v1/auth/login`
3. Receive JWT token (access + refresh)
4. Store token in localStorage
5. Store user data in Zustand store
6. Redirect based on role:
   - SUPER_ADMIN → `/admin/super-admin`
   - ADMIN_MANAGER → `/admin-manager`
   - ADMIN_LAYANAN → `/dashboard`
   - DOCTOR/NURSE → `/sessions`
   - MEMBER → `/me/dashboard`

### Protected Routes
- Middleware checks token in localStorage
- Validates token with API
- Redirects to `/login` if invalid
- Injects token in API requests

### Logout Process
1. Clear localStorage
2. Clear Zustand store
3. Redirect to `/login`

---

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

### Mobile Optimizations
- Collapsible sidebar
- Touch-friendly buttons
- Responsive tables
- Mobile-first CSS

---

## 🎯 Key Features Implementation

### Package Management
- **Bundle Display**: Shows multiple packages grouped
- **Discount Display**: "30% + Rp 2.000.000" format
- **Edit Modal**: Full assign-like modal for editing
- **Refund Modal**: Reason + amount input
- **Cancel Modal**: Reason input
- **Payment Proof**: Upload & view functionality

### Session Workflow
- **8-Step Process**: Sequential workflow
- **Step Validation**: Can't proceed without completing previous steps
- **Material Tracking**: Inventory deduction
- **Photo Upload**: Session documentation
- **EMR Integration**: Medical records

### Invoice System
- **Professional Layout**: Company header, line items
- **PDF Generation**: Client-side PDF generation
- **Payment Proof**: Upload & view
- **Print Functionality**: Browser print

### Inventory Management
- **Stock Levels**: Real-time stock display
- **Low Stock Alerts**: Visual indicators
- **Request Workflow**: Create → Approve → Ship → Receive
- **Shipment Tracking**: Status updates

---

## 🧪 Testing (if exists)

### Test Files
- **`__tests__/`** - Test files
- **`*.test.tsx`** - Component tests
- **`*.spec.tsx`** - Integration tests

### Testing Libraries
- Jest
- React Testing Library
- MSW (Mock Service Worker)

---

## 📦 Dependencies Highlights

### Production
- **next** - React framework
- **react** - UI library
- **typescript** - Type safety
- **axios** - HTTP client
- **zustand** - State management
- **date-fns** - Date utilities
- **react-hook-form** - Form handling (if used)
- **zod** - Schema validation (if used)

### Development
- **@types/react** - React types
- **@types/node** - Node types
- **eslint** - Linting
- **prettier** - Code formatting (if used)

---

## 🚀 Build & Deployment

### Build Process
```bash
npm run build
```
- TypeScript compilation
- Next.js optimization
- Static asset generation
- CSS bundling

### Output
- **`.next/`** - Build output
- **`out/`** - Static export (if used)

### Environment Variables
- `NEXT_PUBLIC_API_URL` - API base URL
- `NEXT_PUBLIC_MINIO_URL` - MinIO URL (if needed)

---

## 📊 Performance Optimizations

1. **Code Splitting** - Automatic by Next.js
2. **Image Optimization** - Next.js Image component
3. **Lazy Loading** - Dynamic imports for heavy components
4. **Memoization** - React.memo, useMemo, useCallback
5. **CSS Modules** - Scoped styles, no global conflicts
6. **API Caching** - SWR or React Query (if used)

---

## 🎨 Component Patterns

### Container/Presentational Pattern
- **Container**: Data fetching & logic
- **Presentational**: UI rendering

### Composition Pattern
- Small, reusable components
- Compose complex UIs from simple parts

### Render Props Pattern (if used)
- Share code between components

### Custom Hooks Pattern
- Extract reusable logic

---

## 📝 Code Style Guidelines

### Naming Conventions
- **Components**: PascalCase (e.g., `MemberCard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.ts`)
- **Utils**: camelCase (e.g., `formatCurrency.ts`)
- **Types**: PascalCase (e.g., `Member`, `PackageDisplay`)
- **CSS Modules**: camelCase (e.g., `memberCard`, `primaryButton`)

### File Organization
- One component per file
- Co-locate related files (component + styles + types)
- Group by feature, not by type

### Import Order
1. React & Next.js
2. Third-party libraries
3. Internal utilities
4. Types
5. Styles

---

## 🔍 Debugging Tools

### Browser DevTools
- React DevTools
- Redux DevTools (if using Redux)
- Network tab for API calls
- Console for errors

### VS Code Extensions
- ESLint
- Prettier
- TypeScript
- Auto Import

---

**Last Updated:** 2026-05-05  
**Total Files:** 150+ files  
**Total Components:** 50+ components  
**Total Pages:** 30+ pages  
**Total API Clients:** 10+ clients
