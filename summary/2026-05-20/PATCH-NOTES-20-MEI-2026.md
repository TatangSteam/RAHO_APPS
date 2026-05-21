# Patch Notes - 20 Mei 2026

## Overview

Patch ini mencakup perbaikan dan peningkatan pada fitur Stock Request, Shipment, Referral, UI Modal, dan perbaikan bug duplikasi diagnosa.

---

## 🔧 Bug Fixes

### 1. Fix Duplicate Diagnosis After Therapy Session

**Problem:** Diagnosa berduplikasi di daftar diagnosa member setelah sesi terapi dilakukan. Setiap kali sesi terapi baru dibuat dengan diagnosa yang sama, diagnosa baru dibuat alih-alih menggunakan yang sudah ada.

**Root Cause:** 
- Logika lama mencoba mencari diagnosa dengan `encounterId: null` dan jika ditemukan, mengupdate `encounterId` ke encounter saat ini
- Karena `encounterId` adalah `@unique`, diagnosa yang sudah di-link tidak bisa digunakan lagi
- Sesi terapi berikutnya dengan diagnosa yang sama akan membuat diagnosa baru

**Solution:**
- Mengubah logika agar selalu membuat "session copy" dari diagnosa untuk setiap sesi terapi
- Session copies menggunakan prefix `DXS-` (Diagnosis Session) untuk membedakan dari diagnosa asli `DX-`
- Diagnosa asli (`encounterId: null`) tidak pernah dimodifikasi
- `getMemberDiagnoses` hanya menampilkan diagnosa asli (bukan session copies)

**Files Changed:**
- `apps/api/src/modules/sessions/services/diagnosis.service.ts`
- `apps/api/src/modules/members/services/member-medical-records.service.ts`
- `apps/api/src/utils/codeGenerator.ts`

**Diagnosis Code Format:**
- `DX-{BRANCH}-{YYMM}-{SEQ}` - Diagnosa asli member (dibuat di halaman Member Detail)
- `DXS-{BRANCH}-{YYMM}-{SEQ}` - Session copy (dibuat saat sesi terapi)

---

### 2. Fix Stock Request Shipment Flow

**Problem:** Saat request stok di-approve, stok langsung ditambahkan ke cabang tanpa melalui proses pengiriman.

**Solution:** 
- Mengubah `confirmPayment` method untuk membuat shipment dengan status `PREPARING` alih-alih langsung menambah stok
- Stok hanya ditambahkan ketika Admin Cabang memanggil `receiveShipment`

**Files Changed:**
- `apps/api/src/modules/inventory/services/stock-request-approval.service.ts`
- `apps/api/src/modules/inventory/services/shipment-processing.service.ts`

**Flow Baru:**
```
PREMIERE: Request → Approve → Shipment (PREPARING) → Ship → Receive → Stock Added
PARTNERSHIP: Request → Invoice → Payment → Confirm → Shipment (PREPARING) → Ship → Receive → Stock Added
```

---

### 3. Fix Invoice Download Feature for Stock Request

**Problem:** Modal review tidak menampilkan invoice items dengan benar karena data tidak lengkap dari list API.

**Solution:**
- Mengubah `handleReviewRequest` untuk fetch detail lengkap menggunakan `inventoryApi.getStockRequestById(request.id)` sebelum membuka modal
- Menambahkan fallback calculation untuk invoice items jika data tidak tersedia

**Files Changed:**
- `apps/web/src/app/(staff)/inventory/stock-requests/page.tsx`
- `apps/web/src/app/(staff)/inventory/stock-requests/components/ReviewModal.tsx`

---

### 4. Fix Payment Proof Display (404 Error)

**Problem:** Gambar bukti pembayaran tidak muncul (404 error) karena URL yang salah.

**Solution:**
- Mengubah `fetchPaymentProof` untuk menggunakan `process.env.NEXT_PUBLIC_API_URL` (`http://localhost:4000/api/v1`) alih-alih `window.location.origin`

**Files Changed:**
- `apps/web/src/app/(staff)/inventory/stock-requests/components/ReviewModal.tsx`

---

### 5. Fix Shipments Not Showing for Partnership Branches

**Problem:** Shipment tidak muncul untuk cabang Partnership karena filter branch yang salah.

**Solution:**
- Memperbaiki logika filter branch di shipment controller untuk role ADMIN_MANAGER

**Files Changed:**
- `apps/api/src/modules/inventory/shipment.controller.ts`

---

### 6. Fix Referral Creation - Auto-fill Branch for Admin Cabang

**Problem:** Saat Admin Cabang membuat referral baru, field cabang tidak terisi otomatis.

**Solution:**
- Menambahkan props `userBranchId` dan `isAdminCabang` ke `CreateReferralModal`
- Untuk Admin Cabang: `branchId` auto-fill dengan branch mereka, field ditampilkan read-only
- Untuk role lain: dropdown tetap ditampilkan untuk memilih branch

**Files Changed:**
- `apps/web/src/app/(staff)/referrals/page.tsx`

---

### 7. Fix Runtime Error - PaymentUploadModal Not Defined

**Problem:** `ReferenceError: PaymentUploadModal is not defined` karena nama komponen tidak sesuai.

**Solution:**
- Memperbaiki import dan penggunaan komponen `UploadPaymentModal`

**Files Changed:**
- `apps/web/src/app/(staff)/inventory/stock-requests/page.tsx`

---

### 8. Fix Review Notes Not Displaying After Approval/Rejection

**Problem:** Catatan review yang diisi saat approve/reject request stok tidak ditampilkan di card dan modal setelah request diproses.

**Solution:**
- Menambahkan tampilan `reviewNotes` di `StockRequestCard.tsx` dengan styling berbeda untuk approved (hijau) dan rejected (merah)
- Menambahkan section "Existing Review Notes" di `ReviewModal.tsx` untuk menampilkan catatan review yang sudah ada
- Catatan review sekarang ditampilkan dengan label "Catatan Review" untuk approved dan "Alasan Penolakan" untuk rejected

**Files Changed:**
- `apps/web/src/app/(staff)/inventory/stock-requests/components/StockRequestCard.tsx`
- `apps/web/src/app/(staff)/inventory/stock-requests/components/ReviewModal.tsx`

---

### 9. Fix Warning Stock Inconsistency Between Admin Cabang and Super Admin/Admin Manager

**Problem:** Fitur warning stock di halaman inventori menampilkan data yang berbeda untuk Admin Cabang vs Super Admin/Admin Manager. Super Admin dan Admin Manager tidak bisa melihat inventori karena tidak memiliki `branchId` yang di-set.

**Solution:**
- Menambahkan branch selector dropdown untuk Super Admin dan Admin Manager di halaman inventori
- Super Admin dan Admin Manager sekarang bisa memilih cabang mana yang ingin dilihat inventorinya
- Admin Cabang tetap hanya melihat inventori cabang mereka sendiri (tanpa dropdown)
- Menambahkan empty state "Pilih Cabang" ketika belum ada cabang yang dipilih

**Files Changed:**
- `apps/web/src/app/(staff)/inventory/page.tsx`

**New Features:**
- Branch selector dropdown di header halaman inventori (hanya untuk Super Admin dan Admin Manager)
- Dropdown menampilkan nama cabang, kode cabang, dan tipe cabang
- Data inventori otomatis di-refresh ketika cabang dipilih

---

## ✨ New Features & Improvements

### 1. Update Shipment Modals to Dark Theme

**Description:** Membuat modal shipment dengan styling yang konsisten dengan AssignPackageModal (dark theme).

**New Components:**
- `ShipModal.tsx` - Modal untuk mengirim shipment
- `ReceiveModal.tsx` - Modal untuk menerima shipment dengan form ketidaksesuaian
- `DetailModal.tsx` - Modal untuk melihat detail shipment

**Features:**
- Dark theme dengan warna yang konsisten
- Section boxes dengan warna berbeda (blue, purple, amber, green)
- Responsive design
- Form ketidaksesuaian dengan highlight merah

**Files Changed:**
- `apps/web/src/app/(staff)/inventory/shipments/components/ShipModal.tsx` (new)
- `apps/web/src/app/(staff)/inventory/shipments/components/ReceiveModal.tsx` (new)
- `apps/web/src/app/(staff)/inventory/shipments/components/DetailModal.tsx` (new)
- `apps/web/src/app/(staff)/inventory/shipments/page.tsx`

---

### 2. New Upload Payment Proof Modal

**Description:** Membuat modal upload bukti pembayaran dengan styling AssignPackageModal.

**Features:**
- Drag & drop file upload
- Preview gambar sebelum upload
- Validasi file (hanya gambar, max 5MB)
- Informasi invoice dan request
- Dark theme yang konsisten

**Files Changed:**
- `apps/web/src/app/(staff)/inventory/stock-requests/components/UploadPaymentModal.tsx` (new)
- `apps/web/src/app/(staff)/inventory/stock-requests/page.tsx`

---

### 3. Comprehensive Test Scenario Documentation

**Description:** Membuat dokumentasi test scenario lengkap untuk fitur Stock Request.

**Contents:**
- Flow diagram untuk PREMIERE dan PARTNERSHIP branches
- 13 test scenarios dengan langkah detail
- Edge cases dan negative tests
- API endpoints reference
- Checklist summary per role
- Status flow reference

**Key Clarifications:**
- Admin Manager yang upload bukti pembayaran (bukan Admin Cabang)
- Admin Cabang mengirim bukti via WhatsApp/Email ke Admin Manager
- Stock hanya ditambahkan saat Admin Cabang menerima shipment

**Files Changed:**
- `docs/TEST-SCENARIO-STOCK-REQUEST.md`

---

## 📋 Summary of Changes

| Category | Count |
|----------|-------|
| Bug Fixes | 9 |
| New Components | 4 |
| Updated Components | 7 |
| Documentation | 1 |

---

## 🔄 Flow Clarification

### PREMIERE Branch
```
Admin Cabang          Admin Manager          Admin Cabang
     │                     │                      │
     │ Create Request      │                      │
     │────────────────────>│                      │
     │                     │ Approve              │
     │                     │ (Shipment created)   │
     │                     │                      │
     │                     │ Ship                 │
     │                     │─────────────────────>│
     │                     │                      │ Receive
     │                     │                      │ (Stock added)
```

### PARTNERSHIP Branch
```
Admin Cabang          Admin Manager          Admin Cabang
     │                     │                      │
     │ Create Request      │                      │
     │────────────────────>│                      │
     │                     │ Create Invoice       │
     │                     │                      │
     │ Pay externally      │                      │
     │ (send proof via WA) │                      │
     │────────────────────>│                      │
     │                     │ Upload Proof         │
     │                     │ Confirm Payment      │
     │                     │ (Shipment created)   │
     │                     │                      │
     │                     │ Ship                 │
     │                     │─────────────────────>│
     │                     │                      │ Receive
     │                     │                      │ (Stock added)
```

---

## 📁 Files Modified

### API (Backend)
- `apps/api/src/modules/sessions/services/diagnosis.service.ts` (fix duplicate diagnosis)
- `apps/api/src/modules/members/services/member-medical-records.service.ts` (filter session copies)
- `apps/api/src/utils/codeGenerator.ts` (support DXS prefix)
- `apps/api/src/modules/inventory/services/stock-request-approval.service.ts`
- `apps/api/src/modules/inventory/services/shipment-processing.service.ts`
- `apps/api/src/modules/inventory/shipment.controller.ts`
- `apps/api/src/modules/files/files.service.ts`

### Web (Frontend)
- `apps/web/src/app/(staff)/inventory/page.tsx` (branch selector for Super Admin/Admin Manager)
- `apps/web/src/app/(staff)/inventory/stock-requests/page.tsx`
- `apps/web/src/app/(staff)/inventory/stock-requests/components/ReviewModal.tsx` (display existing review notes)
- `apps/web/src/app/(staff)/inventory/stock-requests/components/StockRequestCard.tsx` (display review notes)
- `apps/web/src/app/(staff)/inventory/stock-requests/components/UploadPaymentModal.tsx` (new)
- `apps/web/src/app/(staff)/inventory/shipments/page.tsx`
- `apps/web/src/app/(staff)/inventory/shipments/components/ShipModal.tsx` (new)
- `apps/web/src/app/(staff)/inventory/shipments/components/ReceiveModal.tsx` (new)
- `apps/web/src/app/(staff)/inventory/shipments/components/DetailModal.tsx` (new)
- `apps/web/src/app/(staff)/referrals/page.tsx`

### Documentation
- `docs/TEST-SCENARIO-STOCK-REQUEST.md`

---

## 🧪 Testing Notes

1. **Duplicate Diagnosis Fix:** 
   - Buat diagnosa di halaman Member Detail
   - Buat sesi terapi pertama dengan diagnosa tersebut
   - Buat sesi terapi kedua dengan diagnosa yang sama
   - Verifikasi diagnosa di tab Diagnosa member tidak berduplikasi
   - Diagnosa asli tetap ada dengan kode `DX-xxx`
   - Session copies memiliki kode `DXS-xxx` (tidak ditampilkan di list member)
2. **Stock Request Flow:** Test both PREMIERE and PARTNERSHIP flows end-to-end
3. **Payment Proof:** Verify Admin Manager can upload and view payment proof
4. **Shipment:** Verify shipment is created on approve/confirm, not stock
5. **Receive:** Verify stock is added only when Admin Cabang receives shipment
6. **Referral:** Verify Admin Cabang sees auto-filled branch (read-only)
7. **Review Notes Display:**
   - Approve request stok dengan catatan review
   - Verifikasi catatan review muncul di card (warna hijau)
   - Buka modal detail, verifikasi catatan review ditampilkan
   - Reject request stok dengan alasan penolakan
   - Verifikasi alasan penolakan muncul di card (warna merah)
8. **Warning Stock Consistency:**
   - Login sebagai Super Admin, buka halaman Inventori
   - Verifikasi dropdown branch selector muncul
   - Pilih cabang, verifikasi data inventori ditampilkan
   - Ganti cabang, verifikasi data berubah sesuai cabang yang dipilih
   - Login sebagai Admin Cabang, verifikasi tidak ada dropdown (langsung tampil data cabang mereka)

---

## 📅 Date
20 Mei 2026
