# Akses Sesi Terapi untuk Admin (SUPER_ADMIN & ADMIN_MANAGER)

**Status:** ✅ Implemented  
**Tanggal:** 24 Juni 2026  
**Versi:** 1.0

## Ringkasan

SUPER_ADMIN dan ADMIN_MANAGER sekarang memiliki akses penuh ke halaman **Sesi Terapi** dengan kemampuan melihat data dari semua cabang.

## Perubahan yang Dilakukan

### 1. Update Sidebar Menu
**File:** `apps/web/src/components/layout/Sidebar.tsx`

Menambahkan role `SUPER_ADMIN` dan `ADMIN_MANAGER` ke menu "Sesi Terapi":

```typescript
{
  label: 'Sesi Terapi',
  href: '/sessions',
  icon: <Activity size={20} />,
  roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'],
},
```

**Sebelumnya:** Hanya role `ADMIN_CABANG`, `ADMIN_LAYANAN`, `DOCTOR`, `NURSE`  
**Sekarang:** Termasuk `SUPER_ADMIN` dan `ADMIN_MANAGER`

## Fitur yang Tersedia untuk Admin

### 1. Cross-Branch Visibility
- SUPER_ADMIN dan ADMIN_MANAGER dapat melihat sesi terapi dari **semua cabang**
- Role lain hanya melihat sesi dari cabang mereka sendiri

### 2. Filter Lanjutan
Admin memiliki akses ke filter tambahan:
- ✅ **Filter Cabang** (khusus untuk SUPER_ADMIN & ADMIN_MANAGER)
- ✅ Filter Dokter
- ✅ Filter Nakes
- ✅ Filter Status (Selesai/Belum Selesai)
- ✅ Filter Tipe Pelaksanaan (On-Site/Home Care)
- ✅ Filter Rentang Tanggal

### 3. Export Data
- Export ke Excel (.xlsx) atau CSV
- Pemilihan field detail (Odoo-style field selection)
- Export mencakup data dari semua cabang (untuk admin)

### 4. Customisasi Kolom Tabel
- Pilih kolom yang ditampilkan di tabel
- Simpan preferensi kolom per user
- Reset ke default kapan saja

## Technical Details

### API Endpoint
**GET** `/api/sessions`

**Role-based Logic:**
```typescript
// Di sessions.controller.ts (line 148-154)
let effectiveBranchId: string | undefined = undefined;
if (filterBranchId) {
  effectiveBranchId = filterBranchId as string;
} else if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN_MANAGER) {
  effectiveBranchId = branchId || undefined;
}
```

**Behavior:**
- **SUPER_ADMIN/ADMIN_MANAGER**: Jika tidak ada filter cabang, tampilkan semua
- **Role lain**: Hanya tampilkan dari cabang user tersebut

### Frontend Logic
**File:** `apps/web/src/app/(staff)/sessions/page.tsx`

```typescript
// Line 736
const canSeeAllBranches = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';

// Line 739-777
useEffect(() => {
  if (!user) return;
  
  const loadFilterOptions = async () => {
    // Load branches only for SUPER_ADMIN and ADMIN_MANAGER
    if (canSeeAllBranches) {
      const branchesRes = await branchesApi.listBranches();
      setBranches(branchesRes.data?.data || []);
    }
    // ... load doctors and nurses
  };
  
  loadFilterOptions();
}, [user, canSeeAllBranches]);
```

## Cara Menggunakan

### Untuk SUPER_ADMIN & ADMIN_MANAGER

1. **Akses Menu**
   - Login sebagai SUPER_ADMIN atau ADMIN_MANAGER
   - Klik menu **"Sesi Terapi"** di sidebar (section "Klinik")

2. **Filter Berdasarkan Cabang**
   - Klik tombol **"🔍 Filter"**
   - Pilih cabang dari dropdown **"Cabang"**
   - Atau biarkan kosong untuk melihat semua cabang

3. **Export Data**
   - Klik tombol **"📥 Export"**
   - Pilih format: Excel (.xlsx) atau CSV
   - Pilih field yang ingin di-export (per kategori)
   - Klik **"Export"**

4. **Customisasi Kolom**
   - Klik tombol **"Kolom"**
   - Centang/hapus kolom yang ingin ditampilkan
   - Klik **"Simpan sebagai Default"** untuk menyimpan preferensi

### Untuk Role Lain (ADMIN_CABANG, DOCTOR, NURSE)

- Tidak melihat filter cabang
- Hanya melihat sesi dari cabang mereka
- Fitur export dan customisasi kolom tetap tersedia

## Testing

### Test Case 1: SUPER_ADMIN dapat akses menu
✅ **Expected:** Menu "Sesi Terapi" muncul di sidebar  
✅ **Actual:** Menu tampil di section "Klinik"

### Test Case 2: Melihat semua cabang
✅ **Expected:** Tanpa filter, tampilkan sesi dari semua cabang  
✅ **Actual:** API mengembalikan data cross-branch

### Test Case 3: Filter cabang tersedia
✅ **Expected:** Dropdown filter cabang muncul untuk admin  
✅ **Actual:** Filter tampil dan berfungsi

### Test Case 4: ADMIN_CABANG tidak lihat filter cabang
✅ **Expected:** ADMIN_CABANG tidak melihat dropdown cabang  
✅ **Actual:** Filter cabang tersembunyi, hanya melihat cabang sendiri

## Security Considerations

### Authorization Layer
1. **Frontend:** Role check di Sidebar untuk menampilkan menu
2. **Frontend:** Conditional rendering filter cabang
3. **Backend:** Role-based data filtering di controller
4. **Backend:** Branch access validation untuk data sensitive

### Data Access Rules
- SUPER_ADMIN: Full access ke semua data
- ADMIN_MANAGER: Full access ke semua data
- ADMIN_CABANG: Hanya cabang sendiri
- DOCTOR/NURSE: Hanya cabang yang mereka assigned

## Future Enhancements

Potential improvements (not yet implemented):
- [ ] Dashboard analytics untuk admin (aggregate data cross-branch)
- [ ] Bulk operations untuk multiple sessions
- [ ] Advanced reporting dengan grafik dan statistik
- [ ] Export dengan template custom
- [ ] Scheduled export (daily/weekly reports)

## Troubleshooting

### Menu tidak muncul
**Problem:** Menu "Sesi Terapi" tidak muncul di sidebar  
**Solution:** Pastikan user memiliki role SUPER_ADMIN atau ADMIN_MANAGER

### Filter cabang tidak muncul
**Problem:** Dropdown filter cabang tidak tampil  
**Solution:** Hanya SUPER_ADMIN dan ADMIN_MANAGER yang melihat filter ini

### Data kosong
**Problem:** Tidak ada data sesi terapi  
**Solution:** 
- Cek apakah ada sesi terapi di database
- Cek filter yang aktif (status, tanggal, dll)
- Clear filter dan coba lagi

## References

- **Sidebar:** `apps/web/src/components/layout/Sidebar.tsx`
- **Sessions Page:** `apps/web/src/app/(staff)/sessions/page.tsx`
- **API Controller:** `apps/api/src/modules/sessions/sessions.controller.ts`
- **API Service:** `apps/api/src/modules/sessions/services/session-retrieval.service.ts`

---

**Last Updated:** 24 Juni 2026  
**Maintained By:** Development Team
