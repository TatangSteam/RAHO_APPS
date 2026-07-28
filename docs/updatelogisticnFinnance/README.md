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

Vertical slice awal sudah dimulai:

- enum dan template permission `FINANCE_LOGISTICS_CONTROLLER`;
- branch scope untuk tampilan request dan shipment;
- shipment Partnership wajib memakai reservation/FIFO;
- dispatch Partnership membuat event idempoten
  `PARTNERSHIP_GOODS_SHIPPED`;
- dispatch Partnership tidak lagi dianggap internal transfer dan receipt-nya
  tidak boleh menambah inventory milik RAHO;
- kebijakan terapi Partnership tidak disinkron sebagai omzet per infus ke
  Zoho sudah tersedia untuk consumer berikutnya.

Yang belum selesai adalah mapping entity Zoho, worker outbox, write API Zoho,
retry/dead-letter, dan rekonsiliasi.
