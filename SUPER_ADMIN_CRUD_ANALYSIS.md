# SUPER_ADMIN CRUD Permissions Analysis

## Overview
Analisis lengkap tentang kemampuan SUPER_ADMIN untuk melakukan operasi CRUD (Create, Read, Update, Delete) pada semua data dalam sistem.

---

## 1. BRANCHES (Cabang) ✅ FULL CRUD

### Backend Routes: `branches.routes.ts`
| Operation | Endpoint | Access | Status |
|-----------|----------|--------|--------|
| **Create** | `POST /branches` | SUPER_ADMIN, ADMIN_MANAGER | ✅ |
| **Read** | `GET /branches` | SUPER_ADMIN, ADMIN_MANAGER | ✅ |
| **Read** | `GET /branches/:branchId` | SUPER_ADMIN, ADMIN_MANAGER | ✅ |
| **Update** | `PATCH /branches/:branchId` | SUPER_ADMIN, ADMIN_MANAGER | ✅ |
| **Delete** | `DELETE /branches/:branchId` | SUPER_ADMIN, ADMIN_MANAGER | ✅ |

**Verdict**: ✅ **FULL CRUD ACCESS**

---

## 2. USERS (Pengguna) ✅ FULL CRUD

### Backend Routes: `users.routes.ts`
| Operation | Endpoint | Access | Status |
|-----------|----------|--------|--------|
| **Create** | `POST /users` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG | ✅ |
| **Read** | `GET /users` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG | ✅ |
| **Read** | `GET /users/:userId` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG | ✅ |
| **Update** | `PATCH /users/:userId` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG | ✅ |
| **Delete** | `DELETE /users/:userId` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG | ✅ |
| **Special** | `POST /users/:userId/reset-password` | SUPER_ADMIN, ADMIN_MANAGER | ✅ |

**Additional**: 
- `POST /admin/users/admin-manager` - SUPER_ADMIN only ✅
- `GET /admin/users` - SUPER_ADMIN only ✅

**Verdict**: ✅ **FULL CRUD ACCESS + SPECIAL OPERATIONS**

---

## 3. MEMBERS ⚠️ LIMITED CRUD

### Backend Routes: `members.routes.ts`
| Operation | Endpoint | Access | Status |
|-----------|----------|--------|--------|
| **Create** | `POST /members` | ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER | ❌ SUPER_ADMIN NOT LISTED |
| **Read** | `GET /members` | ALL STAFF | ✅ |
| **Read** | `GET /members/:memberId` | ALL STAFF | ✅ |
| **Update** | `PATCH /members/:memberId` | ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER | ❌ SUPER_ADMIN NOT LISTED |
| **Delete** | `DELETE /members/:memberId` | ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER | ❌ SUPER_ADMIN NOT LISTED |

**Issue**: SUPER_ADMIN tidak termasuk dalam authorize list untuk Create, Update, Delete member!

**Verdict**: ⚠️ **READ ONLY - MISSING CUD PERMISSIONS**

---

## 4. PACKAGES (Paket Member) ⚠️ LIMITED CRUD

### Backend Routes: `packages.routes.ts`
| Operation | Endpoint | Access | Status |
|-----------|----------|--------|--------|
| **Create** | `POST /members/:memberId/packages` | ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER | ❌ SUPER_ADMIN NOT LISTED |
| **Read** | `GET /members/:memberId/packages` | ALL STAFF | ✅ |
| **Update** | `PATCH /packages/:packageId` | ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER | ❌ SUPER_ADMIN NOT LISTED |
| **Delete** | `DELETE /packages/:packageId` | ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER | ❌ SUPER_ADMIN NOT LISTED |

**Package Pricing** (Master Data):
| Operation | Endpoint | Access | Status |
|-----------|----------|--------|--------|
| **Create** | `POST /package-pricings` | SUPER_ADMIN, ADMIN_MANAGER | ✅ |
| **Read** | `GET /package-pricings` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG, ADMIN_LAYANAN | ✅ |
| **Update** | `PATCH /package-pricings/:pricingId` | SUPER_ADMIN, ADMIN_MANAGER | ✅ |
| **Delete** | `DELETE /package-pricings/:pricingId` | SUPER_ADMIN, ADMIN_MANAGER | ✅ |

**Verdict**: 
- Member Packages: ⚠️ **READ ONLY**
- Package Pricing (Master): ✅ **FULL CRUD**

---

## 5. SESSIONS (Sesi Terapi) ⚠️ LIMITED CRUD

### Backend Routes: `sessions.routes.ts`
| Operation | Endpoint | Access | Status |
|-----------|----------|--------|--------|
| **Create** | `POST /sessions` | DOCTOR, NURSE, ADMIN_LAYANAN | ❌ SUPER_ADMIN NOT LISTED |
| **Read** | `GET /sessions` | ALL STAFF | ✅ |
| **Read** | `GET /sessions/:sessionId` | ALL STAFF | ✅ |
| **Update** | `PATCH /sessions/:sessionId` | DOCTOR, NURSE, ADMIN_LAYANAN | ❌ SUPER_ADMIN NOT LISTED |
| **Delete** | `DELETE /sessions/:sessionId` | ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER | ❌ SUPER_ADMIN NOT LISTED |

**Verdict**: ⚠️ **READ ONLY - MISSING CUD PERMISSIONS**

---

## 6. INVOICES (Invoice) ✅ FULL CRUD

### Backend Routes: `invoices.routes.ts`
| Operation | Endpoint | Access | Status |
|-----------|----------|--------|--------|
| **Create** | `POST /invoices` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG, ADMIN_LAYANAN | ✅ |
| **Read** | `GET /invoices` | ALL STAFF | ✅ |
| **Read** | `GET /invoices/:invoiceId` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG, ADMIN_LAYANAN | ✅ |
| **Update** | `PATCH /invoices/:invoiceId` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG, ADMIN_LAYANAN | ✅ |
| **Delete** | `POST /invoices/:invoiceId/cancel` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG, ADMIN_LAYANAN | ✅ |

**Verdict**: ✅ **FULL CRUD ACCESS**

---

## 7. REFERRALS (Kode Referral) ✅ FULL CRUD

### Backend Routes: `referrals.routes.ts`
| Operation | Endpoint | Access | Status |
|-----------|----------|--------|--------|
| **Create** | `POST /referrals` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG | ✅ |
| **Read** | `GET /referrals` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG | ✅ |
| **Read** | `GET /referrals/:referralId` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG | ✅ |
| **Update** | `PATCH /referrals/:referralId` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG | ✅ |
| **Delete** | `DELETE /referrals/:referralId` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG | ✅ |

**Verdict**: ✅ **FULL CRUD ACCESS**

---

## 8. INVENTORY (Stok) ⚠️ LIMITED CRUD

### Backend Routes: `inventory.routes.ts`
| Operation | Endpoint | Access | Status |
|-----------|----------|--------|--------|
| **Create** | `POST /inventory/items` | ADMIN_CABANG, ADMIN_LAYANAN | ❌ SUPER_ADMIN NOT LISTED |
| **Read** | `GET /inventory/items` | ALL STAFF | ✅ |
| **Read** | `GET /inventory/items/:itemId` | ALL STAFF | ✅ |
| **Update** | `PATCH /inventory/items/:itemId` | ADMIN_CABANG, ADMIN_LAYANAN | ❌ SUPER_ADMIN NOT LISTED |
| **Delete** | `DELETE /inventory/items/:itemId` | ADMIN_CABANG, ADMIN_LAYANAN | ❌ SUPER_ADMIN NOT LISTED |

**Verdict**: ⚠️ **READ ONLY - MISSING CUD PERMISSIONS**

---

## 9. NON-THERAPY PRODUCTS (Produk Non-Terapi) ✅ FULL CRUD

### Backend Routes: `non-therapy.routes.ts`
| Operation | Endpoint | Access | Status |
|-----------|----------|--------|--------|
| **Create** | `POST /non-therapy/products` | SUPER_ADMIN, ADMIN_MANAGER | ✅ |
| **Read** | `GET /non-therapy/products` | ALL STAFF | ✅ |
| **Read** | `GET /non-therapy/products/:productId` | ALL STAFF | ✅ |
| **Update** | `PATCH /non-therapy/products/:productId` | SUPER_ADMIN, ADMIN_MANAGER | ✅ |
| **Delete** | `DELETE /non-therapy/products/:productId` | SUPER_ADMIN, ADMIN_MANAGER | ✅ |

**Verdict**: ✅ **FULL CRUD ACCESS**

---

## 10. MASTER DATA ✅ FULL CRUD

### Booster Types
| Operation | Endpoint | Access | Status |
|-----------|----------|--------|--------|
| **Create** | `POST /admin/master/booster-types` | SUPER_ADMIN, ADMIN_CABANG | ✅ |
| **Read** | `GET /admin/master/booster-types` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG | ✅ |
| **Update** | `PATCH /admin/master/booster-types/:typeId` | SUPER_ADMIN, ADMIN_CABANG | ✅ |
| **Delete** | `DELETE /admin/master/booster-types/:typeId` | SUPER_ADMIN | ✅ |

### Service Types
| Operation | Endpoint | Access | Status |
|-----------|----------|--------|--------|
| **Create** | `POST /admin/master/service-types` | SUPER_ADMIN, ADMIN_CABANG | ✅ |
| **Read** | `GET /admin/master/service-types` | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG | ✅ |
| **Update** | `PATCH /admin/master/service-types/:typeId` | SUPER_ADMIN, ADMIN_CABANG | ✅ |
| **Delete** | `DELETE /admin/master/service-types/:typeId` | SUPER_ADMIN | ✅ |

**Verdict**: ✅ **FULL CRUD ACCESS**

---

## SUMMARY

### ✅ FULL CRUD ACCESS (7 modules)
1. **Branches** - Manajemen cabang
2. **Users** - Manajemen pengguna
3. **Invoices** - Invoice pembayaran
4. **Referrals** - Kode referral
5. **Non-Therapy Products** - Produk non-terapi
6. **Master Data** - Booster types, Service types
7. **Package Pricing** - Harga paket (master)

### ⚠️ READ ONLY (4 modules)
1. **Members** - Tidak bisa Create/Update/Delete member
2. **Packages** - Tidak bisa Create/Update/Delete paket member
3. **Sessions** - Tidak bisa Create/Update/Delete sesi terapi
4. **Inventory** - Tidak bisa Create/Update/Delete stok

---

## ISSUES FOUND

### 🔴 Critical: SUPER_ADMIN Missing CRUD Permissions

#### 1. Members Module
**File**: `apps/api/src/modules/members/members.routes.ts`

**Current**:
```typescript
router.post('/', 
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER']), // ❌ Missing SUPER_ADMIN
  createMember
);
```

**Should be**:
```typescript
router.post('/', 
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN']),
  createMember
);
```

#### 2. Packages Module
**File**: `apps/api/src/modules/packages/packages.routes.ts`

**Current**:
```typescript
router.post('/members/:memberId/packages',
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER']), // ❌ Missing SUPER_ADMIN
  controller.assignPackage.bind(controller)
);
```

**Should be**:
```typescript
router.post('/members/:memberId/packages',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN']),
  controller.assignPackage.bind(controller)
);
```

#### 3. Sessions Module
**File**: `apps/api/src/modules/sessions/sessions.routes.ts`

**Current**:
```typescript
router.post('/',
  authorize(['DOCTOR', 'NURSE', 'ADMIN_LAYANAN']), // ❌ Missing SUPER_ADMIN
  createSession
);
```

**Should be**:
```typescript
router.post('/',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE']),
  createSession
);
```

#### 4. Inventory Module
**File**: `apps/api/src/modules/inventory/inventory.routes.ts`

**Current**:
```typescript
router.post('/items',
  authorize(['ADMIN_CABANG', 'ADMIN_LAYANAN']), // ❌ Missing SUPER_ADMIN
  controller.createInventoryItem.bind(controller)
);
```

**Should be**:
```typescript
router.post('/items',
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN']),
  controller.createInventoryItem.bind(controller)
);
```

---

## RECOMMENDATIONS

### Priority 1: Add SUPER_ADMIN to All CRUD Operations
SUPER_ADMIN should have full CRUD access to ALL data in the system. Update the following files:

1. `apps/api/src/modules/members/members.routes.ts` - Add SUPER_ADMIN to all routes
2. `apps/api/src/modules/packages/packages.routes.ts` - Add SUPER_ADMIN to all routes
3. `apps/api/src/modules/sessions/sessions.routes.ts` - Add SUPER_ADMIN to all routes
4. `apps/api/src/modules/inventory/inventory.routes.ts` - Add SUPER_ADMIN to all routes

### Priority 2: Create Convenience Constants
Create role group constants to avoid repetition:

```typescript
// In authorize.ts
export const FULL_ADMIN_ACCESS: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN
];

export const CLINICAL_STAFF: Role[] = [
  Role.DOCTOR,
  Role.NURSE,
  Role.ADMIN_LAYANAN
];
```

### Priority 3: Test After Changes
Run comprehensive tests to ensure SUPER_ADMIN can:
- Create members
- Assign packages
- Create therapy sessions
- Manage inventory
- All other CRUD operations

---

## CONCLUSION

**Current Status**: ⚠️ **INCOMPLETE**

SUPER_ADMIN currently has:
- ✅ Full access to 7 out of 11 major modules
- ⚠️ Read-only access to 4 critical modules (Members, Packages, Sessions, Inventory)

**Required Action**: Add SUPER_ADMIN to authorize lists in 4 route files to grant full CRUD access.

**Impact**: Medium-High - SUPER_ADMIN cannot perform critical operations like creating members or managing therapy sessions.

**Effort**: Low - Simple authorization list updates in 4 files.
