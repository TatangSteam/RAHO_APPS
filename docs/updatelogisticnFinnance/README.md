# Update Finance dan Logistik RAHO–Zoho

Paket dokumentasi versi terbaru:

1. [Requirements](./REQUIREMENTS_FINANCE_LOGISTICS_ZOHO.md) — kontrak bisnis,
   fungsi, data, accounting, keamanan, dan acceptance criteria.
2. [ERD Mermaid](./ERD_FINANCE_LOGISTIK_MERMAID.md) — model Finance, Logistik,
   treatment revenue source, dan integrasi Zoho.
3. [Development Flow](./DEVELOPMENT_FLOW_INTEGRASI_FINANCE_LOGISTIK_ZOHO.md) —
   urutan arsitektur dan implementasi.
4. [Sprint dan Test Plan](./SPRINT_DAN_TEST_PLAN_ZOHO_FINANCE_LOGISTIK.md) —
   backlog 14 sprint serta cara pembuktiannya.

## Keputusan utama

```text
RAHO = sumber operasi
Zoho Books = ledger/laporan finansial eksternal

Master terapi dibuat  -> tidak ada omzet
Payment verified      -> retainer/deferred revenue
Completion BASIC      -> hanya omzet dan retainer Basic
Completion BOOSTER    -> hanya omzet dan retainer Booster
Material completion   -> stok turun dan HPP naik
Partnership order     -> omzet barang saat shipment SHIPPED
Partnership infusion  -> tidak masuk revenue/HPP Zoho
Cancellation          -> reversal, bukan delete
Controller role       -> kontrol Finance + Logistik dengan maker-checker
```

Implementasi transaksi otomatis ke Zoho belum dianggap selesai hanya karena
OAuth sudah terhubung. Release harus mengikuti requirement, sprint gate, dan
reconciliation di dalam paket ini.

## Status implementasi

Sprint 1–8 sudah memiliki implementasi backend dan UI operasional:

- role `FINANCE_LOGISTICS_CONTROLLER` dan branch scope;
- koneksi OAuth, discovery, mapping, outbox worker, retry/dead-letter;
- Customer/Vendor, Item/Location, Sales Invoice;
- `PAYMENT_VERIFIED`, partial/full Customer Payment, mapping rekening/metode;
- refund immutable yang mengacu pembayaran asli;
- rekonsiliasi AR antara saldo ERP dan Zoho;
- sumber omzet sesi eksklusif `BASIC` atau `BOOSTER`, bukan keduanya;
- pembayaran paket mendanai Zoho Retainer Invoice dan Retainer Payment;
- completion membuat invoice omzet terapi dan memakai saldo retainer;
- pembatalan melepas aplikasi retainer dan mem-void invoice terapi;
- rekonsiliasi deferred/recognized ERP dengan Retainer Zoho;
- mode dokumen sebagai default dan journal sebagai fallback terkontrol;
- kebijakan Partnership tetap dipisahkan dari omzet terapi biasa.
- expense baru masuk outbox `EXPENSE_PAID` setelah jurnal dan kas/bank berhasil;
- mapping akun beban serta rekening paid-through wajib sebelum create;
- receipt dikirim terpisah tanpa membocorkan URL internal, sehingga retry tidak
  menggandakan expense;
- preview, status mapping/receipt, retry, dan rekonsiliasi amount/date/reference
  tersedia pada tab Expense;
- reversal expense tidak melakukan delete otomatis ke Zoho.

Live UAT tetap membutuhkan OAuth scope versi terbaru, worker aktif,
`ZOHO_SYNC_DRY_RUN=false`, mapping lengkap, serta data uji Zoho yang disetujui.
