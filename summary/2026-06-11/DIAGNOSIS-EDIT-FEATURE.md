# Fitur Edit Diagnosis oleh Dokter

**Tanggal:** 11 Juni 2026  
**Status:** ✅ Selesai Implementasi

## 📋 Ringkasan

Menambahkan kemampuan bagi dokter untuk mengedit diagnosis yang sudah dibuat dalam session terapi. Sebelumnya, diagnosis hanya bisa dibuat sekali dan tidak bisa diubah.

## 🎯 Fitur yang Ditambahkan

### Backend (API)

1. **Schema Validasi Baru** (`sessions.schema.ts`)
   - `updateDiagnosisSchema` - untuk validasi data update diagnosis
   - `UpdateDiagnosisInput` type definition

2. **Service Method** (`diagnosis.service.ts`)
   - `updateDiagnosis()` - method untuk update diagnosis existing
   - Validasi bahwa hanya dokter yang bisa edit
   - Audit log untuk track perubahan

3. **Controller** (`sessions.controller.ts`)
   - `updateDiagnosis()` - handler untuk request update

4. **Route** (`sessions.routes.ts`)
   - `PATCH /treatment-sessions/encounters/:encounterId/diagnoses`
   - Hanya dokter (`Role.DOCTOR`) yang diizinkan

### Frontend (Web)

1. **API Client** (`sessionApi.ts`)
   - `updateDiagnosis()` - function untuk call API update

2. **Komponen UI** (`Step1Diagnosis.tsx`)
   - Tombol "Edit Diagnosa" muncul hanya untuk dokter
   - Mode edit dengan form lengkap untuk semua field
   - Tombol "Batal" untuk cancel edit
   - Tombol "Simpan Perubahan" untuk submit update

3. **Styling** (`Step1Diagnosis.module.css`)
   - Style untuk tombol edit
   - Style untuk tombol cancel
   - Responsive layout untuk form edit

## 🔐 Keamanan & Validasi

### Backend
- ✅ Hanya role `DOCTOR` yang bisa mengakses endpoint update
- ✅ Validasi diagnosis exists untuk encounter
- ✅ Validasi user adalah dokter
- ✅ Field `doktorPemeriksa` tidak bisa diubah (preserve original doctor)
- ✅ Audit log untuk track semua perubahan

### Frontend
- ✅ Tombol edit hanya muncul untuk user dengan role DOCTOR
- ✅ Validasi required fields
- ✅ Error handling dengan pesan yang jelas

## 📝 Field yang Bisa Diedit

Dokter dapat mengedit semua field diagnosis kecuali:
- ❌ `doktorPemeriksa` (tidak bisa diubah)
- ❌ `diagnosisCode` (tidak bisa diubah)
- ❌ `createdAt` (tidak bisa diubah)

Field yang bisa diedit:
- ✅ `diagnosa` - diagnosis utama
- ✅ `kategoriDiagnosa` - kategori diagnosis
- ✅ `icdPrimer` - kode ICD primer
- ✅ `icdSekunder` - kode ICD sekunder
- ✅ `icdTersier` - kode ICD tersier
- ✅ `keluhanRiwayatSekarang` - keluhan dan riwayat
- ✅ `riwayatPenyakitTerdahulu` - riwayat penyakit
- ✅ `riwayatSosialKebiasaan` - riwayat sosial
- ✅ `riwayatPengobatan` - riwayat pengobatan
- ✅ `pemeriksaanFisik` - hasil pemeriksaan fisik
- ✅ `pemeriksaanTambahan` - pemeriksaan tambahan

## 🎨 User Experience

### Flow untuk Dokter

1. **Melihat Diagnosis**
   - Diagnosis yang sudah dibuat ditampilkan dalam mode "completed"
   - Tombol "✏️ Edit Diagnosa" muncul di bawah detail diagnosis

2. **Mode Edit**
   - Klik tombol edit untuk masuk mode edit
   - Form lengkap muncul dengan semua field terisi
   - Semua field dapat diedit kecuali dokter pemeriksa

3. **Menyimpan Perubahan**
   - Klik "Simpan Perubahan" untuk update
   - Loading state saat menyimpan
   - Kembali ke mode view setelah berhasil

4. **Membatalkan Edit**
   - Klik "Batal" untuk cancel tanpa menyimpan
   - Kembali ke mode view dengan data original

### Flow untuk Non-Dokter

- Tombol edit tidak muncul
- Diagnosis ditampilkan read-only
- Tidak bisa mengubah diagnosis yang sudah dibuat

## 🔄 Backward Compatibility

✅ **Fully Compatible**
- Endpoint lama tetap berfungsi
- Data structure tidak berubah
- Hanya menambah endpoint baru `PATCH`

## 📊 Audit Trail

Setiap update diagnosis tercatat di audit log dengan:
- `action`: `UPDATE`
- `resource`: `Diagnosis`
- `resourceId`: ID diagnosis
- `meta.diagnosisCode`: Kode diagnosis
- `meta.encounterId`: ID encounter
- `meta.action`: `DIAGNOSIS_EDITED`
- `meta.changedFields`: Array field yang diubah

## 🧪 Testing

### Manual Testing Checklist

#### Backend
- [x] Endpoint PATCH dapat diakses oleh dokter
- [x] Endpoint PATCH ditolak untuk non-dokter
- [x] Validasi data input berfungsi
- [x] Update berhasil dengan data valid
- [x] Audit log tercatat dengan benar

#### Frontend
- [x] Tombol edit hanya muncul untuk dokter
- [x] Mode edit dapat diakses
- [x] Form terisi dengan data existing
- [x] Update berhasil dengan data valid
- [x] Cancel mengembalikan ke mode view
- [x] Error handling menampilkan pesan yang jelas
- [x] Responsive di mobile

## 📁 File yang Dimodifikasi

### Backend
```
apps/api/src/modules/sessions/
├── sessions.schema.ts          (+ updateDiagnosisSchema)
├── sessions.controller.ts      (+ updateDiagnosis)
├── sessions.service.ts         (+ updateDiagnosis)
├── sessions.routes.ts          (+ PATCH route)
└── services/
    └── diagnosis.service.ts    (+ updateDiagnosis method)
```

### Frontend
```
apps/web/src/
├── lib/sessionApi.ts                           (+ updateDiagnosis)
├── components/sessions/
│   ├── Step1Diagnosis.tsx                      (+ edit mode)
│   └── Step1Diagnosis.module.css              (+ edit styles)
```

## 🚀 Deployment Notes

1. **Database Migration**: ❌ Tidak diperlukan (no schema changes)
2. **Environment Variables**: ❌ Tidak ada perubahan
3. **Dependencies**: ❌ Tidak ada dependency baru
4. **Breaking Changes**: ❌ Tidak ada

## 📖 API Documentation

### Update Diagnosis

**Endpoint:** `PATCH /api/treatment-sessions/encounters/:encounterId/diagnoses`

**Authorization:** Required (DOCTOR only)

**Request Body:**
```json
{
  "diagnosa": "string (optional)",
  "kategoriDiagnosa": "enum DiagnosisCategory (optional)",
  "icdPrimer": "string (optional)",
  "icdSekunder": "string (optional)", 
  "icdTersier": "string (optional)",
  "keluhanRiwayatSekarang": "string (optional)",
  "riwayatPenyakitTerdahulu": "string (optional)",
  "riwayatSosialKebiasaan": "string (optional)",
  "riwayatPengobatan": "string (optional)",
  "pemeriksaanFisik": "string (optional)",
  "pemeriksaanTambahan": "object (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "diagnosisCode": "DXS-PST-2606-00001",
    "diagnosa": "Updated diagnosis text",
    "kategoriDiagnosa": "HIPERTENSI",
    // ... other fields
    "updatedAt": "2026-06-11T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `403 FORBIDDEN` - User bukan dokter
- `404 DIAGNOSIS_NOT_FOUND` - Diagnosis tidak ditemukan
- `400 VALIDATION_ERROR` - Data tidak valid

## ✅ Kesimpulan

Fitur edit diagnosis telah berhasil diimplementasikan dengan:
- ✅ Full backend validation & security
- ✅ User-friendly UI untuk dokter
- ✅ Audit trail lengkap
- ✅ Backward compatible
- ✅ No breaking changes

Dokter sekarang dapat mengedit diagnosis yang sudah dibuat dalam session terapi, meningkatkan fleksibilitas dan akurasi data medis.
