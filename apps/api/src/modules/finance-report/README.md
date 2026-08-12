# Finance Reporting Contract — Sprint 10

Semua angka laporan finance memakai `journal_lines` dari `journal_entries` berstatus
`POSTED` atau `REVERSED`. Jurnal `REVERSED` tetap berada dalam ledger dan dinetralkan
oleh entry reversal terpisah. Tabel invoice, payment, treatment, dan revenue recognition bukan sumber
angka dashboard.

Filter yang sama (`branchId`, `startDate`, `endDate`) dipakai oleh:

- P&L: revenue, expense, dan net profit periode;
- posisi keuangan: aset, liabilitas, ekuitas, laba belum ditutup, dan uji persamaan akuntansi;
- perubahan ekuitas: saldo awal, perubahan modal langsung, laba/rugi periode, dan saldo akhir;
- Trial Balance: opening, movement, dan ending balance;
- General Ledger: source-document link dan running balance lintas halaman;
- kas/bank: saldo akun kontrol dibanding `cash_bank_transactions`;
- deferred revenue: saldo akun liability dibanding funding/recognition/reversal;
- finance dashboard: ringkasan ledger beserta satu status rekonsiliasi.

AR/AP aging memakai saldo **current operational subledger**, bukan rekonstruksi
historis ledger. Respons selalu menyertakan `balanceSnapshotAt` dan `source` agar
pengguna tidak salah menganggap filter tanggal sebagai saldo historis.

Laporan arus kas belum diterbitkan sampai kebijakan klasifikasi aktivitas
operasi, investasi, dan pendanaan disetujui Finance. Sistem tidak menebak
klasifikasi dari kode akun.

Branch scope dan permission divalidasi server-side. Selisih subledger tidak ditutup
otomatis; endpoint mengembalikan `difference` dan `reconciled: false` untuk ditindaklanjuti.
