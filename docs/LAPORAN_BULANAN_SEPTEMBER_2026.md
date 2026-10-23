# Laporan Bulanan Perkembangan Website RAHO

**Periode:** 1–30 September 2026  
**Waktu laporan:** 30 September 2026; data penggunaan diekspor pukul 21.34 WIB  
**Zona waktu:** Asia/Jakarta (UTC+7)  
**Project:** RAHO ERP / Clinic Management System  
**Repository:** `RAHO_APPS`  
**Baseline awal:** `ed3251b` — 31 Agustus 2026  
**Baseline akhir yang diaudit:** `1dd9abd` — 30 September 2026  
**Sumber penggunaan:** `kinerja-staff-2026-09-30.xlsx` — semua cabang, semua tanggal  
**Audiens:** Manajemen, Product Owner, tim IT, operasional klinik, Finance, dan Logistik

---

## 1. Ringkasan Eksekutif

Pengembangan September 2026 berfokus pada pematangan proses operasional yang
sudah berjalan di RAHO. Website tidak hanya bertambah fitur, tetapi juga
mendapat banyak perbaikan konsistensi data, keamanan akses, integritas stok,
serta kemudahan penggunaan untuk pekerjaan harian klinik.

Hasil utama bulan ini:

- alur sesi terapi dan material diperkuat, termasuk dukungan sesi historis,
  aktivasi ulang material, penyelesaian ulang sesi, serta koreksi therapy plan
  yang sudah dipakai;
- modul insentif bulanan dikembangkan untuk Nakes, MSO, Koordinator CHS, dan
  Doctor Head, dilengkapi ekspor Excel dan workflow perhitungan;
- perhitungan Air Nano diperbaiki agar menggunakan jumlah dus aktual dan status
  invoice terverifikasi;
- akses laporan insentif diperketat: hanya Super Admin dan Finance yang dapat
  melihat insentif semua orang, sedangkan role lain hanya melihat miliknya;
- inventory ledger, valuasi stok lama, default cost, add-on Air Nano, pembatalan
  transaksi, dan pengembalian stok dibuat lebih aman;
- voucher partnership, lokasi klaim, campaign, operator, registry, dan histori
  ditambahkan sebagai satu kelompok menu;
- laporan sesi WhatsApp mendapat QR pairing dan template visual yang dapat
  disesuaikan;
- fitur kolaborasi tim, task, subtask, serta halaman RAIN/OpenClaw ditambahkan;
- akses Finance & Logistik, Admin Manager, Dokter, Nakes, dan Admin Cabang
  diperbaiki sesuai scope kerja masing-masing;
- dashboard Super Admin diperbaiki agar jumlah staff dan member tidak tercampur;
- snapshot pengisian sesi menunjukkan 29 dari 39 staff yang tercantum mempunyai
  aktivitas sesi, dengan 3.143 dari 3.927 keterlibatan staff–sesi sudah lengkap;
- stabilitas deployment ditingkatkan melalui perbaikan Docker, migration
  recovery, dan pengurangan penggunaan memori test CI.

Secara keseluruhan, September merupakan bulan stabilisasi dan penguatan kontrol.
Perubahan terbaru pada `1dd9abd` telah melewati workflow deployment dan verifikasi
server dengan status sukses.

---

## 2. Ringkasan Angka Perubahan

| Metrik | Nilai | Catatan |
|---|---:|---|
| Commit | 113 | Termasuk feature, fix, refactor, test, chore, dan merge |
| Kontributor | 3 | Etherlyvan 108, samudraayoga 3, DawudRizky 2 |
| File berubah | 436 | Berdasarkan perbandingan baseline awal dan akhir |
| Penambahan baris | 37.353 | Termasuk source, test, migration, dan dokumentasi |
| Penghapusan baris | 2.427 | Termasuk refactor dan penggantian implementasi lama |
| Migration database baru | 27 | Wajib tetap dijalankan berurutan pada deployment |
| File test berubah | 122 | Unit, integration, contract, component, dan E2E |
| Halaman staff baru | 15 | Kolaborasi, RAIN, Voucher, dan Staff Incentives |
| File API berubah | 265 | Service, controller, schema, migration, dan test |
| File Web berubah | 135 | Halaman, komponen, API client, state, dan test |

Komposisi commit:

| Jenis | Jumlah |
|---|---:|
| Perbaikan (`fix`) | 59 |
| Fitur (`feat`) | 41 |
| Pemeliharaan (`chore`) | 8 |
| Refactor | 2 |
| Merge | 2 |
| Test khusus | 1 |

Proporsi perbaikan yang lebih besar daripada fitur menunjukkan fokus bulan ini
pada stabilitas, koreksi data, dan kesiapan operasional.

---

## 3. Penggunaan dan Pengisian Aplikasi

### 3.1 Ruang lingkup data

Analisis penggunaan berasal dari file `kinerja-staff-2026-09-30.xlsx` yang
diekspor pada 30 September 2026 pukul 21.34 WIB dengan filter **Semua Cabang**,
**Semua tanggal**, dan **Semua staff**. Dengan demikian, angka berikut merupakan
snapshot kumulatif sampai waktu ekspor, bukan aktivitas yang hanya terjadi pada
1–30 September.

File ini mengukur keterlibatan staff dalam sesi terapi dan kelengkapan
pengisiannya. File tidak memuat login, durasi pemakaian, atau aktivitas pada
modul lain. Staff dengan nol sesi karena itu tidak otomatis berarti tidak pernah
memakai aplikasi.

Kolom **Sesi Unik** bersifat unik per staff. Satu sesi terapi dapat melibatkan
lebih dari satu staff, sehingga penjumlahan kolom tersebut disebut
**keterlibatan staff–sesi**, bukan jumlah sesi unik sistem.

### 3.2 Indikator utama

| Indikator | Nilai | Interpretasi |
|---|---:|---|
| Staff tercantum | 39 | Dokter, Nakes, MSO, dan Admin Cabang pada file ekspor |
| Staff dengan aktivitas sesi | 29 (74,36%) | Mempunyai sedikitnya satu Sesi Unik |
| Staff tanpa aktivitas sesi | 10 (25,64%) | Perlu dibaca bersama status cabang dan penugasan |
| Staff dengan sesi belum lengkap | 23 | Mempunyai sedikitnya satu backlog pengisian |
| Keterlibatan staff–sesi | 3.927 | Bukan jumlah sesi unik global |
| Sudah lengkap | 3.143 (80,04%) | Sesi Unik dikurangi Sesi Belum Lengkap per staff |
| Belum lengkap | 784 (19,96%) | Backlog pada saat file diekspor |
| Atribusi sebagai Dokter | 1.365 | Kolom peran Dokter; dapat beririsan dengan peran operasional |
| Atribusi sebagai MSO & Nakes | 2.563 | Termasuk aktivitas operasional yang tercatat pada file |

Angka 39 staff pada ekspor ini tidak dapat dibandingkan langsung dengan total
staff pada dashboard karena file hanya berisi role dan aktivitas yang masuk ke
laporan Kinerja Staff.

### 3.3 Kelengkapan berdasarkan role

| Role | Staff | Staff aktif | Keterlibatan staff–sesi | Belum lengkap | Tingkat lengkap |
|---|---:|---:|---:|---:|---:|
| Dokter | 9 | 7 | 1.364 | 402 | 70,53% |
| Nakes | 15 | 13 | 1.185 | 174 | 85,32% |
| MSO | 7 | 5 | 909 | 148 | 83,72% |
| Admin Cabang | 8 | 4 | 469 | 60 | 87,21% |

Dokter menyumbang 402 dari 784 sesi belum lengkap atau 51,28% dari seluruh
backlog. Karena completion rate Dokter merupakan yang terendah, penutupan
evaluasi dan tindakan dokter menjadi prioritas perbaikan pengisian.

### 3.4 Kelengkapan berdasarkan cabang

| Cabang | Staff | Staff aktif | Keterlibatan staff–sesi | Belum lengkap | Tingkat lengkap |
|---|---:|---:|---:|---:|---:|
| Raho Premier Jakarta | 16 | 16 | 2.464 | 560 | 77,27% |
| Raho Club Premier Menara Batavia | 7 | 6 | 1.044 | 160 | 84,67% |
| RAHO Club Premier Botanica | 5 | 5 | 411 | 56 | 86,37% |
| Cabang Tes | 2 | 2 | 8 | 8 | 0,00% |

Raho Premier Jakarta menampung 62,75% dari seluruh keterlibatan staff–sesi dan
memiliki backlog terbesar. Menara Batavia menyumbang 26,59%, sedangkan Botanica
10,47%. Cabang Tes harus dipisahkan dari KPI operasional agar data simulasi tidak
mempengaruhi laporan manajemen.

Empat kelompok cabang tidak mempunyai sesi pada snapshot ini: Nano Life Plus
(4 staff), Raho Club Premier Jambi (3), Grand Orchard Kelapa Gading (1), dan
Raho Premier Dummy (1). Perlu dipastikan apakah cabang belum go-live, staff belum
ditugaskan pada sesi, atau data aktivitasnya berada di luar cakupan laporan.

### 3.5 Pengisian tertinggi dan backlog prioritas

Lima staff dengan keterlibatan sesi tertinggi:

| Staff | Role | Cabang | Sesi unik | Belum lengkap | Tingkat lengkap |
|---|---|---|---:|---:|---:|
| dr. Andri Heryanto | Dokter | Menara Batavia | 629 | 2 | 99,68% |
| Adzka Sibghotullah | MSO | Raho Premier Jakarta | 507 | 1 | 99,80% |
| Maria Damara | Nakes | Raho Premier Jakarta | 506 | 1 | 99,80% |
| Amiratun Naillah | Dokter | Raho Premier Jakarta | 223 | 106 | 52,47% |
| Sindi Miana Tantri | Admin Cabang | Raho Premier Jakarta | 207 | 48 | 76,81% |

Tiga staff teratas menyumbang 41,81% dari seluruh keterlibatan staff–sesi. Ini
menunjukkan aplikasi telah dipakai intensif oleh pengguna utama, tetapi volume
pengisian masih cukup terkonsentrasi.

Backlog pengisian terbesar yang perlu ditindaklanjuti:

| Staff | Role | Cabang | Sesi unik | Belum lengkap | Tingkat lengkap |
|---|---|---|---:|---:|---:|
| Bethania Sophia Fitri | Dokter | Menara Batavia | 173 | 154 | 10,98% |
| Amiratun Naillah | Dokter | Raho Premier Jakarta | 223 | 106 | 52,47% |
| Dwimesta Fadryona | Dokter | Raho Premier Jakarta | 92 | 92 | 0,00% |
| Meilani Nur Azizah | Nakes | Raho Premier Jakarta | 182 | 81 | 55,49% |
| Bagus Mangakuarto Dimas | MSO | Raho Premier Jakarta | 181 | 81 | 55,25% |

Daftar ini adalah dasar follow-up operasional, bukan penilaian kinerja final.
Sesi belum lengkap dapat dipengaruhi pembagian tanggung jawab, data legacy,
status sesi, atau langkah role lain yang masih menunggu.

### 3.6 Rekomendasi pengukuran berikutnya

1. Ekspor laporan berikutnya dengan filter tanggal 1–30 September agar metrik
   penggunaan bulanan dapat dibedakan dari data kumulatif.
2. Pisahkan cabang tes dan dummy dari KPI produksi.
3. Tambahkan metrik login terakhir, hari aktif, dan modul yang dipakai untuk
   mengukur adopsi aplikasi di luar pengisian sesi.
4. Tindak lanjuti 784 backlog, dimulai dari Dokter dan Raho Premier Jakarta.
5. Tambahkan kolom penyebab belum lengkap agar hambatan pengguna dapat
   dibedakan dari sesi yang memang masih berjalan.
6. Gunakan target kelengkapan operasional yang disetujui manajemen; sebagai
   usulan awal, pantau pencapaian menuju minimal 95%.

---

## 4. Perkembangan per Area

### 4.1 Sesi terapi, therapy plan, dan infus aktual

| Perkembangan | Dampak operasional | Status |
|---|---|---|
| Sesi historis tanpa konsumsi stok | Data terapi lama dapat dimasukkan tanpa mengurangi stok berjalan | Selesai |
| Aktivasi ulang material sesi | Material sesi dapat dipulihkan dan dilanjutkan oleh staff yang berwenang | Selesai |
| Sinkronisasi komponen Infus Set | Penggunaan komponen kit tidak lagi terlewat atau dihitung ganda | Selesai |
| Recompletion sesi | Sesi posted yang dikoreksi dapat direversal dan diselesaikan kembali | Selesai |
| Dokter bekerja independen | Dokter yang ditugaskan dapat menyimpan evaluasi dan infus sesuai scope sesi | Selesai |
| Reminder langkah belum lengkap | Pengguna mendapat daftar langkah yang benar-benar masih kurang sesuai role | Selesai |
| Hapus set therapy plan terpakai | Super Admin dapat menghapus set beserta sesi terkait melalui reversal terkontrol | Selesai |
| Edit therapy plan terpakai | Dosis baru menyelaraskan infus aktual dan material; sesi posted wajib reversal | Selesai dan deployed |

Flow koreksi therapy plan terbaru:

```text
Therapy plan sudah dipakai
          ↓
Buka sesi terkait → Edit Therapy Plan
          ↓
Jika sesi belum posted:
plan versi baru → infus aktual diselaraskan → material draft diperbarui
          ↓
Jika sesi sudah posted:
alasan + konfirmasi → reversal stok/finance → sesi pending
          ↓
plan versi baru → infus/material diselaraskan → selesaikan ulang sesi
```

Guard yang ditambahkan:

- perubahan dilakukan dalam transaksi database;
- stok yang tidak cukup membatalkan seluruh edit;
- master stok yang belum tersedia menghasilkan pesan yang jelas;
- material posted tidak boleh diubah tanpa reversal;
- edit keterangan saja tidak menimpa dosis aktual;
- sesi historis `skipInventoryConsumption` tidak mengubah stok saat ini.

### 4.2 Insentif staff

Modul Staff Incentives berkembang dari perhitungan sederhana menjadi laporan
bulanan untuk beberapa kelompok penerima.

| Kelompok | Implementasi September |
|---|---|
| Nakes | Perhitungan jumlah infus, tarif per infus, target, dan bonus bulanan |
| MSO | Jumlah visit, penjualan Air Nano lunas, insentif per dus, dan bonus target |
| Koordinator CHS | Assignment multi-cabang, personal infusion, target tim/cabang, dan bonus |
| Doctor Head | Assignment cabang, target homecare/partnership, dan komponen insentif |

Perbaikan penting:

- jumlah Air Nano dihitung berdasarkan kuantitas dus, bukan jumlah baris transaksi;
- invoice `PAID` yang sudah mempunyai bukti verifikasi direkonsiliasi agar tidak
  tertinggal sebagai `PENDING`;
- draft insentif mengambil data terbaru, sedangkan snapshot reviewed/approved
  tetap terlindungi;
- Finance/Super Admin dapat melakukan koreksi terkontrol sebelum status paid;
- hak akses laporan dan ekspor Excel dibatasi di backend;
- Admin Manager, Admin Cabang, Admin Layanan, Dokter, dan Nakes hanya menerima
  baris insentif miliknya sendiri.

### 4.3 Inventory, add-on, dan stok Air Nano

Perubahan bulan ini memperkuat hubungan antara transaksi klinik, add-on, dan
ledger inventory.

- valuasi stok lama dapat dilakukan walaupun lokasi historis belum lengkap;
- SKU tanpa biaya terlihat pada dashboard agar dapat segera diperbaiki;
- default unit cost dapat diatur pada master produk;
- periode accounting dan stok jual add-on dapat disiapkan otomatis;
- penjualan inventory tanpa nilai dicegah;
- transaksi add-on dapat dibatalkan dengan pengembalian stok yang aman;
- Air Nano hijau dan variasi SKU legacy dapat ditemukan dengan fallback yang
  lebih baik;
- penyimpanan Infus Aktual untuk sesi baru memakai saldo ledger sebagai sumber
  kebenaran, bukan mirror `inventory_items.stock` yang dapat tertinggal;
- pembayaran dan verifikasi add-on terhubung dengan kelayakan insentif MSO.

### 4.4 Voucher dan partnership

Kelompok menu Voucher kini mencakup:

- dashboard voucher;
- campaign;
- registry;
- operator;
- lokasi klaim;
- histori klaim;
- tipe voucher pada histori;
- klaim voucher partnership mandiri;
- dukungan lokasi reguler RAHO;
- penerbitan voucher dummy untuk kebutuhan pengujian.

Penyimpanan kode voucher, versi campaign, status ketersediaan, dan hubungan
dengan klaim juga diperkuat melalui migration database.

### 4.5 WhatsApp dan laporan sesi

Perubahan utama:

- pairing WhatsApp berpindah dari nomor telepon ke QR code;
- timeout QR diperpanjang agar proses pairing lebih realistis;
- template laporan sesi dapat memakai background dan branding khusus;
- foto sesi kembali dapat disertakan tanpa ketergantungan pada consent yang
  tidak relevan untuk proses pengiriman internal;
- laporan tetap mengikuti data sesi dan hak akses pengguna.

### 4.6 Kolaborasi dan RAIN

Website mendapatkan area **Extra** untuk kebutuhan kolaborasi internal:

- team dan membership;
- task dan subtask;
- penanggung jawab utama;
- monitoring progres;
- CRUD tugas harian dengan histori assignment;
- panduan penggunaan untuk pengguna baru;
- API personal task;
- halaman RAIN;
- integrasi awal OpenClaw dengan ERP yang terautentikasi.

Area ini sudah mempunyai fondasi UI dan API, tetapi penggunaan lintas tim tetap
perlu dipantau agar aturan owner, leader, dan assignment konsisten dengan proses
organisasi sebenarnya.

### 4.7 Member, paket, pembayaran, dan profil

- Super Admin dapat menetapkan paket lintas cabang sesuai kewenangan;
- katalog harga di-refresh berdasarkan scope sebelum assignment;
- service type dan harga per scope dapat dikelola;
- kuota paket dapat dinaikkan tanpa menghilangkan sesi yang sudah terpakai;
- total paket dan booster pada preview edit tidak lagi terduplikasi;
- status paket, invoice cicilan, dan verifikasi pembayaran disinkronkan;
- Nakes dapat mengunggah dan mengonfirmasi bukti pembayaran sesuai flow baru;
- Admin Manager dapat mengedit nama member pada cabang yang diizinkan;
- pengguna dapat memperbarui username, nama lengkap, dan foto profil;
- upload informed consent dan dokumen member diperkuat terhadap network error
  dan submit berulang;
- proses deaktivasi serta hard destruction member mendapat guard tambahan untuk
  data finance dan inventory.

### 4.8 Role, akses, dashboard, dan keamanan data

Perubahan akses yang menonjol:

- role Finance & Logistik dapat diberikan atau dicabut oleh Super Admin;
- akses inventory Finance dipulihkan melalui daftar staff role bersama;
- menu Finance disembunyikan dari Admin Cabang bila tidak mempunyai hak;
- akses terapi untuk Admin Manager dan staff yang ditugaskan diperbaiki;
- dashboard Super Admin memisahkan staff dari akun member;
- perhitungan total staff dan member diperbaiki;
- evaluasi dokter dibuat idempotent dan dibatasi sesuai aturan edit;
- laporan insentif dilindungi berdasarkan user, bukan hanya tampilan UI;
- scope cabang tetap diverifikasi oleh backend pada operasi sesi dan member.

---

## 5. Perkembangan Berdasarkan Minggu

| Minggu | Fokus | Hasil utama |
|---|---|---|
| 1–7 September | Voucher, WhatsApp, paket, sesi legacy, dan material | QR pairing, voucher partnership, no-stock legacy session, aktivasi material, recompletion, dan hardening upload |
| 8–14 September | Profil, kolaborasi, insentif, therapy plan | Runtime integration profile, task/team, insentif Nakes–MSO–CHS–Doctor Head, workflow pembayaran, dan perbaikan set therapy plan |
| 15–21 September | Inventory valuation, RAIN, role, dan akses | Valuasi stok lama, missing-cost SKU, OpenClaw/RAIN, Finance role, Zoho status, dan reminder sesi |
| 22–30 September | Add-on, pembayaran, dashboard, insentif, dan koreksi klinis | Default cost, pembatalan Air Nano, ledger Infus Aktual, pembayaran oleh Nakes, perbaikan dashboard, rekonsiliasi Air Nano, privasi insentif, dan edit therapy plan terpakai |

---

## 6. Halaman Baru yang Terlihat Pengguna

September menambahkan 15 halaman staff utama:

### Staff Incentives

- `/staff-incentives`
- `/staff-incentives/nakes`
- `/staff-incentives/mso`
- `/staff-incentives/coordinator`
- `/staff-incentives/doctor-head`

### Voucher

- `/extra/vouchers`
- `/extra/vouchers/campaigns`
- `/extra/vouchers/history`
- `/extra/vouchers/locations`
- `/extra/vouchers/operators`
- `/extra/vouchers/registry`

### Kolaborasi dan RAIN

- `/extra/collaboration`
- `/extra/collaboration/tasks`
- `/extra/collaboration/teams`
- `/extra/rain`

---

## 7. Database dan Deployment

### 7.1 Migration

Terdapat 27 migration baru pada perbandingan baseline September. Area yang
terpengaruh meliputi:

- voucher partnership, campaign, kode terenkripsi, dan claim location;
- WhatsApp custom background;
- bypass inventory untuk sesi historis;
- atribusi penjualan add-on ke MSO;
- perbaikan stok komponen Infus Set;
- recompletion sesi;
- unique member document;
- team task collaboration;
- runtime connection registry;
- provisioning Super Admin;
- sinkronisasi nomor sesi;
- assignment CHS dan Doctor Head;
- batas edit evaluasi dokter;
- idempotensi insentif referral dan workflow staff incentive;
- penyelarasan index schema;
- default unit cost;
- izin pembayaran paket oleh Nakes;
- rekonsiliasi invoice lunas terverifikasi.

### 7.2 Deployment terakhir

| Item | Nilai |
|---|---|
| Commit | `1dd9abd` |
| Workflow | Deploy RAHO_APPS |
| Status | Sukses |
| Selesai | 30 September 2026, 17.05 WIB |
| Bukti | [GitHub Actions run 36699196578](https://github.com/TatangSteam/RAHO_APPS/actions/runs/36699196578) |

Perbaikan infrastruktur bulan ini juga mencakup:

- retry Docker build dan penggunaan npm cache yang lebih aman;
- pengurangan konsumsi memori Jest pada CI;
- recovery migration schema legacy;
- pemisahan akses runtime database/Zoho dari flow operasional utama.

---

## 8. Pengujian dan Quality Assurance

Sebanyak 122 file test berubah dalam baseline September. Coverage perubahan
mencakup:

- session creation, completion, cancellation, recompletion, material, dan
  therapy plan;
- inventory ledger, FIFO, valuasi, add-on, serta pengembalian stok;
- paket, booster, pembayaran, dan verifikasi invoice;
- insentif Nakes, MSO, CHS, Doctor Head, snapshot, dan ekspor;
- voucher, partnership, campaign, dan claim location;
- permission, branch scope, role Finance, dan Admin Manager;
- WhatsApp report dan QR pairing;
- kolaborasi task/team dan RAIN;
- dashboard serta perhitungan staff/member.

Verifikasi terakhir untuk fitur penutup bulan:

| Pemeriksaan | Hasil |
|---|---|
| Targeted API test therapy plan/session | 28/28 lulus |
| Targeted Web test therapy plan/session | 7/7 lulus |
| Type-check API | Lulus |
| Type-check Web | Lulus |
| Production build API | Lulus |
| Production build Web | Lulus |
| Deployment dan server verification | Lulus |

Batas klaim: angka di atas adalah evidence untuk perubahan penutup bulan dan
workflow deployment. Laporan ini tidak mengklaim seluruh test repository
dijalankan ulang manual dalam satu perintah pada saat laporan dibuat.

---

## 9. Dampak untuk Pengguna

| Pengguna | Dampak utama |
|---|---|
| Super Admin | Dashboard lebih akurat, pengelolaan role lebih lengkap, koreksi sesi/therapy plan terkontrol, dan audit lebih jelas |
| Admin Manager | Scope cabang lebih konsisten, dapat mengoreksi data member, memantau kolaborasi, dan menjalankan reversal sesuai kewenangan |
| Admin Cabang | Flow stok, add-on, pembayaran, dan koreksi sesi lebih aman |
| Admin Layanan/MSO | Atribusi penjualan Air Nano, visit, insentif pribadi, serta dokumen member lebih mudah dikelola |
| Dokter | Dapat menyimpan evaluasi/infus pada sesi yang ditugaskan dan mengoreksi therapy plan aktif tanpa merusak stok |
| Nakes | Aktivasi material, pembayaran, infus aktual, dan insentif pribadi lebih terhubung |
| Finance & Logistik | Akses inventory dipulihkan, workflow insentif dan rekonsiliasi invoice lebih dapat diaudit |
| Manajemen | Laporan insentif, dashboard staff/member, dan monitoring task memberikan visibilitas operasional lebih baik |

---

## 10. Risiko dan Tindak Lanjut

| Risiko/pekerjaan lanjutan | Rekomendasi |
|---|---|
| Jumlah migration cukup besar | Pertahankan backup otomatis dan uji restore sebelum perubahan database besar |
| Koreksi sesi posted memengaruhi stok dan finance | Gunakan alasan wajib, audit reversal, dan review Admin/Finance |
| Master produk atau saldo cabang belum lengkap | Pantau error `MATERIAL_INVENTORY_NOT_FOUND` dan lengkapi master sebelum sesi diselesaikan |
| Data invoice legacy tidak konsisten | Jalankan rekonsiliasi berkala dan bandingkan invoice, payment, serta verification status |
| Snapshot masih memakai filter semua tanggal | Gunakan rentang tanggal bulanan agar tren adopsi dan kelengkapan dapat dibandingkan antarbulan |
| Terdapat 784 keterlibatan staff–sesi belum lengkap | Prioritaskan follow-up Dokter dan Raho Premier Jakarta, lalu dokumentasikan penyebab backlog |
| Aturan insentif berkembang cepat | Tetapkan dokumen kebijakan bisnis yang disetujui Finance/HR sebagai sumber aturan |
| Integrasi RAIN/OpenClaw masih awal | Lakukan UAT role, rate limiting, audit akses, dan monitoring error |
| Zoho dapat berubah atau kehilangan scope | Pertahankan mode aman, validasi organization, dan jangan membuat operasi klinik bergantung pada Zoho |
| Banyak perbaikan bersifat lintas modul | Jalankan regression test penuh dan smoke test per role sebelum perubahan besar berikutnya |

---

## 11. Prioritas Oktober 2026

Prioritas yang disarankan:

1. menjalankan UAT end-to-end untuk sesi terapi, stok, pembayaran, dan insentif;
2. membuat dashboard rekonsiliasi plan–infus–material untuk mendeteksi selisih
   historis;
3. mengunci dan mendokumentasikan formula insentif bersama Finance/HR;
4. menambah monitoring otomatis untuk invoice lunas yang belum verified;
5. menyelesaikan UAT kolaborasi dan RAIN sebelum dipakai seluruh organisasi;
6. menjalankan rehearsal restore backup dan seluruh migration pada salinan
   production;
7. menambah smoke test setelah deployment untuk login, member, sesi, inventory,
   payment, dan laporan insentif;
8. mengevaluasi performa halaman besar seperti detail member, dashboard
   inventory, dan staff incentives;
9. menutup backlog pengisian sesi dan mulai memantau penggunaan aplikasi dengan
   filter bulanan, login terakhir, hari aktif, serta modul yang dipakai.

---

## 12. Commit Penting September

| Area | Commit | Ringkasan |
|---|---|---|
| WhatsApp | `5db4c5f` | Mengganti pairing nomor dengan QR code |
| Sesi legacy | `23cae4f` | Menambahkan opsi sesi terapi tanpa stok |
| Material sesi | `879d205` | Aktivasi ulang material dan stok sesi |
| Recompletion | `f368fdc` | Penyelesaian ulang setelah koreksi sesi posted |
| Staff incentives | `ec4cedf` | Dasar insentif bulanan Nakes dan MSO |
| CHS incentives | `6fb64cf` | Koordinator CHS dan ekspor Excel |
| Doctor Head | `1853785` | Aturan Doctor Head dan perluasan CHS |
| Incentive workflow | `7713929` | Pengamanan kalkulasi dan pembayaran |
| Collaboration | `6cef4d5` | CRUD task manager sederhana |
| RAIN | `e9aa4bf` | Personal task API dan chat read-only |
| Inventory valuation | `1570318` | Penyederhanaan valuasi stok lama |
| Zoho | `9701379` | Status OAuth dan validasi organization |
| Add-on | `07f5d66` | Pembatalan dan pengembalian stok aman |
| Infus ledger | `bb3f034` | Menggunakan ledger stock untuk material infus |
| Air Nano incentive | `2d3f30f` | Rekonsiliasi invoice lunas terverifikasi |
| Incentive privacy | `1ee5528` | Membatasi laporan ke data diri sendiri |
| Therapy plan correction | `1dd9abd` | Sinkronisasi plan terpakai, infus aktual, dan stok |

---

## 13. Kesimpulan

Pada akhir September 2026, RAHO menjadi lebih siap untuk operasional harian
karena proses klinis, stok, pembayaran, dan insentif semakin terhubung serta
memiliki guard yang lebih kuat. Pencapaian terpenting bukan hanya penambahan
halaman baru, tetapi perbaikan integritas lintas modul: satu koreksi klinis kini
memiliki dampak yang jelas terhadap infus aktual, material, stok, finance,
snapshot, dan audit.

Data penggunaan menunjukkan aplikasi telah dipakai intensif oleh pengguna
utama, tetapi pengisian belum merata: 80,04% keterlibatan staff–sesi telah
lengkap dan 784 masih memerlukan tindak lanjut. Angka ini harus diperlakukan
sebagai snapshot kumulatif karena sumber diekspor dengan filter semua tanggal.

Fokus berikutnya sebaiknya bergeser dari penambahan fitur cepat menuju UAT
lintas role, rekonsiliasi data production, observability, dan penyederhanaan
proses bagi pengguna non-teknis.
