# Branch-Specific Pricing Guide

## Overview

Sistem RAHO **SUDAH SEPENUHNYA MENDUKUNG** branch-specific pricing. Setiap cabang dapat memiliki harga paket yang berbeda, atau menggunakan harga global yang berlaku untuk semua cabang.

## Konsep Pricing

### 1. Global Pricing (Harga Global)
- **branchId = null**
- Berlaku untuk SEMUA cabang yang tidak memiliki pricing khusus
- Hanya bisa dikelola oleh **SUPER_ADMIN** dan **ADMIN_MANAGER**

### 2. Branch-Specific Pricing (Harga Per Cabang)
- **branchId = ID cabang tertentu**
- Override/menggantikan harga global untuk cabang tersebut
- Bisa dikelola oleh **ADMIN_CABANG** (hanya untuk cabangnya sendiri) dan admin level lebih tinggi

## Database Schema

```prisma
model PackagePricing {
  id            String      @id @default(cuid())
  branchId      String?     // NULL = global, specific ID = branch-specific
  packageType   PackageType // BASIC atau BOOSTER
  boosterType   String?     // NO, GT, MB, KCL, H2S, HK, O3
  serviceType   String?     // HC, PS, PHC, PTY, PDA
  productCode   String?     // e.g., TNB-P7-HC, BST-NO-P1-HC
  name          String
  totalSessions Int
  price         Decimal     @db.Decimal(12, 2)
  isActive      Boolean     @default(true)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  branch         Branch?         @relation(fields: [branchId], references: [id])
  memberPackages MemberPackage[]

  @@unique([branchId, packageType, boosterType, serviceType, totalSessions])
  @@map("package_pricings")
}
```

## Permission Matrix

| Role | View Pricing | Create Pricing | Update Pricing | Delete Pricing | Scope |
|------|-------------|----------------|----------------|----------------|-------|
| **SUPER_ADMIN** | ✅ All | ✅ Global + All Branches | ✅ All | ✅ All | Global + All branches |
| **ADMIN_MANAGER** | ✅ All | ✅ Global + All Branches | ✅ All | ✅ All | Global + All branches |
| **ADMIN_CABANG** | ✅ Own Branch Only | ✅ Own Branch Only | ✅ Own Branch Only | ✅ Own Branch Only | Own branch only |

### Permission Logic

#### ADMIN_CABANG (Branch Admin)
```typescript
// Automatically filtered to their branch
if (user.role === 'ADMIN_CABANG' && user.branchId) {
  filters.branchId = user.branchId;  // Only see their branch pricing
  data.branchId = user.branchId;      // Can only create for their branch
}
```

#### SUPER_ADMIN & ADMIN_MANAGER
- Can view ALL pricing (global + all branches)
- Can create global pricing (`branchId = null`)
- Can create branch-specific pricing for ANY branch
- Can update/delete any pricing

## API Endpoints

Base URL: `/api/admin/package-pricing`

### 1. Get All Pricing
```http
GET /api/admin/package-pricing?packageType=BASIC&branchId=xyz&page=1&limit=50
Authorization: Bearer <token>
```

**Query Parameters:**
- `packageType`: BASIC | BOOSTER (optional)
- `branchId`: Filter by branch ID (optional)
- `isActive`: true | false (optional)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "pricings": [
      {
        "id": "clxxx",
        "packageType": "BASIC",
        "boosterType": null,
        "serviceType": "HC",
        "name": "Paket BASIC 7 Sesi - Home Care",
        "productCode": "TNB-P7-HC",
        "totalSessions": 7,
        "price": 5000000,
        "isActive": true,
        "branchId": "clyyy",
        "branch": {
          "id": "clyyy",
          "name": "RAHO Surabaya",
          "branchCode": "SBY"
        },
        "createdAt": "2026-06-19T00:00:00.000Z",
        "updatedAt": "2026-06-19T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "totalPages": 2
    }
  }
}
```

### 2. Get Single Pricing
```http
GET /api/admin/package-pricing/:pricingId
Authorization: Bearer <token>
```

### 3. Create Pricing
```http
POST /api/admin/package-pricing
Authorization: Bearer <token>
Content-Type: application/json

{
  "packageType": "BASIC",
  "serviceType": "HC",
  "name": "Paket BASIC 7 Sesi - Home Care",
  "productCode": "TNB-P7-HC",
  "totalSessions": 7,
  "price": 5000000,
  "isActive": true,
  "branchId": "clyyy"  // Optional: null = global pricing
}
```

**For BOOSTER Packages:**
```json
{
  "packageType": "BOOSTER",
  "boosterType": "NO",
  "serviceType": "HC",
  "name": "Booster NO 1 Sesi - Home Care",
  "productCode": "BST-NO-P1-HC",
  "totalSessions": 1,
  "price": 500000,
  "branchId": "clyyy"
}
```

### 4. Update Pricing
```http
PATCH /api/admin/package-pricing/:pricingId
Authorization: Bearer <token>
Content-Type: application/json

{
  "price": 5500000,
  "isActive": true
}
```

**Note:** Perubahan pricing TIDAK mempengaruhi paket member yang sudah ada, karena MemberPackage menyimpan snapshot data saat assignment.

### 5. Delete Pricing
```http
DELETE /api/admin/package-pricing/:pricingId
Authorization: Bearer <token>
```

**Protection:** Tidak bisa delete pricing yang sedang digunakan oleh member packages.

## Business Flow

### Flow 1: Setup Global Pricing (SUPER_ADMIN/ADMIN_MANAGER)

1. **Login sebagai SUPER_ADMIN atau ADMIN_MANAGER**
2. **Buat Global Pricing** (branchId = null):
   ```json
   POST /api/admin/package-pricing
   {
     "packageType": "BASIC",
     "serviceType": "HC",
     "totalSessions": 7,
     "price": 5000000,
     "branchId": null  // Global pricing
   }
   ```
3. **Pricing ini berlaku untuk SEMUA cabang** yang belum memiliki pricing khusus

### Flow 2: Setup Branch-Specific Pricing (ADMIN_CABANG)

1. **Login sebagai ADMIN_CABANG** cabang Surabaya
2. **User sudah memiliki `branchId` di profile mereka**
3. **Buat Branch-Specific Pricing**:
   ```json
   POST /api/admin/package-pricing
   {
     "packageType": "BASIC",
     "serviceType": "HC",
     "totalSessions": 7,
     "price": 4500000  // Harga khusus Surabaya
     // branchId akan auto-set ke branchId user (SBY)
   }
   ```
4. **Pricing ini hanya berlaku untuk cabang Surabaya**
5. **Override global pricing** untuk cabang tersebut

### Flow 3: Member Beli Package

1. **Staff assign package ke member** di cabang Surabaya
2. **System lookup pricing**:
   ```typescript
   // Priority: Branch-specific > Global
   const pricing = await findPricing({
     branchId: 'SBY',
     packageType: 'BASIC',
     totalSessions: 7
   });
   ```
3. **System menggunakan harga Surabaya** (Rp 4.500.000) bukan harga global (Rp 5.000.000)
4. **Snapshot price disimpan di `MemberPackage`**

## Validation Rules

### 1. Unique Constraint
Tidak boleh ada 2 pricing dengan kombinasi yang sama:
- `branchId` (null untuk global)
- `packageType`
- `boosterType`
- `serviceType`
- `totalSessions`

### 2. Required Fields
- **BASIC Package**: `packageType`, `name`, `totalSessions`, `price`
- **BOOSTER Package**: Semua field BASIC + `boosterType` + `serviceType`

### 3. Branch Validation
- Jika `branchId` provided, branch harus exist
- ADMIN_CABANG hanya bisa manage pricing untuk cabangnya sendiri

### 4. Delete Protection
- Tidak bisa delete pricing yang sedang digunakan
- System check `MemberPackage.packagePricingId`

## Frontend Implementation Recommendations

### 1. Admin Pricing Management Page

**Route:** `/admin/package-pricing`

**Features:**
- List all pricing dengan filter (packageType, branch, isActive)
- Create new pricing form
- Edit pricing modal
- Delete pricing (with confirmation)
- Toggle active/inactive status

**UI Components:**
```tsx
// Sample structure
<PackagePricingList>
  <Filters>
    <PackageTypeFilter />
    <BranchFilter />  // ADMIN_CABANG: readonly (own branch)
    <ActiveFilter />
  </Filters>
  
  <PricingTable>
    <PricingRow>
      <BranchBadge />  // "Global" or "SBY"
      <PackageInfo />
      <PriceDisplay />
      <StatusBadge />
      <ActionButtons />
    </PricingRow>
  </PricingTable>
  
  <CreatePricingButton />
</PackagePricingList>
```

### 2. Branch Selection Logic

```typescript
// For ADMIN_CABANG
const canSelectBranch = ['SUPER_ADMIN', 'ADMIN_MANAGER'].includes(user.role);

<BranchSelect 
  value={branchId}
  onChange={setBranchId}
  disabled={!canSelectBranch}  // ADMIN_CABANG can't change
  allowNull={canSelectBranch}  // Allow "Global" option
  nullLabel="Global (Semua Cabang)"
/>
```

### 3. Price Display Priority

```typescript
// Show which price is being used
const getPriceLabel = (pricing) => {
  if (!pricing.branchId) {
    return "Harga Global";
  }
  return `Harga ${pricing.branch.name}`;
};

const isOverriding = (pricing, globalPricing) => {
  return pricing.branchId && globalPricing;
};
```

## Testing Scenarios

### Test 1: Global Pricing Creation (SUPER_ADMIN)
```bash
curl -X POST /api/admin/package-pricing \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "packageType": "BASIC",
    "serviceType": "HC",
    "totalSessions": 7,
    "price": 5000000,
    "name": "Paket BASIC 7 Sesi - Home Care",
    "branchId": null
  }'
```

### Test 2: Branch-Specific Pricing (ADMIN_CABANG)
```bash
curl -X POST /api/admin/package-pricing \
  -H "Authorization: Bearer $ADMIN_CABANG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "packageType": "BASIC",
    "serviceType": "HC",
    "totalSessions": 7,
    "price": 4500000,
    "name": "Paket BASIC 7 Sesi - Home Care (Surabaya)"
  }'
# branchId akan auto-set dari user.branchId
```

### Test 3: ADMIN_CABANG Cannot Create for Other Branch
```bash
curl -X POST /api/admin/package-pricing \
  -H "Authorization: Bearer $ADMIN_CABANG_SBY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "packageType": "BASIC",
    "serviceType": "HC",
    "totalSessions": 7,
    "price": 4500000,
    "branchId": "OTHER_BRANCH_ID"  # Will be overridden
  }'
# System akan force branchId = user.branchId (SBY)
```

## Summary

✅ **Backend SUDAH LENGKAP:**
- Database schema dengan branch support
- Full CRUD API dengan permission control
- Service layer dengan validation
- ADMIN_CABANG restrictions implemented

❓ **Yang Perlu Dicek:**
- Apakah sudah ada frontend UI untuk manage pricing?
- Jika belum, perlu dibuat page di `/admin/package-pricing`

## Next Steps

1. ✅ Schema sudah siap
2. ✅ Backend API sudah lengkap  
3. ✅ Permissions sudah implemented
4. ⏳ Cek apakah frontend UI sudah ada
5. ⏳ Jika belum, buat UI untuk pricing management

## Contact

Untuk pertanyaan lebih lanjut tentang implementation, silakan refer ke:
- **Service**: `apps/api/src/modules/admin/services/package-pricing-admin.service.ts`
- **Controller**: `apps/api/src/modules/admin/admin.controller.ts`
- **Routes**: `apps/api/src/modules/admin/admin.routes.ts`
- **Schema**: `apps/api/prisma/schema.prisma` (model PackagePricing)
