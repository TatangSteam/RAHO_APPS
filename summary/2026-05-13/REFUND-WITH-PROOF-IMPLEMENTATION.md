# Implementasi Refund dengan Bukti Gambar

## Tanggal: 13 Mei 2026

## Ringkasan
Implementasi fitur refund paket dengan upload bukti gambar ke MinIO. Ketika paket di-refund, badge "📝 [REFUND] {reason}" akan muncul dan bisa diklik untuk melihat detail refund beserta bukti gambar.

## Perubahan Database
✅ **Sudah dijalankan oleh user** - Migration `20260513_add_refund_fields` menambahkan kolom:
- `refundAmount` (Decimal)
- `refundReason` (String)
- `refundProofUrl` (String, optional)
- `refundProofFileName` (String, optional)
- `refundProofFileSize` (Int, optional)
- `refundProofMimeType` (String, optional)
- `refundedBy` (String, optional) - Foreign key ke User
- `refundedAt` (DateTime, optional)

## Backend Changes

### 1. Schema Update
**File**: `apps/api/prisma/schema.prisma`
- ✅ Menambahkan refund fields ke model `MemberPackage`
- ✅ Menambahkan relasi `refundedByUser` dan `packagesRefunded` ke model `User`

### 2. Package Service
**File**: `apps/api/src/modules/packages/packages.service.ts`
- ✅ Update method `refundPackage` untuk menerima parameter `refundProofFile?: Express.Multer.File`

### 3. Package Refund Service
**File**: `apps/api/src/modules/packages/services/package-refund.service.ts`
- ✅ Import `uploadFile` dari `../../../config/minio`
- ✅ Update method `refundPackage` untuk:
  - Menerima parameter `refundProofFile?: Express.Multer.File`
  - Upload file ke MinIO jika disediakan
  - Simpan URL dan metadata file ke database
  - Update semua packages dalam bundle dengan refund info

### 4. Package Retrieval Service
**File**: `apps/api/src/modules/packages/services/package-retrieval.service.ts`
- ✅ Update method `formatPackageData` untuk include refund fields:
  - `refundAmount`
  - `refundReason`
  - `refundProofUrl`
  - `refundProofFileName`
  - `refundProofFileSize`
  - `refundProofMimeType`
  - `refundedBy` (nama user)
  - `refundedAt`

### 5. Package Routes
**File**: `apps/api/src/modules/packages/packages.routes.ts`
- ✅ Sudah ada middleware `uploadPaymentProof.single('refundProof')` pada route POST `/packages/:id/refund`

### 6. Package Controller
**File**: `apps/api/src/modules/packages/packages.controller.ts`
- ✅ Sudah pass `req.file` ke service layer

## Frontend Changes

### 1. Type Definitions
**File**: `apps/web/src/types/package.ts`
- ✅ Update interface `MemberPackage` dengan refund fields:
  ```typescript
  refundAmount?: number;
  refundReason?: string;
  refundProofUrl?: string;
  refundProofFileName?: string;
  refundProofFileSize?: number;
  refundProofMimeType?: string;
  refundedBy?: string;
  refundedAt?: string;
  ```

### 2. Packages API
**File**: `apps/web/src/lib/packagesApi.ts`
- ✅ Update `refundPackage` method untuk:
  - Accept `refundProof?: File` parameter
  - Send as FormData jika file disediakan
  - Send as JSON jika tidak ada file

### 3. Package Card Component
**File**: `apps/web/src/components/members/PackageCard.tsx`
- ✅ Tambah prop `onViewRefundDetail` ke interface
- ✅ Tambah function `getRefundBadge` untuk render badge refund yang clickable
- ✅ Display refund badge di compact header untuk standalone packages
- ✅ Display refund badge di compact header untuk bundle packages

### 4. Package Card CSS
**File**: `apps/web/src/components/members/MemberPackagesTab.module.css`
- ✅ Tambah style `.badge.refund` dengan:
  - Orange color scheme
  - Clickable cursor
  - Hover effects
  - Text truncation untuk reason yang panjang

### 5. Refund Detail Modal (NEW)
**File**: `apps/web/src/components/members/RefundDetailModal.tsx`
- ✅ Component baru untuk menampilkan detail refund
- ✅ Menampilkan:
  - Kode paket
  - Jumlah refund
  - Tanggal refund
  - Diproses oleh (staff name)
  - Alasan refund
  - Bukti gambar refund (jika ada)
- ✅ Image preview dengan fallback error handling
- ✅ Link untuk view full size dan download

**File**: `apps/web/src/components/members/RefundDetailModal.module.css`
- ✅ Styling untuk modal dengan:
  - Responsive layout
  - Image preview container
  - Error state styling
  - Action buttons

### 6. Package Refund Modal
**File**: `apps/web/src/components/members/PackageRefundModal.tsx`
- ✅ Tambah prop `refundProof` dan `onProofChange`
- ✅ Tambah file input untuk upload bukti refund (optional)
- ✅ Image preview untuk file yang dipilih

### 7. Member Packages Tab
**File**: `apps/web/src/components/members/MemberPackagesTab.tsx`
- ✅ Tambah prop `onViewRefundDetail` ke interface
- ✅ Pass prop ke `PackageCard` component

### 8. Member Detail Page
**File**: `apps/web/src/app/(staff)/members/[memberId]/page.tsx`
- ✅ Import `RefundDetailModal`
- ✅ Tambah state untuk refund proof: `refundProof`
- ✅ Tambah state untuk refund detail modal: `showRefundDetailModal`, `refundDetailData`
- ✅ Update `handleRefundPackage` untuk include `refundProof.file`
- ✅ Pass `onViewRefundDetail` handler ke `MemberPackagesTab`
- ✅ Pass `refundProof` dan `onProofChange` ke `PackageRefundModal`
- ✅ Render `RefundDetailModal` component

## Fitur yang Diimplementasikan

### 1. Upload Bukti Refund
- Staff bisa upload gambar bukti refund (optional) saat melakukan refund
- File diupload ke MinIO dengan folder `refund-proofs`
- Metadata file disimpan di database

### 2. Clickable Refund Badge
- Badge "📝 [REFUND] {reason}" muncul pada paket yang sudah di-refund
- Badge bisa diklik untuk membuka modal detail refund
- Badge memiliki hover effect dan cursor pointer
- Reason di-truncate jika terlalu panjang

### 3. Refund Detail Modal
- Menampilkan informasi lengkap refund:
  - Kode paket
  - Jumlah refund (formatted currency)
  - Tanggal dan waktu refund
  - Nama staff yang memproses
  - Alasan refund
  - Bukti gambar (jika ada)
- Image preview dengan error handling
- Link untuk view full size dan download
- Responsive design

### 4. Bundle Support
- Refund badge muncul di bundle packages
- Menggunakan refund info dari package pertama dalam bundle
- Semua packages dalam bundle di-update dengan refund info yang sama

## Testing Checklist

### Backend Testing
- [ ] Test refund tanpa bukti gambar
- [ ] Test refund dengan bukti gambar
- [ ] Test refund bundle packages
- [ ] Verify file uploaded ke MinIO
- [ ] Verify refund fields tersimpan di database
- [ ] Test refund amount validation
- [ ] Test refund untuk ACTIVE packages only

### Frontend Testing
- [ ] Test refund badge muncul setelah refund
- [ ] Test click refund badge membuka modal
- [ ] Test modal menampilkan data refund dengan benar
- [ ] Test image preview di refund modal
- [ ] Test image display di detail modal
- [ ] Test error handling jika image gagal load
- [ ] Test view full size dan download link
- [ ] Test refund badge di standalone packages
- [ ] Test refund badge di bundle packages
- [ ] Test upload bukti refund (optional)
- [ ] Test refund tanpa bukti gambar

## File Upload Flow

1. **User Action**: Staff mengisi form refund dan upload gambar (optional)
2. **Frontend**: 
   - File disimpan di state `refundProof`
   - Preview ditampilkan
   - Saat submit, file dikirim via FormData
3. **Backend**:
   - Multer middleware handle file upload
   - File di-pass ke service layer
   - Service upload ke MinIO
   - URL dan metadata disimpan ke database
4. **Display**:
   - Badge refund muncul di package card
   - Click badge membuka modal
   - Modal menampilkan image dari MinIO URL

## Notes
- Bukti refund bersifat **optional** - refund bisa dilakukan tanpa upload gambar
- File upload menggunakan pattern yang sama dengan payment proof dan member documents
- Refund badge menggunakan orange color scheme untuk membedakan dari status badge lain
- Modal refund detail menggunakan portal untuk proper z-index handling
- Image preview menggunakan object-fit: contain untuk maintain aspect ratio

## Status
✅ **COMPLETED** - Semua backend dan frontend changes sudah diimplementasi
✅ **NO ERRORS** - Semua file passed diagnostics check

## Next Steps
1. User perlu test fitur di development environment
2. Verify file upload ke MinIO berfungsi dengan benar
3. Test dengan berbagai ukuran dan format gambar
4. Test refund flow end-to-end
