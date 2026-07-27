# Panduan Sinkronisasi Data Existing Zoho Books dengan ERP RAHO

Status: rancangan bisnis dan implementasi final sebelum coding  
Tanggal: 27 Juli 2026  
Target: Zoho Books saja, tanpa Zoho Inventory

## 1. Tujuan

Dokumen ini mengatur integrasi ketika organisasi Zoho Books **sudah berisi
data**, meliputi:

1. Items aktif dan stock on hand.
2. Inventory adjustments/perubahan persediaan.
3. Customers aktif yang akan dipetakan menjadi member RAHO.
4. Faktur uang muka untuk pembayaran yang diterima sebelum layanan/barang
   diberikan.
5. Termin pembayaran.
6. Invoice satuan yang mengubah uang muka menjadi omzet ketika kewajiban
   layanan atau penjualan telah dipenuhi.

Prinsip utamanya:

> Data existing Zoho tidak ditimpa. Sistem membaca, mencocokkan, mengadopsi
> baseline, menyelesaikan konflik, lalu mengaktifkan sinkronisasi transaksi baru.

## 2. Istilah bisnis

| Istilah RAHO | Modul/istilah Zoho Books |
|---|---|
| Produk/barang aktif | Items |
| Persediaan | Inventory-tracked Items |
| Perubahan stok | Inventory Adjustment atau transaksi Books |
| Member/pelanggan | Customer Contact |
| Faktur uang muka | Retainer Invoice |
| Pembayaran uang muka | Retainer Payment |
| Faktur satuan | Invoice |
| Penggunaan uang muka | Apply Retainer to Invoice |
| Omzet | Revenue yang diakui oleh Invoice |
| Termin | Tahap pembayaran dan jatuh tempo |

Retainer Invoice dipilih karena uang yang diterima sebelum barang/jasa diberikan
belum menjadi pendapatan. Uang tersebut ditahan sebagai kewajiban sampai
diterapkan ke Invoice atas layanan atau penjualan yang benar-benar terjadi.

## 3. Batas sistem

### 3.1 Zoho Books

Zoho Books menjadi sistem tujuan untuk:

- item finansial;
- stock on hand yang direkonsiliasi;
- customer;
- retainer invoice dan retainer payment;
- invoice satuan;
- customer payment;
- revenue, piutang, uang muka, dan laporan keuangan.

### 3.2 RAHO

RAHO tetap menjadi sistem operasional untuk:

- member dan identitas layanan;
- paket, add-on, dan entitlement;
- jadwal serta pelaksanaan infus;
- penjualan/kiriman partnership;
- gudang, batch, expiry, reservation, dan FIFO;
- event pemenuhan kewajiban;
- approval, evidence, dan audit.

### 3.3 Data yang tidak dikirim

Jangan mengirim ke Zoho:

- diagnosis;
- hasil pemeriksaan;
- catatan medis;
- kandungan/detail klinis terapi;
- foto medis;
- informasi klinis lain yang tidak diperlukan untuk penagihan.

Tanggal lahir dikirim hanya karena menjadi kebutuhan pencocokan customer yang
ditetapkan dalam dokumen ini. Akses field tersebut harus dibatasi.

## 4. Tahapan besar

```text
Hubungkan Zoho
      ↓
Tarik data existing secara read-only
      ↓
Normalisasi dan matching
      ↓
Preview konflik dan selisih
      ↓
Approval Admin/Finance
      ↓
Adopsi baseline ke RAHO
      ↓
Kunci baseline
      ↓
Aktifkan sinkronisasi transaksi baru
      ↓
Rekonsiliasi berkala
```

Tidak ada write ke Zoho selama tahap discovery dan preview.

## 5. Mode integrasi

| Mode | Perilaku |
|---|---|
| `OFF` | Tidak membaca atau menulis Zoho |
| `DISCOVERY` | Membaca data existing, tanpa perubahan |
| `SHADOW` | Membuat mapping/payload preview, tanpa write |
| `BASELINE` | Mengadopsi baseline yang sudah disetujui |
| `PILOT` | Sinkronisasi write untuk cabang/item terpilih |
| `LIVE` | Sinkronisasi transaksi baru secara penuh |

Perpindahan mode harus diaudit dan hanya dapat dilakukan oleh pengguna
berwenang.

---

## 6. Items aktif dan persediaan existing

### 6.1 Data yang ditarik

Ambil seluruh item Zoho, bukan hanya halaman pertama. Simpan minimum:

- `item_id`;
- name;
- SKU;
- status;
- `product_type`;
- `item_type`;
- unit;
- selling rate;
- purchase rate;
- inventory account;
- COGS/purchase account;
- reorder level;
- stock on hand per location;
- available stock per location;
- custom fields;
- last modified time jika tersedia.

Filter hasil menjadi:

```text
ACTIVE_INVENTORY
ACTIVE_NON_INVENTORY
INACTIVE
INVALID_OR_INCOMPLETE
```

Hanya `ACTIVE_INVENTORY` yang otomatis menjadi baseline persediaan.

### 6.2 Aturan matching item

Urutan pencocokan:

1. Mapping `Zoho item ID ↔ RAHO product ID` yang sudah tersimpan.
2. Custom field unik `RAHO_ITEM_ID`.
3. SKU persis setelah trim dan normalisasi case.
4. Nama+UOM hanya sebagai kandidat review, bukan auto-match.

Hasil:

| Hasil | Tindakan |
|---|---|
| Satu exact match | Link otomatis |
| Tidak ada match | Buat draft produk RAHO dari item Zoho |
| Lebih dari satu match | `ACTION_REQUIRED` |
| SKU sama tetapi UOM berbeda | Blok dan minta mapping conversion |
| Item Zoho inactive | Tidak dibuat aktif otomatis di RAHO |
| Item RAHO ada, Zoho tidak ada | Buat di Zoho setelah baseline selesai |

Nama saja tidak cukup untuk auto-match.

### 6.3 Adopsi stock existing

Pada initial connection, stock Zoho menjadi opening balance RAHO.

```text
Zoho item stock per location
→ map ke RAHO warehouse/stock location
→ buat opening inventory posting RAHO
→ buat inventory balance
→ buat opening cost layer
→ simpan baseline snapshot
```

Jika Zoho mempunyai 70 pcs sedangkan data pra-cutover RAHO mempunyai 100 pcs:

```text
Opening RAHO baru     = 70 pcs
Saldo Zoho            = 70 pcs
Selisih data lama     = 30 pcs
Tindakan ke Zoho      = tidak ada
Status                = BASELINE_ADOPTED_WITH_DIFFERENCE
```

Selisih lama tetap disimpan untuk audit, tetapi tidak boleh langsung menambah
atau mengurangi Zoho.

### 6.4 Nilai opening inventory

Ambil nilai unit/rate yang dapat dipertanggungjawabkan dari Zoho atau laporan
inventory Books. Jika Zoho hanya memberikan quantity melalui item response,
Finance harus menyediakan export/report nilai persediaan sebagai sumber
baseline.

Untuk RAHO:

```text
opening quantity = stock on hand Zoho
opening unit cost = approved Zoho baseline unit value
opening value    = quantity × unit cost
```

Opening cost layer diberi source:

```text
ZOHO_BASELINE:{organizationId}:{itemId}:{locationId}:{snapshotDate}
```

### 6.5 Location

Setiap Books location dipetakan ke satu lokasi RAHO.

| Kondisi | Tindakan |
|---|---|
| Location Zoho sudah dikenal | Link |
| Location Zoho baru | Buat draft mapping |
| Beberapa gudang RAHO ke satu location Zoho | Butuh aturan agregasi |
| Satu gudang RAHO ke beberapa location Zoho | Dilarang tanpa split policy |

Rak/bin internal tetap berada di RAHO.

### 6.6 Freeze dan snapshot

Cutover item:

1. Masuk mode `DISCOVERY`.
2. Tarik semua halaman item dan stock.
3. Simpan raw response hash dan waktu snapshot.
4. Freeze mutasi RAHO selama baseline diadopsi.
5. Jalankan matching.
6. Review konflik.
7. Finance menyetujui quantity dan nilai.
8. Posting opening balance RAHO secara atomik.
9. Ambil ulang saldo Zoho.
10. Pastikan saldo baseline tidak berubah selama proses.
11. Kunci baseline.
12. Aktifkan event baru.

Jika saldo Zoho berubah antara snapshot dan approval, snapshot dianggap stale
dan harus diulang.

---

## 7. Penyesuaian persediaan dan perubahan stok

### 7.1 Aturan setelah baseline

Setelah baseline dikunci:

- RAHO menjadi sumber kejadian operasional baru.
- Zoho tetap menyimpan dampak quantity dan finansial.
- Rekonsiliasi membandingkan hasil akhirnya.
- Pengguna tidak boleh membuat adjustment manual di kedua sistem untuk kejadian
  yang sama.

### 7.2 Matriks perubahan persediaan

| Kejadian RAHO | Dampak RAHO | Target Zoho Books |
|---|---|---|
| Pembelian/penerimaan | Stock masuk + FIFO | Bill/workflow pembelian tervalidasi |
| Invoice penjualan barang | Stock keluar | Invoice inventory item |
| Kirim barang partnership | Stock keluar | Invoice pada recognition point |
| Pemakaian bahan infus | Stock keluar aktual | Quantity Adjustment negatif |
| Barang rusak/expired | Stock keluar | Quantity Adjustment negatif |
| Selisih lebih opname | Stock masuk | Quantity Adjustment positif |
| Selisih kurang opname | Stock keluar | Quantity Adjustment negatif |
| Koreksi nilai | Nilai layer dikoreksi | Value Adjustment |
| Transfer cabang | Keluar/masuk lokasi | Location transfer/adjustment tervalidasi |

### 7.3 Satu kejadian, satu dampak

Contoh yang benar:

```text
Supplier Bill Zoho menaikkan stock
→ jangan membuat Quantity Adjustment positif untuk penerimaan yang sama.
```

Contoh yang salah:

```text
Bill + Quantity Adjustment + jurnal persediaan
→ quantity/nilai tercatat lebih dari sekali.
```

### 7.4 Inventory Adjustment

Sebelum implementasi, lakukan proof of concept pada organisasi Zoho Books:

1. Quantity adjustment positif.
2. Quantity adjustment negatif.
3. Value adjustment.
4. Adjustment per location.
5. Reversal.
6. Pengambilan external ID dan stock setelah adjustment.

Jangan memakai endpoint `/inventory/v1/itemadjustments` karena itu milik Zoho
Inventory. Jika organisasi/Books API tidak menyediakan jalur otomatis yang
dibutuhkan:

- job masuk `ACTION_REQUIRED`;
- Finance membuat adjustment di UI Zoho Books berdasarkan payload RAHO; atau
- hanya jurnal nilai yang dikirim, dengan status quantity Zoho belum synced.

Sistem tidak boleh menampilkan status `SYNCED` jika hanya nilai yang berubah
tetapi quantity belum berubah.

### 7.5 Reference dan idempotency

```text
RAHO_STOCK_EVENT:{inventoryPostingId}
RAHO_STOCK_REVERSAL:{originalPostingId}:{reversalId}
```

Sebelum create:

1. Periksa mapping lokal.
2. Cari reference di Zoho jika modul mendukung.
3. Jika ditemukan, link external ID.
4. Create hanya bila belum ada.
5. Simpan response sebelum menandai job sukses.

---

## 8. Customer aktif menjadi member RAHO

### 8.1 Data customer yang ditarik

Ambil customer contact aktif:

- `contact_id`;
- display/contact name;
- first name dan last name bila tersedia;
- custom field tanggal lahir;
- email;
- phone/mobile;
- billing address;
- status;
- currency;
- custom field `RAHO_MEMBER_ID`;
- last modified time.

Zoho harus memiliki custom field customer:

```text
RAHO_DATE_OF_BIRTH
```

Format yang disarankan:

```text
YYYY-MM-DD
```

Tanpa tanggal lahir yang valid, customer tidak boleh auto-match berdasarkan nama
saja.

### 8.2 Normalisasi nama

Sebelum membandingkan:

1. Trim whitespace awal/akhir.
2. Ubah ke lowercase untuk key.
3. Gabungkan multiple spaces.
4. Normalisasi Unicode.
5. Hilangkan gelar hanya jika daftar gelar telah disetujui.
6. Jangan menghilangkan bagian nama yang dapat membedakan orang.

Contoh:

```text
"  Siti   Aminah " → "siti aminah"
"SITI AMINAH"      → "siti aminah"
```

### 8.3 Aturan exact match

Auto-match hanya jika:

```text
normalized Zoho customer name = normalized RAHO member name
AND
Zoho date of birth = RAHO date of birth
AND
tepat satu member RAHO ditemukan
```

Jika cocok:

- jangan membuat member baru;
- simpan mapping `Zoho contact ID ↔ RAHO member ID`;
- isi field kosong yang diizinkan menurut merge policy;
- jangan menimpa NIK, tanggal lahir, atau data terverifikasi tanpa review;
- tulis custom field `RAHO_MEMBER_ID` ke Zoho setelah approval.

### 8.4 Jika tidak ada match

Buat member/pelanggan baru di RAHO jika:

- customer Zoho aktif;
- nama tersedia;
- tanggal lahir valid;
- tidak ada exact match;
- tidak ada kandidat ambigu;
- cabang registrasi default telah ditentukan.

Data minimum member baru:

```text
memberNo             dibuat oleh RAHO
fullName             dari Zoho
dateOfBirth          dari custom field Zoho
email/phone/address  jika tersedia
registrationBranch   hasil mapping/default
isActive             true
source               ZOHO_EXISTING_CUSTOMER
```

### 8.5 Kondisi yang harus manual

| Kondisi | Hasil |
|---|---|
| Nama sama, tanggal lahir sama, satu hasil | Auto-link |
| Nama sama, tanggal lahir berbeda | Jangan link |
| Nama sama, tanggal lahir kosong | Manual review |
| Tanggal lahir sama, nama berbeda | Manual review |
| Dua member mempunyai nama+DOB sama | Ambiguous, jangan link |
| Customer perusahaan | Buat customer bisnis, bukan member individual |
| Customer inactive | Jangan otomatis aktifkan member |

Jika tersedia, NIK, email, atau nomor telepon dapat menjadi bukti tambahan,
tetapi nama+tanggal lahir tetap aturan minimum yang diminta.

### 8.6 Merge policy

| Field | Kebijakan |
|---|---|
| Nama | RAHO terverifikasi menang; perbedaan direview |
| Tanggal lahir | Tidak boleh ditimpa otomatis |
| NIK | Tidak dikirim dari Zoho kecuali sumber terverifikasi |
| Email/phone | Isi jika kosong; konflik direview |
| Address | Zoho dapat mengisi bila RAHO kosong |
| Status aktif | Tidak menonaktifkan otomatis tanpa approval |

---

## 9. Faktur uang muka

### 9.1 Konsep

Ketika member membayar sebelum infus, barang, atau add-on diberikan:

```text
Pembayaran diterima
→ masuk Retainer Invoice
→ dicatat sebagai uang muka/kewajiban
→ belum masuk omzet
```

Di Zoho Books, gunakan **Retainer Invoice**, bukan Invoice pendapatan biasa.

### 9.2 Trigger pembuatan

Retainer Invoice dibuat ketika:

- member membeli paket dan diwajibkan membayar di awal;
- pembayaran awal diterima/terverifikasi;
- customer mapping tersedia;
- harga, diskon, tax, dan termin telah final;
- transaksi belum pernah mempunyai retainer mapping.

Reference:

```text
RAHO_RETAINER:{memberPackageId}
RAHO_RETAINER_TERM:{paymentGroupId}:{installmentNumber}
```

### 9.3 Status

```text
DRAFT
→ APPROVED/SENT
→ UNPAID/PARTIALLY_PAID
→ PAID
→ PARTIALLY_APPLIED
→ FULLY_APPLIED
→ REFUNDED/VOID
```

Status internal RAHO harus membedakan:

- nilai ditagihkan;
- nilai dibayar;
- nilai masih ditahan;
- nilai sudah diterapkan ke invoice;
- nilai tersisa;
- nilai direfund.

### 9.4 Akuntansi

Pada pembayaran uang muka:

```text
Dr Kas/Bank
   Cr Uang Muka Pelanggan / Deferred Revenue
```

Belum ada omzet dan belum ada pengakuan pendapatan layanan.

Pada realisasi layanan/penjualan:

```text
Saat Invoice satuan diposting:
Dr Piutang Usaha
   Cr Pendapatan

Saat retainer diterapkan:
Dr Uang Muka Pelanggan / Deferred Revenue
   Cr Piutang Usaha
```

Implementasi Zoho dilakukan dengan membuat Invoice satuan lalu menerapkan
retainer payment ke Invoice tersebut.

---

## 10. Termin pembayaran

### 10.1 Definisi

Termin adalah pembagian kewajiban pembayaran paket menjadi beberapa tahap.

Contoh paket Rp12.000.000:

| Termin | Persentase | Nilai | Jatuh tempo |
|---|---:|---:|---|
| 1 | 50% | Rp6.000.000 | saat daftar |
| 2 | 25% | Rp3.000.000 | sebelum infus ke-4 |
| 3 | 25% | Rp3.000.000 | sebelum infus ke-7 |

Total termin wajib sama dengan total kontrak setelah diskon dan pajak.

### 10.2 Model Zoho

Pilihan yang direkomendasikan:

- satu Retainer Invoice per termin; atau
- satu Retainer Invoice dengan beberapa pembayaran jika dokumen bisnis tidak
  perlu dipisahkan.

Gunakan satu Retainer Invoice per termin bila:

- tanggal jatuh tempo berbeda;
- approval berbeda;
- invoice number per termin diperlukan;
- penagihan dikirim terpisah.

### 10.3 Hold

Termin yang sudah dibayar tetap di-hold sebagai retainer balance sampai event
revenue terjadi.

```text
Retainer paid ≠ Revenue
Retainer applied to fulfilled Invoice = Revenue
```

### 10.4 Kekurangan pembayaran

Jika nilai Invoice satuan lebih besar dari retainer tersedia:

```text
Invoice amount          Rp2.000.000
Retainer available      Rp1.500.000
Applied retainer        Rp1.500.000
Invoice outstanding       Rp500.000
```

Sisa Rp500.000 menjadi piutang dan mengikuti payment terms Invoice.

### 10.5 Kelebihan uang muka

Jika retainer lebih besar:

```text
Retainer available      Rp3.000.000
Invoice satuan          Rp2.000.000
Applied                 Rp2.000.000
Retainer remaining      Rp1.000.000
```

Sisa tetap ditahan untuk Invoice berikutnya atau direfund melalui prosedur
refund.

---

## 11. Invoice satuan dan pengakuan omzet

### 11.1 Definisi

Invoice satuan adalah Invoice yang dibuat ketika satu unit kewajiban telah
dipenuhi. Invoice inilah yang memindahkan bagian uang muka menjadi omzet.

Trigger yang diizinkan:

1. Infus selesai.
2. Barang partnership dikirim/diserahterimakan sesuai recognition policy.
3. Add-on Premier diserahkan/diaktifkan/digunakan sesuai jenis produknya.

Invoice tidak dibuat hanya karena jadwal dibuat atau paket dibayar.

### 11.2 Infus

Trigger:

```text
TreatmentSession status = COMPLETED
AND completion tidak dibatalkan
AND invoice satuan untuk session belum ada
```

Flow:

```text
Infus completed
→ hitung nilai unit layanan
→ buat Invoice Zoho
→ apply saldo Retainer
→ nilai applied menjadi omzet
→ simpan invoice_id dan applied amount
```

Reference:

```text
RAHO_UNIT_INVOICE:INFUSION:{treatmentSessionId}
```

### 11.3 Nilai invoice infus

Kebijakan nilai harus eksplisit.

Metode default:

```text
nilai per sesi = nilai paket bersih / jumlah sesi berbayar
```

Contoh:

```text
Paket 7 sesi       Rp12.500.000
Diskon               Rp500.000
Nilai bersih       Rp12.000.000
Nilai sesi 1–6      Rp1.714.285,71
Nilai sesi terakhir = residual agar total tepat Rp12.000.000
```

Jangan membulatkan setiap sesi tanpa residual policy karena total omzet dapat
berbeda dari nilai paket.

Sesi bonus/gratis:

- tidak membuat revenue baru;
- boleh membuat Invoice nol hanya jika dibutuhkan untuk audit;
- material/HPP tetap dicatat sesuai pemakaian aktual.

### 11.4 Penjualan/kirim barang partnership

Recognition point harus dipilih tertulis:

```text
DISPATCHED
atau
RECEIVED/DELIVERED
```

Rekomendasi konservatif: `RECEIVED/DELIVERED`, kecuali kontrak menyatakan risiko
dan kendali berpindah saat dispatch.

Flow:

```text
Stock request approved
→ payment/retainer tersedia
→ shipment dibuat
→ barang mencapai recognition point
→ buat Invoice item inventory
→ stock Zoho berkurang
→ apply retainer jika ada
→ omzet diakui
```

Reference:

```text
RAHO_UNIT_INVOICE:PARTNERSHIP:{shipmentId}
```

Partial delivery membuat Invoice hanya atas quantity yang benar-benar memenuhi
recognition point. Sisa dibuat pada pengiriman berikutnya.

### 11.5 Add-on Premier

Recognition point bergantung tipe add-on:

| Add-on | Recognition point |
|---|---|
| Barang fisik | Diserahkan ke member |
| Booster/material per sesi | Sesi terkait completed |
| Hak layanan | Layanan diberikan |
| Biaya sekali jadi yang langsung dipenuhi | Aktivasi/penyerahan tervalidasi |

Flow:

```text
Add-on paid/approved
→ nilai ditahan sebagai retainer bila belum dipenuhi
→ fulfillment event
→ Invoice satuan
→ apply retainer
→ omzet
```

Reference:

```text
RAHO_UNIT_INVOICE:ADDON:{memberAddOnId}:{fulfillmentId}
```

### 11.6 Apply retainer ke Invoice

Gunakan operasi Zoho Books:

```text
POST /books/v3/retainerinvoices/{retainerinvoice_id}/invoices
```

Payload konseptual:

```json
{
  "invoice_payments": [
    {
      "invoice_id": "ZOHO_INVOICE_ID",
      "amount_applied": 2000000,
      "apply_date": "2026-07-27"
    }
  ]
}
```

Nilai apply:

```text
minimum(
  invoice outstanding,
  retainer available,
  amount authorized for this fulfillment
)
```

### 11.7 Satu event satu Invoice

Sebelum create Invoice:

1. Cari mapping berdasarkan fulfillment event ID.
2. Cari custom reference di Zoho.
3. Jika sudah ada, link dan jangan create ulang.
4. Create hanya jika belum ada.
5. Apply retainer dengan operation key terpisah.

Idempotency:

```text
CREATE_INVOICE:{fulfillmentEventId}
APPLY_RETAINER:{retainerId}:{invoiceId}:{amount}:{applyDate}
```

---

## 12. Flow end-to-end

### 12.1 Initial adoption

```text
Zoho Items/Stock/Customers existing
→ discovery
→ matching
→ review konflik
→ import opening stock RAHO
→ link/create member RAHO
→ lock baseline
→ LIVE
```

### 12.2 Paket dibayar di awal

```text
Member membeli paket
→ buat Retainer Invoice
→ pembayaran diverifikasi
→ retainer PAID
→ nilai masih liability
→ infus completed
→ buat Invoice satuan
→ apply retainer
→ omzet diakui sebesar Invoice
```

### 12.3 Paket dengan termin

```text
Kontrak paket
→ Termin 1 Retainer Invoice
→ Termin 1 dibayar dan di-hold
→ fulfillment terjadi
→ Invoice satuan
→ apply saldo Termin 1
→ ketika saldo kurang, gunakan Termin berikutnya/piutang
```

### 12.4 Partnership

```text
Stock request
→ Retainer/payment sesuai kebijakan
→ shipment
→ recognition point tercapai
→ Invoice barang
→ inventory berkurang
→ retainer diterapkan
→ omzet diakui
```

---

## 13. Model data tambahan

### 13.1 Mapping external

```text
ZohoEntityMapping
  organizationId
  entityType
  rahoEntityId
  zohoEntityId
  externalReference
  sourceHash
  lastSyncedHash
  lastSyncedAt
  status
```

Entity type minimum:

```text
ITEM
LOCATION
CONTACT_CUSTOMER
RETAINER_INVOICE
RETAINER_PAYMENT
INVOICE
RETAINER_APPLICATION
INVENTORY_ADJUSTMENT
```

### 13.2 Member matching

```text
ZohoMemberMatch
  zohoContactId
  rahoMemberId
  normalizedName
  dateOfBirth
  matchMethod
  confidence
  status
  reviewedBy
  reviewedAt
```

Status:

```text
EXACT_MATCH
CREATED_FROM_ZOHO
AMBIGUOUS
MISSING_BIRTH_DATE
CONFLICT
IGNORED
```

### 13.3 Revenue fulfillment

```text
RevenueFulfillment
  type
  sourceId
  memberId/customerId
  contractValue
  fulfilledValue
  invoiceValue
  zohoInvoiceId
  retainerApplied
  outstanding
  recognitionDate
  status
```

Type:

```text
INFUSION
PARTNERSHIP_DELIVERY
PREMIER_ADDON
OTHER_APPROVED_SALE
```

### 13.4 Retainer ledger

Simpan lokal:

```text
retainer billed
retainer paid
retainer available
retainer applied
retainer refunded
retainer remaining
```

Invariant:

```text
remaining = paid - applied - refunded
remaining >= 0
```

---

## 14. Event integrasi

| Event | Target |
|---|---|
| `ZOHO_BASELINE_REQUESTED` | Discovery read-only |
| `ZOHO_BASELINE_APPROVED` | Import opening RAHO |
| `CUSTOMER_DISCOVERED` | Member matching |
| `ITEM_ACTIVATED` | Zoho Item |
| `RETAINER_REQUIRED` | Retainer Invoice |
| `ADVANCE_PAYMENT_VERIFIED` | Retainer Payment |
| `TREATMENT_COMPLETED` | Invoice satuan infus |
| `PARTNERSHIP_DELIVERED` | Invoice barang |
| `PREMIER_ADDON_FULFILLED` | Invoice add-on |
| `UNIT_INVOICE_CREATED` | Apply Retainer |
| `INVENTORY_ADJUSTMENT_POSTED` | Books adjustment |
| `FULFILLMENT_REVERSED` | Void/credit/reversal |

Event harus dibuat dalam transaksi database yang sama dengan perubahan bisnis.

---

## 15. Dependency

```text
Customer mapping
      ↓
Retainer Invoice
      ↓
Retainer Payment
      ↓
Fulfillment event
      ↓
Invoice satuan
      ↓
Apply Retainer
      ↓
Revenue reconciliation
```

Job tidak boleh melompati dependency. Contohnya, retainer tidak boleh
diaplikasikan sebelum Invoice mempunyai Zoho invoice ID.

---

## 16. Reversal dan pembatalan

### 16.1 Infus dibatalkan setelah Invoice

1. Jangan menghapus transaksi posted.
2. Void Invoice jika masih diizinkan dan belum locked.
3. Jika tidak, buat Credit Note/reversal.
4. Batalkan application retainer terhadap Invoice.
5. Kembalikan nilai ke retainer available.
6. Reverse revenue dan inventory/HPP terkait.

### 16.2 Pengiriman partnership diretur

- buat sales return/credit note sesuai kemampuan Books;
- kembalikan inventory jika barang diterima kembali;
- kurangi omzet;
- kembalikan retainer/credit sesuai kebijakan.

### 16.3 Paket dibatalkan

Sisa retainer:

- tetap sebagai credit bila disetujui; atau
- direfund melalui transaksi refund Zoho.

Refund tidak boleh dilakukan hanya dengan mengubah status lokal.

---

## 17. Rekonsiliasi

### 17.1 Item dan persediaan

Bandingkan per item/location:

```text
RAHO on hand
Zoho stock on hand
quantity difference
RAHO FIFO value
Zoho inventory value
value difference
```

### 17.2 Customer/member

Tampilkan:

- customer aktif Zoho;
- exact matched;
- member baru dari Zoho;
- missing DOB;
- ambiguous;
- conflict;
- customer tanpa mapping.

### 17.3 Retainer

```text
RAHO advance verified
versus
Zoho retainer paid

RAHO unearned balance
versus
Zoho retainer available
```

### 17.4 Invoice dan omzet

```text
jumlah fulfillment event
versus
jumlah Invoice satuan

nilai fulfilled
versus
nilai Invoice

nilai retainer applied
versus
nilai omzet terkait
```

Status:

```text
MATCHED
MISSING_IN_RAHO
MISSING_IN_ZOHO
AMOUNT_DIFFERENCE
QUANTITY_DIFFERENCE
AMBIGUOUS
ACTION_REQUIRED
RESOLVED
```

---

## 18. UI yang diperlukan

Menu **Integrasi Zoho Books**:

1. Ringkasan.
2. Data Existing.
3. Item dan Persediaan.
4. Customer dan Member.
5. Faktur Uang Muka.
6. Invoice Satuan dan Omzet.
7. Antrean.
8. Rekonsiliasi.

### 18.1 Data Existing

Tombol:

```text
Tarik Data Zoho
Preview Matching
Export Konflik
Approve Baseline
Adopsi Baseline
```

### 18.2 Customer dan Member

Kolom:

```text
Zoho customer
Tanggal lahir Zoho
Kandidat member RAHO
Tanggal lahir RAHO
Match method
Status
Action
```

### 18.3 Retainer dan omzet

Tampilkan:

```text
Member
Kontrak/paket
Total kontrak
Retainer paid
Retainer applied
Retainer remaining
Invoice satuan count
Revenue recognized
Outstanding
```

---

## 19. Permission dan approval

Permission minimum:

```text
ZOHO.CONNECT
ZOHO.BASELINE.READ
ZOHO.BASELINE.APPROVE
ZOHO.MAPPING.MANAGE
ZOHO.MEMBER_MATCH.REVIEW
ZOHO.RETAINER.CREATE
ZOHO.RETAINER.APPLY
ZOHO.SYNC.RETRY
ZOHO.RECONCILIATION.RESOLVE
```

Baseline, ambiguous member match, value adjustment, refund, dan reversal
memerlukan approval sesuai nominal/kebijakan organisasi.

---

## 20. Testing dan UAT

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| EX-01 | Zoho item existing cocok SKU | Link, tidak duplikat |
| EX-02 | Item hanya ada di Zoho | Draft produk RAHO |
| EX-03 | Stock Zoho 70, RAHO lama 100 | Opening RAHO 70, difference 30 |
| EX-04 | Saldo berubah saat cutover | Snapshot stale, proses dibatalkan |
| MB-01 | Nama+DOB sama, satu member | Auto-link |
| MB-02 | Nama sama, DOB beda | Tidak auto-link |
| MB-03 | Dua member nama+DOB sama | Ambiguous |
| MB-04 | Customer baru valid | Member baru dibuat |
| RT-01 | Uang muka dibayar | Liability, bukan omzet |
| RT-02 | Termin parsial | Retainer balance sesuai pembayaran |
| RV-01 | Infus completed | Invoice satuan + apply retainer |
| RV-02 | Infus belum completed | Tidak ada Invoice omzet |
| RV-03 | Partnership partial delivery | Invoice hanya quantity delivered |
| RV-04 | Add-on belum fulfilled | Tetap retainer |
| RV-05 | Retainer kurang | Sisa menjadi piutang |
| RV-06 | Retainer lebih | Sisa tetap available |
| RV-07 | Retry worker | Tidak ada Invoice/application ganda |
| RV-08 | Pembatalan | Revenue dan retainer direversal benar |

---

## 21. Urutan implementasi

1. Buat OAuth dan Books client.
2. Buat tabel connection, mapping, job, attempt, dan reconciliation.
3. Implementasikan discovery Items, Locations, Contacts, Retainers, dan Invoices.
4. Implementasikan preview matching item.
5. Implementasikan preview matching customer/member.
6. Buat UI konflik dan approval baseline.
7. Implementasikan adopsi stock Zoho ke opening RAHO.
8. Implementasikan pembuatan member dari customer Zoho.
9. Implementasikan Retainer Invoice dan Retainer Payment.
10. Implementasikan termin.
11. Implementasikan Invoice satuan infus.
12. Implementasikan Invoice partnership.
13. Implementasikan Invoice add-on Premier.
14. Implementasikan apply retainer.
15. Implementasikan reversal/refund.
16. Implementasikan inventory dan revenue reconciliation.
17. Jalankan pilot satu cabang.
18. Cutover production dan monitor.

---

## 22. Definition of done

Implementasi selesai jika:

1. Data existing Zoho tidak ditimpa saat discovery.
2. Semua item aktif mempunyai mapping atau status tindakan yang jelas.
3. Opening stock RAHO sama dengan baseline Zoho yang disetujui.
4. Tidak ada item ganda akibat initial sync/retry.
5. Customer nama+tanggal lahir sama terhubung ke member yang sama.
6. Customer tanpa exact match dibuat sebagai member baru setelah validasi.
7. Match ambigu tidak pernah digabung otomatis.
8. Uang muka berada di Retainer Invoice dan belum menjadi omzet.
9. Termin dapat dilacak billed, paid, applied, remaining, dan overdue.
10. Invoice satuan hanya dibuat saat fulfillment.
11. Infus, partnership, dan add-on mempunyai recognition point yang jelas.
12. Apply retainer tidak melebihi saldo tersedia atau outstanding Invoice.
13. Invoice/application/reversal idempotent.
14. Persediaan, retainer, Invoice, dan omzet dapat direkonsiliasi.
15. Seluruh UAT EX, MB, RT, dan RV lulus.

---

## 23. Referensi resmi

- [Zoho Books OAuth](https://www.zoho.com/books/api/v3/oauth/)
- [Zoho Books Items API](https://www.zoho.com/books/api/v3/items/)
- [Zoho Books Contacts API](https://www.zoho.com/books/api/v3/contacts/)
- [Zoho Books Retainer Invoices API](https://www.zoho.com/books/api/v3/retainer-invoices/)
- [Apply Retainers to Invoices](https://www.zoho.com/books/help/retainer-invoice/functions.html)
- [Zoho Books Invoices API](https://www.zoho.com/books/api/v3/invoices/)
- [Zoho Books Inventory Adjustments](https://www.zoho.com/us/books/help/items/item-adjustments.html)
