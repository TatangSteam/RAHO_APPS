# Accounting Foundation — Posting Contract

`postJournal(input, tx?)` in `accounting.service.ts` is the only supported write path for posted journals. Posted entries do not have update/delete endpoints.

The HTTP endpoint `POST /accounting/journals` additionally requires an `Idempotency-Key` header equal to `postingKey`.

## Contract

```ts
await postJournal({
  postingKey: `INVENTORY_RECEIPT:${receipt.id}`,
  transactionDate: receipt.receivedAt,
  branchId: receipt.branchId,
  actorUserId,
  description: `Goods receipt ${receipt.receiptNumber}`,
  lines: [
    { accountCode: '1300', debit: receipt.totalCost.toFixed(2) },
    { accountCode: '2100', credit: receipt.totalCost.toFixed(2) },
  ],
  sourceLinks: [{
    sourceType: 'GOODS_RECEIPT',
    sourceId: receipt.id,
    sourceNumber: receipt.receiptNumber,
  }],
}, tx);
```

When Developer B passes the same Prisma transaction client used to write stock mutation/cost layers, stock and finance commit or roll back together.

## Guarantees

- Decimal arithmetic; no floating-point total calculation.
- Exactly one positive debit/credit side per line.
- Total debit must equal total credit and be greater than zero.
- Account must be active and postable.
- The transaction date must resolve to an `OPEN` branch or global accounting period.
- `postingKey` is unique and makes a retry return the original journal.
- Each posting carries at least one generic source-document link.
- Branch permission and scope are validated for every line.
- Journal, lines, source links, sequence, and audit record are created in one transaction.

If a caller supplies an existing transaction, it owns retry handling for a concurrent unique-key conflict. Without an external transaction, the service resolves a duplicate `postingKey` as an idempotent replay.
