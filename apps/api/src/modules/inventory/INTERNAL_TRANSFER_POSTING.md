# Sprint 5 — Internal Transfer Posting Policy

## Posting policy

| Event | Debit | Credit | Inventory effect |
|---|---|---|---|
| Shipment dispatched | 1310 Persediaan Dalam Perjalanan | 1300 Persediaan | FIFO layer sumber berkurang; quantity berpindah ke bucket in-transit |
| Shipment received | 1300 Persediaan | 1310 Persediaan Dalam Perjalanan | FIFO layer tujuan dibuat dengan unit cost dan batch asal |

Semua account yang dipakai bertipe `ASSET`; internal transfer tidak boleh memakai
account revenue atau expense. Nilai aset gabungan dihitung sebagai:

`remaining source cost layers + internal transfer remaining value + destination cost layers`

Nilai tersebut tetap pada dispatch dan receipt. Untuk partial receipt/discrepancy,
nilai yang belum diterima tetap berada di in-transit.

## Atomicity dan idempotency

Jalur `/inventory/logistics/branch-shipments` dan jalur shipment lama sama-sama
mengunci row shipment dengan `SELECT ... FOR UPDATE`. Dispatch dan receipt memakai
unique inventory posting keys, unique journal posting keys, serta satu
`internal_transfer_ledgers.shipmentId` per source document. Perubahan status,
quantity, FIFO layer, journal, dan source link berada dalam Prisma transaction yang
sama.

Migration memperkenalkan account 1310, posting type `TRANSFER_OUT/TRANSFER_IN`,
mutation type transfer, dan ledger trace yang menghubungkan shipment ke dua inventory
posting serta dua journal entry.
