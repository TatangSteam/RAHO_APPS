# Report Aplikasi RAHO ERP untuk Presentasi Non-IT

Status: bahan presentasi siap dipindahkan ke PowerPoint  
Snapshot aplikasi: 24 Agustus 2026  
Audiens: Pemilik, Direksi, Kepala Cabang, Operasional, Finance, dan pengguna non-IT  
Durasi presentasi yang disarankan: 20–30 menit

---

## Cara paling cepat menggunakan report ini

Jika audiens tidak suka membaca panjang, cukup gunakan:

1. Slide 1–5 untuk menjelaskan aplikasi.
2. Slide 6–12 untuk menunjukkan fitur yang sudah dibuat.
3. Slide 13–15 untuk fitur terbaru, manfaat, dan status kesiapan.
4. Slide 16 untuk keputusan berikutnya.

Pesan utama presentasi:

> RAHO ERP menyatukan pelayanan member, sesi terapi, persediaan, keuangan,
> approval, dan laporan dalam satu alur yang dapat ditelusuri.

---

# Bagian A — Isi PowerPoint

## Slide 1 — Sampul

### Judul

**RAHO ERP**  
Satu Sistem untuk Pelayanan, Terapi, Persediaan, dan Keuangan

### Subjudul

Laporan perkembangan aplikasi dan fitur yang telah dibangun  
Snapshot 24 Agustus 2026

### Visual yang disarankan

- Logo resmi RAHO di tengah atau kanan.
- Latar gelap mengikuti tampilan aplikasi.
- Gunakan aksen emas dan merah RAHO.

### Kalimat pembicara

> RAHO ERP adalah sistem operasional klinik yang menghubungkan pekerjaan
> pelayanan member sampai pencatatan keuangan dan laporan manajemen.

---

## Slide 2 — Ringkasan untuk Pimpinan

### Judul

**RAHO ERP sudah menjadi pusat operasional lintas cabang, bukan sekadar aplikasi member.**

### Isi utama

| Fakta | Makna bisnis |
|---|---|
| **175+ fitur terdokumentasi** | Proses utama klinik telah mempunyai dukungan sistem |
| **77 halaman aplikasi** | Tersedia ruang kerja khusus sesuai tanggung jawab pengguna |
| **8 kelompok pengguna** | Akses dibedakan dari Super Admin sampai Member |
| **30 modul bisnis** | Pelayanan, klinis, stok, Finance, approval, dan integrasi dipisahkan dengan jelas |
| **316 skenario UAT** | Alur penting sudah mempunyai panduan pengujian lintas role |

### Pesan singkat

```text
Satu data → satu alur kerja → satu jejak audit
```

### Catatan pembicara

Jumlah tersebut menunjukkan luas cakupan yang ditemukan pada aplikasi dan
dokumentasi. Angka fitur bukan pengganti UAT; fitur baru tetap harus diuji dan
ditandatangani oleh pemilik proses sebelum dianggap siap produksi penuh.

---

## Slide 3 — Masalah Bisnis yang Diselesaikan

### Judul

**RAHO ERP mengurangi pekerjaan terpisah dan membuat setiap transaksi dapat ditelusuri.**

### Sebelum sistem terintegrasi

- Data member tersebar.
- Sesi terapi berisiko tertinggal atau belum lengkap.
- Pemakaian barang sulit dicocokkan dengan stok.
- Approval berjalan melalui chat atau pesan pribadi.
- Finance harus menyusun ulang data dari banyak sumber.
- Koreksi data berisiko menghilangkan histori.

### Setelah menggunakan RAHO ERP

- Member, paket, sesi, dan pembayaran saling terhubung.
- Tugas yang belum selesai muncul sebagai reminder.
- Pemakaian bahan langsung mempunyai sumber stok.
- Approval masuk ke satu Approval Inbox.
- Jurnal, kas/bank, dan laporan berasal dari dokumen sumber.
- Perubahan penting tercatat di Audit Log.

### Visual yang disarankan

Gunakan perbandingan dua sisi:

```text
TERPISAH DAN MANUAL        →        TERHUBUNG DAN TERKONTROL
```

---

## Slide 4 — Apa Itu RAHO ERP?

### Judul

**RAHO ERP adalah sistem kerja bersama untuk seluruh perjalanan pelayanan klinik.**

### Peta sistem

```text
MEMBER & PAKET
      ↓
SESI TERAPI & CATATAN KLINIS
      ↓
PEMAKAIAN BARANG & PERSEDIAAN
      ↓
INVOICE, PEMBAYARAN & KEUANGAN
      ↓
APPROVAL, AUDIT & LAPORAN
      ↓
INTEGRASI ZOHO BOOKS
```

### Penjelasan sederhana

- **Operasional:** membantu cabang melayani member.
- **Klinis:** membantu Dokter dan Nakes mencatat terapi.
- **Logistik:** menjaga barang dari pembelian sampai pemakaian.
- **Finance:** menghubungkan transaksi dengan kas, jurnal, dan laporan.
- **Manajemen:** memberi approval, monitoring, dan audit.

### Catatan pembicara

RAHO ERP tidak menggantikan keputusan medis atau keputusan Finance. Sistem
menyediakan alur, pembatasan akses, bukti, dan histori agar keputusan manusia
lebih cepat dan dapat dipertanggungjawabkan.

---

## Slide 5 — Flow Bisnis Utama

### Judul

**Satu perjalanan member menghubungkan enam fungsi bisnis secara otomatis.**

### Flow

```text
1. Member didaftarkan
        ↓
2. Paket dipilih dan invoice dibuat
        ↓
3. Pembayaran diverifikasi
        ↓
4. Sesi terapi dijalankan
        ↓
5. Benefit dan stok berkurang satu kali
        ↓
6. Revenue, HPP, jurnal, dan laporan diperbarui
```

### Kontrol penting

- Nomor dan referensi dokumen jelas.
- Satu kejadian bisnis tidak boleh diposting dua kali.
- Data yang sudah diposting dikoreksi melalui reversal, bukan dihapus.
- Cabang dan role menentukan data yang boleh dilihat atau diubah.

---

## Slide 6 — Pengguna dan Tanggung Jawab

### Judul

**Setiap role hanya melihat pekerjaan yang relevan dengan tanggung jawabnya.**

| Role | Fokus utama |
|---|---|
| **Super Admin** | Konfigurasi global, user, role, master, audit, integrasi |
| **Admin Manager** | Monitoring beberapa cabang, approval, laporan, dan koreksi terkontrol |
| **Admin Cabang** | Operasional cabang, staff, member, stok, dan verifikasi |
| **Admin Layanan / MSO** | Member, paket, pembayaran, sesi, inventori tim, dan reimburse |
| **Finance & Logistik** | Accounting, kas/bank, persediaan, purchasing, approval, dan Zoho |
| **Dokter** | Diagnosis, Therapy Plan, Evaluasi Dokter, dan catatan klinis |
| **Nakes** | Vital, infus, material, foto, dan pelaksanaan terapi |
| **Member** | Profil, voucher, invoice, pembayaran, dan histori sesi milik sendiri |

### Pesan penting

> Hak akses mengikuti role, permission, dan cabang yang ditugaskan—bukan hanya
> berdasarkan menu yang terlihat.

---

## Slide 7 — Member, Paket, dan Pembayaran

### Judul

**Data member terhubung langsung dengan paket, invoice, pembayaran, dan riwayat layanan.**

### Fitur yang sudah dibuat

- Registrasi, pencarian, dan edit profil member.
- Member dapat mempunyai akses ke lebih dari satu cabang.
- Dokumen PSP, foto profil, dan hasil laboratorium dengan akses aman.
- Paket Basic, Booster, bundling, add-on, dan produk non-terapi.
- Harga paket per cabang dan dukungan cicilan.
- Invoice, bukti pembayaran, verifikasi, pembayaran parsial, dan refund.
- Voucher/sisa sesi dan portal pribadi Member.
- Referral code dan insentif referral.
- Paket gratis/complimentary tanpa pembayaran palsu.

### Flow singkat

```text
Cari Member → Pilih Paket → Invoice → Pembayaran → Verifikasi → Paket Aktif
```

### Nilai bisnis

- Pelayanan tidak perlu mencari data di banyak tempat.
- Outstanding pembayaran terlihat.
- Sisa benefit member tidak dihitung manual.
- Bukti pembayaran dapat diperiksa kembali.

---

## Slide 8 — Sesi Terapi dan Catatan Klinis

### Judul

**Sesi terapi membagi pekerjaan medis dan operasional tanpa mencampur tanggung jawab.**

### Tahapan utama

```text
Diagnosis
→ Therapy Plan
→ Vital Sebelum
→ Infus / Booster
→ Pemakaian Material
→ Foto & Catatan
→ Vital Sesudah
→ Evaluasi Dokter
→ Finalisasi
```

### Pembagian tugas

- **Dokter:** diagnosis, rencana yang menjadi kewenangan medis, dan evaluasi.
- **Nakes:** vital, infus, booster aktual, bahan, foto, dan catatan pelaksanaan.
- **Admin Layanan/Admin Cabang:** koordinasi dan penyelesaian pekerjaan operasional.
- **Manager:** monitoring dan koreksi terkontrol sesuai cabang.

### Reminder yang sudah dibuat

- Admin Cabang melihat sesi belum selesai di cabangnya.
- MSO dan Nakes melihat sesi yang di-assign kepadanya.
- Dokter baru menerima reminder ketika prasyarat Evaluasi Dokter sudah lengkap.
- Dokter tidak diganggu reminder jika bagian sebelum evaluasi masih belum selesai.
- MSO/Nakes tidak menerima reminder ketika satu-satunya pekerjaan tersisa adalah Evaluasi Dokter.

### Nilai bisnis

> Pekerjaan yang tertunda terlihat, tetapi reminder tetap dikirim kepada orang
> yang benar.

---

## Slide 9 — Persediaan dan Logistik

### Judul

**Barang dapat ditelusuri dari pembelian sampai dipakai pada sesi terapi.**

### Fitur yang sudah dibuat

- Master produk, SKU, satuan, dan konversi UOM.
- Gudang, lokasi stok, batch, expiry, dan kondisi barang.
- Stok on-hand, reserved, available, dan nilai persediaan.
- Inventory ledger dan mutasi stok.
- FIFO cost layer untuk nilai pemakaian barang.
- Request stok, approval parsial/penuh, dan reservasi.
- Shipment, penerimaan parsial, shortage/damage, dan discrepancy resolution.
- Supplier, Purchase Request, Purchase Order, dan Goods Receipt.
- Treatment BOM dan pemakaian bahan aktual.
- Adjustment, Stock Opname, reversal, dan rekonsiliasi.
- Tas Homecare, stok tas, penggunaan, pengembalian, dan opname.

### Flow singkat

```text
Supplier → PO → Goods Receipt → Stok → Sesi Terapi → Pemakaian → Rekonsiliasi
```

### Nilai bisnis

- Barang tidak hanya terlihat jumlahnya, tetapi juga asal dan pemakaiannya.
- Perbedaan stok harus diselesaikan melalui flow resmi.
- Quantity dan nilai dapat ditelusuri ke dokumen sumber.

---

## Slide 10 — Inventori Tim dan Pinjaman Barang

### Judul

**Tim dapat memakai stok sendiri atau meminjam dari tim lain tanpa memindahkan barang secara informal.**

### Pilihan sumber barang saat finalisasi sesi

```text
PILIH STOK CABANG
→ sistem memotong ledger cabang

PILIH STOK TIM
→ sistem memotong stok tas aktif milik tim
```

Hanya satu sumber yang boleh berkurang untuk satu pemakaian.

### Flow pinjaman antartim

```text
Tim peminjam membuat request
→ Tim pemberi/Manager review
→ Approve atau Reject
→ Jika approve, stok berpindah
→ Pinjaman berstatus ACTIVE
→ Barang dikembalikan
→ Stok kembali ke tim pemberi
```

### Proteksi

- Hanya antartim berbeda dalam cabang yang sama.
- Jumlah tidak boleh melebihi stok pemberi.
- Tim dan tas harus aktif.
- Approve dan return mengikuti pihak yang berwenang.
- Semua perpindahan mempunyai histori.

---

## Slide 11 — Finance, Accounting, dan Approval

### Judul

**Transaksi operasional dapat mengalir menjadi catatan keuangan tanpa kehilangan sumbernya.**

### Fitur Finance yang sudah dibuat

- Chart of Accounts dan periode akuntansi.
- Jurnal dengan validasi total debit = kredit.
- General Ledger dan source link.
- Kas & Bank, receipt, payment, refund, dan saldo.
- Opening Balance terkontrol.
- Expense dengan bukti, approval, pembayaran, dan jurnal.
- Purchasing dan Accounts Payable.
- Deferred Revenue dan pengakuan pendapatan per sesi.
- Profit & Loss, Trial Balance, General Ledger, dan laporan kas/bank.

### Approval Inbox

```text
Dokumen dibuat
→ Submit
→ Masuk Approval Inbox pihak berwenang
→ Approve / Reject / Return for Revision
→ Posting
→ Audit dan laporan
```

### Kontrol utama

- Pembuat dokumen tidak boleh menyetujui dokumennya sendiri.
- Approval mengikuti cabang, nominal, kategori, dan tahap aktif.
- Dokumen posted tidak dihapus langsung.
- Satu pembayaran tidak boleh membentuk jurnal ganda.

---

## Slide 12 — Reimburse Berfoto

### Judul

**Reimburse kini mempunyai bukti, approval, pembayaran, dan jurnal dalam satu flow.**

### Flow

```text
Staf membuat draft + unggah foto
→ Submit
→ Verifikasi Admin Cabang
→ Persetujuan Finance
→ Jika ≥ Rp10 juta: High Approval
→ Finance membayar
→ Kas/Bank dan jurnal terbentuk
→ Status PAID
```

### Data yang disimpan

- Pengaju dan cabang.
- Tanggal, kategori, deskripsi, serta nominal.
- Metode pembayaran dan rekening jika diperlukan.
- Maksimal lima bukti foto privat.
- Alasan revisi atau penolakan.
- Approval history dan referensi pembayaran.

### Nilai bisnis

- Tidak lagi bergantung pada foto yang tercecer di chat.
- Finance melihat dokumen dan bukti yang sama.
- Status klaim dapat dipantau oleh pengaju.
- Pembayaran dan jurnal dibuat satu kali secara terkontrol.

---

## Slide 13 — Program Sosial Terapi Rp500.000

### Judul

**Program Sosial memisahkan harga khusus dari paket normal dan mewajibkan persetujuan.**

### Produk khusus

| Kode | Layanan | Harga member |
|---|---|---:|
| `SRV-TNB-TRP-PS-001` | Terapi Nano Bubble 1X — Program Sosial | **Rp500.000** |

Harga pembanding Basic normal 1X: **Rp2.000.000**.

### Flow

```text
Admin Layanan/Admin Cabang mengajukan
→ Admin Manager menyetujui kelayakan
→ Finance menyetujui subsidi
→ Sistem membuat paket Basic Rp500.000 per sesi
→ Booster opsional dapat dibuat gratis sesuai approval
→ Invoice dibuat
```

### Aturan penting

- Harga sosial tidak dipilih melalui assign paket biasa.
- Paket hanya dibuat setelah approval lengkap.
- Booster gratis harus disebutkan dalam pengajuan.
- Paket sosial dilindungi dari edit/cancel/refund umum yang dapat mengubah hasil approval.
- Data paket dan transaksi lama tidak diubah.

### Nilai bisnis

> Kebijakan sosial dapat dijalankan secara manusiawi tanpa menghilangkan kontrol
> subsidi dan pertanggungjawaban Finance.

---

## Slide 14 — Audit, Keamanan, dan Integrasi

### Judul

**Sistem dirancang agar akses, perubahan, dan kegagalan integrasi tetap dapat dikendalikan.**

### Keamanan dan kontrol

- Login, token, logout, dan profil pengguna.
- Permission granular serta pembatasan cabang.
- File klinis dan bukti transaksi tidak dibuka sebagai file publik.
- Audit Log mencatat actor, tindakan, cabang, dan perubahan penting.
- Maker-checker dan approval bertahap.
- Validasi anti-double posting dan idempotency.

### Zoho Books

- OAuth dan pemilihan organisasi.
- Mapping akun, location, contact, item, dan dokumen.
- Sinkronisasi invoice, pembayaran, expense, PO, Bill, dan vendor payment.
- Queue, retry, dan rekonsiliasi.
- Mode `OFF`, `DRY_RUN`, `CANARY`, dan `LIVE`.
- Gangguan Zoho tidak menghentikan transaksi utama RAHO.

### Batasan yang harus disebutkan

Integrasi Zoho bersifat **terkontrol** dan tetap membutuhkan credential,
mapping, test organization, contract test, cutover, serta sign-off Finance.

---

## Slide 15 — Dampak untuk Setiap Bagian

### Judul

**Manfaat RAHO ERP terlihat pada pelayanan, kontrol, dan kualitas keputusan.**

| Bagian | Dampak yang diharapkan |
|---|---|
| **Pelayanan** | Data member dan pekerjaan tertunda lebih mudah ditemukan |
| **Dokter** | Reminder fokus pada tugas medis yang memang sudah siap dikerjakan |
| **Nakes** | Pelaksanaan dan bahan aktual tercatat dalam satu sesi |
| **Cabang** | Paket, pembayaran, stok, dan tugas harian lebih mudah dipantau |
| **Logistik** | Pergerakan quantity, batch, expiry, dan nilai dapat ditelusuri |
| **Finance** | Dokumen sumber, approval, kas/bank, dan jurnal lebih terhubung |
| **Manager** | Monitoring lintas cabang dan audit tersedia dalam satu sistem |
| **Member** | Paket, invoice, voucher, dan histori pribadi dapat dilihat sendiri |

### Catatan

Manfaat di atas adalah hubungan fungsi ke hasil bisnis. Penghematan waktu atau
penurunan kesalahan dalam persen belum boleh diklaim sebelum tersedia data
baseline dan pengukuran setelah go-live.

---

## Slide 16 — Status Kesiapan

### Judul

**Fondasi aplikasi luas; fokus berikutnya adalah membuktikan kesiapan operasional melalui UAT.**

### Arti status

| Status | Arti sederhana |
|---|---|
| **Tersedia** | Halaman, API, data, atau service sudah ada di source aplikasi |
| **Baru** | Baru dibuat atau diperluas dan membutuhkan perhatian UAT |
| **Terkontrol** | Memerlukan permission, approval, konfigurasi, atau mode aktivasi |
| **Perlu UAT** | Belum boleh dianggap lulus produksi sebelum diuji pengguna |
| **Legacy nonaktif** | Data lama dipertahankan untuk audit, tetapi tidak dipakai pada flow baru |

### Yang sudah tersedia

- Alur member, paket, sesi, stok, Finance, approval, audit, dan laporan.
- UAT per role untuk MSO, Nakes, Dokter, Admin Manager, dan Finance.
- Skenario lintas role untuk sesi terapi dan reimburse.
- Strategi migration additive untuk fitur baru agar data lama tetap aman.

### Yang masih harus dibuktikan

- UAT dengan akun dan cabang nyata.
- Validasi master data serta opening balance.
- Permission dan branch scope sesuai keputusan bisnis.
- Rekonsiliasi stok dan keuangan.
- Contract test serta cutover Zoho Books.
- Sign-off Operasional, Klinis, Logistik, Finance, dan Product Owner.

---

## Slide 17 — Prioritas Berikutnya

### Judul

**Go-live yang aman membutuhkan disiplin data dan pemilik proses, bukan hanya deployment kode.**

### Rencana 30 hari yang disarankan

```text
MINGGU 1
UAT lintas role + perbaikan blocker P0

MINGGU 2
Bersihkan master data, permission, cabang, harga, COA, dan stok

MINGGU 3
Pilot pada cabang, member, dan tim terbatas

MINGGU 4
Rekonsiliasi, sign-off, lalu perluasan bertahap
```

### Keputusan yang dibutuhkan dari pimpinan

1. Siapa Product Owner dan pemilik proses tiap bagian?
2. Cabang mana yang menjadi pilot?
3. Siapa yang menandatangani hasil UAT?
4. Berapa toleransi selisih stok dan Finance?
5. Kapan freeze data serta cutover dilakukan?

### Kalimat penutup

> Aplikasinya sudah mempunyai cakupan yang luas. Tahap terpenting berikutnya
> adalah memastikan setiap role menjalankan flow yang sama dan data awalnya benar.

---

# Bagian B — Ringkasan Fitur untuk Lampiran PowerPoint

## 1. Platform dan akses

- Login, logout, profil, dan session keamanan.
- Multi-cabang dan assignment staff.
- Dashboard serta menu per role.
- Permission granular dan user override.
- Maker-checker dan approval engine.
- Notification, chat, import, export, dan audit.
- File access authorization dan security guard API.

## 2. Cabang, staff, dan member

- Master cabang dan tipe cabang.
- Staff, role, cabang, deaktivasi, dan reset password.
- Admin Manager regional.
- Kinerja Staff dan export.
- Member, profil, multi-cabang, PSP, foto, lab, dan referral.
- Portal Member.

## 3. Paket dan pembayaran

- Basic, Booster, bundle, add-on, dan non-terapi.
- Harga per cabang, diskon, cicilan, dan complimentary.
- Invoice, bukti bayar, verifikasi, partial payment, refund, dan cancel.
- Voucher/sisa sesi serta referral incentive.
- Program Sosial Basic Rp500.000 dengan approval.

## 4. Klinis dan sesi

- Diagnosis dan kategori diagnosis.
- Therapy Plan, versioning, dan dosis.
- Vital sebelum/sesudah.
- Infus, booster, material, foto, keluhan, dan rekomendasi.
- Evaluasi Dokter.
- Reminder berdasarkan role dan kesiapan tahap.
- Atomic completion, anti-double completion, edit/reversal terkontrol.
- Pilihan Stok Cabang atau Stok Tim.

## 5. Inventory dan logistik

- Master produk, UOM, gudang, location, batch, dan expiry.
- Ledger, mutasi, reserved, FIFO, valuation, dan opening stock.
- Request, approval, reservation, shipment, receipt, dan discrepancy.
- Supplier, PR, PO, Goods Receipt, BOM, serta konsumsi sesi.
- Adjustment, Stock Opname, reversal, dan rekonsiliasi.
- Tas Homecare, Inventori Tim, dan pinjaman antartim.

## 6. Finance dan accounting

- Invoice dan pembayaran member.
- COA, periode, jurnal, General Ledger, kas, dan bank.
- Opening Balance, expense, AP, dan supplier payment.
- Deferred Revenue serta revenue recognition.
- Approval Inbox dan audit keputusan.
- P&L, Trial Balance, GL, kas/bank, dan laporan Finance.
- Reimburse berfoto sampai pembayaran dan jurnal.

## 7. Integrasi dan monitoring

- Zoho OAuth, organization, mapping, dan capability discovery.
- Contact, item, invoice, payment, expense, PO, Bill, dan vendor payment sync.
- Transactional outbox, retry, webhook, reconciliation, dan go-live mode.
- Dashboard, laporan sesi, inventory, shipment, approval, audit, dan export.

---

# Bagian C — Panduan Desain PowerPoint

## Tema visual

- Latar utama: hitam atau charcoal.
- Warna utama: emas RAHO.
- Warna penekanan: merah untuk warning, hijau untuk selesai, biru untuk informasi.
- Hindari terlalu banyak kotak kecil dalam satu slide.
- Maksimal enam poin pendek pada slide utama.
- Detail panjang ditempatkan di catatan pembicara atau appendix.

## Ukuran teks

- Judul: 30–40 pt.
- Angka utama: 32–48 pt.
- Isi: 18–24 pt.
- Catatan sumber: 9–11 pt.

## Pola slide

- Slide pembuka: satu pesan besar.
- Slide flow: gunakan panah kiri ke kanan atau atas ke bawah.
- Slide fitur: kelompokkan berdasarkan perjalanan bisnis, bukan menu teknis.
- Slide status: gunakan warna konsisten untuk Tersedia, Terkontrol, dan Perlu UAT.

## Yang jangan dilakukan

- Jangan menampilkan nama tabel database atau endpoint API kepada audiens umum.
- Jangan mengklaim semua fitur sudah production-ready hanya karena source tersedia.
- Jangan mengklaim angka efisiensi jika belum ada pengukuran sebelum/sesudah.
- Jangan memenuhi slide dengan seluruh daftar fitur; pindahkan detail ke appendix.

---

# Bagian D — Sumber dan Dasar Report

Report ini disusun dari bukti yang tersedia di repository:

- `docs/REGISTER_FITUR_ERP_LENGKAP_DAN_TIMELINE.md`
- `docs/DAFTAR_FITUR_PER_ROLE_DAN_FLOW.md`
- `docs/FLOW_PENGGUNAAN_APLIKASI.md`
- `docs/UAT/README.md`
- Dokumen UAT MSO, Nakes, Dokter, Admin Manager, dan Finance.
- Halaman aplikasi pada `apps/web/src/app`.
- Modul bisnis pada `apps/api/src/modules`.
- Prisma schema dan migration database.
- Implementasi Program Sosial per 24 Agustus 2026.

Definisi penting:

> “Sudah dibuat” berarti fitur ditemukan sebagai halaman, komponen, endpoint,
> service, schema, migration, test, atau dokumen flow di repository. Status ini
> tidak otomatis berarti fitur telah lulus UAT atau sudah aktif di production.

