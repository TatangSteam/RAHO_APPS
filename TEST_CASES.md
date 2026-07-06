# Test Cases - RAHO ERP Management System

Last updated: 6 Juli 2026

Status default: Not Run.  
Priority: P0 = critical flow, P1 = important, P2 = enhancement/regression support.

| TC ID | Module | Scenario | Preconditions | Steps | Test Data | Expected Result | Priority | Type | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC-001 | Authentication | Login staff valid | User staff aktif tersedia. | 1. Buka `/login`. 2. Isi email dan password valid. 3. Klik Masuk. | `superadmin@raho.id` / password valid | User berhasil login, token tersimpan, diarahkan ke dashboard sesuai role. | P0 | Positive | Not Run |
| TC-002 | Authentication | Login member valid | User member aktif tersedia. | 1. Buka `/login`. 2. Isi username/email member dan password. 3. Klik Masuk. | Member aktif | Member berhasil masuk ke portal `/me/dashboard`. | P0 | Positive | Not Run |
| TC-003 | Authentication | Login password salah | User aktif tersedia. | 1. Buka login. 2. Isi email valid dan password salah. 3. Submit. | Email valid, password invalid | Login ditolak, pesan error tampil, audit failed login tercatat. | P0 | Negative | Not Run |
| TC-004 | Authentication | Login user inactive | User inactive tersedia. | 1. Login dengan user inactive. | User inactive | Login ditolak dan user tidak mendapat token. | P0 | Negative | Not Run |
| TC-005 | Authentication | Rate limit login | Environment rate limit aktif. | 1. Login gagal berulang melebihi limit. | Password salah 5+ kali | Sistem menolak sementara dengan pesan rate limit. | P0 | Security | Not Run |
| TC-006 | Authentication | Logout | User sudah login. | 1. Klik Logout. 2. Akses protected route. | Token valid | User diarahkan ke login dan protected route tidak dapat diakses. | P0 | Positive | Not Run |
| TC-007 | Authentication | Refresh token valid | User login dan refresh token valid. | 1. Trigger refresh token. 2. Akses API protected. | Refresh token valid | Access token baru diterima dan API protected berhasil. | P0 | API | Not Run |
| TC-008 | Authentication | Refresh token expired | Refresh token expired/invalid. | 1. Trigger refresh token. | Refresh token invalid | Refresh ditolak dan user dipaksa login ulang. | P0 | Negative | Not Run |
| TC-009 | Authorization | Role tidak berhak membuka menu admin | Login sebagai NURSE. | 1. Buka route super admin. | NURSE token | Akses ditolak/redirect; menu admin tidak tampil. | P0 | Security | Not Run |
| TC-010 | Authorization | API role forbidden | Login sebagai role tanpa izin. | 1. Call endpoint admin protected. | NURSE token ke `/api/v1/admin/users` | API mengembalikan 403. | P0 | API Security | Not Run |
| TC-011 | Branch Access | User cabang A tidak melihat data cabang B | Data dua cabang tersedia. | 1. Login staff cabang A. 2. Buka member/inventory cabang B via URL/API. | Staff cabang A | Data cabang B tidak tampil atau API ditolak. | P0 | Security | Not Run |
| TC-012 | Branch Access | Branch switcher user multi-cabang | User punya lebih dari satu branch. | 1. Login. 2. Ganti cabang aktif. 3. Buka dashboard/list. | User multi-cabang | Data berubah mengikuti cabang aktif. | P1 | Functional | Not Run |
| TC-013 | User Management | Create staff valid | Login SUPER_ADMIN/ADMIN_CABANG. | 1. Buka staff/users. 2. Tambah staff. 3. Isi data valid. 4. Simpan. | Email unik, role valid | Staff dibuat, credential tampil, audit log tercatat. | P0 | Positive | Not Run |
| TC-014 | User Management | Create staff email duplicate | Email user sudah ada. | 1. Tambah staff dengan email existing. | Email existing | Sistem menolak dengan validasi email unik. | P0 | Negative | Not Run |
| TC-015 | User Management | Update staff role | Login admin berwenang. | 1. Buka detail staff. 2. Ubah role. 3. Simpan. | Staff existing | Role berubah, permission menyesuaikan, audit log tercatat. | P1 | Functional | Not Run |
| TC-016 | User Management | Deactivate staff | Login admin berwenang. | 1. Buka user. 2. Deactivate/delete user. 3. Konfirmasi. | Staff aktif | Staff inactive dan tidak bisa login. | P0 | Functional | Not Run |
| TC-017 | User Management | Reset password staff | Login SUPER_ADMIN/ADMIN_MANAGER. | 1. Buka user. 2. Reset password. | User aktif | Password baru dibuat/ditampilkan sesuai flow; audit log tercatat. | P1 | Functional | Not Run |
| TC-018 | User Management | Change own password | User login. | 1. Buka profil. 2. Isi password lama dan baru. 3. Submit. | Password lama valid | Password berubah dan login berikutnya memakai password baru. | P1 | Functional | Not Run |
| TC-019 | User Management | Upload avatar | User login. | 1. Buka profil. 2. Upload avatar valid. | JPG/PNG valid | Avatar tersimpan dan tampil. | P2 | Functional | Not Run |
| TC-020 | User Management | Upload avatar invalid | User login. | 1. Upload file invalid. | `.exe` atau file > limit | Upload ditolak, tidak ada file/record yatim. | P1 | Negative | Not Run |
| TC-021 | Branch Management | Create branch valid | Login SUPER_ADMIN. | 1. Buka branches. 2. Tambah cabang. 3. Isi data valid. | `branchCode` unik | Cabang dibuat dan muncul di list. | P0 | Positive | Not Run |
| TC-022 | Branch Management | Create branch duplicate code | Kode cabang sudah ada. | 1. Tambah cabang dengan kode existing. | Kode existing | Sistem menolak karena kode harus unik. | P0 | Negative | Not Run |
| TC-023 | Branch Management | Update branch | Cabang tersedia. | 1. Buka detail cabang. 2. Edit data. 3. Simpan. | Nama/alamat baru | Data cabang berubah dan audit log tercatat. | P1 | Functional | Not Run |
| TC-024 | Branch Management | Assign manager to branch | Manager dan cabang tersedia. | 1. Buka cabang. 2. Assign manager. | Manager aktif | Manager mendapat akses cabang. | P1 | Functional | Not Run |
| TC-025 | Branch Management | Unassign manager from branch | Manager sudah assigned. | 1. Remove manager dari cabang. | Manager assigned | Manager tidak lagi melihat cabang tersebut. | P1 | Functional | Not Run |
| TC-026 | Branch Management | List branch members | Data member cabang tersedia. | 1. Buka detail cabang. 2. Tab members. | Branch valid | Member cabang tampil sesuai scope. | P1 | Functional | Not Run |
| TC-027 | Member Management | Register member valid | Login ADMIN_CABANG/ADMIN_LAYANAN. | 1. Buka member baru. 2. Isi data lengkap. 3. Upload dokumen opsional. 4. Simpan. | Data member valid | Member dibuat, user member dibuat, memberNo unik, audit log tercatat. | P0 | Positive | Not Run |
| TC-028 | Member Management | Register member missing required | Login staff berwenang. | 1. Buka form member. 2. Kosongkan field wajib. 3. Simpan. | Nama/kontak kosong | Sistem menampilkan validasi dan tidak membuat member. | P0 | Negative | Not Run |
| TC-029 | Member Management | Register with active referral | Referral aktif tersedia. | 1. Register member. 2. Pilih referral aktif. 3. Simpan. | Referral aktif | Member terhubung ke referral, statistik referral siap dihitung. | P1 | Functional | Not Run |
| TC-030 | Member Management | Register with inactive referral | Referral inactive tersedia. | 1. Pilih referral inactive saat registrasi. | Referral inactive | Sistem menolak atau tidak menampilkan referral inactive. | P1 | Negative | Not Run |
| TC-031 | Member Management | Search member by name/memberNo | Member tersedia. | 1. Buka list member. 2. Search nama/memberNo. | Keyword valid | Hasil sesuai keyword dan branch access. | P0 | Functional | Not Run |
| TC-032 | Member Management | Filter member by branch/status | Data multi status tersedia. | 1. Pilih filter branch/status. | Branch/status | List sesuai filter. | P1 | Functional | Not Run |
| TC-033 | Member Management | View member detail | Member tersedia. | 1. Buka detail member. | Member ID valid | Tab profil, paket, sesi, diagnosa, therapy plan, lab, dokumen tampil sesuai permission. | P0 | Functional | Not Run |
| TC-034 | Member Management | Update member valid | Member tersedia. | 1. Edit profil member. 2. Simpan. | Data baru valid | Data berubah dan audit log tercatat. | P0 | Functional | Not Run |
| TC-035 | Member Management | Delete member authorized | Login SUPER_ADMIN/ADMIN_MANAGER. | 1. Buka member. 2. Delete. 3. Konfirmasi. | Member test | Member terhapus/nonaktif sesuai implementasi. | P1 | Functional | Not Run |
| TC-036 | Member Management | Delete member unauthorized | Login ADMIN_LAYANAN/NURSE. | 1. Call delete member. | Token role tidak berhak | API mengembalikan 403. | P0 | Security | Not Run |
| TC-037 | Member Management | Upload member document valid | Member tersedia. | 1. Upload PSP/foto profil. | PDF/JPG valid | Dokumen tersimpan dan tampil di consent/documents. | P1 | Functional | Not Run |
| TC-038 | Member Management | Upload member document invalid type | Member tersedia. | 1. Upload file invalid. | `.exe` | Upload ditolak. | P1 | Negative | Not Run |
| TC-039 | Member Management | Grant branch access | Member dan branch tersedia. | 1. Grant access cabang lain. | Member ID, branch ID | Member dapat diakses di cabang tambahan. | P1 | Functional | Not Run |
| TC-040 | Member Management | Grant duplicate branch access | Member sudah punya access. | 1. Grant cabang yang sama. | Existing access | Sistem mencegah duplikasi. | P1 | Negative | Not Run |
| TC-041 | Member Management | Create member diagnosis | Member tersedia. | 1. Buka tab diagnosis. 2. Tambah diagnosis. | Diagnosis valid, ICD optional | Diagnosis tersimpan dengan author dan timestamp. | P0 | Functional | Not Run |
| TC-042 | Member Management | Update member diagnosis | Diagnosis tersedia. | 1. Edit diagnosis. 2. Simpan. | Diagnosis baru | Diagnosis berubah dan audit log/history tercatat. | P1 | Functional | Not Run |
| TC-043 | Member Management | Upload lab result valid | Member tersedia. | 1. Upload hasil lab. | PDF/JPG/PNG valid | Lab result tersimpan dan tampil di tab lab. | P1 | Functional | Not Run |
| TC-044 | Member Management | Delete lab result authorized | Lab result tersedia. | 1. Login SUPER_ADMIN/ADMIN_MANAGER. 2. Delete lab result. | Lab ID valid | Lab result terhapus. | P1 | Functional | Not Run |
| TC-045 | Member Management | Delete lab result unauthorized | Login DOCTOR/NURSE. | 1. Delete lab result. | Role tidak berhak | API mengembalikan 403. | P0 | Security | Not Run |
| TC-046 | Member Portal | Member dashboard | Login sebagai member. | 1. Buka `/me/dashboard`. | Member aktif | Ringkasan paket, sesi, invoice, profil tampil milik sendiri. | P1 | Functional | Not Run |
| TC-047 | Member Portal | Member view sessions | Member punya sesi. | 1. Buka `/me/sessions`. 2. Buka detail. | Session member | Detail sesi read-only tampil. | P1 | Functional | Not Run |
| TC-048 | Member Portal | Member cannot access other member session | Dua member tersedia. | 1. Login member A. 2. Akses session member B via URL/API. | Session ID member B | Akses ditolak. | P0 | Security | Not Run |
| TC-049 | Member Portal | Member view vouchers/packages | Member punya paket. | 1. Buka `/me/vouchers`. | Paket member | Paket dan status tampil benar. | P1 | Functional | Not Run |
| TC-050 | Member Portal | Member view invoices | Member punya invoice. | 1. Buka `/me/invoices`. 2. Buka detail. | Invoice member | Invoice milik member tampil. | P1 | Functional | Not Run |
| TC-051 | Package | Assign basic package valid | Member aktif dan pricing tersedia. | 1. Buka member. 2. Assign package basic. 3. Simpan. | Basic package | Paket PENDING_PAYMENT dibuat, invoice/payment data dibuat. | P0 | Functional | Not Run |
| TC-052 | Package | Assign booster package valid | Member aktif dan pricing tersedia. | 1. Assign booster package. | Booster type valid | Paket booster dibuat dengan harga benar. | P0 | Functional | Not Run |
| TC-053 | Package | Assign package with discount | Pricing tersedia. | 1. Isi discount percent/amount. 2. Simpan. | Discount valid | Final price benar dan tidak negatif. | P0 | Functional | Not Run |
| TC-054 | Package | Discount makes negative total | Pricing tersedia. | 1. Isi discount melebihi harga. 2. Simpan. | Discount invalid | Sistem menolak. | P0 | Negative | Not Run |
| TC-055 | Package | Upload payment proof valid | Paket pending tersedia. | 1. Upload bukti pembayaran. | JPG/PDF valid | Bukti tersimpan dan dapat dilihat. | P0 | Functional | Not Run |
| TC-056 | Package | Verify payment | Paket dengan bukti bayar tersedia. | 1. Buka verify payment. 2. Verify. | Payment valid | Paket ACTIVE, paid/verified timestamp terisi, invoice/payment dan audit tercatat. | P0 | Functional | Not Run |
| TC-057 | Package | Reject payment | Bukti bayar invalid. | 1. Reject payment. 2. Isi reason. | Reason valid | Status rejected/reason tersimpan. | P0 | Functional | Not Run |
| TC-058 | Package | Reject payment without reason | Bukti bayar invalid. | 1. Reject tanpa reason. | Reason kosong | Sistem menolak. | P1 | Negative | Not Run |
| TC-059 | Package | Edit pending package | Paket PENDING_PAYMENT tersedia. | 1. Edit paket. 2. Simpan. | Data valid | Paket berubah dan total dihitung ulang. | P1 | Functional | Not Run |
| TC-060 | Package | Edit active package blocked | Paket ACTIVE tersedia. | 1. Coba edit paket. | Paket active | Sistem menolak edit langsung. | P0 | Negative | Not Run |
| TC-061 | Package | Cancel pending package | Paket PENDING_PAYMENT tersedia. | 1. Cancel paket. 2. Isi reason. | Reason valid | Paket CANCELLED dan tidak bisa dibayar/dipakai. | P1 | Functional | Not Run |
| TC-062 | Package | Refund active package valid | Paket ACTIVE tersedia. | 1. Refund. 2. Isi amount dan reason. | Amount <= final price | Paket refunded/cancelled sesuai flow, audit tercatat. | P1 | Functional | Not Run |
| TC-063 | Package | Refund amount exceeds price | Paket ACTIVE tersedia. | 1. Refund dengan amount terlalu besar. | Amount > final price | Sistem menolak. | P0 | Negative | Not Run |
| TC-064 | Package Pricing | Create package pricing | Login admin berwenang. | 1. Buka package pricing. 2. Tambah harga. | Branch, type, price valid | Pricing dibuat. | P1 | Functional | Not Run |
| TC-065 | Package Pricing | Price negative blocked | Login admin berwenang. | 1. Isi price negatif. 2. Simpan. | `-1000` | Sistem menolak. | P0 | Negative | Not Run |
| TC-066 | Session | Create session valid | Member punya package ACTIVE eligible. | 1. Buka sessions. 2. Create session. 3. Pilih member, paket, dokter, nakes. | Data valid | Sesi dibuat dengan nomor unik dan status ongoing. | P0 | Functional | Not Run |
| TC-067 | Session | Create session without active package | Member tanpa paket active. | 1. Create session untuk member. | Member no active package | Sistem menolak. | P0 | Negative | Not Run |
| TC-068 | Session | Doctor cannot create session | Login DOCTOR. | 1. Coba create session. | Doctor token | Akses ditolak sesuai rule. | P0 | Security | Not Run |
| TC-069 | Session | View session detail | Sesi tersedia. | 1. Buka detail sesi. | Session ID valid | Detail dan step progress tampil. | P0 | Functional | Not Run |
| TC-070 | Session | Step diagnosis valid | Sesi tersedia dan doctor authorized. | 1. Isi diagnosis, ICD, kategori. 2. Simpan. | Diagnosis valid | Step diagnosis tersimpan dan marked completed. | P0 | Functional | Not Run |
| TC-071 | Session | Step diagnosis invalid ICD | Sesi tersedia. | 1. Isi ICD invalid. 2. Simpan. | ICD invalid | Sistem menolak atau memberi warning sesuai validasi. | P1 | Negative | Not Run |
| TC-072 | Session | Step therapy plan valid | Diagnosis tersedia. | 1. Isi therapy plan. 2. Simpan. | Substance/dosis valid | Therapy plan tersimpan dan dapat dibaca nurse. | P0 | Functional | Not Run |
| TC-073 | Session | Vital before valid | Sesi tersedia. | 1. Isi vital before. 2. Simpan. | Sistol, diastol, HR, saturasi valid | Vital before tersimpan dengan timestamp. | P0 | Functional | Not Run |
| TC-074 | Session | Vital value out of range | Sesi tersedia. | 1. Isi nilai vital ekstrem. 2. Simpan. | Saturasi 200 | Sistem menolak atau menampilkan warning sesuai rule. | P1 | Negative | Not Run |
| TC-075 | Session | Infusion execution valid | Therapy plan tersedia. | 1. Isi detail infus. 2. Simpan. | Cairan, dosis, waktu valid | Infusion record tersimpan. | P0 | Functional | Not Run |
| TC-076 | Session | Infusion deviation requires note | Therapy plan tersedia. | 1. Isi dosis aktual berbeda. 2. Kosongkan catatan deviasi. | Dosis berbeda | Sistem meminta catatan deviasi. | P1 | Negative | Not Run |
| TC-077 | Session | Material usage valid | Inventory item stok cukup. | 1. Pilih material. 2. Isi qty. 3. Simpan. | Qty <= stock | Stock berkurang dan mutation USED dibuat. | P0 | Functional | Not Run |
| TC-078 | Session | Material usage exceeds stock | Stok item kecil. | 1. Isi qty melebihi stok. 2. Simpan. | Qty > stock | Sistem menolak dan stok tidak berubah. | P0 | Negative | Not Run |
| TC-079 | Session | Upload session photo valid | Sesi tersedia. | 1. Upload foto. | JPG/PNG valid | Foto tersimpan dan tampil. | P1 | Functional | Not Run |
| TC-080 | Session | Vital after valid | Vital before tersedia. | 1. Isi vital after. 2. Simpan. | Vital valid | Vital after tersimpan dan perbandingan before/after tampil. | P0 | Functional | Not Run |
| TC-081 | Session | Doctor evaluation valid | Sesi tersedia. | 1. Isi evaluasi/SOAP. 2. Simpan. | Evaluasi valid | Evaluasi tersimpan dengan author dokter. | P0 | Functional | Not Run |
| TC-082 | Session | Complete session all steps done | Semua step wajib selesai. | 1. Klik complete session. | Sesi lengkap | Sesi completed, locked, usedSessions bertambah 1, audit log tercatat. | P0 | Functional | Not Run |
| TC-083 | Session | Complete session incomplete step | Ada step wajib belum selesai. | 1. Klik complete session. | Sesi incomplete | Sistem menolak dan menampilkan step kurang. | P0 | Negative | Not Run |
| TC-084 | Session | Prevent double completion | Sesi sudah completed. | 1. Trigger complete lagi. | Completed session | Sistem menolak dan usedSessions tidak bertambah lagi. | P0 | Regression | Not Run |
| TC-085 | Session | Edit completed session blocked | Sesi completed. | 1. Edit material/vital biasa. | Completed session | Sistem menolak tanpa flow koreksi. | P0 | Negative | Not Run |
| TC-086 | Therapy Plan | Bulk create therapy plans valid | Member punya paket eligible. | 1. Buka bulk therapy. 2. Isi jumlah dalam kuota. 3. Simpan. | Count <= remaining sessions | Therapy plan set dan rows dibuat. | P1 | Functional | Not Run |
| TC-087 | Therapy Plan | Bulk exceeds package quota | Member punya sisa kuota kecil. | 1. Isi jumlah melebihi kuota. | Count > remaining | Sistem menolak. | P0 | Negative | Not Run |
| TC-088 | Therapy Plan | Edit therapy plan creates history | Therapy plan tersedia. | 1. Edit row. 2. Simpan. | Dosis/catatan baru | Versi/history tercatat dan data terbaru tampil. | P1 | Regression | Not Run |
| TC-089 | Therapy Plan | Superseded plan cannot be used | Plan superseded tersedia. | 1. Pilih plan superseded untuk sesi. | Superseded plan | Sistem menolak atau menyembunyikan plan tersebut. | P0 | Negative | Not Run |
| TC-090 | Inventory | Create master product valid | Login SUPER_ADMIN. | 1. Tambah master product. | SKU/nama unik, unit valid | Master product dibuat. | P0 | Functional | Not Run |
| TC-091 | Inventory | Duplicate master product blocked | Produk existing tersedia. | 1. Buat produk dengan nama/SKU existing. | Duplicate name/SKU | Sistem menolak. | P0 | Negative | Not Run |
| TC-092 | Inventory | Create branch inventory item | Master product dan branch tersedia. | 1. Tambah item inventory branch. | Product, branch, stock valid | Inventory item dibuat. | P0 | Functional | Not Run |
| TC-093 | Inventory | Duplicate branch inventory blocked | Item sudah ada di branch. | 1. Tambah item sama. | Product+branch existing | Sistem menolak duplikasi. | P0 | Negative | Not Run |
| TC-094 | Inventory | Stock adjustment valid | Inventory item tersedia. | 1. Adjustment stock. 2. Isi reason. | Qty valid | Stock berubah dan mutation ADJUSTMENT dibuat. | P0 | Functional | Not Run |
| TC-095 | Inventory | Stock cannot be negative | Inventory item tersedia. | 1. Adjustment membuat stok negatif. | Negative result | Sistem menolak. | P0 | Negative | Not Run |
| TC-096 | Inventory | Low stock indicator | Item stock <= threshold. | 1. Buka inventory. | Stock rendah | Item ditandai low stock. | P1 | Functional | Not Run |
| TC-097 | Inventory | Stock mutation list | Mutasi tersedia. | 1. Buka stock mutations. 2. Filter produk/periode. | Filter valid | Mutasi tampil immutable dengan before/after. | P1 | Functional | Not Run |
| TC-098 | Stock Request | Create stock request valid | Login ADMIN_CABANG. | 1. Buka stock request. 2. Pilih items dan qty. 3. Submit. | Qty > 0 | Request PENDING dibuat. | P0 | Functional | Not Run |
| TC-099 | Stock Request | Create stock request without item | Login ADMIN_CABANG. | 1. Submit request kosong. | No items | Sistem menolak. | P0 | Negative | Not Run |
| TC-100 | Stock Request | Approve stock request | Request PENDING tersedia. | 1. Login ADMIN_MANAGER. 2. Approve request. | Approved qty valid | Status berubah approved/next status dan audit tercatat. | P0 | Functional | Not Run |
| TC-101 | Stock Request | Reject stock request requires reason | Request PENDING tersedia. | 1. Reject tanpa reason. | Reason kosong | Sistem menolak. | P1 | Negative | Not Run |
| TC-102 | Shipment | Create shipment from approved request | Request approved tersedia. | 1. Buat shipment. | Request approved | Shipment PREPARING dibuat. | P0 | Functional | Not Run |
| TC-103 | Shipment | Cannot create shipment from pending request | Request PENDING tersedia. | 1. Coba buat shipment. | Pending request | Sistem menolak. | P0 | Negative | Not Run |
| TC-104 | Shipment | Ship shipment | Shipment PREPARING tersedia. | 1. Isi data pengiriman. 2. Ship. | Shipment valid | Status SHIPPED dan shippedAt/by terisi. | P0 | Functional | Not Run |
| TC-105 | Shipment | Receive shipment full quantity | Shipment SHIPPED tersedia. | 1. Receive qty sama dengan sent. | Full received | Status received/approved sesuai flow, stok penerima bertambah. | P0 | Functional | Not Run |
| TC-106 | Shipment | Receive shipment shortage | Shipment SHIPPED tersedia. | 1. Receive qty kurang. 2. Isi notes. | Received < sent | Discrepancy/shortage tercatat. | P0 | Functional | Not Run |
| TC-107 | Shipment | Receive cannot exceed sent without rule | Shipment SHIPPED tersedia. | 1. Isi receivedQty > sentQty. | Received > sent | Sistem menolak atau membuat overstock sesuai flow yang valid. | P1 | Negative | Not Run |
| TC-108 | Overstock | Preview overstock deduction | Overstock tersedia. | 1. Buka overstock preview. | Overstock item | Preview tampil dan stok tidak berubah. | P1 | Functional | Not Run |
| TC-109 | Overstock | Final deduction creates mutation | Overstock tersedia. | 1. Lakukan deduction final. | Qty valid | Overstock berkurang dan stock mutation tercatat. | P1 | Functional | Not Run |
| TC-110 | Invoice | Generate invoice valid | Transaksi/paket tersedia. | 1. Generate invoice. | Item valid | Invoice number unik, item dan total benar. | P0 | Functional | Not Run |
| TC-111 | Invoice | Record full payment | Invoice pending tersedia. | 1. Record payment sebesar outstanding. | Amount = outstanding | Invoice paid/verified sesuai flow. | P0 | Functional | Not Run |
| TC-112 | Invoice | Record partial payment | Invoice pending tersedia. | 1. Record payment sebagian. | Amount < outstanding | Paid amount bertambah, remaining amount benar. | P1 | Functional | Not Run |
| TC-113 | Invoice | Overpayment blocked | Invoice pending tersedia. | 1. Record amount > outstanding. | Overpayment | Sistem menolak atau handling sesuai rule. | P0 | Negative | Not Run |
| TC-114 | Invoice | Cancel invoice valid | Invoice cancellable tersedia. | 1. Cancel invoice dengan reason. | Reason valid | Invoice CANCELLED dan tidak bisa dibayar. | P1 | Functional | Not Run |
| TC-115 | Invoice | Pay cancelled invoice blocked | Invoice CANCELLED tersedia. | 1. Record payment. | Cancelled invoice | Sistem menolak payment. | P0 | Negative | Not Run |
| TC-116 | Invoice | Download invoice PDF | Invoice tersedia. | 1. Klik download/cetak PDF. | Invoice valid | PDF/download tampil sesuai data invoice. | P1 | Functional | Not Run |
| TC-117 | Payment | Payment dashboard filter | Payment data tersedia. | 1. Buka payments. 2. Filter status/periode. | Status filter | Data pembayaran sesuai filter. | P1 | Functional | Not Run |
| TC-118 | Non-Therapy | Create non-therapy product | Login admin berwenang. | 1. Tambah produk non-terapi. | Nama/harga valid | Produk dibuat. | P1 | Functional | Not Run |
| TC-119 | Non-Therapy | Purchase non-therapy product | Produk aktif dan member tersedia. | 1. Buat pembelian produk. | Qty/harga valid | Transaksi dan invoice item dibuat. | P1 | Functional | Not Run |
| TC-120 | Non-Therapy | Inactive product cannot be purchased | Produk inactive tersedia. | 1. Coba purchase produk inactive. | Inactive product | Sistem menolak. | P1 | Negative | Not Run |
| TC-121 | Referral | Create referral code valid | Login admin berwenang. | 1. Tambah referral. | Code unik | Referral dibuat aktif. | P1 | Functional | Not Run |
| TC-122 | Referral | Duplicate referral code blocked | Referral existing tersedia. | 1. Buat kode sama. | Duplicate code | Sistem menolak. | P1 | Negative | Not Run |
| TC-123 | Referral | Incentive created after payment verify | Member punya referral dan paket verified. | 1. Verify payment paket member referral. | Referral incentive setting | Incentive record dibuat dengan amount benar. | P1 | Integration | Not Run |
| TC-124 | Referral | Incentive not created without referral | Member tanpa referral. | 1. Verify payment paket. | No referral | Tidak ada incentive record. | P1 | Functional | Not Run |
| TC-125 | Referral | Export incentive | Data incentive tersedia. | 1. Filter periode. 2. Export. | Periode valid | File export berisi data sesuai filter dan branch scope. | P1 | Functional | Not Run |
| TC-126 | Dashboard | Super admin dashboard | Login SUPER_ADMIN. | 1. Buka dashboard super admin. | Data sistem | System stats, health, activities, performance tampil. | P1 | Functional | Not Run |
| TC-127 | Dashboard | Admin manager dashboard scoped | Login ADMIN_MANAGER dengan cabang assigned. | 1. Buka dashboard. | Manager token | Data hanya cabang assigned. | P1 | Security | Not Run |
| TC-128 | Dashboard | Doctor dashboard | Login DOCTOR. | 1. Buka dashboard dokter. | Doctor token | Data klinis/tugas dokter tampil sesuai scope. | P1 | Functional | Not Run |
| TC-129 | Dashboard | Nurse dashboard | Login NURSE. | 1. Buka dashboard nakes. | Nurse token | Data sesi/tugas nakes tampil sesuai scope. | P1 | Functional | Not Run |
| TC-130 | Reports | Export sessions report | Data sesi tersedia. | 1. Buka reports. 2. Pilih session report. 3. Export. | Filter valid | File export sesuai filter. | P1 | Functional | Not Run |
| TC-131 | Reports | Export large report requires filter | Dataset besar. | 1. Export tanpa filter periode. | Filter kosong | Sistem meminta pembatasan atau tetap paginated sesuai rule. | P2 | Negative | Not Run |
| TC-132 | Audit Log | Audit log created on mutation | User melakukan update data. | 1. Update member/package/inventory. 2. Buka audit log. | Mutation valid | Audit log berisi actor, action, resource, branch, metadata. | P0 | Integration | Not Run |
| TC-133 | Audit Log | Audit log filter | Audit data tersedia. | 1. Filter by user/action/date. | Filter valid | Log sesuai filter. | P1 | Functional | Not Run |
| TC-134 | Audit Log | Sensitive data masked | Audit berisi perubahan sensitif. | 1. Buka/export audit. | Password/token fields | Data sensitif tidak tampil mentah. | P0 | Security | Not Run |
| TC-135 | Impersonation | Start impersonation authorized | Login SUPER_ADMIN/ADMIN_MANAGER. | 1. Pilih target user. 2. Start impersonation. | Target valid | Session berubah ke target, banner tampil, audit tercatat. | P0 | Security | Not Run |
| TC-136 | Impersonation | Nested impersonation blocked | Impersonation sedang aktif. | 1. Coba impersonate user lain. | Active impersonation | Sistem menolak nested impersonation. | P0 | Negative | Not Run |
| TC-137 | Impersonation | Stop impersonation | Impersonation aktif. | 1. Klik stop. | Active impersonation | Kembali ke actor asli dan audit tercatat. | P0 | Functional | Not Run |
| TC-138 | Notification | Send notification to member | Member tersedia. | 1. Buka detail member. 2. Kirim notifikasi. | Pesan valid | Notification dibuat/dikirim ke member. | P1 | Functional | Not Run |
| TC-139 | Notification | Notification list read/unread | Notifikasi tersedia. | 1. Buka notifications. 2. Mark read. | Notification unread | Status berubah menjadi read. | P2 | Functional | Not Run |
| TC-140 | Chat | Open chat page | Login staff. | 1. Buka chat. | Staff token | Halaman chat tampil atau under construction sesuai status fitur. | P3 | Functional | Not Run |
| TC-141 | File Management | Protected file access authorized | File member/sesi tersedia. | 1. Login user berhak. 2. Akses `/files/...`. | Valid token | File berhasil diakses. | P0 | Security | Not Run |
| TC-142 | File Management | Protected file access unauthorized | File milik cabang/member lain tersedia. | 1. Login user tidak berhak. 2. Akses file. | Invalid ownership/scope | Akses ditolak. | P0 | Security | Not Run |
| TC-143 | File Management | File not found | Token valid. | 1. Akses path file tidak ada. | Invalid path | API mengembalikan not found. | P1 | Negative | Not Run |
| TC-144 | API | 404 route not found | API berjalan. | 1. Call endpoint tidak ada. | `/api/v1/not-exist` | Response 404 `ROUTE_NOT_FOUND`. | P1 | API | Not Run |
| TC-145 | API | Validation error response | Endpoint dengan schema validation. | 1. Kirim body invalid. | Missing required field | Response error validasi konsisten. | P0 | API Negative | Not Run |
| TC-146 | API | Unauthorized without token | Endpoint protected. | 1. Call tanpa token. | No Authorization header | Response 401. | P0 | API Security | Not Run |
| TC-147 | API | Forbidden wrong role | Endpoint role protected. | 1. Call dengan token role salah. | Wrong role | Response 403. | P0 | API Security | Not Run |
| TC-148 | API | Branch access header/context | Endpoint branch-scoped. | 1. Call dengan branch ID di luar akses. | X-Branch-Id invalid | Response forbidden atau data kosong sesuai design. | P0 | API Security | Not Run |
| TC-149 | UX | Loading state on slow request | Simulasikan network lambat. | 1. Buka list besar. | Slow network | Loading indicator tampil dan UI tidak freeze. | P2 | UX | Not Run |
| TC-150 | UX | Empty state list | Dataset kosong. | 1. Buka list kosong. | No data | Empty state jelas tampil. | P2 | UX | Not Run |
| TC-151 | UX | Error state API failure | Simulasikan API error. | 1. Buka halaman. | API 500 | Pesan error tampil, page tidak blank. | P1 | UX Negative | Not Run |
| TC-152 | UX | Destructive action confirmation | Data yang bisa dihapus tersedia. | 1. Klik delete/cancel/refund. | Any destructive action | Confirm dialog tampil sebelum aksi diproses. | P1 | UX | Not Run |
| TC-153 | UX | Responsive member list mobile | Jalankan viewport mobile. | 1. Buka member list. | 375px width | Layout tidak overlap, action tetap usable. | P2 | Responsive | Not Run |
| TC-154 | UX | Responsive session workflow mobile | Jalankan viewport mobile. | 1. Buka detail sesi. 2. Navigasi step. | 375px width | Step workflow tetap usable tanpa teks terpotong. | P2 | Responsive | Not Run |
| TC-155 | UX | Keyboard navigation modal | Modal tersedia. | 1. Navigasi dengan Tab/Esc/Enter. | Keyboard only | Fokus berpindah benar dan modal bisa ditutup/disubmit. | P2 | Accessibility | Not Run |
| TC-156 | Security | XSS input sanitized | Form catatan tersedia. | 1. Isi script tag. 2. Simpan dan tampilkan ulang. | `<script>alert(1)</script>` | Script tidak dieksekusi. | P0 | Security | Not Run |
| TC-157 | Security | SQL injection attempt | Search/filter tersedia. | 1. Input payload SQL injection. | `' OR 1=1 --` | Query aman, data tidak bocor, tidak error DB mentah. | P0 | Security | Not Run |
| TC-158 | Security | Upload malicious extension blocked | Upload tersedia. | 1. Upload executable disguised. | `.exe`, wrong MIME | Upload ditolak. | P0 | Security | Not Run |
| TC-159 | Security | CORS blocked origin | API production config. | 1. Request dari origin tidak diizinkan. | Invalid Origin | CORS menolak request. | P1 | Security | Not Run |
| TC-160 | Performance | Member list pagination | Banyak member tersedia. | 1. Buka list. 2. Pindah halaman. | 1000+ members | Response cepat, pagination benar. | P1 | Performance | Not Run |
| TC-161 | Performance | Audit log pagination | Banyak audit log tersedia. | 1. Buka audit log. 2. Filter/paginate. | 10000+ logs | Response tetap stabil dan paginated. | P1 | Performance | Not Run |
| TC-162 | Performance | Inventory mutation large dataset | Banyak mutasi stok. | 1. Buka stock mutations. 2. Filter periode. | Large dataset | Query tidak timeout dan hasil benar. | P2 | Performance | Not Run |
| TC-163 | Integration | Full member journey | Environment seed lengkap. | 1. Register member. 2. Assign paket. 3. Upload/verify payment. 4. Create session. 5. Complete all steps. | Data valid | Member, paket, invoice, session, stok, audit seluruhnya konsisten. | P0 | E2E | Not Run |
| TC-164 | Integration | Inventory request to shipment flow | Cabang butuh stok. | 1. Create request. 2. Approve. 3. Create shipment. 4. Ship. 5. Receive. | Items valid | Status mengalir benar dan stok penerima bertambah. | P0 | E2E | Not Run |
| TC-165 | Integration | Referral incentive full flow | Referral aktif. | 1. Register member dengan referral. 2. Assign paket. 3. Verify payment. 4. Cek incentive. | Referral + package | Incentive amount benar dan immutable. | P1 | E2E | Not Run |
| TC-166 | Integration | Member portal payment proof flow | Member punya invoice pending. | 1. Member upload proof. 2. Staff verify. 3. Member cek status. | Payment proof valid | Status berubah di staff dan portal member. | P1 | E2E | Not Run |
| TC-167 | Deployment | Health check API | Server berjalan. | 1. Call `/health`. | N/A | Response status ok, timestamp, environment. | P0 | Ops | Not Run |
| TC-168 | Deployment | Environment variables missing | Jalankan app dengan env wajib kosong di test env. | 1. Start API. | Missing env | App gagal start dengan error konfigurasi jelas. | P0 | Ops Negative | Not Run |
| TC-169 | Deployment | Migration deploy | Database test tersedia. | 1. Jalankan migration deploy. | Migration files | Migration sukses tanpa data loss. | P0 | Ops | Not Run |
| TC-170 | Backup | Backup and restore smoke test | Backup tersedia. | 1. Restore ke environment test. 2. Validasi record utama. | Backup DB/storage | Data dan file dapat dipulihkan. | P0 | Ops | Not Run |

## Regression Smoke Pack

Jalankan minimal test berikut sebelum release:

- TC-001, TC-006, TC-009, TC-011
- TC-027, TC-033, TC-051, TC-056
- TC-066, TC-077, TC-082, TC-084
- TC-098, TC-100, TC-102, TC-105
- TC-110, TC-111, TC-132, TC-141
- TC-163, TC-164

