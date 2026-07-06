# Business Rules - RAHO ERP Management System

Last updated: 6 Juli 2026

Severity:
- Critical: wajib dipenuhi; pelanggaran dapat menyebabkan kebocoran data, data finansial/stok salah, atau proses operasional berhenti.
- High: penting untuk menjaga validitas proses bisnis dan kontrol operasional.
- Medium: meningkatkan kualitas proses, reporting, dan konsistensi pengalaman user.
- Low: aturan pendukung atau enhancement.

| Rule ID | Module | Rule | Severity |
| --- | --- | --- | --- |
| BR-001 | Authentication | User hanya dapat login dengan email dan password yang valid. | Critical |
| BR-002 | Authentication | Login gagal harus dibatasi dengan rate limit untuk mencegah brute force. | Critical |
| BR-003 | Authentication | Password wajib disimpan dalam bentuk hash, tidak boleh plain text. | Critical |
| BR-004 | Authentication | Token/session yang sudah logout atau expired tidak boleh dapat mengakses protected API. | Critical |
| BR-005 | Authentication | User yang tidak terautentikasi wajib diarahkan ke halaman login. | Critical |
| BR-006 | Authentication | Refresh token hanya boleh digunakan oleh user/session yang valid. | Critical |
| BR-007 | Authorization | Akses menu, page, dan API harus konsisten mengikuti role user. | Critical |
| BR-008 | Authorization | User tidak boleh melihat atau memodifikasi data di luar permission role-nya. | Critical |
| BR-009 | Authorization | Setiap endpoint protected wajib menjalankan authentication middleware. | Critical |
| BR-010 | Branch Access | Data cabang hanya boleh diakses oleh user yang memiliki akses ke cabang tersebut. | Critical |
| BR-011 | Branch Access | User multi-cabang wajib memiliki branch context aktif saat membuat data operasional. | High |
| BR-012 | Branch Access | Super admin dapat melihat data lintas cabang sesuai permission sistem. | High |
| BR-013 | Branch Access | Admin manager hanya boleh mengelola cabang yang ditugaskan kepadanya. | Critical |
| BR-014 | Branch Access | Doctor/nurse lintas cabang hanya boleh mengakses sesi/member di cabang assignment-nya. | Critical |
| BR-015 | User Management | Email user harus unik di seluruh sistem. | Critical |
| BR-016 | User Management | Pembuatan user/staff wajib menentukan role yang valid. | Critical |
| BR-017 | User Management | Staff cabang wajib memiliki minimal satu branch assignment aktif. | High |
| BR-018 | User Management | Perubahan role user wajib tercatat di audit log. | Critical |
| BR-019 | User Management | User inactive/deactivated tidak boleh login. | Critical |
| BR-020 | User Management | Credential sementara hanya boleh ditampilkan satu kali setelah dibuat/reset. | High |
| BR-021 | User Management | Reset password user hanya boleh dilakukan oleh role yang berwenang. | Critical |
| BR-022 | Impersonation | Impersonation hanya boleh dilakukan oleh super admin atau role berwenang. | Critical |
| BR-023 | Impersonation | Nested impersonation tidak diperbolehkan. | Critical |
| BR-024 | Impersonation | Saat impersonation aktif, sistem wajib menampilkan banner identitas actor asli. | High |
| BR-025 | Impersonation | Semua aksi selama impersonation wajib mencatat actor asli dan user yang diimpersonate. | Critical |
| BR-026 | Branch Management | Kode cabang harus unik. | Critical |
| BR-027 | Branch Management | Perubahan kode cabang tidak boleh merusak nomor member, sesi, invoice, atau histori transaksi lama. | Critical |
| BR-028 | Branch Management | Cabang inactive tidak boleh digunakan untuk transaksi atau pembuatan data baru. | High |
| BR-029 | Branch Management | Assignment admin manager ke cabang wajib tercatat audit log. | High |
| BR-030 | Member Management | Member number harus unik. | Critical |
| BR-031 | Member Management | Registrasi member wajib memiliki data identitas minimum sesuai form bisnis. | Critical |
| BR-032 | Member Management | Member wajib terhubung ke minimal satu cabang. | Critical |
| BR-033 | Member Management | Member hanya boleh diakses oleh staff yang memiliki branch access terkait. | Critical |
| BR-034 | Member Management | Nomor telepon/email member boleh mengikuti kebijakan duplikasi yang ditetapkan sistem, tetapi pencarian duplikasi harus tersedia. | Medium |
| BR-035 | Member Management | Perubahan data personal member wajib tercatat audit log. | High |
| BR-036 | Member Management | Member suspended tidak boleh dibuatkan sesi terapi baru. | Critical |
| BR-037 | Member Management | Member deceased tidak boleh dibuatkan transaksi layanan atau sesi baru. | Critical |
| BR-038 | Member Management | Perubahan status suspended/deceased wajib memiliki reason dan tanggal efektif. | High |
| BR-039 | Member Management | Dokumen member hanya boleh diupload oleh role yang berwenang. | High |
| BR-040 | Member Management | File dokumen member harus divalidasi tipe dan ukuran file. | High |
| BR-041 | Member Portal | Member hanya boleh melihat data miliknya sendiri. | Critical |
| BR-042 | Member Portal | Member tidak boleh mengubah data medis, paket, invoice, atau sesi secara langsung. | Critical |
| BR-043 | Member Portal | Upload bukti pembayaran oleh member hanya boleh untuk invoice/paket miliknya sendiri. | Critical |
| BR-044 | Member Portal | Detail sesi di portal member bersifat read-only. | High |
| BR-045 | Package Management | Paket baru harus dimulai dengan status PENDING_PAYMENT kecuali ada aturan aktivasi khusus. | Critical |
| BR-046 | Package Management | Paket PENDING_PAYMENT tidak boleh digunakan untuk sesi terapi. | Critical |
| BR-047 | Package Management | Paket hanya dapat ACTIVE setelah pembayaran diverifikasi. | Critical |
| BR-048 | Package Management | Paket ACTIVE dapat digunakan untuk sesi selama kuota dan masa berlaku masih valid. | Critical |
| BR-049 | Package Management | Paket EXPIRED tidak boleh digunakan untuk sesi baru. | Critical |
| BR-050 | Package Management | Paket CANCELLED tidak boleh dibayar atau digunakan. | Critical |
| BR-051 | Package Management | Paket REFUNDED tidak boleh digunakan untuk sesi baru. | Critical |
| BR-052 | Package Management | Paket PENDING_PAYMENT boleh diedit sebelum pembayaran diverifikasi. | High |
| BR-053 | Package Management | Paket ACTIVE/EXPIRED/CANCELLED/REFUNDED tidak boleh diedit langsung tanpa flow koreksi khusus. | Critical |
| BR-054 | Package Management | Cancel paket hanya diperbolehkan untuk paket PENDING_PAYMENT. | High |
| BR-055 | Package Management | Refund hanya diperbolehkan untuk paket ACTIVE sesuai permission. | High |
| BR-056 | Package Management | Nilai refund tidak boleh lebih besar dari nilai transaksi paket. | Critical |
| BR-057 | Package Management | Refund wajib memiliki reason. | High |
| BR-058 | Package Management | Used sessions tidak boleh melebihi total sessions paket. | Critical |
| BR-059 | Package Management | Sistem harus otomatis mengubah paket menjadi EXPIRED jika kuota habis atau tanggal berakhir terlewati. | Critical |
| BR-060 | Package Management | Bundle paket harus menjaga total harga, diskon, dan invoice item tetap konsisten. | Critical |
| BR-061 | Package Pricing | Harga paket aktif harus diambil dari pricing cabang yang berlaku saat transaksi dibuat. | Critical |
| BR-062 | Package Pricing | Perubahan harga baru tidak boleh mengubah histori transaksi lama. | Critical |
| BR-063 | Package Pricing | Harga paket tidak boleh bernilai negatif. | Critical |
| BR-064 | Package Pricing | Discount percentage harus berada pada rentang valid yang ditentukan sistem. | High |
| BR-065 | Package Pricing | Total akhir setelah diskon tidak boleh negatif. | Critical |
| BR-066 | Payment | Bukti pembayaran wajib terhubung ke paket/invoice yang valid. | Critical |
| BR-067 | Payment | Payment verification tidak boleh diproses lebih dari satu kali untuk transaksi yang sama. | Critical |
| BR-068 | Payment | Reject pembayaran wajib memiliki alasan. | High |
| BR-069 | Payment | Amount pembayaran tidak boleh lebih besar dari outstanding tanpa aturan overpayment. | Critical |
| BR-070 | Payment | Payment proof harus divalidasi tipe file, ukuran, dan ownership. | High |
| BR-071 | Invoice | Nomor invoice harus unik. | Critical |
| BR-072 | Invoice | Nomor invoice harus mengikuti format cabang/periode yang berlaku. | High |
| BR-073 | Invoice | Total invoice harus sama dengan total item setelah diskon dan pajak. | Critical |
| BR-074 | Invoice | Invoice cancelled tidak boleh dibayar lagi. | Critical |
| BR-075 | Invoice | Pembatalan invoice wajib memiliki reason dan audit log. | High |
| BR-076 | Invoice | Invoice member hanya boleh dilihat oleh member pemilik invoice atau staff yang berwenang. | Critical |
| BR-077 | Invoice | Invoice item harus menyimpan deskripsi, quantity, price, discount, dan subtotal. | High |
| BR-078 | Invoice | Invoice PDF harus merepresentasikan data invoice yang sama dengan sistem. | High |
| BR-079 | Treatment Session | Sesi terapi hanya boleh dibuat untuk member yang memiliki paket aktif dan eligible. | Critical |
| BR-080 | Treatment Session | Doctor tidak boleh membuat sesi terapi baru jika aturan role melarangnya. | High |
| BR-081 | Treatment Session | Setiap sesi wajib memiliki branch context. | Critical |
| BR-082 | Treatment Session | Nomor sesi harus unik dan mengikuti aturan penomoran cabang. | Critical |
| BR-083 | Treatment Session | Staff yang ditugaskan ke sesi harus memiliki akses ke cabang sesi. | Critical |
| BR-084 | Treatment Session | Session progress harus tersimpan per step agar data tidak hilang. | High |
| BR-085 | Treatment Session | Sesi hanya boleh completed jika step wajib sudah lengkap. | Critical |
| BR-086 | Treatment Session | Completion sesi harus menambah used session paket secara atomik. | Critical |
| BR-087 | Treatment Session | Completion sesi tidak boleh menghitung usage paket lebih dari satu kali. | Critical |
| BR-088 | Treatment Session | Sesi completed harus dikunci dari perubahan biasa. | Critical |
| BR-089 | Treatment Session | Koreksi sesi completed harus melalui flow koreksi khusus dengan audit log. | Critical |
| BR-090 | Diagnosis | Diagnosis hanya boleh dibuat/diubah oleh role klinis yang berwenang. | Critical |
| BR-091 | Diagnosis | Diagnosis wajib menyimpan author dan timestamp. | High |
| BR-092 | Diagnosis | ICD code yang dipilih harus berasal dari sumber/format yang valid. | High |
| BR-093 | Diagnosis | Perubahan diagnosis wajib tercatat di audit log. | High |
| BR-094 | Therapy Plan | Therapy plan hanya boleh dibuat/diubah oleh role yang berwenang. | Critical |
| BR-095 | Therapy Plan | Therapy plan wajib terhubung ke member atau sesi yang valid. | Critical |
| BR-096 | Therapy Plan | Therapy plan superseded tidak boleh digunakan untuk sesi baru. | Critical |
| BR-097 | Therapy Plan | Edit therapy plan wajib membuat versioning atau histori perubahan. | High |
| BR-098 | Therapy Plan | Bulk therapy plan tidak boleh melebihi kuota paket yang eligible. | Critical |
| BR-099 | Therapy Plan | Dosis dan substance therapy plan harus mengikuti field dan range valid yang ditetapkan. | High |
| BR-100 | Vital Signs | Vital sign sebelum dan sesudah terapi harus dibedakan berdasarkan timing. | High |
| BR-101 | Vital Signs | Nilai vital sign harus berada pada range valid atau diberi validasi/peringatan. | High |
| BR-102 | Vital Signs | Vital sign wajib menyimpan recordedBy dan timestamp. | High |
| BR-103 | Infusion | Pelaksanaan infus harus mengacu pada therapy plan aktif. | High |
| BR-104 | Infusion | Deviasi dosis/eksekusi dari therapy plan wajib memiliki catatan. | High |
| BR-105 | Infusion | Infusion record wajib menyimpan executor dan timestamp. | High |
| BR-106 | Material Usage | Material usage hanya boleh menggunakan inventory item cabang sesi. | Critical |
| BR-107 | Material Usage | Quantity material usage harus lebih besar dari 0. | Critical |
| BR-108 | Material Usage | Quantity material usage tidak boleh melebihi stok tersedia. | Critical |
| BR-109 | Material Usage | Material usage harus mengurangi stok dan membuat stock mutation secara atomik. | Critical |
| BR-110 | Material Usage | Material usage pada sesi completed tidak boleh dihapus tanpa flow koreksi. | Critical |
| BR-111 | Session Photo | Foto sesi hanya boleh diupload ke sesi yang valid dan dapat diakses user. | High |
| BR-112 | Session Photo | Foto sesi harus divalidasi tipe dan ukuran file. | High |
| BR-113 | Session Photo | Foto sesi wajib menyimpan uploadedBy dan timestamp. | Medium |
| BR-114 | Inventory | Master product code/nama harus unik sesuai kebijakan sistem. | Critical |
| BR-115 | Inventory | Produk inactive tidak boleh dipakai untuk transaksi inventory baru. | High |
| BR-116 | Inventory | Current stock tidak boleh menjadi negatif. | Critical |
| BR-117 | Inventory | Semua perubahan stock wajib menghasilkan stock mutation. | Critical |
| BR-118 | Inventory | Stock mutation bersifat immutable. | Critical |
| BR-119 | Inventory | Stock mutation wajib menyimpan quantity before dan after. | Critical |
| BR-120 | Inventory | Stock adjustment harus dilakukan oleh role yang berwenang. | Critical |
| BR-121 | Inventory | Low stock alert aktif jika current stock <= minimum threshold. | Medium |
| BR-122 | Inventory | Unit conversion harus digunakan konsisten saat request, usage, dan stock update. | Critical |
| BR-123 | Stock Request | Stock request hanya boleh dibuat oleh cabang yang berwenang. | Critical |
| BR-124 | Stock Request | Stock request wajib memiliki minimal satu item. | Critical |
| BR-125 | Stock Request | Quantity request harus lebih besar dari 0. | Critical |
| BR-126 | Stock Request | Stock request baru harus berstatus PENDING. | High |
| BR-127 | Stock Request | Request yang sudah approved/rejected tidak boleh diedit sembarangan. | High |
| BR-128 | Stock Request | Reject stock request wajib memiliki reason. | High |
| BR-129 | Stock Request | Approved quantity tidak boleh lebih besar dari requested quantity tanpa aturan khusus. | High |
| BR-130 | Shipment | Shipment hanya boleh dibuat dari stock request yang valid/approved. | Critical |
| BR-131 | Shipment | Shipment wajib memiliki source branch dan destination branch yang valid. | Critical |
| BR-132 | Shipment | Shipment status harus mengikuti alur status yang ditentukan sistem. | Critical |
| BR-133 | Shipment | Stok destination branch hanya boleh bertambah setelah shipment diterima/diapprove sesuai flow. | Critical |
| BR-134 | Shipment | Shortage harus dicatat jika quantity diterima kurang dari quantity dikirim. | High |
| BR-135 | Shipment | Shipment yang sudah final tidak boleh diubah tanpa flow koreksi. | Critical |
| BR-136 | Overstock | Overstock deduction preview tidak boleh langsung mengubah stok. | High |
| BR-137 | Overstock | Deduction final wajib membuat stock mutation. | Critical |
| BR-138 | Non-Therapy | Produk non-terapi inactive tidak boleh dibeli. | High |
| BR-139 | Non-Therapy | Pembelian non-terapi wajib menghasilkan invoice atau invoice item. | High |
| BR-140 | Non-Therapy | Harga produk non-terapi tidak boleh negatif. | Critical |
| BR-141 | Referral | Referral code harus unik. | Critical |
| BR-142 | Referral | Referral code harus aktif saat dipakai registrasi member. | High |
| BR-143 | Referral | Member tidak boleh melakukan self-referral jika sistem dapat mendeteksinya. | High |
| BR-144 | Referral | Incentive referral dihitung saat pembayaran paket berhasil diverifikasi. | High |
| BR-145 | Referral | Incentive yang sudah dibuat tidak boleh berubah karena perubahan setting referral di masa depan. | Critical |
| BR-146 | Referral | Export incentive harus mengikuti filter branch/periode dan permission user. | High |
| BR-147 | Dashboard | Dashboard harus menampilkan data sesuai role user. | High |
| BR-148 | Dashboard | Dashboard harus mengikuti branch scope user. | Critical |
| BR-149 | Dashboard | Filter tanggal/periode harus diterapkan konsisten pada metric dan chart. | Medium |
| BR-150 | Reports | Export report harus menghasilkan data yang sama dengan filter UI. | High |
| BR-151 | Reports | Report lintas cabang hanya boleh diakses oleh role yang berwenang. | Critical |
| BR-152 | Reports | Scheduled report hanya boleh dibuat oleh role yang berwenang. | High |
| BR-153 | Audit Log | Semua mutation penting wajib membuat audit log. | Critical |
| BR-154 | Audit Log | Audit log wajib menyimpan actor, action, resource, timestamp, dan metadata relevan. | Critical |
| BR-155 | Audit Log | Audit log tidak boleh menyimpan password, token, secret, atau data sensitif mentah. | Critical |
| BR-156 | Audit Log | Audit log harus dapat difilter berdasarkan user, action, resource, branch, dan date range. | High |
| BR-157 | Audit Log | Export audit log harus melakukan masking data sensitif. | Critical |
| BR-158 | File Management | File hanya boleh diakses oleh user yang memiliki auth dan permission valid. | Critical |
| BR-159 | File Management | Upload gagal tidak boleh meninggalkan database record tanpa file valid. | High |
| BR-160 | File Management | File storage path harus menghindari tabrakan nama file. | High |
| BR-161 | File Management | File invoice, payment proof, lab result, dokumen member, dan foto sesi harus memiliki ownership/context. | Critical |
| BR-162 | File Management | Orphan file harus dapat dibersihkan melalui proses yang aman. | Medium |
| BR-163 | Notification | Notifikasi hanya boleh dikirim ke penerima yang valid. | High |
| BR-164 | Notification | Notifikasi member harus terkait member yang benar. | Critical |
| BR-165 | Notification | Status pengiriman eksternal harus dicatat sebagai success/failed/pending. | Medium |
| BR-166 | Notification | Retry pengiriman eksternal harus dibatasi agar tidak spam. | Medium |
| BR-167 | Chat | Chat staff harus mengikuti role dan branch scope. | High |
| BR-168 | Chat | Pesan chat tidak boleh terlihat oleh user yang bukan peserta/role berwenang. | Critical |
| BR-169 | API | Semua API mutation wajib melakukan input validation. | Critical |
| BR-170 | API | Response error API harus konsisten dan tidak membocorkan stack trace di production. | Critical |
| BR-171 | API | API list besar wajib menggunakan pagination. | High |
| BR-172 | API | Query yang menerima filter branch harus memvalidasi branch access. | Critical |
| BR-173 | API | Body request tidak boleh melebihi limit yang ditentukan. | High |
| BR-174 | Database | Operasi multi-table untuk payment, package, session, dan inventory wajib transactional. | Critical |
| BR-175 | Database | Foreign key dan constraint harus menjaga integritas relasi utama. | Critical |
| BR-176 | Database | Data historis transaksi tidak boleh diubah tanpa jejak audit. | Critical |
| BR-177 | Database | Field uang/quantity tidak boleh menerima nilai invalid seperti negatif jika tidak sesuai konteks. | Critical |
| BR-178 | Security | CORS hanya boleh mengizinkan origin yang dikonfigurasi. | High |
| BR-179 | Security | Upload file harus membatasi tipe file yang diizinkan. | High |
| BR-180 | Security | Data sensitif harus dimasking di log, audit, dan export. | Critical |
| BR-181 | Security | Endpoint admin hanya boleh diakses role admin yang berwenang. | Critical |
| BR-182 | UX | User tidak boleh melihat action button yang pasti ditolak permission. | Medium |
| BR-183 | UX | Action destruktif wajib memakai konfirmasi. | High |
| BR-184 | UX | Action destruktif penting wajib memiliki reason jika berdampak ke transaksi/data medis. | High |
| BR-185 | UX | Loading, success, empty, dan error state harus tersedia pada flow utama. | Medium |
| BR-186 | UX | Error validasi harus ditampilkan dekat field atau action terkait. | Medium |
| BR-187 | Testing | Flow P0 wajib memiliki regression test atau test scenario yang terdokumentasi. | High |
| BR-188 | Testing | Seed testing harus dapat membuat data untuk semua role utama. | High |
| BR-189 | Testing | E2E role simulation harus memverifikasi branch access dan permission. | Critical |
| BR-190 | Deployment | Environment production tidak boleh menggunakan secret default/example. | Critical |
| BR-191 | Deployment | Database harus dibackup sebelum migration production. | Critical |
| BR-192 | Deployment | Migration production harus dapat diulang/ditelusuri dan memiliki rollback plan. | Critical |
| BR-193 | Deployment | Health check harus tersedia untuk memverifikasi API berjalan. | High |
| BR-194 | Deployment | Log production harus cukup untuk troubleshooting tanpa membocorkan secret. | High |
| BR-195 | Backup | Backup database dan file storage harus dilakukan berkala. | Critical |
| BR-196 | Backup | Restore backup harus diuji secara berkala. | Critical |
| BR-197 | Compliance | Data medis hanya boleh diakses oleh user yang memiliki kebutuhan operasional/klinis. | Critical |
| BR-198 | Compliance | Perubahan data medis wajib memiliki jejak author dan timestamp. | Critical |
| BR-199 | Compliance | Data finansial tidak boleh dimodifikasi tanpa audit trail. | Critical |
| BR-200 | Compliance | Export data harus mengikuti permission role dan branch scope. | Critical |

