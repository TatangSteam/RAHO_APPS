# Deferred Revenue — Sprint 7

## Posting policy

- Verifikasi pembayaran invoice tetap mem-posting `Dr Kas/Bank / Cr 2200 Pendapatan Ditangguhkan`.
- Funding movement membagi pembayaran ke benefit package menggunakan relative standalone selling price.
- Valuasi menyimpan consideration, jumlah sesi, nilai sesi reguler, selisih pembulatan sesi terakhir, serta snapshot akun/policy.
- Tidak ada service Sprint 7 yang mem-posting ke akun revenue `4100`.

## Event contract

Completion treatment dan event outbox `TREATMENT_COMPLETED:{sessionId}` berada dalam satu serializable transaction. Payload memuat branch, member, session, treatment date, completion time, serta package IDs.

`reserveTreatmentCompletedRevenue()` adalah kontrak consumer untuk Sprint 8. Unique key berikut mencegah pengakuan ganda:

- `domain_events.eventKey`;
- `revenue_recognitions.recognitionKey`;
- `(treatmentSessionId, memberPackageId)`.

Reservation belum memperbarui saldo kontrak dan belum membuat jurnal. Sprint 8 akan mem-posting deferred release, HPP, FIFO usage, dan completion dalam satu transaction.

## Upgrade data

Migration membuat baseline valuation/contract untuk package lama. Funding historis tanpa journal link ditandai `SPRINT_7_BACKFILL` dan wajib direkonsiliasi ke opening balance akun 2200 sebelum go-live.
