# Purchasing & Accounts Payable — Sprint 6

Alur MVP AC-003:

1. maker membuat dan submit Purchase Request;
2. checker berbeda approve/reject quantity per baris;
3. approved PR dikonversi satu kali menjadi Purchase Order;
4. partial Goods Receipt membuat mutation + FIFO cost layer dan jurnal `Dr 1300 Persediaan / Cr 2110 GRNI` secara atomik;
5. supplier invoice tidak boleh melebihi nilai receipt yang belum ditagihkan dan mem-posting `Dr 2110 GRNI / Cr 2100 AP`;
6. pembayaran parsial/penuh mengunci invoice, menolak overpayment, membuat cash-bank transaction, dan mem-posting `Dr 2100 AP / Cr akun kas/bank`.

Dokumen posted tidak memiliki endpoint edit/delete. Retry memakai posting/idempotency key dengan unique constraint dan pengecekan payload hash. Seluruh query dan aksi transaksi memakai branch scope serta permission server-side.

Test berbasis PostgreSQL memerlukan migration terbaru dan database lokal aktif. Contract/unit test dapat dijalankan tanpa database:

```bash
npm test -- --runInBand src/modules/purchasing/__tests__
```
