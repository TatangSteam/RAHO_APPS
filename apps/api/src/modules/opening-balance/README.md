# Sprint 4 — Opening Balance

Alur dokumen: `DRAFT -> SUBMITTED -> POSTED` atau `SUBMITTED -> REJECTED`.
User dengan role template aktif `FINANCE` atau `FINANCE_DUMMY` mengelola alur
end-to-end dan dapat post/reject dokumen buatannya sendiri. Role lain tetap
memerlukan checker berbeda dengan permission `OPENING_BALANCE.POST` dan
`JOURNAL.POST`.

Dokumen berstatus `DRAFT` atau `REJECTED` dapat dikoreksi oleh maker melalui
`PATCH /opening-balances/:id`. Penggantian lines dilakukan atomik, divalidasi
ulang agar balanced, dan dicatat pada audit history sebelum dapat diajukan
kembali.

Saat posting, satu Prisma transaction melakukan seluruh perubahan berikut:

1. membuat journal balanced dan source link `OPENING_BALANCE`;
2. membuat cash/bank ledger untuk line `CASH_BANK`;
3. untuk line `INVENTORY`, membuat inventory posting `OPENING`, stock mutation,
   inventory balance, batch bila diperlukan, dan FIFO cost layer;
4. menandai dokumen immutable sebagai `POSTED` dan menulis audit log.

`postingKey`, source posting key, row lock, dan unique constraint mencegah posting
ganda. Koreksi saldo posted harus dibuat sebagai reversal pada ledger terkait.

Reservation hanya mengubah quantity bucket `reservedQty`. Nilai aset dihitung dari
`remainingQty × unitCost` pada cost layer, sehingga reservasi tidak membuat jurnal,
stock mutation, cost allocation, atau perubahan nilai aset.
