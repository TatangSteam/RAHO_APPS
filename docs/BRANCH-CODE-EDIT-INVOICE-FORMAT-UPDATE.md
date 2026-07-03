# Branch Code Edit & Invoice Format Update

## Overview
Implementasi fitur untuk memungkinkan Super Admin mengedit kode cabang dengan opsi auto-generate, serta perubahan format nomor invoice.

## Tanggal Implementasi
3 Juli 2026

## Perubahan yang Dilakukan

### 1. Schema Update (branches.schema.ts)
- **Menambahkan field baru di `updateBranchSchema`:**
  - `branchCode`: string (opsional) - Untuk manual edit kode cabang
  - `autoGenerateBranchCode`: boolean (opsional) - Untuk auto-generate kode cabang baru
  - `regencyCode` wajib diisi ketika mode otomatis dipilih
  - Kode manual dinormalisasi ke huruf besar dan hanya menerima 3-20 karakter alfanumerik

- **Menambahkan schema baru:**
  - `updateBranchCodeSchema`: Schema khusus untuk update kode cabang dengan validasi

### 2. Branch Service Update (branches.service.ts)

#### Fungsi Baru:
- **`validateBranchCodeUnique(branchCode, excludeBranchId)`**
  - Memvalidasi bahwa kode cabang yang baru unique
  - Tidak menghitung branch yang sedang diedit (excludeBranchId)

#### Fungsi yang Diupdate:
- **`updateBranchService(branchId, input, userRole)`**
  - Menambahkan parameter `userRole` untuk validasi akses
  - **Hanya SUPER_ADMIN** yang bisa mengubah kode cabang
  - Request perubahan kode dari role lain ditolak dengan HTTP 403
  - Mendukung 2 mode:
    1. **Auto-generate**: Jika `autoGenerateBranchCode = true` dan `regencyCode` tersedia
       - Menggunakan fungsi `generateUniqueBranchCode()` yang sudah ada
       - Format: `{ProvinsiKode}{KabupatenKode}{Sequence}` (contoh: `317101`)
    
    2. **Manual edit**: Jika `branchCode` diisi dengan nilai baru
       - Validasi uniqueness dengan `validateBranchCodeUnique()`
       - Update langsung ke nilai yang diinput
  
  - Logging perubahan kode cabang untuk audit trail

### 3. Invoice Format Update

#### Code Generator (utils/codeGenerator.ts)
- **Format lama**: `INV-{BRANCH}-{YYMM}-{SEQ:05}`
  - Contoh: `INV-PST-2607-00001`

- **Format baru**: `{SEQ:05}-{BRANCH}-{MM}-{YYYY}`
  - Contoh: `00001-PST-07-2026`
  - Format: Nomor-KodeCabang-Bulan-Tahun

#### Invoice Creation Service (invoice-creation.service.ts)
- **Update `generateInvoiceNumber()`:**
  - Menggunakan pattern matching berdasarkan suffix: `-{BRANCH}-{MM}-{YYYY}`
  - Mencari invoice terakhir dengan pattern yang sama
  - Auto-increment sequence number per bulan per cabang
  - Sequence reset setiap bulan baru

#### Package Invoice Generation & Seeder
- Alur invoice saat assign paket/termin menggunakan generator bersama yang sama
- Seeder invoice utama dan data dashboard menggunakan format baru agar data development konsisten

### 4. Web UI
- Halaman utama `/branches/{branchId}/edit` dan modal legacy `/admin/branches` mendukung:
  - Edit kode manual untuk Super Admin
  - Pilihan “Buat kode otomatis sesuai kode wilayah baru”
  - Dropdown provinsi dan kabupaten/kota serta pratinjau kode
- Admin Manager tetap dapat mengedit data cabang lain, tetapi kode cabang bersifat read-only

### 5. Controller Update (branches.controller.ts)
- **Update `updateBranch()`:**
  - Menambahkan `userRole = req.user.role`
  - Pass userRole ke service untuk validasi akses

## Cara Penggunaan

### A. Edit Kode Cabang (Super Admin Only)

#### 1. Manual Edit Kode Cabang
```http
PUT /api/branches/{branchId}
Authorization: Bearer {super_admin_token}
Content-Type: application/json

{
  "branchCode": "317102",
  "name": "RAHO Pusat Jakarta"
}
```

**Response:**
- Status 200: Berhasil update
- Status 400: Kode cabang sudah digunakan
- Status 403: Hanya Super Admin yang bisa edit kode cabang

#### 2. Auto-Generate Kode Cabang Baru
```http
PUT /api/branches/{branchId}
Authorization: Bearer {super_admin_token}
Content-Type: application/json

{
  "autoGenerateBranchCode": true,
  "regencyCode": "31.71",
  "name": "RAHO Pusat Jakarta"
}
```

**Response:**
- Kode cabang baru akan di-generate otomatis berdasarkan regencyCode
- Format: `{4-digit-regency}{2-digit-sequence}`
- Contoh: `317101`, `317102`, dst.

### B. Format Invoice Baru

#### Contoh Invoice Number:
- **Januari 2026**: `00001-PST-01-2026`, `00002-PST-01-2026`
- **Februari 2026**: `00001-PST-02-2026` (reset sequence)
- **Juli 2026**: `00001-317101-07-2026` (dengan kode cabang baru)

#### Struktur:
1. **00001**: Sequence number (5 digit, auto-increment per bulan)
2. **PST**: Kode cabang
3. **07**: Bulan (2 digit)
4. **2026**: Tahun (4 digit)

## Validasi & Keamanan

### Permission Check
- **Edit kode cabang**: Hanya `SUPER_ADMIN`
- **Edit data cabang lainnya**: `SUPER_ADMIN`, `ADMIN_MANAGER`

### Validasi
1. **Uniqueness**: Kode cabang harus unique di seluruh sistem
2. **Format**: Kode cabang mengikuti standar yang ada (numeric)
3. **History**: Perubahan kode cabang dicatat di audit log

### Audit Trail
Setiap perubahan kode cabang akan dicatat dengan detail:
- Hasil kode cabang baru pada audit metadata
- Old branchCode → New branchCode pada application log
- User yang melakukan perubahan
- Timestamp
- IP Address & User Agent

## Testing

### Test Cases
1. ✅ Super Admin dapat edit kode cabang manual
2. ✅ Super Admin dapat auto-generate kode cabang baru
3. ✅ Non-Super Admin tidak bisa edit kode cabang
4. ✅ Validasi uniqueness kode cabang
5. ✅ Invoice number menggunakan format baru
6. ✅ Sequence invoice reset per bulan
7. ✅ Type-check API dan web berhasil
8. ✅ Build produksi API dan web berhasil
9. ✅ 10 unit/component tests terkait berhasil

### Manual Testing
```bash
# Build API
cd apps/api
npm run build

# Start API server
npm run dev

# Test endpoints
curl -X PUT http://localhost:4000/api/branches/{branchId} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"branchCode": "999999"}'
```

## Migration Notes

### Backward Compatibility
- **Kode cabang existing**: Tetap valid dan tidak berubah
- **Invoice lama**: Format lama tetap ada di database
- **Invoice baru**: Menggunakan format baru mulai dari deploy

### Data Migration
**TIDAK DIPERLUKAN** - Perubahan hanya mempengaruhi:
1. Kode cabang baru yang dibuat/diedit setelah deploy
2. Invoice baru yang dibuat setelah deploy

## Files Modified

1. `apps/api/src/modules/branches/branches.schema.ts`
2. `apps/api/src/modules/branches/branches.service.ts`
3. `apps/api/src/modules/branches/branches.controller.ts`
4. `apps/api/src/utils/codeGenerator.ts`
5. `apps/api/src/utils/invoiceGenerator.ts`
6. `apps/api/src/modules/invoices/services/invoice-creation.service.ts`
7. `apps/api/src/modules/packages/services/invoice-generation.service.ts`
8. Seeder invoice di `apps/api/prisma`
9. UI dan API types cabang di `apps/web`
10. Test branch code, invoice generator, dan modal edit cabang

## Impact Analysis

### Low Risk
- Perubahan isolated pada branch management
- Invoice format tidak mempengaruhi logic pembayaran
- Backward compatible dengan data existing

### Medium Risk
- Perubahan format invoice number perlu diinformasikan ke tim finance
- Nomor invoice baru akan mulai lagi dari `00001` per cabang pada bulan deploy jika hanya ada invoice format lama

### High Priority
- Testing pada staging environment sebelum production
- Komunikasi ke stakeholder tentang perubahan format invoice

## Rollback Plan

Jika terjadi masalah:
1. Revert commits pada 5 files yang dimodifikasi
2. Rebuild dan redeploy
3. Invoice dengan format baru akan tetap valid di database
4. Tidak perlu migration rollback

## Next Steps

1. ✅ Update dokumentasi implementasi
2. ✅ Update UI untuk edit kode cabang
3. ✅ Tampilan invoice tetap kompatibel karena nomor ditampilkan sebagai string
4. ✅ Unit test, component test, type-check, dan production build
5. ⏳ Deploy ke staging untuk UAT
6. ⏳ Sosialisasi format invoice baru ke tim finance dan Super Admin

## Contact

Untuk pertanyaan atau issue terkait implementasi ini, hubungi:
- Development Team
- Date: 3 Juli 2026
