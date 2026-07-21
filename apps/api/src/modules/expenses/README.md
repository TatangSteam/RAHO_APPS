# Sprint 4 — Expense

Alur dokumen: `DRAFT -> SUBMITTED -> APPROVED -> PAID`, dengan jalur penolakan
`SUBMITTED -> REJECTED`. Maker tidak dapat approve/reject dokumennya sendiri.

Evidence disimpan privat di object storage dan hanya dapat dibaca melalui signed URL
lima menit setelah permission dan branch scope diperiksa. Pembayaran mengunci row
expense dan dalam satu transaction membuat jurnal (debit beban, kredit kas/bank),
cash/bank ledger, source link, status `PAID`, serta audit log. Retry pada expense yang
sudah `PAID` menjadi idempotent replay.
