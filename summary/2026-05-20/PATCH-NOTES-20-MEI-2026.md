# Patch Notes - 20 Mei 2026

## Overview

Patch ini mencakup perbaikan dan peningkatan pada fitur Stock Request, Shipment, Referral, dan UI Modal.

---

## 🔧 Bug Fixes

### 1. Fix Stock Request Shipment Flow

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

### 2. Fix Invoice Download Feature for Stock Request

**Problem:** Modal review tidak menampilkan invoice items dengan benar karena data tidak lengkap dari list API.

**Solution:**
- Mengubah `handleReviewRequest` untuk fetch detail lengkap menggunakan `inventoryApi.getStockRequestById(request.id)` sebelum membuka modal
- Menambahkan fallback calculation untuk invoice items jika data tidak tersedia

**Files Changed:**
- `apps/web/src/app/(staff)/inventory/stock-requests/page.tsx`
- `apps/web/src/app/(staff)/inventory/stock-requests/components/ReviewModal.tsx`

---

### 3. Fix Payment Proof Display (404 Error)

**Problem:** Gambar bukti pembayaran tidak muncul (404 error) karena URL yang salah.

**Solution:**
- Mengubah `fetchPaymentProof` untuk menggunakan `process.env.NEXT_PUBLIC_API_URL` (`http://localhost:4000/api/v1`) alih-alih `window.location.origin`

**Files Changed:**
- `apps/web/src/app/(staff)/inventory/stock-requests/components/ReviewModal.tsx`

---

### 4. Fix Shipments Not Showing for Partnership Branches

**Problem:** Shipment tidak muncul untuk cabang Partnership karena filter branch yang salah.

**Solution:**
- Memperbaiki logika filter branch di shipment controller untuk role ADMIN_MANAGER

**Files Changed:**
- `apps/api/src/modules/inventory/shipment.controller.ts`

---

### 5. Fix Referral Creation - Auto-fill Branch for Admin Cabang

**Problem:** Saat Admin Cabang membuat referral baru, field cabang tidak terisi otomatis.

**Solution:**
- Menambahkan props `userBranchId` dan `isAdminCabang` ke `CreateReferralModal`
- Untuk Admin Cabang: `branchId` auto-fill dengan branch mereka, field ditampilkan read-only
- Untuk role lain: dropdown tetap ditampilkan untuk memilih branch

**Files Changed:**
- `apps/web/src/app/(staff)/referrals/page.tsx`

---

### 6. Fix Runtime Error - PaymentUploadModal Not Defined

**Problem:** `ReferenceError: PaymentUploadModal is not defined` karena nama komponen tidak sesuai.

**Solution:**
- Memperbaiki import dan penggunaan komponen `UploadPaymentModal`

**Files Changed:**
- `apps/web/src/app/(staff)/inventory/stock-requests/page.tsx`

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
| Bug Fixes | 6 |
| New Components | 4 |
| Updated Components | 5 |
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
- `apps/api/src/modules/inventory/services/stock-request-approval.service.ts`
- `apps/api/src/modules/inventory/services/shipment-processing.service.ts`
- `apps/api/src/modules/inventory/shipment.controller.ts`
- `apps/api/src/modules/files/files.service.ts`

### Web (Frontend)
- `apps/web/src/app/(staff)/inventory/stock-requests/page.tsx`
- `apps/web/src/app/(staff)/inventory/stock-requests/components/ReviewModal.tsx`
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

1. **Stock Request Flow:** Test both PREMIERE and PARTNERSHIP flows end-to-end
2. **Payment Proof:** Verify Admin Manager can upload and view payment proof
3. **Shipment:** Verify shipment is created on approve/confirm, not stock
4. **Receive:** Verify stock is added only when Admin Cabang receives shipment
5. **Referral:** Verify Admin Cabang sees auto-filled branch (read-only)

---

## 📅 Date
20 Mei 2026
