# Flow satu arah ERP ke Zoho Books

## Keputusan arsitektur

- ERP RAHO adalah satu-satunya sumber data operasional untuk member, logistik,
  finance, master, dan transaksi.
- Target integrasi hanya Zoho Books. Zoho Inventory dan aplikasi Zoho lain
  tidak menjadi target.
- Tidak ada inbound sync yang membuat atau mengubah data bisnis ERP.
- Pembacaan Zoho hanya boleh dilakukan untuk setup konfigurasi, exact-match
  idempotency, dan deteksi konflik sebelum write. Hasil baca tidak boleh
  otomatis dianggap sebagai data ERP.
- Semua transaksi harus valid dan final di ERP sebelum dibuat sebagai
  `IntegrationEvent` dan dikirim asynchronous oleh worker.

## Identitas dan tanda asal

Setiap record yang dibuat ERP mempunyai `externalKey` stabil dengan prefix
`RAHO:` dan mapping lokal-ke-Zoho. Mapping menyimpan:

- `dataOrigin=ERP` untuk record yang dibuat oleh worker ERP;
- `dataOrigin=MANUAL_ZOHO` untuk record Zoho yang dipilih melalui review
  manusia;
- `dataOrigin=UNKNOWN` untuk mapping lama atau recovery tanpa bukti asal;
- `managementMode=ERP_MANAGED` bila ERP boleh mengirim update;
- `managementMode=MANUAL_ONLY` bila record hanya boleh dikelola di Zoho;
- `managementMode=REVIEW_REQUIRED` bila worker harus menahan perubahan;
- `originVerifiedAt` sebagai waktu verifikasi asal;
- ID lokal, tipe entity, ID Zoho, dan external key.

Untuk contact, `RAHO External ID` wajib dikirim melalui custom field Zoho.
Untuk dokumen transaksi, external key/reference dan catatan `RAHO ERP` tetap
menjadi bukti yang terlihat di Zoho Books. Database melarang external key yang
sama dipakai dua mapping dengan tipe entity yang sama pada koneksi yang sama.

## Urutan pengiriman

1. Setup ERP: chart/mapping akun, pajak, UOM, cabang/location, item, member,
   vendor, serta saldo awal/cutover diselesaikan.
2. Preview dan validasi memastikan semua dependency mempunyai mapping aktif.
3. Transaksi difinalkan di ERP dan outbox dibuat dalam transaksi database yang
   sama.
4. Worker mencari mapping berdasarkan local ID/external key.
5. Jika belum ada mapping, worker melakukan exact-match terbatas ke Zoho.
6. Jika tidak ada kandidat, worker membuat record Zoho dan menyimpan mapping
   `ERP`.
7. Jika ada kandidat tanpa marker `[RAHO ERP] <externalKey>`, worker menahan
   event dengan `ZOHO_MANUAL_DATA_OVERLAP`; record tersebut tidak ditimpa.
8. Retry selalu memakai mapping/external key yang sama sehingga tidak membuat
   dokumen kedua.

## Stok dalam mode Zoho Books-only

- Tidak ada scope `ZohoInventory.*` dan tidak ada request ke endpoint
  `/inventory/v1`.
- Bills, purchase orders, invoices, expenses, dan pembayaran tetap dikirim ke
  API Zoho Books sesuai fungsi finance/logistiknya.
- Stock ledger, treatment consumption, stock opname, dan detail quantity tetap
  final di ERP. Event adjustment tidak ditandai berhasil dikirim ke Zoho.
- Karena Books API v3 tidak menyediakan endpoint inventory-adjustment yang
  dipakai integrasi ini, event tersebut berstatus perlu tindakan dengan kode
  `ZOHO_BOOKS_INVENTORY_EXPORT_REQUIRED` dan tetap masuk ekspor CSV terkontrol.
- Ekspor memuat external key ERP dan marker `[RAHO ERP]` agar operator dapat
  memeriksa nomor yang sama di Zoho Books sebelum melakukan input manual.

## Kemungkinan tabrakan atau overlap

| Kondisi | Risiko | Tindakan |
|---|---|---|
| Nomor invoice/PO/Bill sama dengan input manual | Double posting | Tahan dengan status konflik; Finance memilih record yang benar |
| Email, NPWP, telepon, atau nama contact sama | Member/vendor ganda | Jangan auto-match tanpa `RAHO External ID`; wajib review |
| SKU/item code sama tetapi belum punya mapping | Item ganda atau stok bercampur | Tahan dan review master sebelum transaksi dikirim |
| Satu external key dipakai dua data ERP dalam entity yang sama | Mapping salah | Ditolak oleh unique constraint database |
| Record manual disetujui sebagai mapping ERP | Update ERP dapat menimpa data manual | Tetap ditandai `MANUAL_ZOHO`, lalu kepemilikan ditetapkan eksplisit sebagai `ERP_MANAGED` atau `MANUAL_ONLY` |
| Retry setelah timeout Zoho | Request pertama mungkin berhasil | Cari exact external key/reference sebelum create ulang |
| User mengubah record ERP langsung di Zoho | Ledger berbeda dari ERP | Laporkan drift; jangan tarik perubahan itu ke ERP |
| Opening balance dan transaksi historis sama-sama dikirim | Saldo ganda | Tetapkan tanggal cutover dan hanya gunakan satu jalur |

## Aturan operasional

- Input manual di Zoho Books masih diperbolehkan, tetapi nomor/reference tidak
  boleh memakai namespace `RAHO:`.
- Data manual yang mirip dengan ERP tidak boleh digabung otomatis.
- Nomor bisnis yang sama tidak cukup untuk recovery; marker ERP wajib ada.
- Mapping `UNKNOWN` atau `REVIEW_REQUIRED` tidak boleh diubah worker.
- Webhook/reconciliation hanya menjadi evidence dan peringatan; tidak pernah
  mengubah transaksi final ERP.
- Go-live tetap `OFF` sampai setup dependency dan pemeriksaan overlap selesai.
