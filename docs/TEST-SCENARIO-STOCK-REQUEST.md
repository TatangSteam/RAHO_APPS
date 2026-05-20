# Test Scenario: Stock Request Feature

## Overview

Dokumen ini berisi skenario pengujian untuk fitur Request Stok yang mencakup:
- Request stok dari Admin Cabang
- Review dan approval oleh Admin Manager
- Flow berbeda untuk cabang PREMIERE dan PARTNERSHIP
- Pengiriman dan penerimaan barang

---

## Prerequisites

### Test Accounts

| Role | Email | Password | Branch |
|------|-------|----------|--------|
| Super Admin | superadmin@raho.id | SuperAdmin@123 | - |
| Admin Manager | manager1@raho.id | Manager@123 | Manages multiple branches |
| Admin Cabang (Premiere) | admincabang.pst@raho.id | AdminCabang@123 | RAHO Premiere Jakarta |
| Admin Cabang (Partnership) | admincabang.bdg@raho.id | AdminCabang@123 | | RAHO Partnership Bandung |

### Test Data Requirements
- Master Products sudah tersedia di database
- Cabang PREMIERE dan PARTNERSHIP sudah terdaftar
- Admin Manager sudah di-assign ke cabang yang akan ditest

---

## Flow Diagram

### PREMIERE Branch Flow
```
Admin Cabang                    Admin Manager                    Admin Cabang
     │                               │                               │
     │ 1. Create Request             │                               │
     │ ─────────────────────────────>│                               │
     │                               │                               │
     │                               │ 2. Review & Approve           │
     │                               │ (Shipment auto-created)       │
     │                               │                               │
     │                               │ 3. Ship Shipment              │
     │                               │ ─────────────────────────────>│
     │                               │                               │
     │                               │                               │ 4. Receive Shipment
     │                               │                               │ (Stock added)
     │                               │                               │
```

### PARTNERSHIP Branch Flow
```
Admin Cabang                    Admin Manager                    Admin Cabang
     │                               │                               │
     │ 1. Create Request             │                               │
     │ ─────────────────────────────>│                               │
     │                               │                               │
     │                               │ 2. Review & Create Invoice    │
     │                               │                               │
     │ 3. Pay externally             │                               │
     │ (Transfer bank, send proof    │                               │
     │  via WhatsApp/Email)          │                               │
     │ ─────────────────────────────>│                               │
     │                               │                               │
     │                               │ 4. Upload Payment Proof       │
     │                               │ (received from Admin Cabang)  │
     │                               │                               │
     │                               │ 5. Confirm Payment            │
     │                               │ (Shipment auto-created)       │
     │                               │                               │
     │                               │ 6. Ship Shipment              │
     │                               │ ─────────────────────────────>│
     │                               │                               │
     │                               │                               │ 7. Receive Shipment
     │                               │                               │ (Stock added)
     │                               │                               │
```

---

## Test Scenarios

### Scenario 1: Create Stock Request (Admin Cabang)

**Objective:** Memastikan Admin Cabang dapat membuat request stok

**Steps:**
1. Login sebagai Admin Cabang (Premiere atau Partnership)
2. Navigasi ke menu **Inventory > Request Stok**
3. Klik tombol **"➕ Buat Request"**
4. Di modal yang muncul:
   - Cari produk menggunakan search box
   - Filter berdasarkan kategori jika diperlukan
   - Klik **"+ Tambah"** pada produk yang ingin di-request
   - Atur jumlah yang diminta untuk setiap item
   - Tambahkan catatan per item (opsional)
   - Tambahkan catatan umum request (opsional)
5. Klik **"Buat Request"**

**Expected Results:**
- ✅ Modal menampilkan daftar Master Products
- ✅ Produk yang sudah ditambahkan menampilkan "✓ Ditambahkan"
- ✅ Request berhasil dibuat dengan status **PENDING**
- ✅ Request muncul di daftar dengan kode request unik (REQ-XXX-YYMMDD-NNN)
- ✅ Toast notification sukses muncul

---

### Scenario 2: Review Request - PREMIERE Branch (Admin Manager)

**Objective:** Memastikan Admin Manager dapat approve request dari cabang Premiere tanpa invoice

**Precondition:** Ada request PENDING dari cabang PREMIERE

**Steps:**
1. Login sebagai Admin Manager
2. Navigasi ke menu **Inventory > Request Stok**
3. Filter status **"Pending"** untuk melihat request yang perlu direview
4. Klik **"📋 Review"** pada request dari cabang PREMIERE
5. Di modal review:
   - Verifikasi informasi request (items, jumlah)
   - Perhatikan badge **"PREMIERE"** pada nama cabang
   - Isi catatan review (wajib)
6. Klik **"✓ Approve Request"**

**Expected Results:**
- ✅ Modal menampilkan detail request dengan benar
- ✅ Tidak ada input harga (karena PREMIERE)
- ✅ Setelah approve:
  - Status request berubah menjadi **APPROVED**
  - Shipment otomatis dibuat dengan status **PREPARING**
- ✅ Toast notification sukses muncul
- ✅ Shipment muncul di halaman Pengiriman

---

### Scenario 3: Review Request - PARTNERSHIP Branch (Admin Manager)

**Objective:** Memastikan Admin Manager dapat membuat invoice untuk cabang Partnership

**Precondition:** Ada request PENDING dari cabang PARTNERSHIP

**Steps:**
1. Login sebagai Admin Manager
2. Navigasi ke menu **Inventory > Request Stok**
3. Filter status **"Pending"**
4. Klik **"📋 Review"** pada request dari cabang PARTNERSHIP
5. Di modal review:
   - Verifikasi informasi request
   - Perhatikan badge **"PARTNERSHIP"** pada nama cabang
   - **Input harga per unit** untuk setiap item (wajib)
   - Verifikasi total invoice yang dihitung otomatis
   - Isi catatan (opsional)
6. Klik **"📄 Buat Invoice"**

**Expected Results:**
- ✅ Modal menampilkan input harga untuk setiap item
- ✅ Total invoice dihitung otomatis (quantity × price)
- ✅ Setelah buat invoice:
  - Status request berubah menjadi **WAITING_PAYMENT**
  - Invoice dibuat dengan nomor unik (INV-STK-XXX-YYMMDD-NNN)
- ✅ Toast notification sukses muncul

---

### Scenario 4: Download Invoice PDF (Admin Manager/Admin Cabang)

**Objective:** Memastikan invoice dapat didownload sebagai PDF

**Precondition:** Request dalam status WAITING_PAYMENT atau setelahnya

**Steps:**
1. Login sebagai Admin Manager atau Admin Cabang
2. Navigasi ke menu **Inventory > Request Stok**
3. Klik **"📋 Review"** pada request yang sudah ada invoice
4. Klik tab **"📄 Invoice"**
5. Klik **"📥 Download Invoice PDF"**

**Expected Results:**
- ✅ PDF invoice terdownload dengan format yang benar
- ✅ PDF berisi: nomor invoice, tanggal, items, harga, total
- ✅ Nama file: `Invoice_{INVOICE_NUMBER}.pdf`

---

### Scenario 5: Upload Payment Proof (Admin Manager)

**Objective:** Memastikan Admin Manager dapat upload bukti pembayaran yang diterima dari Admin Cabang

**Precondition:** 
- Request dalam status WAITING_PAYMENT
- Admin Cabang sudah mengirim bukti pembayaran via WhatsApp/Email ke Admin Manager

**Steps:**
1. Login sebagai Admin Manager
2. Navigasi ke menu **Inventory > Request Stok**
3. Filter status **"Menunggu Bayar"**
4. Klik **"📤 Upload Bukti"** pada request
5. Di modal upload (dark theme):
   - Verifikasi informasi request dan invoice
   - Drag & drop file gambar atau klik untuk memilih
   - Preview gambar akan muncul
   - Bisa hapus dan pilih ulang jika salah
6. Klik **"📤 Upload & Simpan"**

**Expected Results:**
- ✅ Modal menampilkan informasi invoice dengan benar
- ✅ Drag & drop berfungsi
- ✅ Preview gambar muncul setelah memilih file
- ✅ Validasi: hanya file gambar (JPG, PNG, JPEG), max 5MB
- ✅ Setelah upload:
  - Status request berubah menjadi **PAYMENT_UPLOADED**
  - File tersimpan di MinIO
- ✅ Toast notification sukses muncul

---

### Scenario 6: View Payment Proof (Admin Manager)

**Objective:** Memastikan Admin Manager dapat melihat bukti pembayaran yang sudah diupload

**Precondition:** Request dalam status PAYMENT_UPLOADED

**Steps:**
1. Login sebagai Admin Manager
2. Navigasi ke menu **Inventory > Request Stok**
3. Filter status **"Bukti Diupload"**
4. Klik **"📋 Review"** pada request
5. Klik tab **"💳 Bukti Bayar"**

**Expected Results:**
- ✅ Gambar bukti pembayaran ditampilkan dengan jelas
- ✅ Informasi file (nama, tanggal upload) ditampilkan
- ✅ Gambar dapat di-zoom atau dibuka di tab baru

---

### Scenario 7: Confirm Payment (Admin Manager)

**Objective:** Memastikan Admin Manager dapat konfirmasi pembayaran setelah melihat bukti

**Precondition:** Request dalam status PAYMENT_UPLOADED

**Steps:**
1. Login sebagai Admin Manager
2. Navigasi ke menu **Inventory > Request Stok**
3. Filter status **"Bukti Diupload"**
4. Klik **"📋 Review"** pada request
5. Di modal review:
   - Klik tab **"💳 Bukti Bayar"** untuk melihat foto bukti
   - Verifikasi bukti pembayaran valid
   - Isi catatan verifikasi (opsional)
6. Klik **"✓ Konfirmasi Pembayaran"**

**Expected Results:**
- ✅ Foto bukti pembayaran dapat dilihat dengan jelas
- ✅ Setelah konfirmasi:
  - Status request berubah menjadi **APPROVED**
  - Shipment otomatis dibuat dengan status **PREPARING**
- ✅ Toast notification sukses muncul
- ✅ Shipment muncul di halaman Pengiriman

---

### Scenario 8: Reject Payment (Admin Manager)

**Objective:** Memastikan Admin Manager dapat menolak pembayaran yang tidak valid

**Precondition:** Request dalam status PAYMENT_UPLOADED

**Steps:**
1. Login sebagai Admin Manager
2. Navigasi ke menu **Inventory > Request Stok**
3. Filter status **"Bukti Diupload"**
4. Klik **"📋 Review"** pada request
5. Di modal review:
   - Lihat bukti pembayaran
   - Isi alasan penolakan (wajib)
6. Klik **"↩ Tolak"**

**Expected Results:**
- ✅ Alasan penolakan wajib diisi
- ✅ Setelah tolak:
  - Status request kembali ke **WAITING_PAYMENT**
  - Bukti pembayaran dihapus
  - Admin Manager dapat upload ulang setelah menerima bukti baru
- ✅ Toast notification muncul

---

### Scenario 9: Ship Shipment (Admin Manager)

**Objective:** Memastikan Admin Manager dapat mengirim barang

**Precondition:** Shipment dalam status PREPARING

**Steps:**
1. Login sebagai Admin Manager
2. Navigasi ke menu **Inventory > Pengiriman**
3. Filter status **"Disiapkan"**
4. Klik **"🚚 Kirim"** pada shipment
5. Di modal (dark theme):
   - Verifikasi informasi shipment (kode, rute)
   - Verifikasi items yang akan dikirim
   - Isi catatan pengiriman (opsional)
6. Klik **"🚚 Kirim Pengiriman"**

**Expected Results:**
- ✅ Modal menampilkan detail items dengan benar
- ✅ Setelah kirim:
  - Status shipment berubah menjadi **SHIPPED**
  - Tanggal pengiriman tercatat
- ✅ Toast notification sukses muncul

---

### Scenario 10: Receive Shipment - Normal (Admin Cabang)

**Objective:** Memastikan Admin Cabang dapat menerima barang dengan jumlah sesuai

**Precondition:** Shipment dalam status SHIPPED

**Steps:**
1. Login sebagai Admin Cabang
2. Navigasi ke menu **Inventory > Pengiriman**
3. Filter status **"Dikirim"**
4. Klik **"📥 Terima"** pada shipment
5. Di modal (dark theme):
   - Verifikasi jumlah yang diterima sama dengan yang dikirim
   - Isi catatan penerimaan (opsional)
6. Klik **"✅ Terima Pengiriman"**

**Expected Results:**
- ✅ Jumlah default sama dengan jumlah yang dikirim
- ✅ Setelah terima:
  - Status shipment berubah menjadi **RECEIVED**
  - **Stok di inventory cabang bertambah**
  - Stock mutation tercatat
- ✅ Toast notification sukses muncul

---

### Scenario 11: Receive Shipment - With Discrepancy (Admin Cabang)

**Objective:** Memastikan Admin Cabang dapat melaporkan ketidaksesuaian saat terima barang

**Precondition:** Shipment dalam status SHIPPED

**Steps:**
1. Login sebagai Admin Cabang
2. Navigasi ke menu **Inventory > Pengiriman**
3. Filter status **"Dikirim"**
4. Klik **"📥 Terima"** pada shipment
5. Di modal (dark theme):
   - Ubah jumlah yang diterima (lebih kecil dari yang dikirim)
   - Form ketidaksesuaian akan muncul otomatis (highlight merah)
   - Pilih tipe ketidaksesuaian:
     - **Kurang** - Jumlah kurang dari yang dikirim
     - **Rusak** - Barang rusak
     - **Salah Item** - Item tidak sesuai
     - **Lainnya** - Alasan lain
   - Isi catatan ketidaksesuaian
6. Klik **"⚠️ Terima dengan Catatan"**

**Expected Results:**
- ✅ Form ketidaksesuaian muncul saat jumlah berbeda
- ✅ Item dengan ketidaksesuaian di-highlight merah
- ✅ Setelah terima:
  - Status shipment berubah menjadi **RECEIVED_WITH_ISSUE**
  - Discrepancy tercatat di database
  - **Stok bertambah sesuai jumlah yang diterima** (bukan yang dikirim)
- ✅ Toast notification muncul dengan pesan yang sesuai

---

### Scenario 12: View Shipment Detail

**Objective:** Memastikan detail shipment dapat dilihat

**Steps:**
1. Login sebagai Admin Manager atau Admin Cabang
2. Navigasi ke menu **Inventory > Pengiriman**
3. Klik pada card shipment (bukan tombol aksi)

**Expected Results:**
- ✅ Modal detail muncul dengan informasi lengkap:
  - Kode shipment dan status
  - Rute (dari → ke)
  - Timeline (dibuat, dikirim, diterima)
  - Daftar items
  - Ketidaksesuaian (jika ada)
  - Catatan
- ✅ Tombol aksi sesuai status dan role

---

### Scenario 13: Reject Stock Request (Admin Manager)

**Objective:** Memastikan Admin Manager dapat menolak request stok

**Precondition:** Request dalam status PENDING

**Steps:**
1. Login sebagai Admin Manager
2. Navigasi ke menu **Inventory > Request Stok**
3. Filter status **"Pending"**
4. Klik **"📋 Review"** pada request
5. Di modal:
   - Isi alasan penolakan (wajib)
6. Klik **"✗ Reject"**

**Expected Results:**
- ✅ Alasan penolakan wajib diisi
- ✅ Setelah reject:
  - Status request berubah menjadi **REJECTED**
  - Request tidak dapat diproses lagi
- ✅ Toast notification muncul

---

## Edge Cases & Negative Tests

### EC-1: Create Request Without Items
**Steps:** Coba buat request tanpa menambahkan item
**Expected:** Tombol "Buat Request" disabled atau error message muncul

### EC-2: Create Invoice Without Prices
**Steps:** Coba buat invoice tanpa mengisi harga
**Expected:** Error message "Semua item harus memiliki harga"

### EC-3: Upload Non-Image File
**Steps:** Coba upload file PDF atau dokumen lain sebagai bukti pembayaran
**Expected:** Error message atau file tidak diterima

### EC-4: Upload File > 5MB
**Steps:** Coba upload gambar dengan ukuran > 5MB
**Expected:** Error message "Ukuran file maksimal 5MB"

### EC-5: Access Request from Other Branch
**Steps:** Admin Cabang A mencoba akses request dari Cabang B
**Expected:** Request tidak muncul di list atau error 403

### EC-6: Approve Already Approved Request
**Steps:** Coba approve request yang sudah di-approve
**Expected:** Error "Permintaan stok tidak dapat diproses"

### EC-7: Receive Already Received Shipment
**Steps:** Coba terima shipment yang sudah diterima
**Expected:** Tombol "Terima" tidak muncul atau error

### EC-8: Ship Shipment as Admin Cabang
**Steps:** Admin Cabang mencoba ship shipment
**Expected:** Tombol "Kirim" tidak muncul (hanya Admin Manager yang bisa)

### EC-9: Receive Shipment as Admin Manager
**Steps:** Admin Manager mencoba receive shipment
**Expected:** Tombol "Terima" tidak muncul (hanya Admin Cabang tujuan yang bisa)

---

## Status Flow Reference

### PREMIERE Branch Flow
```
PENDING ──────────────────────────────────────> APPROVED ──> (Shipment: PREPARING → SHIPPED → RECEIVED)
    │                                                                                            │
    │                                                                                            v
    └──> REJECTED                                                                    Stock Added to Branch
```

### PARTNERSHIP Branch Flow
```
PENDING ──> WAITING_PAYMENT ──> PAYMENT_UPLOADED ──> APPROVED ──> (Shipment: PREPARING → SHIPPED → RECEIVED)
    │              │                    │                                                        │
    │              │                    │                                                        v
    │              │                    └──> (reject) ──> WAITING_PAYMENT              Stock Added to Branch
    │              │
    └──> REJECTED  └──> (Admin Cabang pays externally, sends proof to Admin Manager)
```

### Key Points:
1. **Stock hanya ditambahkan saat Admin Cabang menerima shipment** (bukan saat approve)
2. **Admin Manager yang upload bukti pembayaran** (bukan Admin Cabang)
3. **Shipment otomatis dibuat** saat request di-approve (PREMIERE) atau payment dikonfirmasi (PARTNERSHIP)

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/inventory/stock-requests` | Create request |
| GET | `/inventory/stock-requests` | Get requests |
| GET | `/inventory/stock-requests/:id` | Get request detail |
| POST | `/inventory/stock-requests/:id/approve-premiere` | Approve PREMIERE |
| POST | `/inventory/stock-requests/:id/create-invoice` | Create invoice PARTNERSHIP |
| POST | `/inventory/stock-requests/:id/upload-payment-proof` | Upload payment proof |
| POST | `/inventory/stock-requests/:id/confirm-payment` | Confirm payment |
| POST | `/inventory/stock-requests/:id/reject-payment` | Reject payment |
| POST | `/inventory/stock-requests/:id/reject` | Reject request |
| GET | `/inventory/shipments` | Get shipments |
| GET | `/inventory/shipments/:id` | Get shipment detail |
| POST | `/inventory/shipments/:id/ship` | Ship shipment |
| POST | `/inventory/shipments/:id/receive` | Receive shipment |

---

## Checklist Summary

### Admin Cabang
- [ ] Dapat membuat request stok baru
- [ ] Dapat melihat request dari cabang sendiri
- [ ] Dapat download invoice PDF (Partnership)
- [ ] Dapat melihat shipment untuk cabang sendiri
- [ ] Dapat menerima shipment
- [ ] Dapat melaporkan ketidaksesuaian saat terima

### Admin Manager
- [ ] Dapat melihat request dari cabang yang dikelola
- [ ] Dapat approve request PREMIERE (shipment auto-created)
- [ ] Dapat membuat invoice untuk PARTNERSHIP
- [ ] Dapat upload bukti pembayaran (dari Admin Cabang)
- [ ] Dapat konfirmasi pembayaran (shipment auto-created)
- [ ] Dapat tolak pembayaran
- [ ] Dapat mengirim shipment
- [ ] Dapat reject request

### Super Admin
- [ ] Dapat melihat semua request
- [ ] Dapat melakukan semua aksi Admin Manager

---

## UI Components Updated

### Dark Theme Modals (AssignPackageModal style)
- ✅ Upload Payment Modal - drag & drop, preview, file info
- ✅ Ship Modal - shipment info, items list, notes
- ✅ Receive Modal - quantity inputs, discrepancy form
- ✅ Detail Modal - full shipment info, timeline, actions

---

## Notes

1. **Audit Log:** Semua aksi tercatat di audit log untuk tracking
2. **Stock Mutation:** Setiap perubahan stok tercatat dengan referensi ke shipment
3. **File Storage:** Bukti pembayaran disimpan di MinIO dengan path `uploads/stock-requests/{requestId}/`
4. **Invoice Number Format:** `INV-STK-{BRANCH_CODE}-{YYMMDD}-{SEQUENCE}`
5. **Shipment Code Format:** `SHP-{FROM_BRANCH}-{TO_BRANCH}-{YYMMDD}-{SEQUENCE}`
6. **Request Code Format:** `REQ-{BRANCH_CODE}-{YYMMDD}-{SEQUENCE}`

---

## Last Updated
- Date: 20 Mei 2026
- Changes: 
  - Updated flow: Admin Manager uploads payment proof (not Admin Cabang)
  - Stock only added when Admin Cabang receives shipment
  - Added dark theme modal descriptions
  - Added flow diagrams
