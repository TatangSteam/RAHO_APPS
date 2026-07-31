# Cara Menghubungkan Zoho Books yang Sudah Berisi Data

**Tanggal:** 31 Juli 2026  
**Target:** Zoho Books untuk finance dan logistik  
**Prinsip:** transaksi sesi terapi tidak bergantung pada ketersediaan Zoho

## 1. Aturan sumber data

Setelah cut-off:

- RAHO menjadi sumber transaksi operasional baru;
- Zoho Books menerima hasil finance/logistik melalui outbox dan worker;
- kegagalan Zoho tidak membatalkan pembayaran, pembelian paket, sesi terapi,
  penggunaan material, atau transaksi lokal lain;
- data historis Zoho tidak dibuat ulang dari RAHO.

## 2. Persiapan OAuth

1. Buat **Server-based Application** pada Zoho API Console.
2. Isi redirect URI yang sama persis dengan `ZOHO_REDIRECT_URI`.
3. Simpan client ID dan client secret sebagai server secret, bukan di frontend.
4. Buat encryption key acak yang stabil, minimal 32 karakter.
5. Mulai dengan worker mati dan dry-run aktif.

Contoh konfigurasi API:

```env
ZOHO_CLIENT_ID=<client-id>
ZOHO_CLIENT_SECRET=<client-secret>
ZOHO_REDIRECT_URI=https://<domain-web>/api/zoho/callback
ZOHO_TOKEN_ENCRYPTION_KEY=<secret-acak-minimal-32-karakter>
ZOHO_ACCOUNTS_BASE_URL=https://accounts.zoho.com
ZOHO_API_BASE_URL=https://www.zohoapis.com
ZOHO_WEB_REDIRECT_URL=https://<domain-web>/admin/integrations/zoho

ZOHO_SYNC_WORKER_ENABLED=false
ZOHO_SYNC_DRY_RUN=true
ZOHO_RECONCILIATION_ENABLED=false
```

Untuk data center Zoho selain global, sesuaikan accounts/API base URL dengan
tenant yang digunakan.

## 3. Hubungkan dari aplikasi

1. Restart API setelah konfigurasi disimpan.
2. Login sebagai Super Admin.
3. Buka `/admin/integrations/zoho`.
4. Pada tab **Koneksi**, klik **Hubungkan Zoho**.
5. Login ke akun Zoho yang memiliki akses organisasi Books.
6. Setujui scope yang diminta aplikasi.
7. Pilih organisasi yang benar.
8. Klik **Tes**.
9. Buka **Master Zoho**, lalu klik **Ambil ulang dari Zoho**.

OAuth scope tidak perlu diketik manual karena aplikasi membentuk daftar scope
sesuai modul yang diaktifkan. Jika UI menampilkan `reconnect required`,
hubungkan ulang agar refresh token memiliki scope versi terbaru.

## 4. Apa yang ditarik dari Zoho?

Tarik data berikut secara read-only untuk discovery dan mapping:

| Data Zoho | Tujuan di RAHO | Tindakan |
|---|---|---|
| Organization | Memastikan tenant dan mata uang | Pilih satu organisasi aktif |
| Chart of Accounts | Mapping akun finance | Link, jangan buat COA ganda |
| Taxes | Mapping pajak invoice | Link berdasarkan tax ID/rate |
| Bank accounts | Mapping kas/bank | Review rekening satu per satu |
| Payment modes | Mapping metode pembayaran | Link ke metode RAHO |
| Items/SKU/UOM | Mapping produk dan satuan | Exact SKU dulu, nama hanya kandidat |
| Scope cabang Zoho | Mapping Cabang/Logistik Pusat | Satu scope kanonis per cabang |
| Customer/Vendor | Mapping member/customer/supplier | Exact ID/custom field; konflik direview |
| Saldo pada cut-off | Pembanding opening dan rekonsiliasi | Gunakan snapshot yang disetujui |

Jangan langsung menarik seluruh transaksi historis menjadi transaksi baru
RAHO. Invoice, payment, bill, dan journal lama tetap berada di Zoho; RAHO
mewakilinya melalui opening balance, mapping external ID, atau catatan
rekonsiliasi sesuai keputusan Finance.

## 5. Apa yang dipush ke Zoho?

Push hanya setelah mapping dan tanggal cut-off disetujui:

| Sumber RAHO setelah cut-off | Target Zoho |
|---|---|
| Customer/vendor/item baru yang belum ada | Master Zoho terkait |
| Invoice penjualan yang final | Sales Invoice |
| Pembayaran yang sudah verified | Customer Payment/Retainer sesuai policy |
| Expense yang sudah paid | Expense |
| Purchase Order yang issued | Purchase Order |
| Supplier invoice yang posted | Bill |
| Supplier payment yang posted | Vendor Payment |
| Pengakuan omzet terapi | Invoice/Retainer application sesuai mode |
| Adjustment/opname yang posted | Inventory adjustment jika capability tersedia |

Data klinis seperti diagnosis, catatan medis, hasil pemeriksaan, dan foto medis
tidak boleh dikirim ke Zoho.

## 6. Matriks keputusan anti-duplikasi

| Kondisi | Keputusan |
|---|---|
| Data ada di Zoho dan RAHO | Link/mapping, jangan create |
| Master hanya ada di Zoho | Discovery, review, lalu link/adopsi |
| Master hanya ada di RAHO | Push setelah cut-off |
| Transaksi historis hanya ada di Zoho | Jangan push ulang; opening/reconciliation |
| Transaksi baru setelah cut-off | Push RAHO ke Zoho lewat outbox |
| Kandidat lebih dari satu | `NEEDS_REVIEW`, jangan auto-merge |
| Zoho timeout/error | Retry event yang sama; jangan ulang transaksi RAHO |

## 7. Urutan go-live aman

```text
OFF
  -> koneksi dan discovery read-only
  -> mapping dan review konflik
  -> snapshot/cut-off
  -> full reconciliation
  -> DRY_RUN
  -> CANARY cabang terbatas
  -> LIVE
```

Syarat sebelum `LIVE`:

- organization benar;
- tidak ada mapping kritis `NEEDS_REVIEW`;
- transaksi historis tidak masuk antrean create;
- dead-letter kosong atau sudah mempunyai resolution;
- Finance dan Logistik menyetujui hasil reconciliation;
- uji putus koneksi membuktikan flow terapi tetap sukses;
- idempotency retry tidak menghasilkan dokumen Zoho ganda.

## 8. Jika Zoho bermasalah

1. Ubah runtime Zoho ke `OFF`.
2. Biarkan transaksi lokal RAHO berjalan.
3. Jangan mengulang pembelian paket, pembayaran, atau completion sesi.
4. Periksa event, attempt, mapping, dan error Zoho.
5. Perbaiki credential/scope/mapping.
6. Jalankan reconciliation.
7. Retry event yang sama.

Zoho tidak boleh dipanggil secara sinkron di tengah transaksi sesi terapi.
Integrasi wajib tetap melalui outbox setelah transaksi lokal berhasil commit.

