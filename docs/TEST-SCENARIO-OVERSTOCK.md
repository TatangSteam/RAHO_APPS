# Test Scenario: Overstock Feature

## Overview
Fitur overstock memungkinkan Admin Manager mengirim barang lebih banyak dari yang diminta. Kelebihan akan dicatat sebagai overstock dan otomatis dikurangi dari request stok berikutnya menggunakan metode FIFO (First In First Out).

---

## Prerequisites
1. Database sudah di-migrate dengan overstock feature
2. Prisma client sudah di-generate ulang (`npx prisma generate`)
3. Ada minimal 2 cabang (1 PREMIER, 1 PARTNERSHIP)
4. Ada user dengan role:
   - SUPER_ADMIN atau ADMIN_MANAGER
   - ADMIN_CABANG untuk masing-masing cabang

---

## Test Accounts
| Role | Email | Cabang |
|------|-------|--------|
| SUPER_ADMIN | superadmin@raho.id | - |
| ADMIN_MANAGER | manager@raho.id | Manages multiple |
| ADMIN_CABANG | admin.bdg@raho.id | Bandung (PARTNERSHIP) |
| ADMIN_CABANG | admin.jkt@raho.id | Jakarta (PREMIER) |

---

## Test Scenario 1: Kirim dengan Overstock (PREMIER Branch)

### Step 1: Buat Stock Request
1. Login sebagai **ADMIN_CABANG** (Jakarta - PREMIER)
2. Buka menu **Inventori** → **Request Stok**
3. Klik **Buat Request Baru**
4. Pilih produk:
   - Air Nano Biru 600ml: **10 botol**
   - Air Nano Hijau 1500ml: **5 botol**
5. Isi keterangan: "Kebutuhan minggu ini"
6. Klik **Buat Request**

**Expected:**
- Request berhasil dibuat dengan status PENDING
- Tidak ada overstock deduction (belum ada overstock)

### Step 2: Approve Request (PREMIER)
1. Login sebagai **ADMIN_MANAGER** atau **SUPER_ADMIN**
2. Buka menu **Inventori** → **Request Stok**
3. Cari request yang baru dibuat
4. Klik **Review** → **Approve**

**Expected:**
- Request status berubah ke APPROVED
- Shipment otomatis dibuat dengan status PREPARING

### Step 3: Kirim dengan Overstock
1. Masih sebagai **ADMIN_MANAGER**
2. Buka menu **Inventori** → **Pengiriman**
3. Cari shipment yang baru dibuat (status PREPARING)
4. Klik **Kirim**
5. Di modal Ship:
   - Air Nano Biru 600ml: ubah dari 10 menjadi **15 botol**
   - Isi alasan overstock: "Stok gudang berlebih, dikirim sekalian"
   - Air Nano Hijau 1500ml: biarkan **5 botol** (sesuai request)
6. Klik **Kirim Pengiriman**

**Expected:**
- Muncul warning overstock untuk Air Nano Biru (+5 botol)
- Alasan overstock wajib diisi
- Shipment berhasil dikirim dengan status SHIPPED
- Ringkasan overstock ditampilkan

### Step 4: Terima Shipment
1. Login sebagai **ADMIN_CABANG** (Jakarta)
2. Buka menu **Inventori** → **Pengiriman**
3. Cari shipment dengan status SHIPPED
4. Klik **Terima**
5. Konfirmasi penerimaan

**Expected:**
- Shipment status berubah ke RECEIVED
- Stok cabang bertambah (15 + 5 = 20 total)
- Overstock record dibuat:
  - Air Nano Biru 600ml: 5 botol (AVAILABLE)
  - Reason: "Stok gudang berlebih, dikirim sekalian"

### Step 5: Verifikasi Overstock
1. Masih sebagai **ADMIN_CABANG** (Jakarta)
2. Buka menu **Inventori** → **Overstock**

**Expected:**
- Terlihat 1 produk dengan overstock
- Air Nano Biru 600ml: 5 botol tersedia
- Detail menampilkan alasan dan sumber shipment

---

## Test Scenario 2: Auto-Deduction pada Request Berikutnya

### Step 1: Buat Request Baru
1. Login sebagai **ADMIN_CABANG** (Jakarta - PREMIER)
2. Buka menu **Inventori** → **Request Stok**
3. Klik **Buat Request Baru**
4. Pilih produk:
   - Air Nano Biru 600ml: **8 botol**
5. Isi keterangan: "Kebutuhan minggu depan"

**Expected (di modal):**
- Muncul info overstock tersedia: 5 botol
- Preview deduction: -5 botol dari overstock
- Final qty yang akan dikirim: 3 botol

6. Klik **Buat Request**

**Expected:**
- Request berhasil dibuat
- Item menampilkan:
  - Requested: 8 botol
  - Overstock Deducted: 5 botol
  - Final Qty: 3 botol
- Overstock record diupdate:
  - Status: FULLY_USED (karena 5 - 5 = 0)

### Step 2: Verifikasi Overstock Berkurang
1. Buka menu **Inventori** → **Overstock**

**Expected:**
- Air Nano Biru 600ml tidak lagi muncul (sudah habis)
- Atau muncul dengan status FULLY_USED dan qty 0

---

## Test Scenario 3: Partial Overstock Usage

### Step 1: Buat Overstock Baru
1. Ulangi Scenario 1 untuk membuat overstock baru
2. Kirim dengan overstock: Air Nano Biru 600ml +10 botol

### Step 2: Request dengan Partial Usage
1. Buat request baru:
   - Air Nano Biru 600ml: **3 botol**

**Expected:**
- Overstock deducted: 3 botol
- Final qty: 0 botol (tidak perlu kirim)
- Overstock remaining: 7 botol (status: PARTIALLY_USED)

### Step 3: Request Lagi
1. Buat request baru:
   - Air Nano Biru 600ml: **5 botol**

**Expected:**
- Overstock deducted: 5 botol
- Final qty: 0 botol
- Overstock remaining: 2 botol (status: PARTIALLY_USED)

---

## Test Scenario 4: FIFO Order

### Setup
1. Buat 2 shipment dengan overstock untuk produk yang sama:
   - Shipment 1: +5 botol (alasan: "Batch A")
   - Shipment 2: +3 botol (alasan: "Batch B")

### Test
1. Buat request: 6 botol

**Expected:**
- Deduction menggunakan FIFO:
  - Dari Batch A: 5 botol (habis)
  - Dari Batch B: 1 botol (sisa 2)
- Total deducted: 6 botol
- Final qty: 0 botol

---

## Test Scenario 5: Partnership Branch Flow

### Step 1: Buat Request (Partnership)
1. Login sebagai **ADMIN_CABANG** (Bandung - PARTNERSHIP)
2. Buat stock request

### Step 2: Create Invoice
1. Login sebagai **ADMIN_MANAGER**
2. Review request → Create Invoice
3. Set harga per item

### Step 3: Payment Flow
1. Upload bukti pembayaran
2. Konfirmasi pembayaran

### Step 4: Kirim dengan Overstock
1. Setelah payment confirmed, shipment dibuat
2. Kirim dengan overstock (sama seperti Scenario 1)

**Expected:**
- Flow sama dengan PREMIER, hanya ada tambahan payment step
- Overstock tetap bisa ditambahkan saat shipping

---

## Test Scenario 6: Validation Tests

### Test 6.1: Overstock tanpa Alasan
1. Coba kirim dengan qty lebih dari request
2. Kosongkan field alasan overstock
3. Klik Kirim

**Expected:**
- Error: "Alasan overstock wajib diisi untuk [nama produk]"
- Shipment tidak terkirim

### Test 6.2: Overstock dengan Qty Sama
1. Kirim dengan qty sama persis dengan request
2. Tidak perlu isi alasan

**Expected:**
- Shipment berhasil tanpa overstock record

### Test 6.3: Overstock dengan Qty Kurang
1. Kirim dengan qty kurang dari request

**Expected:**
- Shipment berhasil
- Tidak ada overstock record
- (Bisa dilaporkan sebagai discrepancy saat receive)

---

## API Endpoints untuk Testing

### Overstock Endpoints
```
GET  /api/v1/inventory/overstock?branchId=xxx
GET  /api/v1/inventory/overstock/summary?branchId=xxx
POST /api/v1/inventory/overstock/preview
GET  /api/v1/inventory/overstock/available/:branchId/:masterProductId
```

### Ship with Overstock
```
POST /api/v1/inventory/shipments/:shipmentId/ship
Body:
{
  "notes": "Catatan pengiriman",
  "items": [
    {
      "masterProductId": "xxx",
      "sentQty": 15,
      "overstockReason": "Stok gudang berlebih"
    }
  ]
}
```

---

## Checklist

### Backend
- [ ] Overstock routes registered
- [ ] Ship with overstock items working
- [ ] Receive creates overstock records
- [ ] Stock request auto-deducts overstock
- [ ] FIFO order correct
- [ ] Overstock status updates (AVAILABLE → PARTIALLY_USED → FULLY_USED)

### Frontend
- [ ] Ship Modal shows qty controls
- [ ] Ship Modal validates overstock reason
- [ ] Ship Modal shows overstock summary
- [ ] Create Request Modal shows overstock preview
- [ ] Create Request Modal shows deduction info
- [ ] Overstock page displays correctly
- [ ] Overstock page branch selector works (for managers)

### Database
- [ ] BranchOverstock records created correctly
- [ ] OverstockUsage records track deductions
- [ ] ShipmentItem has overstock fields
- [ ] StockRequestItem has deduction fields

---

## Known Limitations
1. Overstock hanya bisa dibuat saat shipping (tidak bisa manual)
2. Overstock tidak bisa di-cancel atau di-adjust manual
3. Overstock hanya berlaku per cabang (tidak bisa transfer antar cabang)
