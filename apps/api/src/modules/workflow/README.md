# Generic Approval Workflow — Sprint 9

Approval instance adalah snapshot immutable dari rule ketika dokumen disubmit. Rule dapat difilter berdasarkan module, transaction type, branch, category, dan rentang nominal. Setiap rule memiliki satu atau lebih step dengan permission dan jumlah approver yang diwajibkan.

Kontrol utama:

- maker tidak dapat memutuskan dokumennya sendiri;
- satu user tidak dapat mengambil keputusan pada dua step dalam instance yang sama;
- keputusan dan approval audit bersifat append-only;
- business document baru berubah menjadi `APPROVED` setelah step terakhir terpenuhi;
- expense, purchase request, stock request/reservation, dan stock opname memakai service yang sama.

Endpoint baca tersedia pada `GET /workflow/inbox` dan `GET /workflow/rules`. Rule baru dibuat melalui `POST /workflow/rules`; perubahan rule tidak mengubah snapshot instance yang sudah berjalan.

## Stock opname

Stock opname menyimpan system quantity sebagai snapshot. Saat approval final, engine mengunci dokumen dan memastikan saldo belum berubah. Selisih lebih membuat adjustment-in dan FIFO cost layer; selisih kurang mengonsumsi FIFO. Mutation dan jurnal berikut commit dalam satu serializable transaction:

- selisih lebih: `Dr 1300 Persediaan / Cr 4300 Keuntungan Penyesuaian`;
- selisih kurang: `Dr 5300 Kerugian Penyesuaian / Cr 1300 Persediaan`.
