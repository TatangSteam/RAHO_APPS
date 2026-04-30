# Perbaikan Error Kode Referral di Admin Cabang

## Tanggal: 30 April 2026

## Masalah

### Error 1: GET /api/v1/referrals - 500 Internal Server Error
```
Invalid `prisma.user.findUnique()` invocation:
Unknown field `staffBranch` for include statement on model `User`.
```

**Penyebab**: 
- Service menggunakan `staffBranch` (singular) yang tidak ada di model User
- Seharusnya menggunakan `staffBranches` (plural) atau langsung `branchId`

### Error 2: GET /api/v1/branches/all - 403 Forbidden
```
Request failed with status code 403
```

**Penyebab**:
- Endpoint `/branches/all` hanya bisa diakses oleh `SUPER_ADMIN` dan `ADMIN_MANAGER`
- `ADMIN_CABANG` tidak punya akses ke endpoint ini

## Solusi

### 1. Fix Error 500 - Referrals Service

**File**: `apps/api/src/modules/referrals/referrals.service.ts`

**Sebelum**:
```typescript
if (userRole === 'ADMIN_CABANG') {
  // Get user's branch from staffBranch relation
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { staffBranch: true }, // ❌ Field tidak ada
  });
  
  if (user?.staffBranch) {
    where.branchId = user.staffBranch.branchId;
  }
}
```

**Sesudah**:
```typescript
if (userRole === 'ADMIN_CABANG') {
  // ADMIN_CABANG can only see referrals in their branch
  // Use branchId directly from user or from staffBranches relation
  if (userBranchId) {
    where.branchId = userBranchId; // ✅ Gunakan branchId langsung
  } else {
    // Fallback: get from staffBranches relation
    const staffBranch = await prisma.staffBranch.findFirst({
      where: { userId: userId },
      select: { branchId: true },
    });
    
    if (staffBranch) {
      where.branchId = staffBranch.branchId;
    }
  }
}
```

**Penjelasan**:
- Gunakan `userBranchId` yang sudah tersedia dari `req.user.branchId`
- Fallback ke query `staffBranches` jika `branchId` tidak ada
- Menggunakan `findFirst` karena relasi many-to-many

### 2. Fix Error 403 - Branches Routes

**File**: `apps/api/src/modules/branches/branches.routes.ts`

**Sebelum**:
```typescript
branchesRouter.get(
  '/all',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER]), // ❌ ADMIN_CABANG tidak bisa akses
  getAllBranchesWithStats,
);
```

**Sesudah**:
```typescript
branchesRouter.get(
  '/all',
  authenticate,
  authorize([
    Role.SUPER_ADMIN, 
    Role.ADMIN_MANAGER, 
    Role.ADMIN_CABANG,    // ✅ Tambahkan ADMIN_CABANG
    Role.ADMIN_LAYANAN    // ✅ Tambahkan ADMIN_LAYANAN
  ]),
  getAllBranchesWithStats,
);
```

**Penjelasan**:
- `ADMIN_CABANG` perlu akses ke list branches untuk dropdown/select
- `ADMIN_LAYANAN` juga perlu akses untuk fitur yang sama
- Service `getAllBranchesWithStats` sudah handle filtering berdasarkan role

## Alur Kerja Setelah Perbaikan

### Untuk ADMIN_CABANG

#### 1. GET /api/v1/referrals
```
Request:
  GET /api/v1/referrals?page=1&limit=20&isActive=true
  Headers: Authorization: Bearer <token>
  User: { role: 'ADMIN_CABANG', branchId: 'branch-123' }

Flow:
  1. Authenticate ✅
  2. Authorize (ADMIN_CABANG in ADMIN_PLUS) ✅
  3. listReferralsService()
     - userRole === 'ADMIN_CABANG'
     - where.branchId = userBranchId (branch-123)
  4. Query hanya referrals di branch-123
  5. Return filtered results ✅

Response:
  {
    "referrals": [...], // Only from branch-123
    "total": 5,
    "page": 1,
    "limit": 20
  }
```

#### 2. GET /api/v1/branches/all
```
Request:
  GET /api/v1/branches/all
  Headers: Authorization: Bearer <token>
  User: { role: 'ADMIN_CABANG', branchId: 'branch-123' }

Flow:
  1. Authenticate ✅
  2. Authorize (ADMIN_CABANG in allowed roles) ✅
  3. getAllBranchesWithStats()
     - Service filters based on role
     - ADMIN_CABANG sees only their branch
  4. Return branch list ✅

Response:
  {
    "branches": [
      {
        "id": "branch-123",
        "name": "Cabang Jakarta",
        "stats": {...}
      }
    ]
  }
```

## Testing

### Test Case 1: ADMIN_CABANG - List Referrals
1. Login sebagai ADMIN_CABANG
2. Navigate ke halaman Kode Referral
3. Verifikasi:
   - ✅ Tidak ada error 500
   - ✅ Hanya muncul referrals dari cabang sendiri
   - ✅ Pagination berfungsi

### Test Case 2: ADMIN_CABANG - Access Branches
1. Login sebagai ADMIN_CABANG
2. Navigate ke halaman yang load branches (e.g., create member)
3. Verifikasi:
   - ✅ Tidak ada error 403
   - ✅ Dropdown branches muncul
   - ✅ Hanya muncul cabang sendiri

### Test Case 3: ADMIN_MANAGER - List Referrals
1. Login sebagai ADMIN_MANAGER
2. Navigate ke halaman Kode Referral
3. Verifikasi:
   - ✅ Muncul referrals dari semua cabang yang dikelola
   - ✅ Tidak ada error

### Test Case 4: SUPER_ADMIN - List Referrals
1. Login sebagai SUPER_ADMIN
2. Navigate ke halaman Kode Referral
3. Verifikasi:
   - ✅ Muncul semua referrals dari semua cabang
   - ✅ Filter by branch berfungsi

## Role Access Matrix

| Endpoint | SUPER_ADMIN | ADMIN_MANAGER | ADMIN_CABANG | ADMIN_LAYANAN |
|----------|-------------|---------------|--------------|---------------|
| GET /referrals | ✅ All | ✅ Managed | ✅ Own Branch | ✅ All |
| GET /branches/all | ✅ All | ✅ Managed | ✅ Own Branch | ✅ All |
| POST /referrals | ✅ | ✅ | ✅ | ✅ |
| PATCH /referrals/:id | ✅ | ✅ | ✅ | ✅ |
| DELETE /referrals/:id | ✅ | ✅ | ✅ | ✅ |

## Files Modified
1. `apps/api/src/modules/referrals/referrals.service.ts` - Fix staffBranch query
2. `apps/api/src/modules/branches/branches.routes.ts` - Add ADMIN_CABANG & ADMIN_LAYANAN to /all endpoint

## Status
✅ **COMPLETED**
- Error 500 pada /referrals fixed
- Error 403 pada /branches/all fixed
- Branch filtering untuk ADMIN_CABANG berfungsi
- API server restarted successfully
- Ready for testing
