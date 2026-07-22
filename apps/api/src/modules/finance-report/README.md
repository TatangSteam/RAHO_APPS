# Finance Reporting Contract — Sprint 10

Semua angka laporan finance memakai `journal_lines` dari `journal_entries` berstatus
`POSTED`. Tabel invoice, payment, treatment, dan revenue recognition bukan sumber
angka dashboard.

Filter yang sama (`branchId`, `startDate`, `endDate`) dipakai oleh:

- P&L: revenue, expense, dan net profit periode;
- Trial Balance: opening, movement, dan ending balance;
- General Ledger: source-document link dan running balance lintas halaman;
- kas/bank: saldo akun kontrol dibanding `cash_bank_transactions`;
- deferred revenue: saldo akun liability dibanding funding/recognition/reversal;
- finance dashboard: ringkasan ledger beserta satu status rekonsiliasi.

Branch scope dan permission divalidasi server-side. Selisih subledger tidak ditutup
otomatis; endpoint mengembalikan `difference` dan `reconciled: false` untuk ditindaklanjuti.
