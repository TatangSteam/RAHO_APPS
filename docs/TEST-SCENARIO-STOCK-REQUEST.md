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
| Super Admin | superadmin@raho.id | password123 | - |
| Admin Manager | manager@raho.id | password123 | Manages multiple branches |
| Admin Cabang (Premiere) | admin.premiere@raho.id | password123 | Cabang Premiere |
| Admin Cabang (Partnership) | admin.partnership@raho.id | password123 | Cabang Partnership |

### Test Data Requirements
- Master Products sudah tersedia di database
- Cabang PREMIERE dan PARTNERSHIP sudah terdaftar
- Admin Manager sudah di-assign ke cabang yang akan ditest

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
6. Klik **"✓ Approve"**

**Expected Results:**
- ✅ Modal menampilkan detail request dengan benar
- ✅ Tidak ada input harga (karena PREMIERE)
- ✅ Setelah approve:
  - Status request berubah menjadi **APPROVED**
  - Shipment otomatis dibuat dengan status **PREPARING**
- ✅ Toast notification sukses muncul

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

### Scenario 4: Upload Payment Proof (Admin Cabang Partnership)

**Objective:** Memastikan Admin Cabang Partnership dapat upload bukti pembayaran

**Precondition:** Request dalam status WAITING_PAYMENT

**Steps:**
1. Login sebagai Admin Cabang Partnership
2. Navigasi ke menu **Inventory > Request Stok**
3. Filter status **"Menunggu Bayar"**
4. Klik **"📤 Upload Bukti Bayar"** pada request
5. Di modal upload:
   - Verifikasi informasi invoice (nomor, total)
   - Klik input file dan pilih gambar bukti pembayaran
   - Preview gambar akan muncul
6. Klik **"📤 Upload"**

**Expected Results:**
- ✅ Modal menampilkan informasi invoice dengan benar
- ✅ Preview gambar muncul setelah memilih file
- ✅ Hanya file gambar yang diterima (JPG, PNG, WebP, GIF, BMP)
- ✅ Setelah upload:
  - Status request berubah menjadi **PAYMENT_UPLOADED**
  - File tersimpan di MinIO
- ✅ Toast notification sukses muncul

---

### Scenario 5: Confirm Payment (Admin Manager)

**Objective:** Memastikan Admin Manager dapat konfirmasi pembayaran setelah melihat bukti

**Precondition:** Request dalam status PAYMENT_UPLOADED

**Steps:**
1. Login sebagai Admin Manager
2. Navigasi ke menu **Inventory > Request Stok**
3. Filter status **"Bukti Diupload"**
4. Klik **"✓ Konfirmasi"** pada request
5. Di modal review:
   - Klik tab **"💳 Bukti Pembayaran"** untuk melihat foto bukti
   - Verifikasi bukti pembayaran valid
   - Isi catatan verifikasi (opsional)
6. Klik **"✓ Konfirmasi Pembayaran"**

**Expected Results:**
- ✅ Foto bukti pembayaran dapat dilihat dengan jelas
- ✅ Setelah konfirmasi:
  - Status request berubah menjadi **PAYMENT_CONFIRMED**
  - Shipment otomatis dibuat dengan status **PREPARING**
- ✅ Toast notification sukses muncul

---

### Scenario 6: Reject Payment (Admin Manager)

**Objective:** Memastikan Admin Manager dapat menolak pembayaran yang tidak valid

**Precondition:** Request dalam status PAYMENT_UPLOADED

**Steps:**
1. Login sebagai Admin Manager
2. Navigasi ke menu **Inventory > Request Stok**
3. Filter status **"Bukti Diupload"**
4. Klik **"✓ Konfirmasi"** pada request
5. Di modal review:
   - Lihat bukti pembayaran
   - Isi alasan penolakan (wajib)
6. Klik **"↩ Tolak Pembayaran"**

**Expected Results:**
- ✅ Alasan penolakan wajib diisi
- ✅ Setelah tolak:
  - Status request kembali ke **WAITING_PAYMENT**
  - Bukti pembayaran dihapus
  - Admin Cabang dapat upload ulang
- ✅ Toast notification muncul

---

### Scenario 7: Ship Shipment (Admin Manager)

**Objective:** Memastikan Admin Manager dapat mengirim barang

**Precondition:** Shipment dalam status PREPARING

**Steps:**
1. Login sebagai Admin Manager
2. Navigasi ke menu **Inventory > Pengiriman**
3. Filter status **"Disiapkan"**
4. Klik **"🚚 Kirim"** pada shipment
5. Di modal:
   - Verifikasi items yang akan dikirim
   - Isi catatan pengiriman (opsional)
6. Klik **"🚚 Kirim"**

**Expected Results:**
- ✅ Modal menampilkan detail items dengan benar
- ✅ Setelah kirim:
  - Status shipment berubah menjadi **SHIPPED**
  - Status request berubah menjadi **SHIPPED**
  - Tanggal pengiriman tercatat
- ✅ Toast notification sukses muncul

---

### Scenario 8: Receive Shipment - Normal (Admin Cabang)

**Objective:** Memastikan Admin Cabang dapat menerima barang dengan jumlah sesuai

**Precondition:** Shipment dalam status SHIPPED

**Steps:**
1. Login sebagai Admin Cabang
2. Navigasi ke menu **Inventory > Pengiriman**
3. Filter status **"Dikirim"**
4. Klik **"📥 Terima"** pada shipment
5. Di modal:
   - Verifikasi jumlah yang diterima sama dengan yang dikirim
   - Isi catatan penerimaan (opsional)
6. Klik **"✅ Terima"**

**Expected Results:**
- ✅ Jumlah default sama dengan jumlah yang dikirim
- ✅ Setelah terima:
  - Status shipment berubah menjadi **RECEIVED**
  - Status request berubah menjadi **COMPLETED**
  - Stok di inventory cabang bertambah
  - Stock mutation tercatat
- ✅ Toast notification sukses muncul

---

### Scenario 9: Receive Shipment - With Discrepancy (Admin Cabang)

**Objective:** Memastikan Admin Cabang dapat melaporkan ketidaksesuaian saat terima barang

**Precondition:** Shipment dalam status SHIPPED

**Steps:**
1. Login sebagai Admin Cabang
2. Navigasi ke menu **Inventory > Pengiriman**
3. Filter status **"Dikirim"**
4. Klik **"📥 Terima"** pada shipment
5. Di modal:
   - Ubah jumlah yang diterima (lebih kecil dari yang dikirim)
   - Form ketidaksesuaian akan muncul otomatis
   - Pilih tipe ketidaksesuaian:
     - **SHORTAGE** - Kurang
     - **DAMAGE** - Rusak
     - **WRONG_ITEM** - Salah Item
     - **OTHER** - Lainnya
   - Isi catatan ketidaksesuaian
6. Klik **"⚠️ Terima dengan Catatan"**

**Expected Results:**
- ✅ Form ketidaksesuaian muncul saat jumlah berbeda
- ✅ Setelah terima:
  - Status shipment berubah menjadi **RECEIVED_WITH_ISSUE**
  - Status request berubah menjadi **COMPLETED_WITH_ISSUE**
  - Discrepancy tercatat di database
  - Stok bertambah sesuai jumlah yang diterima (bukan yang dikirim)
- ✅ Toast notification muncul dengan pesan yang sesuai

---

### Scenario 10: Reject Stock Request (Admin Manager)

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
**Expected:** Error message "Bukti pembayaran hanya menerima format gambar"

### EC-4: Access Request from Other Branch
**Steps:** Admin Cabang A mencoba akses request dari Cabang B
**Expected:** Error 403 "Anda tidak memiliki akses ke request ini"

### EC-5: Approve Already Approved Request
**Steps:** Coba approve request yang sudah di-approve
**Expected:** Error "Permintaan stok tidak dapat diproses. Status saat ini: APPROVED"

### EC-6: Receive Already Received Shipment
**Steps:** Coba terima shipment yang sudah diterima
**Expected:** Error "Pengiriman belum dikirim atau sudah diproses"

---

## Status Flow Reference

### PREMIERE Branch Flow
```
PENDING → APPROVED → SHIPPED → COMPLETED
                            ↘ COMPLETED_WITH_ISSUE
       ↘ REJECTED
```

### PARTNERSHIP Branch Flow
```
PENDING → WAITING_PAYMENT → PAYMENT_UPLOADED → PAYMENT_CONFIRMED → SHIPPED → COMPLETED
                         ↙ (reject payment)                                ↘ COMPLETED_WITH_ISSUE
       ↘ REJECTED
```

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
| POST | `/inventory/shipments/:id/ship` | Ship shipment |
| POST | `/inventory/shipments/:id/receive` | Receive shipment |

---

## Checklist Summary

### Admin Cabang
- [ ] Dapat membuat request stok baru
- [ ] Dapat melihat request dari cabang sendiri
- [ ] Dapat upload bukti pembayaran (Partnership)
- [ ] Dapat menerima shipment
- [ ] Dapat melaporkan ketidaksesuaian

### Admin Manager
- [ ] Dapat melihat request dari cabang yang dikelola
- [ ] Dapat approve request PREMIERE
- [ ] Dapat membuat invoice untuk PARTNERSHIP
- [ ] Dapat konfirmasi/tolak pembayaran
- [ ] Dapat mengirim shipment
- [ ] Dapat reject request

### Super Admin
- [ ] Dapat melihat semua request
- [ ] Dapat melakukan semua aksi Admin Manager

---

## Notes

1. **Audit Log:** Semua aksi tercatat di audit log untuk tracking
2. **Stock Mutation:** Setiap perubahan stok tercatat dengan referensi ke shipment
3. **File Storage:** Bukti pembayaran disimpan di MinIO dengan path `uploads/stock-requests/{requestId}/`
4. **Invoice Number Format:** `INV-STK-{BRANCH_CODE}-{YYMMDD}-{SEQUENCE}`
5. **Shipment Code Format:** `SHP-{FROM_BRANCH}-{TO_BRANCH}-{YYMMDD}-{SEQUENCE}`
