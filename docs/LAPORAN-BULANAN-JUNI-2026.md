# Laporan Bulanan Pengembangan RAHO APPS — Juni 2026

**Periode laporan:** 1–30 Juni 2026 (Asia/Jakarta)  
**Developer yang diaudit:** Etherlyvan / Jovan (`jovanku1@gmail.com`)  
**Repository:** [Etherlyvan/RAHO_APPS](https://github.com/Etherlyvan/RAHO_APPS)  
**Tanggal audit:** 5 Juli 2026  
**Commit akhir periode:** [`c0a334e`](https://github.com/Etherlyvan/RAHO_APPS/commit/c0a334ebf02dc42b32e72d1627237314aef1829e)

> Laporan ini dibuat dari object Git lokal pada seluruh ref (`git log --all`), statistik diff setiap commit, file yang benar-benar berubah, migration, test, dan dokumentasi di repository. Halaman repository tidak dapat dibaca sebagai repository publik dan GitHub CLI tidak tersedia di lingkungan audit. Karena itu, laporan tidak mengklaim data PR, issue, review, deployment, atau status CI yang tidak dapat dibuktikan dari Git lokal.

## 1. Ringkasan Eksekutif

Selama Juni 2026, pekerjaan berfokus pada perluasan workflow klinik dari ujung ke ujung: data member dan rekam medis, therapy plan dan sesi terapi, inventory serta distribusi stok, pengelolaan cabang dan staff, paket serta pembayaran, audit trail, UI responsif, dan fondasi automated E2E testing.

Kontribusi tercatat atas identitas Git Anda sebanyak **75 commit**, terdiri dari **68 commit non-merge** dan **7 merge commit**, pada **21 hari aktif**. Seluruh 75 commit tersebut masih menjadi ancestor branch `main` saat audit dilakukan. Dibanding seluruh 88 commit repository pada periode yang sama, identitas Anda menyumbang **85,2% catatan commit**. Angka ini menunjukkan proporsi commit, bukan pengukuran jam kerja atau besarnya kontribusi manusia.

Hasil paling menonjol pada bulan ini:

- Menambahkan dan memperluas workflow therapy plan: bulk creation, edit/versioning, therapy-plan set, zat IFA, kategori diagnosis, serta integrasi ke sesi dan invoice.
- Menambahkan fitur hasil laboratorium dan upload dokumen member (PSP/foto profil), serta memperluas tampilan dan pengeditan data member.
- Membangun alur inventory yang lebih lengkap: histori mutasi, request, approval, shipment, kekurangan kiriman, cicilan pembayaran request stok, bukti penerimaan, notifikasi, dan histori pemakaian material.
- Memperluas manajemen multi-cabang untuk dokter/staff, branch switcher, harga paket per cabang, penghapusan cabang, dan force delete dengan konfirmasi dampak.
- Memperkuat audit log dan menambahkan fondasi Playwright E2E dengan 9 spec file, fixture autentikasi, page objects, helper, dan konfigurasi runner.
- Menghasilkan dokumentasi teknis dan operasional yang luas, tetapi beberapa dokumen bersifat rencana/panduan dan tidak boleh dianggap otomatis sebagai fitur yang telah terimplementasi.

## 2. Metodologi dan Batas Akurasi

### 2.1 Sumber bukti

- Identitas developer dicocokkan dengan `git config user.name` dan `git config user.email`.
- Commit dihitung memakai seluruh ref Git untuk periode 1–30 Juni 2026 zona waktu Asia/Jakarta.
- Merge commit dihitung sebagai aktivitas kolaborasi, tetapi dikeluarkan dari statistik churn agar perubahan dari parent tidak dihitung ulang sebagai implementasi pribadi.
- Deskripsi fitur diturunkan dari diff dan path aktual, tidak hanya dari commit message yang beberapa di antaranya singkat atau tidak menggambarkan seluruh isi commit.
- Referensi `main` dan referensi lokal `origin/main` menunjukkan `0/0` divergence pada saat audit. Ini bukan pengganti `git fetch` terbaru dari server GitHub.
- Working tree bersih sebelum file laporan ini dibuat; perubahan Juli 2026 tidak dimasukkan ke metrik Juni.

### 2.2 Arti status dalam laporan

- **Terimplementasi di codebase:** terdapat perubahan source/API/UI/schema yang dapat ditunjuk.
- **Test ditambahkan:** file test atau skenario otomatis ditambahkan; tidak berarti seluruh suite telah dijalankan atau lulus.
- **Terdokumentasi:** panduan/proposal/checklist tersedia; tidak otomatis membuktikan implementasi runtime.
- **Perlu verifikasi runtime:** code ada, tetapi laporan ini tidak mengklaim deployment produksi atau hasil pengujian historis tanpa log CI/test yang dapat diaudit.

## 3. Metrik Kontribusi

### 3.1 Aktivitas Git

| Metrik | Nilai | Catatan |
|---|---:|---|
| Total commit repository selama Juni | 88 | Semua author pada seluruh ref |
| Commit atas identitas Etherlyvan | 75 | 85,2% dari catatan commit periode ini |
| Commit non-merge Etherlyvan | 68 | Digunakan untuk statistik churn |
| Merge commit Etherlyvan | 7 | Aktivitas integrasi, tidak dihitung ke churn |
| Hari aktif | 21 hari | Aktivitas pertama 2 Juni, terakhir 30 Juni |
| Rata-rata commit per hari aktif | 3,6 | 75 / 21 |
| Path unik yang disentuh | 575 | Dapat mencakup source, data, docs, dan konfigurasi |
| Penambahan bruto | 235.029 baris | Churn lintas commit, bukan LOC final |
| Penghapusan bruto | 88.142 baris | Termasuk seed sementara yang kemudian dihapus |
| Total churn bruto | 323.171 baris | Harus dibaca bersama segmentasi di bawah |

Kontributor lain pada periode yang sama tercatat sebagai DawudRizky sebanyak 12 commit dan `github-actions[bot]` sebanyak 1 commit. Pekerjaan mereka tidak dimasukkan sebagai pekerjaan pribadi Anda di bagian deliverables.

### 3.2 Segmentasi churn

| Kategori | File unik | Churn | Interpretasi |
|---|---:|---:|---|
| Data generated/seed | 48 | 202.461 | Didominasi dataset ICD/wilayah dan seed besar yang sempat ditambahkan lalu sebagian dihapus |
| Dokumentasi Markdown | 139 | 48.691 | Panduan, summary, checklist, proposal, dan dokumentasi E2E |
| Source aplikasi web | 198 | 44.347 | Next.js pages, components, hooks, API clients, styling |
| Source aplikasi API | 93 | 13.864 | Controller, service, route, middleware, utility |
| Kode E2E | 21 | 6.058 | Spec, fixture, helper, dan page objects Playwright |
| Tooling/assets/other | 43 | 5.925 | Script, config, asset, dan file pendukung |
| Unit/integration test | 7 | 835 | Enam test API dan satu test komponen web |
| Schema dan migration | 24 | 729 | Prisma schema dan migration SQL |
| Lockfile | 2 | 261 | Perubahan dependency lock |

Jika data generated/seed dan dokumentasi dipisahkan, churn yang langsung terkait source aplikasi, database, dan automated test adalah sekitar **65.833 baris**. Angka tetap merupakan churn bruto: baris yang diedit berkali-kali dapat terhitung lebih dari sekali.

### 3.3 Distribusi aktivitas

| Periode | Commit | Fokus utama |
|---|---:|---|
| 1–7 Juni | 15 | Perbaikan TypeScript, audit log, pembayaran paket, dashboard super admin, sesi, login/rate limit |
| 8–14 Juni | 10 | Histori mutasi stok, request modal, dokumen member, lab result, multi-cabang, bulk therapy plan, mobile UI |
| 15–21 Juni | 13 | Download lab, therapy plan/substances, diagnosis, inventory, pricing per cabang, therapy-plan set, pembayaran paket |
| 22–28 Juni | 19 | Shipment/request stok, partial payment, branch deletion, session edit, member edit, kolom tabel, force delete |
| 29–30 Juni | 18 | Bukti penerimaan, notifikasi, loading system, material usage, create session, audit trail, Playwright E2E |

Hari dengan aktivitas tertinggi adalah 30 Juni (11 commit), 23 Juni (8 commit), serta 2 dan 29 Juni (masing-masing 7 commit).

## 4. Deliverables Utama

### 4.1 Member, rekam medis, dan dokumen

1. **Kelengkapan profil dan dashboard member**
   - Memperbaiki query active member dan menambahkan dukungan field agama pada alur member.
   - Memperluas profil, export, serta data yang dikonsumsi portal member.
   - Bukti: [`7d5567c`](https://github.com/Etherlyvan/RAHO_APPS/commit/7d5567ce2721efe0458669adcbe6b736ef6c7540), [`e752d97`](https://github.com/Etherlyvan/RAHO_APPS/commit/e752d97b883103084b6cd689e99a8c25c5e003b5).

2. **Aturan nomor telepon member**
   - Mengubah registration service agar nomor telepon tidak diperlakukan sebagai unique account identifier yang menghalangi pendaftaran anggota keluarga/nomor bersama.
   - Bukti: [`56f7a71`](https://github.com/Etherlyvan/RAHO_APPS/commit/56f7a71fe8105372a6bb3045034786bfb63fc066).

3. **Upload dokumen member**
   - Menambahkan modal upload PSP/informed-consent dan foto profil, endpoint/service member, validasi tipe file, integrasi ke detail member, serta dokumentasi API dan testing manual.
   - Bukti: [`0116d2a`](https://github.com/Etherlyvan/RAHO_APPS/commit/0116d2a7b13b5e1dde3375a68bb66354decf846f).

4. **Hasil laboratorium**
   - Menambahkan model/migration `LabResult`, service backend, route/controller, API client, tab hasil lab, serta permission upload/view/delete.
   - Memperbaiki jalur download file melalui file service agar file lab dapat diambil lewat API.
   - Bukti utama: [`ac213b3`](https://github.com/Etherlyvan/RAHO_APPS/commit/ac213b325a86853126f3bdf08f772c1fd3db5fb9), [`603599d`](https://github.com/Etherlyvan/RAHO_APPS/commit/603599df029af6989bde12acaa712b601ed01b88).

5. **Diagnosis dan status medis**
   - Menambahkan kemampuan edit diagnosis oleh role yang diizinkan, memperluas kategori diagnosis, dan kemudian mendukung multiple diagnosis categories.
   - Menambahkan status member meninggal dan menyesuaikan retrieval/profile terkait.
   - Bukti: [`ac213b3`](https://github.com/Etherlyvan/RAHO_APPS/commit/ac213b325a86853126f3bdf08f772c1fd3db5fb9), [`e752d97`](https://github.com/Etherlyvan/RAHO_APPS/commit/e752d97b883103084b6cd689e99a8c25c5e003b5), [`9cac026`](https://github.com/Etherlyvan/RAHO_APPS/commit/9cac0260524c394540ac5f36dc7c55b8175f8f65).

6. **Edit member dan tabel yang dapat dikustomisasi**
   - Menambahkan modal edit member, pengaturan edit email oleh super admin, konfigurasi kolom tabel member, cell renderer, serta penyelarasan data export/retrieval.
   - Bukti: [`7ba3db2`](https://github.com/Etherlyvan/RAHO_APPS/commit/7ba3db27b13ce4058102e90b9f683b2ada0a8988), [`f8eeeb8`](https://github.com/Etherlyvan/RAHO_APPS/commit/f8eeeb89878af2cfaed8b851917203035f402405), [`46e7128`](https://github.com/Etherlyvan/RAHO_APPS/commit/46e7128dbb464904e05ece34be5f5d8bbc9b4ad5).

### 4.2 Therapy plan dan sesi terapi

1. **Perbaikan workflow sesi awal bulan**
   - Memperbaiki validasi, penomoran sesi, pembuatan sesi, tampilan cabang pada sesi, serta membuang backup/debug artifacts yang tidak diperlukan.
   - Bukti: [`25410e8`](https://github.com/Etherlyvan/RAHO_APPS/commit/25410e8cf10509cfd30afd3e31a3072e6691b90d), [`7417117`](https://github.com/Etherlyvan/RAHO_APPS/commit/7417117acb761a31049e87986d69f16ebe656961).

2. **Bulk therapy plan dan versioning**
   - Menambahkan bulk service, schema, route/controller, modal tabel, copy/quick actions, edit plan, versioning/superseded state, serta integrasi saat membuat sesi.
   - Bukti: [`4439e9c`](https://github.com/Etherlyvan/RAHO_APPS/commit/4439e9c1439c74f102173ece6e85ae5a97261ec3), [`ec5b23c`](https://github.com/Etherlyvan/RAHO_APPS/commit/ec5b23c269d4887aa5d4ab843a2520d08627fed6).

3. **Zat IFA dan struktur dosis**
   - Menambah migration dan utility untuk zat IFA serta field terkait, komponen editor/table therapy plan, dan penyelarasan invoice, package assignment, medical record, serta portal member.
   - Bukti: [`da0fccd`](https://github.com/Etherlyvan/RAHO_APPS/commit/da0fccde5a97dce978bf5d7dc7815226d17f865a).

4. **Therapy-plan set**
   - Menambah model/migration set, bulk edit set service, modal edit set, dan integrasi set ke member serta sesi.
   - Bukti: [`9cac026`](https://github.com/Etherlyvan/RAHO_APPS/commit/9cac0260524c394540ac5f36dc7c55b8175f8f65), [`1113d81`](https://github.com/Etherlyvan/RAHO_APPS/commit/1113d81ee567c648aa40c730b7b0f6936c4172a3).

5. **Dokumentasi klinis dan supporting photos**
   - Menambah keluhan/rekomendasi pada evaluasi dokter, supporting photos service/API, UI upload/tampil foto, dan penyesuaian export/detail sesi.
   - Bukti: [`1113d81`](https://github.com/Etherlyvan/RAHO_APPS/commit/1113d81ee567c648aa40c730b7b0f6936c4172a3), [`61eb3e3`](https://github.com/Etherlyvan/RAHO_APPS/commit/61eb3e39effb60287f33048e3421873391fe347e).

6. **Edit sesi dan branch context**
   - Memperbaiki retrieval/edit therapy plan pada sesi dan menambahkan test untuk branch context, therapy plan session, dan therapy-plan set session edit.
   - Bukti: [`f3b2362`](https://github.com/Etherlyvan/RAHO_APPS/commit/f3b236272f6853f1cfba1ef08dba2ba61848a068), [`cf6c24e`](https://github.com/Etherlyvan/RAHO_APPS/commit/cf6c24e03f10308b48f9855fb079c9d38937f485).

### 4.3 Inventory, stock request, dan shipment

1. **Histori mutasi stok**
   - Menambahkan endpoint histori mutasi, halaman stock mutations, filter/tampilan histori, API client, dan menu sidebar.
   - Bukti: [`bbd6760`](https://github.com/Etherlyvan/RAHO_APPS/commit/bbd67607b1498e72447dc58616069d2e4a72bad3).

2. **Perbaikan request stok**
   - Memperbaiki state create-request modal dan normalisasi input quantity.
   - Bukti: [`fb71adc`](https://github.com/Etherlyvan/RAHO_APPS/commit/fb71adc5183cfa8506bb57c8eff212bb47230908), [`e0de4e4`](https://github.com/Etherlyvan/RAHO_APPS/commit/e0de4e415490481e53d7391d6cb7c79066a22e94), [`29daa8d`](https://github.com/Etherlyvan/RAHO_APPS/commit/29daa8dbb9a9f4a91bad859fbf4d7aaf83cd0982).

3. **Mutation dan inventory fixes**
   - Memperbaiki retrieval shipment/mutation, controller/service inventory, tampilan inventory per cabang, dan error pada halaman stock mutations.
   - Bukti: [`8091e54`](https://github.com/Etherlyvan/RAHO_APPS/commit/8091e54afc3b5d9cff5657d2cad1545675579c4e), [`7f619fa`](https://github.com/Etherlyvan/RAHO_APPS/commit/7f619fa2937e8362100e650b34becd433597b6ce).

4. **Workflow shipment yang lebih lengkap**
   - Menambah edit request/shipment, notes, pengiriman kekurangan, approval processing, detail shipment, stock tab cabang, dan invoice request stok.
   - Bukti: [`e3558e5`](https://github.com/Etherlyvan/RAHO_APPS/commit/e3558e5f8cc06e8f0a411d6f7fe59d799dd269ca), [`df47b69`](https://github.com/Etherlyvan/RAHO_APPS/commit/df47b69d37b22f474bdac6e8a7bf10366c51bc5c).

5. **Partial payment request stok dan file bukti**
   - Menambahkan migration partial payments, review/upload payment modal, retrieval, file handling MinIO, dan status pembayaran request stok.
   - Bukti: [`e309bfa`](https://github.com/Etherlyvan/RAHO_APPS/commit/e309bfa9d91b46108935aabaf643541226b424f0).

6. **Bukti penerimaan barang**
   - Menambah field receipt melalui migration, upload file bukti penerimaan, receive modal, detail shipment, serta endpoint processing terkait.
   - Bukti: [`641c33a`](https://github.com/Etherlyvan/RAHO_APPS/commit/641c33aeb5e342bb2927b1bf87d34d128ffe77bf).

7. **Notifikasi manager dan detail pembayaran**
   - Menambahkan API client/hook notifikasi inventory manager, badge/navigation, halaman notifikasi, dan shortcut ke review/detail pembayaran request stok.
   - Bukti: [`5ec2264`](https://github.com/Etherlyvan/RAHO_APPS/commit/5ec22642a972709af3799656141d968007b8ee9e).

8. **Histori pemakaian material**
   - Menambah service/controller/routes histori penggunaan material, halaman khusus, API client, dan integrasi sidebar/loading.
   - Bukti: [`6d8011a`](https://github.com/Etherlyvan/RAHO_APPS/commit/6d8011a5dfb87542d6f4430d190f8d28c7e54497), [`6470217`](https://github.com/Etherlyvan/RAHO_APPS/commit/64702177c11e5d484e9123c27a4eb821d6d67166).

### 4.4 Cabang, staff, multi-branch, dan pricing

1. **Multi-branch assignment untuk tenaga medis**
   - Menambahkan doctor/staff branch services, admin-manager routes, halaman pengaturan cabang/dokter, branch switcher, assignment/unassign UI, dan penyesuaian dashboard/performance.
   - Bukti: [`ac213b3`](https://github.com/Etherlyvan/RAHO_APPS/commit/ac213b325a86853126f3bdf08f772c1fd3db5fb9).

2. **Branch-specific package pricing**
   - Menambah konsep harga global (`branchId = null`) dan harga khusus cabang, permission matrix, validasi cabang, prioritas harga, dan UI pengelolaan pricing.
   - Bukti: [`9cac026`](https://github.com/Etherlyvan/RAHO_APPS/commit/9cac0260524c394540ac5f36dc7c55b8175f8f65), [panduan pricing](./BRANCH-SPECIFIC-PRICING-GUIDE.md).

3. **Penghapusan cabang**
   - Menambah penghapusan cabang terkontrol, test service/controller terkait member, lalu force-delete flow dengan modal konfirmasi dan penanganan dependensi.
   - Bukti: [`f901fec`](https://github.com/Etherlyvan/RAHO_APPS/commit/f901fecbb188d2ed972f5d23c62c6fe7500b5512), [`b89278f`](https://github.com/Etherlyvan/RAHO_APPS/commit/b89278f6afdb42812740ea0c060e87b4c4e24dac).

4. **Administrasi staff/member**
   - Menambah edit email staff, edit email member untuk super admin, penyesuaian role pada tabel staff, dan perbaikan generator staff code.
   - Bukti: [`484e957`](https://github.com/Etherlyvan/RAHO_APPS/commit/484e9576eeccc8ef160929a9df46abcdad3645df), [`f8eeeb8`](https://github.com/Etherlyvan/RAHO_APPS/commit/f8eeeb89878af2cfaed8b851917203035f402405), [`3449388`](https://github.com/Etherlyvan/RAHO_APPS/commit/34493887612b8dffa39d1fd6166f7074b5ae2472).

### 4.5 Paket, invoice, dan pembayaran

1. **Verifikasi pembayaran paket**
   - Menambah status/field verifikasi dan rejection, endpoint portal member, upload proof UI, modal verifikasi, dan perbaikan error gambar/HTTP 422 pada alur pembayaran.
   - Bukti: [`44d676b`](https://github.com/Etherlyvan/RAHO_APPS/commit/44d676b99da34f95f7af1e0b3e93187f9b649685), [`113dddb`](https://github.com/Etherlyvan/RAHO_APPS/commit/113dddb10ba4e347f7c2c5eb1d72ae327f1e18b0), [`6a82233`](https://github.com/Etherlyvan/RAHO_APPS/commit/6a822333bf071ace76b02e2e8a57a5ac7e169e56).

2. **Package assignment, pricing, dan invoice**
   - Menyelaraskan pilihan booster/basic package, pricing per cabang, package assignment, invoice generation/retrieval, PDF invoice, diskon, dan tampilan bukti pembayaran.
   - Bukti: [`da0fccd`](https://github.com/Etherlyvan/RAHO_APPS/commit/da0fccde5a97dce978bf5d7dc7815226d17f865a), [`9cac026`](https://github.com/Etherlyvan/RAHO_APPS/commit/9cac0260524c394540ac5f36dc7c55b8175f8f65), [`1113d81`](https://github.com/Etherlyvan/RAHO_APPS/commit/1113d81ee567c648aa40c730b7b0f6936c4172a3), [`9bc8506`](https://github.com/Etherlyvan/RAHO_APPS/commit/9bc8506ecd19901ee90592d3547d5d04c3ed3b0f).

3. **Cicilan pembayaran paket**
   - Menambah migration package installment payment flow dan memperbarui schema, verification service, package card, invoice document, serta modal assignment/payment.
   - Bukti: [`1113d81`](https://github.com/Etherlyvan/RAHO_APPS/commit/1113d81ee567c648aa40c730b7b0f6936c4172a3).

### 4.6 Authentication, authorization, dan audit trail

1. **Rate-limit feedback pada login**
   - Memperbaiki rate limiter serta pesan/durasi retry pada login UI, bersamaan dengan perbaikan validasi vital signs.
   - Bukti: [`daa211b`](https://github.com/Etherlyvan/RAHO_APPS/commit/daa211b1720689e7d9db4782e611d9aee4ebf610).
   - Catatan: commit ini juga menambahkan dokumen rancangan account lockout/CAPTCHA, tetapi diff source tidak cukup untuk mengklaim seluruh rancangan tersebut telah diimplementasikan.

2. **Audit log authentication dan user management**
   - Memperluas audit actions dan pencatatan pada auth/user controller/service serta menambahkan coverage/quick-reference documentation.
   - Bukti: [`811b5b8`](https://github.com/Etherlyvan/RAHO_APPS/commit/811b5b80ba89443ce12a07fb3ae8069034b2d0a0), [`dcab37d`](https://github.com/Etherlyvan/RAHO_APPS/commit/dcab37d1d74c7b1b511177c2e9b4e75b816804c4).

3. **Audit trail upgrade**
   - Menambah migration audit trail, perubahan audit controller/routes/utility, integrasi login/payment verification, dan perluasan UI audit-log.
   - Bukti: [`2a3e511`](https://github.com/Etherlyvan/RAHO_APPS/commit/2a3e511961999d62f5f52283b03ccaebb599fe82).

4. **Audit untuk akun yang terhapus**
   - Mengubah relasi audit user agar nullable dan menyesuaikan auth/audit utility agar histori dapat dipertahankan ketika user dihapus.
   - Bukti: [`1e29e76`](https://github.com/Etherlyvan/RAHO_APPS/commit/1e29e76958cb9444e76b063196254613ffc1230b).

### 4.7 UI/UX, responsivitas, dan loading

1. **Mobile/iPhone responsiveness**
   - Memperbaiki global styles, voucher page, modal/member components, horizontal overflow, touch behavior, dan layout mobile.
   - Bukti: [`f23e62a`](https://github.com/Etherlyvan/RAHO_APPS/commit/f23e62a4536f4a03698700199b8da8c71038d8a6), [`4a91237`](https://github.com/Etherlyvan/RAHO_APPS/commit/4a91237964dbfa940a684d71b95c72c7c753d320).

2. **Dashboard dan data operasional**
   - Memodernisasi dashboard super admin, memperbaiki system stats, serta membetulkan sumber data revenue/inventory dashboard.
   - Bukti: [`6a82233`](https://github.com/Etherlyvan/RAHO_APPS/commit/6a822333bf071ace76b02e2e8a57a5ac7e169e56), [`66617bf`](https://github.com/Etherlyvan/RAHO_APPS/commit/66617bf0e45dd83395920416a6aaf97fee06af43), [`fae3b5a`](https://github.com/Etherlyvan/RAHO_APPS/commit/fae3b5ae6abecd172aaf5ec8766b9e0fd44f9967).

3. **Loading system**
   - Menambah reusable loading spinner, login animation, global loading context/overlay, skeleton loader, button state, API-loading tracking, dan menerapkannya pada banyak halaman staff.
   - Bukti: [`08407aa`](https://github.com/Etherlyvan/RAHO_APPS/commit/08407aaea45c87ce864a23c4fb2ae1f4b4e9b3e0), [`6d8011a`](https://github.com/Etherlyvan/RAHO_APPS/commit/6d8011a5dfb87542d6f4430d190f8d28c7e54497).

### 4.8 Data referensi dan database

- Memperkenalkan **23 migration file** dalam commit yang dibuat selama Juni. Satu folder migration bernama tanggal Mei (`20260529100000...`) tetapi baru masuk Git melalui commit Juni, sehingga tetap dihitung sebagai deliverable Git Juni.
- Area migration meliputi agama member, payment verification/rejection, lab result, therapy-plan versioning, zat IFA, diagnosis categories, deceased status, therapy-plan set, supporting photos, keluhan/rekomendasi, installment payment, stock-request debt/partial payment, shipment receipt, nullable audit user, dan audit trail.
- Menambah dataset ICD-10 WHO, data provinsi/kabupaten, local ICD search route, wilayah API, dan script generator ICD.
- Menambah `seed-minimal` dan panduan seed. Seed dump/readable yang sangat besar sempat ditambahkan pada [`9cac026`](https://github.com/Etherlyvan/RAHO_APPS/commit/9cac0260524c394540ac5f36dc7c55b8175f8f65), lalu direktori `apps/api/seednew` dihapus kembali pada [`0abd8a6`](https://github.com/Etherlyvan/RAHO_APPS/commit/0abd8a65ee8642ef47143606d437e755fa43051a). Karena itu, 132 ribu lebih penambahan data tersebut tidak boleh dibaca sebagai source code final.

## 5. Automated Testing dan Dokumentasi

### 5.1 Test yang ditambahkan/diubah

Pada akhir Juni, codebase memiliki fondasi Playwright berikut yang diperkenalkan melalui commit Anda:

- 9 file E2E spec dan 1 auth setup file.
- 21 file TypeScript E2E baru yang mencakup spec, fixture, helper, dan page object.
- 144 deklarasi `test(...)` statis di seluruh spec/setup pada snapshot akhir Juni. Loop berbasis role dapat menghasilkan jumlah runtime case yang berbeda; angka ini bukan hasil eksekusi.
- Skenario mencakup login, logout, member CRUD, inventory, audit log, notification, payment, report, dan session therapy.
- Konfigurasi mencakup storage state per role, API login helper, test user fixture, Playwright config, env example, trace/screenshot/video-on-failure, dan scripts package.

Bukti utama: [`2a3e511`](https://github.com/Etherlyvan/RAHO_APPS/commit/2a3e511961999d62f5f52283b03ccaebb599fe82), [`3d9089b`](https://github.com/Etherlyvan/RAHO_APPS/commit/3d9089be5b224568a300d0dd7890b5e31c4d31ef), [`c7a8e4c`](https://github.com/Etherlyvan/RAHO_APPS/commit/c7a8e4c6a32c40a3ebf46207a9c5d5f2abc91c43), [`21522ac`](https://github.com/Etherlyvan/RAHO_APPS/commit/21522ac6cb8bd6eace3d2798d3323821bbeaf804), dan [`c0a334e`](https://github.com/Etherlyvan/RAHO_APPS/commit/c0a334ebf02dc42b32e72d1627237314aef1829e).

Unit/integration test yang disentuh mencakup:

- Branch deletion service.
- Member create controller.
- Session retrieval berdasarkan branch context.
- Session branch-context controller.
- Therapy plan session service.
- Therapy-plan set session edit.
- Komponen `AdminManagersTab` di web.

Laporan ini hanya menyatakan test code ditambahkan. Tidak ada bukti yang cukup untuk menyatakan semua 144 deklarasi E2E atau seluruh suite CI berhasil dijalankan pada akhir Juni.

### 5.2 Dokumentasi

Sebanyak 139 path Markdown unik disentuh dengan churn 48.691 baris. Dokumentasi utama mencakup:

- Branch-specific pricing.
- Bulk therapy plan dan therapy-plan set.
- Lab result dan upload dokumen member.
- Multi-branch staff/doctor assignment.
- Stock mutation/request/shipment.
- Role-module matrix.
- Responsive design dan loading system.
- Audit log coverage dan E2E test matrix.
- Testing scenario, deployment checklist, troubleshooting, dan summary harian.

Dokumentasi yang hanya berupa proposal/rencana—contohnya rancangan WhatsApp notification atau account lockout/CAPTCHA—tidak dicatat sebagai fitur runtime yang selesai tanpa bukti source yang sesuai.

## 6. Dampak Terhadap Produk

### Operasional klinik

- Sesi dan therapy plan dapat memuat data klinis yang lebih detail dan dapat dikelola dalam bulk/set.
- Dokumen member, hasil lab, diagnosis, supporting photos, serta keluhan/rekomendasi memperkaya rekam operasional pasien.
- Staff cabang dan admin manager mendapat lebih banyak kontrol atas assignment tenaga medis dan konteks cabang.

### Inventory dan keuangan internal

- Request stok bergerak dari form sederhana menjadi alur approval, shipment, shortage, pembayaran, bukti penerimaan, dan notifikasi.
- Histori mutasi dan histori pemakaian material meningkatkan keterlacakan pergerakan stok.
- Pricing per cabang dan pembayaran paket bertahap memberi fleksibilitas komersial yang lebih besar.

### Governance dan kualitas teknis

- Audit trail diperluas untuk aktivitas auth, user management, dan transaksi terkait.
- Migration menyimpan perubahan schema secara eksplisit.
- Playwright, fixture role, page objects, dan test matrix membentuk fondasi regression testing, walau status lulus penuh masih perlu dibuktikan melalui CI atau test run terdokumentasi.

## 7. Risiko, Temuan, dan Hal yang Perlu Ditindaklanjuti

1. **Churn sangat dipengaruhi generated data.** Dataset ICD/wilayah dan seed sementara membuat statistik LOC mentah terlihat jauh lebih besar daripada implementasi aplikasi.
2. **Migration perlu diaudit.** Terdapat dua migration therapy-plan versioning dengan timestamp berdekatan, migration bernama `tester`, dan satu migration bertanggal Mei yang masuk pada Juni. Urutan serta idempotensinya perlu diuji pada database kosong dan database existing.
3. **Binary/test upload masuk repository.** Commit [`61eb3e3`](https://github.com/Etherlyvan/RAHO_APPS/commit/61eb3e39effb60287f33048e3421873391fe347e) memasukkan beberapa gambar session test. Perlu dipastikan file tersebut memang fixture yang disengaja dan tidak memuat data sensitif.
4. **Dokumentasi lebih luas daripada bukti implementasi.** Dokumen proposal/checklist tidak boleh dipakai sebagai bukti fitur selesai tanpa pemeriksaan source dan runtime.
5. **E2E belum sama dengan green suite.** Banyak skenario telah ditulis, tetapi laporan ini tidak menemukan artefak hasil CI yang membuktikan semuanya lulus pada akhir bulan.
6. **Commit message sulit diaudit.** Beberapa message seperti `fix:/TS000`, `gw lupa njir`, dan `ForREAL:/MAJORUPDATE` tidak menjelaskan scope aktual. Conventional commit yang spesifik per modul akan membuat laporan dan rollback lebih aman.
7. **Beberapa commit sangat besar dan lintas domain.** Commit [`ac213b3`](https://github.com/Etherlyvan/RAHO_APPS/commit/ac213b325a86853126f3bdf08f772c1fd3db5fb9) dan [`9cac026`](https://github.com/Etherlyvan/RAHO_APPS/commit/9cac0260524c394540ac5f36dc7c55b8175f8f65) menggabungkan banyak fitur sekaligus, meningkatkan risiko review, regression, dan cherry-pick.

## 8. Rekomendasi Bulan Berikutnya

1. Jalankan seluruh migration dari database kosong dan salinan database existing, lalu dokumentasikan hasilnya.
2. Jadikan smoke E2E P0 sebagai required CI check; pisahkan test stabil, flaky, dan masih berupa scaffold.
3. Tambahkan artefak hasil test/coverage per commit release agar laporan berikutnya dapat membedakan “test ditulis” dan “test lulus”.
4. Audit file binary, generated JSON, summary duplikat, dan seed untuk mengurangi ukuran repository dan risiko data sensitif.
5. Pecah commit per domain dan gunakan format seperti `feat(inventory): add partial stock-request payment`.
6. Cocokkan dokumentasi proposal dengan status source (`planned`, `implemented`, `verified`, `deployed`).
7. Prioritaskan regression test untuk therapy plan, branch deletion, payment verification, dan shipment karena area tersebut menerima perubahan lintas API, schema, dan UI paling besar.

## 9. Kesimpulan

Juni 2026 adalah bulan ekspansi besar untuk RAHO APPS. Kontribusi Anda mencakup hampir seluruh lapisan sistem—database, API, web, test, data referensi, dan dokumentasi—dengan konsentrasi terbesar pada therapy plan/sesi, inventory/logistik, member/rekam medis, multi-cabang, pembayaran, dan automated testing.

Kesimpulan yang dapat dibuktikan dari Git adalah: **68 commit implementasi non-merge, 7 merge commit, 21 hari aktif, 575 path unik disentuh, 23 migration diperkenalkan, dan fondasi E2E lintas sembilan area dibangun.** Kesimpulan yang tidak dibuat oleh laporan ini adalah bahwa semua fitur telah deployed ke production atau seluruh test telah lulus; dua hal tersebut memerlukan bukti runtime/CI terpisah.

## Lampiran A — Inventaris Seluruh Commit Etherlyvan pada Juni 2026

| Tanggal | Commit | Subject asli |
|---|---|---|
| 2026-06-02 | [`7d5567c`](https://github.com/Etherlyvan/RAHO_APPS/commit/7d5567ce2721efe0458669adcbe6b736ef6c7540) | fix:/activeMembersquery,Addedmissingagama |
| 2026-06-02 | [`1de0ccd`](https://github.com/Etherlyvan/RAHO_APPS/commit/1de0ccd74dc7432841eec1e611ce984d20da8065) | fix:/TS018 |
| 2026-06-02 | [`44d676b`](https://github.com/Etherlyvan/RAHO_APPS/commit/44d676b99da34f95f7af1e0b3e93187f9b649685) | fix:/TS023-025 |
| 2026-06-02 | [`c06e8f6`](https://github.com/Etherlyvan/RAHO_APPS/commit/c06e8f698dd3b5e14cade683fc2816c9120da525) | fix:/TS010&013 |
| 2026-06-02 | [`113dddb`](https://github.com/Etherlyvan/RAHO_APPS/commit/113dddb10ba4e347f7c2c5eb1d72ae327f1e18b0) | fix:/TS000 |
| 2026-06-02 | [`811b5b8`](https://github.com/Etherlyvan/RAHO_APPS/commit/811b5b80ba89443ce12a07fb3ae8069034b2d0a0) | fix:/AuditLogTypes |
| 2026-06-02 | [`dcab37d`](https://github.com/Etherlyvan/RAHO_APPS/commit/dcab37d1d74c7b1b511177c2e9b4e75b816804c4) | fix:/AuditLogTypes |
| 2026-06-03 | [`6459887`](https://github.com/Etherlyvan/RAHO_APPS/commit/645988726b68d22d5c92f4e4e6924acb4e4fc146) | fix:/cleaningcode BE |
| 2026-06-04 | [`673d571`](https://github.com/Etherlyvan/RAHO_APPS/commit/673d57178a037260fbe2bf89a7bb010c57017f66) | fix:/tsconfig.json/src |
| 2026-06-04 | [`6a82233`](https://github.com/Etherlyvan/RAHO_APPS/commit/6a822333bf071ace76b02e2e8a57a5ac7e169e56) | fix:/verifikasi pembayaran paket /error gambar |
| 2026-06-04 | [`66617bf`](https://github.com/Etherlyvan/RAHO_APPS/commit/66617bf0e45dd83395920416a6aaf97fee06af43) | fix:/dashboard superadmin |
| 2026-06-05 | [`25410e8`](https://github.com/Etherlyvan/RAHO_APPS/commit/25410e8cf10509cfd30afd3e31a3072e6691b90d) | fix:/sesi terapi |
| 2026-06-07 | [`1e26a13`](https://github.com/Etherlyvan/RAHO_APPS/commit/1e26a13a6c5508f71abc7ae24ffbb32c2a883f6d) | fix:/refferralunclicked |
| 2026-06-07 | [`7417117`](https://github.com/Etherlyvan/RAHO_APPS/commit/7417117acb761a31049e87986d69f16ebe656961) | fix:/payment fixation |
| 2026-06-07 | [`daa211b`](https://github.com/Etherlyvan/RAHO_APPS/commit/daa211b1720689e7d9db4782e611d9aee4ebf610) | fix:/Login Fix& VitalSignValidation |
| 2026-06-08 | [`bbd6760`](https://github.com/Etherlyvan/RAHO_APPS/commit/bbd67607b1498e72447dc58616069d2e4a72bad3) | feat:/history material usage |
| 2026-06-08 | [`fb71adc`](https://github.com/Etherlyvan/RAHO_APPS/commit/fb71adc5183cfa8506bb57c8eff212bb47230908) | fix:/requestmodal |
| 2026-06-08 | [`e0de4e4`](https://github.com/Etherlyvan/RAHO_APPS/commit/e0de4e415490481e53d7391d6cb7c79066a22e94) | fix:/requestmodal |
| 2026-06-08 | [`29daa8d`](https://github.com/Etherlyvan/RAHO_APPS/commit/29daa8dbb9a9f4a91bad859fbf4d7aaf83cd0982) | fix:/requestmodalQuantityInput |
| 2026-06-08 | [`56f7a71`](https://github.com/Etherlyvan/RAHO_APPS/commit/56f7a71fe8105372a6bb3045034786bfb63fc066) | fix:/allowdupnumber |
| 2026-06-09 | [`0116d2a`](https://github.com/Etherlyvan/RAHO_APPS/commit/0116d2a7b13b5e1dde3375a68bb66354decf846f) | feat:/addPSPanpictin detailmember |
| 2026-06-12 | [`ac213b3`](https://github.com/Etherlyvan/RAHO_APPS/commit/ac213b325a86853126f3bdf08f772c1fd3db5fb9) | fix:/DiafnoseEditable, TerapiplanView,DraftNewMember,passwordVisibility Feat:/HasilLab |
| 2026-06-13 | [`4439e9c`](https://github.com/Etherlyvan/RAHO_APPS/commit/4439e9c1439c74f102173ece6e85ae5a97261ec3) | fix:/bulkcreatetherapyPlan |
| 2026-06-13 | [`ec5b23c`](https://github.com/Etherlyvan/RAHO_APPS/commit/ec5b23c269d4887aa5d4ab843a2520d08627fed6) | fix:/bulkcreatetherapyPlan |
| 2026-06-14 | [`f23e62a`](https://github.com/Etherlyvan/RAHO_APPS/commit/f23e62a4536f4a03698700199b8da8c71038d8a6) | fix:/iphone responsiveness |
| 2026-06-15 | [`603599d`](https://github.com/Etherlyvan/RAHO_APPS/commit/603599df029af6989bde12acaa712b601ed01b88) | fix:/hasillabUpload&Download,iferror:/checkcorspermision |
| 2026-06-17 | [`da0fccd`](https://github.com/Etherlyvan/RAHO_APPS/commit/da0fccde5a97dce978bf5d7dc7815226d17f865a) | Fix:/Therapy plan |
| 2026-06-17 | [`e752d97`](https://github.com/Etherlyvan/RAHO_APPS/commit/e752d97b883103084b6cd689e99a8c25c5e003b5) | fix:/need db migrate redeploy/multi feat update |
| 2026-06-17 | [`1b36371`](https://github.com/Etherlyvan/RAHO_APPS/commit/1b363712ddc6a570c8ad34f077419f66e172d3bf) | Merge branch `main` dari origin |
| 2026-06-18 | [`4a91237`](https://github.com/Etherlyvan/RAHO_APPS/commit/4a91237964dbfa940a684d71b95c72c7c753d320) | fix:/ui-responsivity |
| 2026-06-18 | [`fae3b5a`](https://github.com/Etherlyvan/RAHO_APPS/commit/fae3b5ae6abecd172aaf5ec8766b9e0fd44f9967) | fix:/data/dashboardvenue |
| 2026-06-18 | [`8091e54`](https://github.com/Etherlyvan/RAHO_APPS/commit/8091e54afc3b5d9cff5657d2cad1545675579c4e) | fix:/mutationfixerror |
| 2026-06-18 | [`7f619fa`](https://github.com/Etherlyvan/RAHO_APPS/commit/7f619fa2937e8362100e650b34becd433597b6ce) | fix:/inventory |
| 2026-06-19 | [`9cac026`](https://github.com/Etherlyvan/RAHO_APPS/commit/9cac0260524c394540ac5f36dc7c55b8175f8f65) | ForREAL:/MAJORUPDATE:/needTOTHINKHOWTOSAVEtheDB |
| 2026-06-19 | [`0abd8a6`](https://github.com/Etherlyvan/RAHO_APPS/commit/0abd8a65ee8642ef47143606d437e755fa43051a) | ForREAL:/MAJORUPDATE:/needTOTHINKHOWTOSAVEtheDB |
| 2026-06-19 | [`43a7bf4`](https://github.com/Etherlyvan/RAHO_APPS/commit/43a7bf44b27e5b724cf8dba1a863aaf91ea68b0b) | Merge branch `main` dari origin |
| 2026-06-19 | [`484e957`](https://github.com/Etherlyvan/RAHO_APPS/commit/484e9576eeccc8ef160929a9df46abcdad3645df) | fix:/editemail staff |
| 2026-06-21 | [`1113d81`](https://github.com/Etherlyvan/RAHO_APPS/commit/1113d81ee567c648aa40c730b7b0f6936c4172a3) | feature/:therapy plan & assignpacket |
| 2026-06-22 | [`61eb3e3`](https://github.com/Etherlyvan/RAHO_APPS/commit/61eb3e39effb60287f33048e3421873391fe347e) | fix:/paymentdone&fixtherapysession ui |
| 2026-06-22 | [`3554902`](https://github.com/Etherlyvan/RAHO_APPS/commit/3554902b6930723cfbc17970cee87662a821440a) | gw lupa njir |
| 2026-06-22 | [`e58abb0`](https://github.com/Etherlyvan/RAHO_APPS/commit/e58abb0c627eea9372e98db60ccf33fe6553f2cd) | Merge branch `main` dari origin |
| 2026-06-22 | [`e3558e5`](https://github.com/Etherlyvan/RAHO_APPS/commit/e3558e5f8cc06e8f0a411d6f7fe59d799dd269ca) | fix:/sendpacket |
| 2026-06-22 | [`df47b69`](https://github.com/Etherlyvan/RAHO_APPS/commit/df47b69d37b22f474bdac6e8a7bf10366c51bc5c) | fix:/admimanagercreation |
| 2026-06-23 | [`e309bfa`](https://github.com/Etherlyvan/RAHO_APPS/commit/e309bfa9d91b46108935aabaf643541226b424f0) | fix:/sendpacket&request |
| 2026-06-23 | [`974fa41`](https://github.com/Etherlyvan/RAHO_APPS/commit/974fa415bc72fc483d113f711f785f992ecf2344) | fix:/adminmanagerbranchsetting |
| 2026-06-23 | [`f901fec`](https://github.com/Etherlyvan/RAHO_APPS/commit/f901fecbb188d2ed972f5d23c62c6fe7500b5512) | fix:/delete branch |
| 2026-06-23 | [`af330c8`](https://github.com/Etherlyvan/RAHO_APPS/commit/af330c8f9d68d6b335ea4197f4d62a9e266b347e) | Merge branch `main` dari origin |
| 2026-06-23 | [`f3b2362`](https://github.com/Etherlyvan/RAHO_APPS/commit/f3b236272f6853f1cfba1ef08dba2ba61848a068) | fix:/sessiontherapyEdit |
| 2026-06-23 | [`7ba3db2`](https://github.com/Etherlyvan/RAHO_APPS/commit/7ba3db27b13ce4058102e90b9f683b2ada0a8988) | feat:/editmember |
| 2026-06-23 | [`ae1a308`](https://github.com/Etherlyvan/RAHO_APPS/commit/ae1a308a7bc14faf14e10481ead1c95872d6aa4a) | fix:/sessiontherapyEdit |
| 2026-06-23 | [`afc62a3`](https://github.com/Etherlyvan/RAHO_APPS/commit/afc62a3b652f0882d3e9056eea401cee53d5a1d5) | fix:/autohrizerole |
| 2026-06-24 | [`f8eeeb8`](https://github.com/Etherlyvan/RAHO_APPS/commit/f8eeeb89878af2cfaed8b851917203035f402405) | fix:/edit memberemail super admin |
| 2026-06-24 | [`46e7128`](https://github.com/Etherlyvan/RAHO_APPS/commit/46e7128dbb464904e05ece34be5f5d8bbc9b4ad5) | fix:/modal kolom custom used |
| 2026-06-25 | [`b89278f`](https://github.com/Etherlyvan/RAHO_APPS/commit/b89278f6afdb42812740ea0c060e87b4c4e24dac) | feat:/deletebranchesforce |
| 2026-06-25 | [`1e29e76`](https://github.com/Etherlyvan/RAHO_APPS/commit/1e29e76958cb9444e76b063196254613ffc1230b) | feat:/deletebranchesforce |
| 2026-06-25 | [`9bc8506`](https://github.com/Etherlyvan/RAHO_APPS/commit/9bc8506ecd19901ee90592d3547d5d04c3ed3b0f) | fix:/assignpacket |
| 2026-06-25 | [`3449388`](https://github.com/Etherlyvan/RAHO_APPS/commit/34493887612b8dffa39d1fd6166f7074b5ae2472) | fix:/StaffCoding |
| 2026-06-29 | [`cdaf1d7`](https://github.com/Etherlyvan/RAHO_APPS/commit/cdaf1d709341fc53047c8def4bca4644352eeeba) | fix:/boostertype |
| 2026-06-29 | [`2f05063`](https://github.com/Etherlyvan/RAHO_APPS/commit/2f050633c40289390b1f11add1178eba32b86253) | fix:refresh |
| 2026-06-29 | [`641c33a`](https://github.com/Etherlyvan/RAHO_APPS/commit/641c33aeb5e342bb2927b1bf87d34d128ffe77bf) | fix:/upload buktitandaterima |
| 2026-06-29 | [`6fbc62e`](https://github.com/Etherlyvan/RAHO_APPS/commit/6fbc62e84608f29c99f5b594d0d998beb0c1375b) | fix:/mastertype |
| 2026-06-29 | [`5ec2264`](https://github.com/Etherlyvan/RAHO_APPS/commit/5ec22642a972709af3799656141d968007b8ee9e) | view detail payment |
| 2026-06-29 | [`08407aa`](https://github.com/Etherlyvan/RAHO_APPS/commit/08407aaea45c87ce864a23c4fb2ae1f4b4e9b3e0) | feat:/loadingspinner |
| 2026-06-29 | [`056e2e3`](https://github.com/Etherlyvan/RAHO_APPS/commit/056e2e37688520d4e46ced3bc7ce5d011a4c95fb) | fix:/merge |
| 2026-06-30 | [`6d8011a`](https://github.com/Etherlyvan/RAHO_APPS/commit/6d8011a5dfb87542d6f4430d190f8d28c7e54497) | fix:/loading ani,mation |
| 2026-06-30 | [`6470217`](https://github.com/Etherlyvan/RAHO_APPS/commit/64702177c11e5d484e9123c27a4eb821d6d67166) | fix:/fiturmaterialusage |
| 2026-06-30 | [`cf6c24e`](https://github.com/Etherlyvan/RAHO_APPS/commit/cf6c24e03f10308b48f9855fb079c9d38937f485) | fix:/createteraphy session |
| 2026-06-30 | [`e3c1f00`](https://github.com/Etherlyvan/RAHO_APPS/commit/e3c1f003fb5ba44b306e28702ee572b88d8f9f4b) | fix:/tailwind-merge |
| 2026-06-30 | [`2a3e511`](https://github.com/Etherlyvan/RAHO_APPS/commit/2a3e511961999d62f5f52283b03ccaebb599fe82) | feat:/e2eautomated |
| 2026-06-30 | [`6684b95`](https://github.com/Etherlyvan/RAHO_APPS/commit/6684b953ae0150f2dc7413be38dfbab4b2432eea) | Merge branch `main` dari origin |
| 2026-06-30 | [`3d9089b`](https://github.com/Etherlyvan/RAHO_APPS/commit/3d9089be5b224568a300d0dd7890b5e31c4d31ef) | E2E:/Updatephase4 |
| 2026-06-30 | [`39ecca7`](https://github.com/Etherlyvan/RAHO_APPS/commit/39ecca79c56cc4a5f57589d88d7e2abeb6132b10) | Merge branch `main` dari TatangSteam/RAHO_APPS |
| 2026-06-30 | [`c7a8e4c`](https://github.com/Etherlyvan/RAHO_APPS/commit/c7a8e4c6a32c40a3ebf46207a9c5d5f2abc91c43) | fix:E2E |
| 2026-06-30 | [`21522ac`](https://github.com/Etherlyvan/RAHO_APPS/commit/21522ac6cb8bd6eace3d2798d3323821bbeaf804) | fix:E2E |
| 2026-06-30 | [`c0a334e`](https://github.com/Etherlyvan/RAHO_APPS/commit/c0a334ebf02dc42b32e72d1627237314aef1829e) | fix:E2E |

---

**Catatan akhir:** tautan commit diarahkan ke remote GitHub. Jika repository bersifat private, pembaca harus login dan memiliki akses repository untuk membukanya.
