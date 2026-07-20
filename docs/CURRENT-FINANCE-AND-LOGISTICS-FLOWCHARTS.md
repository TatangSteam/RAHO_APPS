# Current Finance and Logistics Flowcharts

Dokumen ini berisi kode Mermaid untuk proses finance dan logistik yang berjalan pada RAHO saat ini. Diagram bersifat **as-is** berdasarkan model database, service, endpoint, dan dokumentasi proyek yang tersedia.

Catatan batasan kondisi saat ini:

- Belum ada integrasi Zoho pada alur aktif.
- Finance operasional memakai `Invoice`, `InvoiceItem`, `InvoicePayment`, serta invoice khusus stock request.
- Homecare sudah mendukung banyak tas per tim, tetapi satu request, shipment, usage, return, dan opname masih mengacu pada satu tas per record.
- Diagram dipecah per proses agar mudah dipelihara dan dirender.

## 1. Peta Besar Finance dan Logistik Saat Ini

```mermaid
flowchart LR
    START([Mulai])

    subgraph COMMERCIAL[Commercial dan Finance Member]
        C1[Assign paket, booster, add-on, atau produk]
        C2[Buat transaksi pending]
        C3[Buat atau perbarui invoice]
        C4[Upload bukti pembayaran]
        C5[Verifikasi pembayaran]
        C6[Invoice paid dan paket aktif]
        C7[Cancel atau refund]
    end

    subgraph INVENTORY[Inventory dan Logistik Cabang]
        I1[Monitor stok]
        I2[Buat stock request]
        I3[Review dan approval]
        I4[Buat invoice stock request]
        I5[Siapkan shipment]
        I6[Kirim dan terima barang]
        I7[Update stok dan mutasi]
    end

    subgraph HOMECARE[Homecare Bag Logistics]
        H1[Kelola tim dan tas]
        H2[Request restock tas]
        H3[Shipment cabang ke tas]
        H4[Pemakaian stok tas]
        H5[Retur dan opname]
        H6[Mutasi stok logistik]
    end

    subgraph CONTROL[Governance]
        G1[Authentication]
        G2[Role dan branch authorization]
        G3[Audit log]
        G4[Protected evidence files]
        G5[Dashboard dan reporting]
    end

    START --> G1 --> G2
    G2 --> C1 --> C2 --> C3 --> C4 --> C5 --> C6
    C3 --> C7
    C6 --> C7

    G2 --> I1 --> I2 --> I3 --> I4 --> I5 --> I6 --> I7
    G2 --> H1 --> H2 --> H3 --> H4 --> H5 --> H6

    C3 -.-> G3
    C5 -.-> G3
    C7 -.-> G3
    I3 -.-> G3
    I7 -.-> G3
    H6 -.-> G3
    C4 -.-> G4
    I6 -.-> G4
    H3 -.-> G4
    G3 --> G5
```

## 2. Finance — Penjualan Paket sampai Pembayaran

```mermaid
flowchart TD
    START([Mulai]) --> AUTH[Validasi user, role, dan branch]
    AUTH --> MEMBER[Pilih member]
    MEMBER --> PRODUCT[Pilih basic package, booster, add-on, atau produk]
    PRODUCT --> PRICE[Ambil master pricing atau harga yang diizinkan]
    PRICE --> INPUT[Input quantity, diskon, service type, dan payment plan]
    INPUT --> VALIDATE{Data dan harga valid?}

    VALIDATE -->|Tidak| ERROR[Return validation error]
    ERROR --> INPUT

    VALIDATE -->|Ya| CALCULATE[Hitung subtotal, diskon, pajak, dan final price]
    CALCULATE --> GROUP{Transaksi bundling?}
    GROUP -->|Ya| PURCHASE_GROUP[Generate purchaseGroupId]
    GROUP -->|Tidak| CREATE_PURCHASE[Buat record pembelian]
    PURCHASE_GROUP --> CREATE_PURCHASE

    CREATE_PURCHASE --> PURCHASE_TYPE{Jenis pembelian}
    PURCHASE_TYPE -->|Package| MEMBER_PACKAGE[Buat MemberPackage]
    PURCHASE_TYPE -->|Add-on| MEMBER_ADDON[Buat MemberAddOn]
    PURCHASE_TYPE -->|Non-therapy| NON_THERAPY[Buat MemberNonTherapyPurchase]

    MEMBER_PACKAGE --> PENDING[Set status PENDING_PAYMENT]
    MEMBER_ADDON --> PENDING
    NON_THERAPY --> PENDING

    PENDING --> PLAN{Payment plan}
    PLAN -->|Full payment| INVOICE_FULL[Buat invoice penuh]
    PLAN -->|Installment| INSTALLMENT[Generate jadwal dan paymentGroupId]
    INSTALLMENT --> INVOICE_TERM[Buat invoice termin aktif]

    INVOICE_FULL --> INVOICE_DATA[Buat Invoice dan InvoiceItem snapshot]
    INVOICE_TERM --> INVOICE_DATA
    INVOICE_DATA --> INVOICE_PENDING[Invoice PENDING_PAYMENT]

    INVOICE_PENDING --> PROOF_SOURCE{Bukti dibayar oleh siapa?}
    PROOF_SOURCE -->|Member| MEMBER_UPLOAD[Member upload bukti]
    PROOF_SOURCE -->|Staff| STAFF_UPLOAD[Staff upload atau record payment]
    MEMBER_UPLOAD --> STORE_PROOF[Simpan protected payment proof]
    STAFF_UPLOAD --> STORE_PROOF

    STORE_PROOF --> WAITING[Set WAITING_VERIFICATION atau verification PENDING]
    WAITING --> REVIEW[Admin review bukti, nominal, metode, dan referensi]
    REVIEW --> VERIFY{Pembayaran valid?}

    VERIFY -->|Tidak| REJECT[Catat rejectedBy, rejectedAt, dan reason]
    REJECT --> FIX_PROOF[Menunggu bukti atau data pembayaran diperbaiki]
    FIX_PROOF --> PROOF_SOURCE

    VERIFY -->|Ya| PAYMENT[Buat InvoicePayment]
    PAYMENT --> INVOICE_PAID[Update invoice PAID dan verification VERIFIED]
    INVOICE_PAID --> UPDATE_PAID[Update actualPaidAmount dan totalVerifiedPaid]
    UPDATE_PAID --> PURCHASE_STATUS{Seluruh kewajiban terpenuhi?}

    PURCHASE_STATUS -->|Ya| ACTIVATE[Set package atau purchase ACTIVE atau PAID]
    PURCHASE_STATUS -->|Belum, installment| NEXT_TERM[Update payment plan dan siapkan termin berikutnya]
    NEXT_TERM --> INVOICE_TERM

    ACTIVATE --> REFERRAL{Member memiliki referral eligible?}
    REFERRAL -->|Ya| INCENTIVE[Hitung dan buat ReferralIncentiveRecord]
    REFERRAL -->|Tidak| AUDIT[Create audit log]
    INCENTIVE --> AUDIT
    AUDIT --> NOTIFY[Create notification bila diperlukan]
    NOTIFY --> END([Selesai])
```

## 3. Finance — Lifecycle Invoice Manual dan Operasional

```mermaid
flowchart TD
    START([Mulai]) --> AUTH[Authenticate dan authorize role]
    AUTH --> BRANCH[Validasi branch scope]
    BRANCH --> ACTION{Aksi invoice}

    ACTION -->|Create| INPUT[Input member, item, diskon, pajak, dan due date]
    INPUT --> VALIDATE{Payload valid?}
    VALIDATE -->|Tidak| ERROR[Return error]
    ERROR --> INPUT
    VALIDATE -->|Ya| NUMBER[Generate invoiceNumber]
    NUMBER --> ITEMS[Buat InvoiceItem snapshot]
    ITEMS --> TOTAL[Hitung subtotal, discount, tax, dan totalAmount]
    TOTAL --> DRAFT[Set Invoice DRAFT]

    ACTION -->|Edit| LOAD_EDIT[Load invoice]
    LOAD_EDIT --> EDITABLE{Status masih dapat diedit?}
    EDITABLE -->|Tidak| DENIED[Reject perubahan]
    EDITABLE -->|Ya| UPDATE[Update header atau item dan hitung ulang]
    UPDATE --> DRAFT

    DRAFT --> FINALIZE{Finalisasi?}
    FINALIZE -->|Belum| SAVE_DRAFT[Simpan draft]
    FINALIZE -->|Ya| PENDING[Set PENDING_PAYMENT]

    PENDING --> PAYMENT_ACTION{Aksi pembayaran}
    PAYMENT_ACTION -->|Record payment| PAYMENT_INPUT[Input amount, method, reference, proof, dan notes]
    PAYMENT_INPUT --> PAYMENT_VALID{Nominal dan invoice valid?}
    PAYMENT_VALID -->|Tidak| PAYMENT_ERROR[Return payment error]
    PAYMENT_ERROR --> PAYMENT_INPUT
    PAYMENT_VALID -->|Ya| CREATE_PAYMENT[Buat InvoicePayment]
    CREATE_PAYMENT --> PAID_AMOUNT[Update actualPaidAmount]
    PAID_AMOUNT --> BALANCE{Tagihan terpenuhi?}
    BALANCE -->|Belum| KEEP_PENDING[Tetap pending atau installment berjalan]
    BALANCE -->|Ya| PAID[Set Invoice PAID]

    ACTION -->|Cancel| LOAD_CANCEL[Load invoice]
    LOAD_CANCEL --> CAN_CANCEL{Boleh dibatalkan?}
    CAN_CANCEL -->|Tidak| DENIED
    CAN_CANCEL -->|Ya| CANCELLED[Set Invoice CANCELLED dan simpan alasan]

    ACTION -->|View atau print| LOAD_VIEW[Load sesuai role dan branch]
    LOAD_VIEW --> OWNER{Akses diizinkan?}
    OWNER -->|Tidak| DENIED
    OWNER -->|Ya| RENDER[Render detail, file bukti, atau PDF]

    SAVE_DRAFT --> AUDIT[Create audit log]
    KEEP_PENDING --> AUDIT
    PAID --> AUDIT
    CANCELLED --> AUDIT
    RENDER --> END([Response tersedia])
    DENIED --> END
    AUDIT --> END
```

## 4. Finance — Installment Flow

```mermaid
flowchart TD
    START([Pilih installment]) --> SCHEDULE[Input installmentTotal dan installmentSchedule]
    SCHEDULE --> VALIDATE{Jumlah termin dan nominal valid?}
    VALIDATE -->|Tidak| ERROR[Perbaiki schedule]
    ERROR --> SCHEDULE
    VALIDATE -->|Ya| GROUP[Generate paymentGroupId]
    GROUP --> FIRST[Buat invoice termin pertama]
    FIRST --> WAIT[Menunggu bukti dan verifikasi]
    WAIT --> VERIFY{Termin terverifikasi?}
    VERIFY -->|Tidak| REJECT[Reject dan tunggu perbaikan]
    REJECT --> WAIT
    VERIFY -->|Ya| RECORD[Catat InvoicePayment]
    RECORD --> SUM[Tambah totalVerifiedPaid]
    SUM --> LAST{Termin terakhir atau total sudah lunas?}
    LAST -->|Tidak| NEXT[Naikkan installmentNumber]
    NEXT --> REMAINING[Hitung sisa outstanding]
    REMAINING --> CREATE_NEXT[Buat invoice termin berikutnya]
    CREATE_NEXT --> WAIT
    LAST -->|Ya| ADJUST[Sesuaikan termin terakhir jika ada selisih pembulatan]
    ADJUST --> COMPLETE[Set payment plan COMPLETED]
    COMPLETE --> ACTIVATE[Pastikan package ACTIVE]
    ACTIVATE --> END([Selesai])
```

## 5. Finance — Cancel dan Refund Paket

```mermaid
flowchart TD
    START([Buka package atau purchase]) --> STATUS{Status transaksi}

    STATUS -->|PENDING_PAYMENT| PENDING_ACTION{Aksi}
    PENDING_ACTION -->|Edit| EDIT[Ubah item, harga, diskon, atau tanggal]
    EDIT --> RECALCULATE[Hitung ulang invoice]
    RECALCULATE --> SAVE[Update purchase dan InvoiceItem]
    SAVE --> AUDIT[Create audit log]

    PENDING_ACTION -->|Cancel| CANCEL_REASON[Input alasan cancel]
    CANCEL_REASON --> VALID_CANCEL{Alasan dan status valid?}
    VALID_CANCEL -->|Tidak| ERROR_CANCEL[Return error]
    VALID_CANCEL -->|Ya| CANCEL_PURCHASE[Set purchase CANCELLED]
    CANCEL_PURCHASE --> CANCEL_INVOICE[Set invoice terkait CANCELLED]
    CANCEL_INVOICE --> AUDIT

    STATUS -->|ACTIVE atau PAID| REFUND_ACTION[Ajukan refund]
    REFUND_ACTION --> REFUND_INPUT[Input nominal, alasan, dan bukti]
    REFUND_INPUT --> VALID_REFUND{Nominal valid dan tidak melebihi pembayaran?}
    VALID_REFUND -->|Tidak| ERROR_REFUND[Return error]
    ERROR_REFUND --> REFUND_INPUT
    VALID_REFUND -->|Ya| SAVE_REFUND[Simpan refundAmount, reason, proof, user, dan waktu]
    SAVE_REFUND --> UPDATE_PACKAGE[Update status paket sesuai aturan refund]
    UPDATE_PACKAGE --> AUDIT

    STATUS -->|CANCELLED atau EXPIRED| REJECT_ACTION[Tolak aksi yang tidak diizinkan]
    REJECT_ACTION --> END([Selesai])
    ERROR_CANCEL --> END
    AUDIT --> END
```

## 6. Logistik Cabang — Stock Request sampai Shipment

```mermaid
flowchart TD
    START([Mulai]) --> AUTH[Authenticate dan authorize]
    AUTH --> SCOPE[Validasi branch scope]
    SCOPE --> STOCK[Admin cabang memeriksa inventory]
    STOCK --> ENOUGH{Stok mencukupi?}
    ENOUGH -->|Ya| MONITOR[Monitoring selesai]
    ENOUGH -->|Tidak| REQUEST[Create StockRequest]

    REQUEST --> REQUEST_ITEMS[Input produk, requestedQty, priority, dan notes]
    REQUEST_ITEMS --> VALIDATE{Produk dan quantity valid?}
    VALIDATE -->|Tidak| ERROR[Return validation error]
    ERROR --> REQUEST_ITEMS
    VALIDATE -->|Ya| PENDING[Set request PENDING]

    PENDING --> REVIEW[Admin Manager atau Super Admin review]
    REVIEW --> DECISION{Approve request?}

    DECISION -->|Tidak| REJECT_REASON[Input rejection reason]
    REJECT_REASON --> REJECTED[Set request REJECTED]
    REJECTED --> AUDIT[Create audit log]

    DECISION -->|Ya| APPROVE_QTY[Set approvedQty per item]
    APPROVE_QTY --> PARTIAL{Semua quantity disetujui?}
    PARTIAL -->|Tidak| PARTIAL_APPROVED[Simpan approvedQty sebagian dan set APPROVED]
    PARTIAL -->|Ya| APPROVED[Set request APPROVED]

    PARTIAL_APPROVED --> BILLING{Request memerlukan invoice?}
    APPROVED --> BILLING
    BILLING -->|Ya| STOCK_INVOICE[Buat StockRequestInvoice]
    BILLING -->|Tidak atau gratis| PREPARE[Buat Shipment PREPARING]
    STOCK_INVOICE --> PAYMENT_TYPE{Normal, debt, atau gratis?}

    PAYMENT_TYPE -->|Normal| WAIT_PAYMENT[Request WAITING_PAYMENT dan invoice PENDING_PAYMENT]
    PAYMENT_TYPE -->|Debt| DEBT[Invoice DEBT sesuai approval plan]
    PAYMENT_TYPE -->|Gratis| FREE[Invoice PAID tanpa bukti pembayaran]

    WAIT_PAYMENT --> UPLOAD[Upload bukti pembayaran stock request]
    UPLOAD --> VERIFY{Bukti pembayaran valid?}
    VERIFY -->|Tidak| PAYMENT_REJECT[Set verification REJECTED dan minta perbaikan]
    PAYMENT_REJECT --> UPLOAD
    VERIFY -->|Ya| PAYMENT_PAID[Set invoice PAID dan verification VERIFIED]

    PAYMENT_PAID --> PREPARE
    DEBT --> PREPARE
    FREE --> PREPARE

    PREPARE --> SOURCE[Validasi source branch dan source inventory]
    SOURCE --> STOCK_AVAILABLE{Stok sumber tersedia?}
    STOCK_AVAILABLE -->|Tidak| SHORTAGE[Perbaiki approved quantity atau tunggu stok]
    SHORTAGE --> REVIEW
    STOCK_AVAILABLE -->|Ya| SHIPMENT_ITEMS[Buat ShipmentItem dari quantity final]
    SHIPMENT_ITEMS --> READY[Shipment status PREPARING]
    READY --> SHIP_ACTION[Admin sumber melakukan ship]
    SHIP_ACTION --> SHIP_VALID{Shipment masih PREPARING?}
    SHIP_VALID -->|Tidak| SHIP_ERROR[Tolak aksi ship]
    SHIP_VALID -->|Ya| DEDUCT[Kurangi atau reserve stok sumber]
    DEDUCT --> MUTATION_OUT[Buat stock mutation keluar]
    MUTATION_OUT --> SHIPPED[Set shipment dan request SHIPPED]
    SHIPPED --> RECEIVE[Cabang tujuan menerima barang]
    RECEIVE --> RECEIVE_INPUT[Input receivedQty per item dan bukti]
    RECEIVE_INPUT --> DISCREPANCY{Ada quantity kurang, lebih, rusak, atau salah item?}

    DISCREPANCY -->|Tidak| ADD_STOCK[Tambah stok cabang tujuan]
    DISCREPANCY -->|Ya| REPORT[Catat ShipmentDiscrepancy dan bukti foto]
    REPORT --> OVERSTOCK{Ada quantity lebih?}
    OVERSTOCK -->|Ya| CREATE_OVERSTOCK[Buat overstock AVAILABLE]
    OVERSTOCK -->|Tidak| ADD_STOCK
    CREATE_OVERSTOCK --> ADD_STOCK

    ADD_STOCK --> MUTATION_IN[Buat stock mutation masuk]
    MUTATION_IN --> RESULT{Penerimaan bermasalah?}
    RESULT -->|Tidak| RECEIVED[Set shipment RECEIVED dan request COMPLETED]
    RESULT -->|Ya| RECEIVED_ISSUE[Set shipment RECEIVED_WITH_ISSUE dan request COMPLETED_WITH_ISSUE]

    RECEIVED --> AUDIT
    RECEIVED_ISSUE --> AUDIT
    MONITOR --> END([Selesai])
    SHIP_ERROR --> END
    AUDIT --> NOTIFY[Update dashboard atau notification]
    NOTIFY --> END
```

## 7. Logistik — Invoice Stock Request

```mermaid
flowchart TD
    START([Stock request disetujui]) --> BUILD[Buat snapshot item dan harga]
    BUILD --> TOTAL[Hitung subtotal dan total invoice]
    TOTAL --> ZERO{Total sama dengan nol?}

    ZERO -->|Ya| FREE[Set invoice PAID]
    FREE --> FREE_VERIFY[Verification VERIFIED sebagai invoice gratis]
    FREE_VERIFY --> REQUEST_APPROVED[Request dapat diproses]

    ZERO -->|Tidak| TYPE{Payment type}
    TYPE -->|Debt| DEBT[Set invoice DEBT]
    DEBT --> DEBT_VERIFY[Verification tetap mengikuti aturan debt]
    DEBT_VERIFY --> REQUEST_APPROVED

    TYPE -->|Normal| PENDING[Set invoice PENDING_PAYMENT]
    PENDING --> WAITING[Set request WAITING_PAYMENT]
    WAITING --> PROOF[Upload payment proof]
    PROOF --> REVIEW[Admin review payment]
    REVIEW --> VALID{Valid?}
    VALID -->|Tidak| REJECT[Set verification REJECTED]
    REJECT --> CORRECT[Perbaiki data atau bukti]
    CORRECT --> PROOF
    VALID -->|Ya| PAYMENT[Buat StockRequestInvoicePayment]
    PAYMENT --> PAID[Set invoice PAID dan verification VERIFIED]
    PAID --> REQUEST_APPROVED

    REQUEST_APPROVED --> SHIPMENT[Buat atau lanjutkan shipment]
    SHIPMENT --> END([Selesai])
```

## 8. Logistik — Material Usage dari Treatment Session

```mermaid
flowchart TD
    START([Nurse membuka step material usage]) --> SESSION[Load treatment session]
    SESSION --> EDITABLE{Session masih dapat diedit?}
    EDITABLE -->|Tidak| DENIED[Tolak perubahan]
    EDITABLE -->|Ya| BRANCH[Ambil branch dari session]
    BRANCH --> ITEMS[Input material dan quantity used]
    ITEMS --> VALIDATE{Item, unit, dan quantity valid?}
    VALIDATE -->|Tidak| ERROR[Return validation error]
    ERROR --> ITEMS
    VALIDATE -->|Ya| CHECK[Periksa InventoryItem per produk]
    CHECK --> ENOUGH{Semua stok cukup?}
    ENOUGH -->|Tidak| STOCK_ERROR[Tolak tanpa mengubah stok]
    STOCK_ERROR --> ITEMS
    ENOUGH -->|Ya| TRANSACTION[Mulai database transaction]
    TRANSACTION --> USAGE[Simpan material usage]
    USAGE --> DEDUCT[Kurangi stok inventory cabang]
    DEDUCT --> MUTATION[Buat StockMutation USED]
    MUTATION --> PROGRESS[Update progress step session]
    PROGRESS --> COMMIT[Commit transaction]
    COMMIT --> LOW{Stok di bawah threshold?}
    LOW -->|Ya| ALERT[Masuk indikator low stock]
    LOW -->|Tidak| AUDIT[Create audit log]
    ALERT --> AUDIT
    AUDIT --> END([Inventory terupdate])
    DENIED --> END
```

## 9. Homecare Logistics — Tim dan Tas Saat Ini

```mermaid
flowchart TD
    START([Mulai]) --> AUTH[Validasi role logistics dan branch scope]
    AUTH --> TEAM_ACTION{Aksi tim}

    TEAM_ACTION -->|Create team| TEAM_INPUT[Input branch, teamCode, name, dan description]
    TEAM_INPUT --> TEAM_VALID{Branch dan teamCode valid?}
    TEAM_VALID -->|Tidak| TEAM_ERROR[Return error]
    TEAM_VALID -->|Ya| CREATE_TEAM[Buat HomecareTeam]

    TEAM_ACTION -->|Manage member| LOAD_TEAM[Load team]
    LOAD_TEAM --> MEMBER_ACTION{Tambah, update, atau nonaktifkan anggota}
    MEMBER_ACTION --> MEMBER_VALID{User dan role valid?}
    MEMBER_VALID -->|Tidak| MEMBER_ERROR[Return error]
    MEMBER_VALID -->|Ya| SAVE_MEMBER[Simpan HomecareTeamMember]

    TEAM_ACTION -->|Create bag| SELECT_TEAM[Pilih team aktif]
    SELECT_TEAM --> BAG_INPUT[Input bagCode, name, branch, dan status]
    BAG_INPUT --> BAG_VALID{Team dan kode tas valid?}
    BAG_VALID -->|Tidak| BAG_ERROR[Return error]
    BAG_VALID -->|Ya| CREATE_BAG[Buat HomecareBag ACTIVE]

    TEAM_ACTION -->|Assign bag| LOAD_BAG[Load tas dan team tujuan]
    LOAD_BAG --> ASSIGN_VALID{Branch dan assignment valid?}
    ASSIGN_VALID -->|Tidak| ASSIGN_ERROR[Return error]
    ASSIGN_VALID -->|Ya| ASSIGN[Update teamId dan branchId tas]

    TEAM_ACTION -->|Delete team| CHECK_TEAM{Masih punya tas atau anggota aktif?}
    CHECK_TEAM -->|Ya| DENY_TEAM[Tolak delete team]
    CHECK_TEAM -->|Tidak| DELETE_TEAM[Delete atau nonaktifkan team]

    TEAM_ACTION -->|Delete bag| CHECK_BAG{Tas memiliki stok atau transaksi aktif?}
    CHECK_BAG -->|Ya| DENY_BAG[Tolak delete bag]
    CHECK_BAG -->|Tidak| DELETE_BAG[Delete atau nonaktifkan tas]

    CREATE_TEAM --> AUDIT[Create audit log]
    SAVE_MEMBER --> AUDIT
    CREATE_BAG --> AUDIT
    ASSIGN --> AUDIT
    DELETE_TEAM --> AUDIT
    DELETE_BAG --> AUDIT
    TEAM_ERROR --> END([Selesai])
    MEMBER_ERROR --> END
    BAG_ERROR --> END
    ASSIGN_ERROR --> END
    DENY_TEAM --> END
    DENY_BAG --> END
    AUDIT --> END
```

## 10. Homecare Logistics — Request dan Shipment ke Satu Tas

```mermaid
flowchart TD
    START([Mulai]) --> SELECT[Team memilih satu HomecareBag]
    SELECT --> STOCK[Periksa HomecareBagStock dan minThreshold]
    STOCK --> NEED{Perlu restock?}
    NEED -->|Tidak| END([Selesai])
    NEED -->|Ya| REQUEST[Create HomecareBagStockRequest]
    REQUEST --> ITEMS[Input item dan requestedQty]
    ITEMS --> PENDING[Set request PENDING]
    PENDING --> REVIEW[Logistics atau manager review]
    REVIEW --> APPROVE{Approve?}

    APPROVE -->|Tidak| REASON[Isi rejectionReason]
    REASON --> REJECTED[Set request REJECTED]
    REJECTED --> AUDIT[Create audit log]

    APPROVE -->|Sebagian| PARTIAL[Set approvedQty dan PARTIALLY_APPROVED]
    APPROVE -->|Ya| APPROVED[Set APPROVED]
    PARTIAL --> PREPARING[Set request PREPARING]
    APPROVED --> PREPARING

    PREPARING --> SHIPMENT[Buat HomecareBagShipment]
    SHIPMENT --> SOURCE[Source wajib branch PUSAT sesuai service saat ini]
    SOURCE --> CHECK{Stok sumber cukup?}
    CHECK -->|Tidak| SHORTAGE[Return shortage error]
    SHORTAGE --> REVIEW
    CHECK -->|Ya| PACK[Siapkan HomecareBagShipmentItem]
    PACK --> SHIP[Ship barang]
    SHIP --> DEDUCT[Kurangi stok branch sumber]
    DEDUCT --> OUT_MUTATION[Buat LogisticStockMutation keluar]
    OUT_MUTATION --> SHIPPED[Set shipment SHIPPED dan request SHIPPED]

    SHIPPED --> RECEIVE[Team menerima shipment untuk satu tas]
    RECEIVE --> QTY[Input receivedQty per item]
    QTY --> ISSUE{Ada discrepancy?}
    ISSUE -->|Tidak| ADD[Tambah HomecareBagStock]
    ISSUE -->|Ya| ISSUE_DATA[Catat discrepancy type, notes, dan foto]
    ISSUE_DATA --> ADD
    ADD --> IN_MUTATION[Buat LogisticStockMutation masuk]
    IN_MUTATION --> RESULT{Ada issue?}
    RESULT -->|Tidak| COMPLETE[Set request RECEIVED atau COMPLETED dan shipment RECEIVED]
    RESULT -->|Ya| COMPLETE_ISSUE[Set RECEIVED_WITH_ISSUE]
    COMPLETE --> AUDIT
    COMPLETE_ISSUE --> AUDIT
    AUDIT --> END
```

## 11. Homecare Logistics — Pemakaian, Retur, dan Opname Satu Tas

```mermaid
flowchart TD
    START([Pilih satu HomecareBag]) --> ACTION{Jenis transaksi}

    ACTION -->|Usage| USAGE_INPUT[Input session opsional, produk, quantity, dan bukti]
    USAGE_INPUT --> USAGE_VALID{Tas aktif dan stok cukup?}
    USAGE_VALID -->|Tidak| USAGE_ERROR[Return error]
    USAGE_VALID -->|Ya| SAVE_USAGE[Buat HomecareBagUsage dan item]
    SAVE_USAGE --> DEDUCT[Kurangi HomecareBagStock]
    DEDUCT --> USAGE_MUTATION[Buat mutation BAG_USAGE]
    USAGE_MUTATION --> USAGE_DONE[Set usage COMPLETED]

    ACTION -->|Return| RETURN_INPUT[Input cabang tujuan, item, quantity, kondisi, dan bukti]
    RETURN_INPUT --> RETURN_VALID{Quantity tersedia dan tujuan valid?}
    RETURN_VALID -->|Tidak| RETURN_ERROR[Return error]
    RETURN_VALID -->|Ya| SAVE_RETURN[Buat HomecareBagReturn]
    SAVE_RETURN --> DEDUCT_RETURN[Kurangi stok tas]
    DEDUCT_RETURN --> ADD_BRANCH[Tambah stok cabang untuk item reusable]
    ADD_BRANCH --> RETURN_MUTATION[Buat mutation BAG_RETURN]
    RETURN_MUTATION --> RETURN_DONE[Catat returnedAt dan receivedAt]

    ACTION -->|Stock opname| OPNAME[Set tas IN_CHECKING]
    OPNAME --> SNAPSHOT[Ambil systemQty per produk]
    SNAPSHOT --> PHYSICAL[Petugas input physicalQty]
    PHYSICAL --> DIFFERENCE[Hitung difference]
    DIFFERENCE --> VARIANCE{Ada selisih?}
    VARIANCE -->|Tidak| COMPLETE_OPNAME[Set opname COMPLETED]
    VARIANCE -->|Ya| REVIEW[Review notes dan bukti]
    REVIEW --> APPROVE{Adjustment disetujui?}
    APPROVE -->|Tidak| HOLD[Tetap perlu investigasi]
    APPROVE -->|Ya| ADJUST[Update stok sesuai physicalQty]
    ADJUST --> ADJUST_MUTATION[Buat mutation STOCK_OPNAME atau ADJUSTMENT]
    ADJUST_MUTATION --> MARK[Set adjustmentCreated true]
    MARK --> COMPLETE_OPNAME
    COMPLETE_OPNAME --> ACTIVE[Set tas ACTIVE kembali]

    USAGE_DONE --> AUDIT[Create audit log]
    RETURN_DONE --> AUDIT
    ACTIVE --> AUDIT
    USAGE_ERROR --> END([Selesai])
    RETURN_ERROR --> END
    HOLD --> END
    AUDIT --> END
```

## 12. Logistik — Transfer Stok Universal

```mermaid
flowchart TD
    START([Create LogisticStockTransaction]) --> TYPE[Set transaction type]
    TYPE --> SOURCE[Set sourceType dan sourceId]
    SOURCE --> DESTINATION[Set destinationType dan destinationId]
    DESTINATION --> LOCATIONS{Kombinasi lokasi}

    LOCATIONS -->|Central ke Branch| CB[Transfer central stock ke branch stock]
    LOCATIONS -->|Branch ke Branch| BB[Transfer antar cabang]
    LOCATIONS -->|Branch ke Bag| BAG_IN[Restock homecare bag]
    LOCATIONS -->|Bag ke Branch| BAG_RETURN[Return dari homecare bag]
    LOCATIONS -->|Adjustment| ADJUST[Penyesuaian satu lokasi]

    CB --> ITEMS[Input LogisticStockTransactionItem]
    BB --> ITEMS
    BAG_IN --> ITEMS
    BAG_RETURN --> ITEMS
    ADJUST --> ITEMS

    ITEMS --> VALIDATE{Lokasi, produk, dan quantity valid?}
    VALIDATE -->|Tidak| ERROR[Set gagal atau return error]
    VALIDATE -->|Ya| SOURCE_STOCK{Source membutuhkan pengurangan?}
    SOURCE_STOCK -->|Ya| ENOUGH{Stok source cukup?}
    ENOUGH -->|Tidak| STOCK_ERROR[Batalkan transaction]
    ENOUGH -->|Ya| BEFORE[Catat sourceStockBefore]
    SOURCE_STOCK -->|Tidak| DEST_BEFORE[Catat destinationStockBefore]
    BEFORE --> DEDUCT[Kurangi source stock]
    DEDUCT --> DEST_BEFORE
    DEST_BEFORE --> ADD{Ada destination?}
    ADD -->|Ya| INCREASE[Tambah destination stock]
    ADD -->|Tidak| SNAPSHOT[Catat saldo akhir]
    INCREASE --> SNAPSHOT
    SNAPSHOT --> MUTATIONS[Buat mutation per lokasi dan item]
    MUTATIONS --> COMPLETE[Set transaction COMPLETED]
    COMPLETE --> AUDIT[Create audit log]
    AUDIT --> END([Selesai])
    ERROR --> END
    STOCK_ERROR --> END
```

## 13. Status Finance Saat Ini

```mermaid
flowchart LR
    DRAFT[DRAFT] --> PENDING[PENDING_PAYMENT]
    PENDING --> PAID[PAID]
    PENDING --> DEBT[DEBT]
    PENDING --> CANCELLED[CANCELLED]
    DEBT --> PAID
    DEBT --> OVERDUE[OVERDUE]
    OVERDUE --> PAID
    OVERDUE --> CANCELLED
```

Status verifikasi pembayaran:

```mermaid
flowchart LR
    PENDING[PENDING] --> VERIFIED[VERIFIED]
    PENDING --> REJECTED[REJECTED]
    REJECTED --> PENDING
```

## 14. Status Stock Request dan Shipment Saat Ini

```mermaid
flowchart LR
    REQUEST_PENDING[PENDING] --> WAITING_PAYMENT[WAITING_PAYMENT]
    REQUEST_PENDING --> REQUEST_APPROVED[APPROVED]
    REQUEST_PENDING --> REQUEST_REJECTED[REJECTED]
    WAITING_PAYMENT --> PAYMENT_UPLOADED[PAYMENT_UPLOADED]
    PAYMENT_UPLOADED --> PAYMENT_CONFIRMED[PAYMENT_CONFIRMED]
    PAYMENT_UPLOADED --> WAITING_PAYMENT
    PAYMENT_CONFIRMED --> REQUEST_APPROVED
    WAITING_PAYMENT --> REQUEST_APPROVED
    REQUEST_APPROVED --> REQUEST_SHIPPED[SHIPPED]
    REQUEST_SHIPPED --> REQUEST_COMPLETED[COMPLETED]
    REQUEST_SHIPPED --> REQUEST_ISSUE[COMPLETED_WITH_ISSUE]
```

```mermaid
flowchart LR
    SHIPMENT_PREPARING[PREPARING] --> SHIPMENT_SHIPPED[SHIPPED]
    SHIPMENT_SHIPPED --> SHIPMENT_RECEIVED[RECEIVED]
    SHIPMENT_SHIPPED --> SHIPMENT_ISSUE[RECEIVED_WITH_ISSUE]
    SHIPMENT_RECEIVED --> SHIPMENT_APPROVED[APPROVED jika flow memerlukan approval akhir]
    SHIPMENT_ISSUE --> SHIPMENT_APPROVED
```

## 15. Status Homecare Bag Saat Ini

```mermaid
flowchart LR
    ACTIVE[ACTIVE] --> CHECKING[IN_CHECKING]
    CHECKING --> ACTIVE
    ACTIVE --> INACTIVE[INACTIVE]
    ACTIVE --> DAMAGED[DAMAGED]
    ACTIVE --> LOST[LOST]
    DAMAGED --> CHECKING
    CHECKING --> INACTIVE
```

## 16. Hubungan Data Finance dan Logistik

```mermaid
flowchart TD
    MEMBER[Member] --> MEMBER_PACKAGE[MemberPackage]
    MEMBER --> MEMBER_ADDON[MemberAddOn]
    MEMBER --> NON_THERAPY[MemberNonTherapyPurchase]
    MEMBER_PACKAGE --> INVOICE[Invoice]
    MEMBER_ADDON --> INVOICE
    NON_THERAPY --> INVOICE
    INVOICE --> INVOICE_ITEM[InvoiceItem]
    INVOICE --> INVOICE_PAYMENT[InvoicePayment]
    INVOICE_PAYMENT --> PAYMENT_PROOF[Protected Payment Proof]

    STOCK_REQUEST[StockRequest] --> SR_ITEM[StockRequestItem]
    STOCK_REQUEST --> SR_INVOICE[StockRequestInvoice]
    SR_INVOICE --> SR_INVOICE_ITEM[StockRequestInvoiceItem]
    SR_INVOICE --> SR_PAYMENT[StockRequestInvoicePayment]
    STOCK_REQUEST --> SHIPMENT[Shipment]
    SHIPMENT --> SHIPMENT_ITEM[ShipmentItem]
    SHIPMENT --> DISCREPANCY[ShipmentDiscrepancy]
    SHIPMENT_ITEM --> INVENTORY_ITEM[InventoryItem]
    DISCREPANCY --> OVERSTOCK[Overstock]
    INVENTORY_ITEM --> STOCK_MUTATION[StockMutation]

    TEAM[HomecareTeam] --> TEAM_MEMBER[HomecareTeamMember]
    TEAM --> BAG[HomecareBag]
    BAG --> BAG_STOCK[HomecareBagStock]
    BAG --> BAG_REQUEST[HomecareBagStockRequest]
    BAG_REQUEST --> BAG_SHIPMENT[HomecareBagShipment]
    BAG --> BAG_USAGE[HomecareBagUsage]
    BAG --> BAG_RETURN[HomecareBagReturn]
    BAG --> BAG_OPNAME[HomecareBagOpname]
    BAG --> LOGISTIC_MUTATION[LogisticStockMutation]
```

## 17. Referensi Implementasi

- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/invoices/`
- `apps/api/src/modules/packages/services/`
- `apps/api/src/modules/inventory/stock-request.service.ts`
- `apps/api/src/modules/inventory/shipment.service.ts`
- `apps/api/src/modules/inventory/logistics.service.ts`
- `apps/api/src/modules/inventory/services/`
- `docs/03-COMMERCIAL-AND-BILLING.md`
- `docs/05-INVENTORY-AND-LOGISTICS.md`
- `docs/06-HOMECARE-LOGISTICS.md`
