# Hapus Filter Branch untuk ADMIN_CABANG pada Kode Referral

## Tanggal: 30 April 2026

## Perubahan
Menghapus filter branch untuk ADMIN_CABANG pada halaman Kode Referral, sehingga ADMIN_CABANG bisa melihat semua kode referral dari semua cabang (sama seperti ADMIN_LAYANAN dan SUPER_ADMIN).

## Alasan
- ADMIN_CABANG perlu melihat semua kode referral untuk keperluan administrasi
- Dropdown "Semua Cabang" perlu menampilkan data dari semua cabang
- Konsistensi dengan role lain yang bisa melihat semua data

## Implementasi

### File Modified
**File**: `apps/api/src/modules/referrals/referrals.service.ts`

### Sebelum
```typescript
// Branch filtering based on role
if (userRole === 'ADMIN_CABANG') {
  // ADMIN_CABANG can only see referrals in their branch
  if (userBranchId) {
    where.branchId = userBranchId;
  } else {
    const staffBranch = await prisma.staffBranch.findFirst({
      where: { userId: userId },
      select: { branchId: true },
    });
    
    if (staffBranch) {
      where.branchId = staffBranch.branchId;
    }
  }
} else if (userRole === 'ADMIN_MANAGER' && userId) {
  // ADMIN_MANAGER can see referrals in branches they manage
  ...
}
```

### Sesudah
```typescript
// Branch filtering based on role
if (userRole === 'ADMIN_MANAGER' && userId) {
  // ADMIN_MANAGER can see referrals in branches they manage
  ...
}
```

**Perubahan**: Menghapus seluruh blok kondisi untuk `ADMIN_CABANG`

## Behavior Setelah Perubahan

### ADMIN_CABANG
**Sebelum**:
- Hanya bisa melihat referrals dari cabang sendiri
- Dropdown "Semua Cabang" tidak berfungsi

**Sesudah**:
- ✅ Bisa melihat semua referrals dari semua cabang
- ✅ Dropdown "Semua Cabang" berfungsi
- ✅ Bisa filter by branch menggunakan dropdown
- ✅ Sama seperti ADMIN_LAYANAN dan SUPER_ADMIN

### ADMIN_MANAGER
**Tidak berubah**:
- Tetap hanya bisa melihat referrals dari cabang yang dikelola
- Filter otomatis berdasarkan `managerBranches`

### SUPER_ADMIN & ADMIN_LAYANAN
**Tidak berubah**:
- Tetap bisa melihat semua referrals
- Bisa filter by branch jika diperlukan

## Role Access Matrix (Updated)

| Role | Access Scope | Filter by Branch |
|------|-------------|------------------|
| SUPER_ADMIN | All branches | ✅ Optional |
| ADMIN_LAYANAN | All branches | ✅ Optional |
| ADMIN_CABANG | **All branches** (changed) | ✅ Optional |
| ADMIN_MANAGER | Managed branches only | ✅ Optional |

## Testing

### Test Case 1: ADMIN_CABANG - View All Referrals
1. Login sebagai ADMIN_CABANG (cabang Bandung)
2. Navigate ke halaman Kode Referral
3. Verifikasi:
   - ✅ Muncul referrals dari semua cabang (Jakarta, Bandung, Surabaya, dll)
   - ✅ Dropdown "Semua Cabang" menampilkan semua cabang
   - ✅ Bisa filter by branch

### Test Case 2: ADMIN_CABANG - Filter by Branch
1. Login sebagai ADMIN_CABANG
2. Navigate ke halaman Kode Referral
3. Pilih "RAHO Partnership Bandung" di dropdown
4. Verifikasi:
   - ✅ Hanya muncul referrals dari cabang Bandung
   - ✅ Pagination berfungsi

### Test Case 3: ADMIN_CABANG - Create Referral
1. Login sebagai ADMIN_CABANG
2. Create kode referral baru
3. Pilih cabang dari dropdown
4. Verifikasi:
   - ✅ Bisa pilih cabang mana saja
   - ✅ Referral berhasil dibuat

### Test Case 4: ADMIN_MANAGER - Still Filtered
1. Login sebagai ADMIN_MANAGER (manage Jakarta & Surabaya)
2. Navigate ke halaman Kode Referral
3. Verifikasi:
   - ✅ Hanya muncul referrals dari Jakarta & Surabaya
   - ✅ Tidak muncul referrals dari cabang lain

## Impact Analysis

### Positive
- ✅ ADMIN_CABANG punya akses penuh ke data referral
- ✅ Konsistensi dengan role ADMIN_LAYANAN
- ✅ Dropdown "Semua Cabang" berfungsi dengan baik
- ✅ Lebih fleksibel untuk administrasi

### Considerations
- ADMIN_CABANG bisa melihat data dari cabang lain
- Jika ini concern, bisa dikembalikan dengan menambahkan kondisi lagi

## Rollback (if needed)
Jika perlu dikembalikan ke behavior sebelumnya, tambahkan kembali kondisi:

```typescript
if (userRole === 'ADMIN_CABANG') {
  if (userBranchId) {
    where.branchId = userBranchId;
  }
} else if (userRole === 'ADMIN_MANAGER' && userId) {
  ...
}
```

## Files Modified
1. `apps/api/src/modules/referrals/referrals.service.ts` - Removed ADMIN_CABANG branch filter

## Status
✅ **COMPLETED**
- Branch filter untuk ADMIN_CABANG dihapus
- ADMIN_CABANG bisa melihat semua referrals
- Dropdown "Semua Cabang" berfungsi
- API server restarted successfully
