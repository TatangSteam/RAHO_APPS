# Deferred Revenue — Sprint 7

## Posting policy

- Verifikasi pembayaran invoice tetap mem-posting `Dr Kas/Bank / Cr 2200 Pendapatan Ditangguhkan`.
- Funding movement membagi pembayaran ke benefit package menggunakan relative standalone selling price.
- Valuasi menyimpan consideration, jumlah sesi, nilai sesi reguler, selisih pembulatan sesi terakhir, serta snapshot akun/policy.
- Tidak ada service Sprint 7 yang mem-posting ke akun revenue `4100`.

## Sprint 8 posting contract

Completion treatment menjalankan validasi material, konsumsi FIFO, actual cost, pelepasan deferred revenue, revenue recognition, jurnal revenue/HPP, perubahan status sesi, outbox event, dan audit log dalam satu serializable transaction.

Jurnal completion menggabungkan debit deferred revenue/kredit revenue sesuai policy serta debit `5100` HPP/kredit `1300` Persediaan berdasarkan actual FIFO cost.

Unique key berikut mencegah pengakuan atau posting ganda:

- `domain_events.eventKey`;
- `revenue_recognitions.recognitionKey`;
- `(treatmentSessionId, memberPackageId)`.
- `journal_entries.postingKey`;
- `inventory_postings.idempotencyKey`.

Pembatalan completion adalah reversal immutable. Proses ini mengembalikan quantity ke FIFO layer asal, membalik jurnal completion, mengembalikan recognized revenue ke deferred revenue, melepaskan pemakaian sesi package, dan menulis event `TREATMENT_COMPLETION_CANCELLED`. Alasan dan idempotency key wajib tersedia.

## Upgrade data

Migration membuat baseline valuation/contract untuk package lama. Funding historis tanpa journal link ditandai `SPRINT_7_BACKFILL` dan wajib direkonsiliasi ke opening balance akun 2200 sebelum go-live.
