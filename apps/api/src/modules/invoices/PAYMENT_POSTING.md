# Invoice Payment Posting Contract

## State transition

```text
Invoice DRAFT --finalize/snapshot--> PENDING_PAYMENT
Payment submit --------------------> PENDING verification
Payment PENDING --reject-----------> REJECTED (no ledger/journal)
Payment PENDING --verify-----------> VERIFIED + cash/bank ledger + journal
                                     |
                                     +-- verified total < invoice total: PARTIAL
                                     +-- verified total = invoice total: PAID
```

`POST /invoices/:invoiceId/payment` accepts multipart form data and requires an
`Idempotency-Key` header equal to `postingKey`. Non-cash methods require a
protected evidence image. Evidence is stored under a private object key and is
read only through the scoped `/invoices/payment-proof/:paymentId` endpoint.

`POST /invoices/payments/:paymentId/verify` is the posting boundary. The maker
cannot verify or reject their own payment. Verification locks the invoice and
payment rows, validates the remaining balance, and commits these records in one
database transaction:

- payment status `VERIFIED`;
- invoice verified total and partial/full status;
- cash/bank transaction;
- balanced journal (`Dr Cash/Bank`, `Cr invoice.settlementAccountCode`);
- source links for `INVOICE_PAYMENT` and `INVOICE`;
- immutable audit records.

The default settlement account is `2200 Pendapatan Ditangguhkan`, so receipt of
cash does not itself recognize revenue. Revenue recognition remains a separate
business event.

## Concurrency guards

- invoice and payment use `SELECT ... FOR UPDATE`;
- payment idempotency key is unique and rechecked after the invoice lock;
- one cash/bank transaction per invoice payment;
- one journal posting key per payment;
- pending plus verified payments may not exceed the invoice total;
- retries return the existing payment/posting rather than creating duplicates.
