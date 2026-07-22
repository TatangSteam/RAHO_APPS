# Deferred Revenue dan Treatment Profitability — Sprint 7–8

## Posting policy

- Verifikasi pembayaran invoice tetap mem-posting `Dr Kas/Bank / Cr 2200 Pendapatan Ditangguhkan`.
- Funding movement membagi pembayaran ke benefit package menggunakan relative standalone selling price.
- Valuasi menyimpan consideration, jumlah sesi, nilai sesi reguler, selisih pembulatan sesi terakhir, serta snapshot akun/policy.
- Pembayaran paket tidak mem-posting akun revenue `4100`; omzet hanya muncul saat treatment selesai.

## Event contract

Completion treatment dan event outbox `TREATMENT_COMPLETED:{sessionId}` berada dalam satu serializable transaction. Payload memuat branch, member, session, treatment date, completion time, serta package IDs.

`reserveTreatmentCompletedRevenue()` membuat reservation idempotent. Completion Sprint 8 kemudian mem-posting, dalam transaction database yang sama:

- FIFO material usage dan stock mutation;
- `Dr 2200 / Cr 4100` untuk release deferred revenue;
- `Dr 5100 / Cr 1300` untuk HPP aktual;
- update contract, recognition, session, domain event, dan integration event.

Unique key berikut mencegah pengakuan ganda:

- `domain_events.eventKey`;
- `revenue_recognitions.recognitionKey`;
- `(treatmentSessionId, memberPackageId)`.

Session menyimpan `completionJournalEntryId`, `materialPostingId`, recognized revenue, HPP, dan gross profit sebagai traceability snapshot. Endpoint `GET /revenue/profitability` membaca snapshot posted tersebut dengan branch scope.

## Upgrade data

Migration membuat baseline valuation/contract untuk package lama. Funding historis tanpa journal link ditandai `SPRINT_7_BACKFILL` dan wajib direkonsiliasi ke opening balance akun 2200 sebelum go-live.
