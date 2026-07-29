# Update Finance dan Logistik RAHO–Zoho

Status terakhir: Sprint 14 sudah diimplementasikan. Integrasi memiliki webhook
inbox, reconciliation resumable, exception dashboard, cutover, canary, dan
rollback. Adapter Zoho tetap opsional; transaksi ERP lokal tidak bergantung
pada koneksi Zoho.

Paket dokumentasi versi terbaru:

1. [Requirements](./REQUIREMENTS_FINANCE_LOGISTICS_ZOHO.md) — kontrak bisnis,
   fungsi, data, accounting, keamanan, dan acceptance criteria.
2. [ERD Mermaid](./ERD_FINANCE_LOGISTIK_MERMAID.md) — model Finance, Logistik,
   treatment revenue source, dan integrasi Zoho.
3. [Development Flow](./DEVELOPMENT_FLOW_INTEGRASI_FINANCE_LOGISTIK_ZOHO.md) —
   urutan arsitektur dan implementasi.
4. [Sprint dan Test Plan](./SPRINT_DAN_TEST_PLAN_ZOHO_FINANCE_LOGISTIK.md) —
   backlog 14 sprint serta cara pembuktiannya.
5. [Runbook Sprint 14](./RUNBOOK_SPRINT14_ZOHO_GO_LIVE.md) - konfigurasi
   webhook, cutover, rollback, dan penanganan outage.

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

Sprint 1–12 sudah memiliki implementasi backend dan UI operasional:

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
- cabang Partnership dipetakan sebagai business Customer, bukan Location;
- pembayaran terverifikasi sebelum shipment dibuat sebagai customer advance dan
  diterapkan satu kali ke invoice barang setelah shipment final;
- `PARTNERSHIP_GOODS_SHIPPED` membuat Sales Invoice dari harga snapshot dan HPP
  FIFO, dengan Location cabang sumber agar stok pusat yang berkurang;
- retry mencari invoice/payment berdasarkan reference stabil sebelum create;
- dashboard Partnership menyediakan preview, mapping prerequisite, retry, dan
  rekonsiliasi omzet/HPP/laba kotor;
- Controller dibatasi branch scope dan tidak dapat mengunggah sekaligus
  memverifikasi bukti pembayaran yang sama.
- penerbitan PO membuat event `PO_ISSUED` secara atomik dan idempoten;
- PO dikirim setelah mapping Vendor, Item, UOM, dan Location lengkap;
- retry mencari PO Zoho berdasarkan referensi stabil sehingga tidak membuat
  duplikat;
- pembatalan PO yang belum diterima/ditagihkan membuat `PO_CANCELLED` dan
  mengubah status Zoho menjadi cancelled tanpa delete;
- PO Partnership dikecualikan dari Location internal Zoho;
- pembuatan PO tidak mengubah stok; stok ERP tetap berubah hanya saat Goods
  Receipt;
- tab Purchase Order menyediakan preview, penyiapan dependency, retry, status
  mapping/event, dan rekonsiliasi.
- supplier invoice menyimpan alokasi quantity per baris PO dan menolak billed
  quantity yang melebihi received quantity;
- posting supplier invoice membuat event `SUPPLIER_INVOICE_POSTED` atomik;
- Zoho Bill terhubung ke PO dan `purchaseorder_item_id` yang benar;
- partial Bill hanya mengirim quantity yang benar-benar ditagihkan;
- Goods Receipt tidak dikirim sebagai inventory adjustment ke Zoho sehingga
  jalur normal penambahan quantity Zoho hanya melalui Bill;
- dashboard GRNI menampilkan received, billed, unbilled, umur, dan exception
  lewat SLA;
- tab Bill & GRNI menyediakan preview, dependency, retry, AP balance, dan
  rekonsiliasi.
- posting pembayaran supplier membuat event `AP_PAYMENT_POSTED` dalam transaksi
  yang sama dengan jurnal AP dan cash/bank transaction;
- Vendor Payment selalu memakai `bill_id`, rekening paid-through, dan metode
  yang sudah dipetakan;
- partial/full payment mengurangi saldo Bill sesuai nominal, sedangkan retry
  memakai `paymentNumber` ERP agar tidak membuat payment ganda;
- refund supplier disimpan immutable, mengacu pembayaran asli, mengembalikan
  saldo AP, dan membuat `AP_PAYMENT_REFUNDED` tanpa menghapus transaksi;
- tab Vendor Payment & AP menyediakan preview, status mapping/event, retry, dan
  rekonsiliasi payment sekaligus saldo Bill.

Live UAT tetap membutuhkan OAuth scope versi terbaru, worker aktif,
`ZOHO_SYNC_DRY_RUN=false`, mapping lengkap, serta data uji Zoho yang disetujui.
