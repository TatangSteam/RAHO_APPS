# Panduan Menyalakan Sinkronisasi ERP ke Zoho Books

Panduan ini dibuat untuk operator yang tidak terbiasa dengan teknis. Ikuti urutannya dan jangan langsung memilih **LIVE**.

## Ringkasan paling penting

- ERP RAHO adalah sumber data utama.
- Zoho Books adalah tujuan pencatatan finance, logistik, dan member.
- ERP tetap dapat dipakai ketika Zoho mati atau mode sinkronisasi `OFF`.
- Gunakan urutan `OFF` → `DRY_RUN` → `CANARY` → `LIVE`.
- `162` bukan batas maksimum. Itu hanya jumlah kontak PST pada pemeriksaan saat ini.
- Data dikirim bertahap agar tidak membanjiri API Zoho.
- Dugaan data ganda tidak dibuat otomatis; data tersebut ditahan untuk diperiksa manusia.
- Data terapi atau medis tidak dikirim sebagai contact Zoho.

## Arti setiap mode

| Mode | Apa yang terjadi |
| --- | --- |
| `OFF` | Tidak ada data yang dikirim ke Zoho. ERP tetap berjalan. |
| `DRY_RUN` | Sistem memeriksa antrean dan payload, tetapi tidak menulis ke Zoho. |
| `CANARY` | Pengiriman nyata hanya untuk cabang percobaan yang dipilih. |
| `LIVE` | Pengiriman nyata untuk seluruh scope yang sudah disetujui. |

Jangan langsung memilih `LIVE`. Jalankan CANARY dan rekonsiliasi selama lima hari kerja bebas mismatch terlebih dahulu.

## Status sistem saat panduan ini dibuat

Tanggal pemeriksaan: 6 Agustus 2026.

- Organisasi Zoho Books: **Ether**.
- Koneksi: sehat dan scope lengkap.
- Mode: `CANARY` untuk cabang PST.
- Cabang CANARY: **PST — RAHO Premier Jakarta**.
- Event PST yang sudah lolos DRY_RUN: **162**.
- Contact PST berhasil `PROCESSED`: **162**.
- Mapping member ERP ke Zoho aktif: **162**.
- Event di luar scope CANARY yang tetap ditahan: **23**.
- Dead-letter: **0**.
- Exception material terbuka: **0**.
- Approval Finance dan Logistik: lengkap.
- Rekonsiliasi: **162 diperiksa, 162 cocok, 0 exception, 0 error**.
- Review duplikasi tertunda: **0**.

Status ini akan berubah saat ada data baru. Selalu periksa ringkasan **Hasil Sinkronisasi CANARY** pada UI sebelum melakukan tindakan.

## Data member yang dikirim

Contact member hanya berisi data operasional berikut:

- nama;
- email, jika tersedia;
- nomor telepon, jika tersedia;
- alamat tagihan, jika tersedia;
- ID unik ERP dengan format `RAHO:MEMBER:<id>`.

Data yang tidak dikirim:

- diagnosis;
- evaluasi dan catatan terapi;
- rencana terapi;
- rekam medis;
- NIK;
- tanggal lahir;
- emergency contact.

## Perlindungan duplikasi

Sebelum membuat contact, sistem memeriksa:

1. ID unik ERP/RAHO di Zoho;
2. email;
3. nomor pajak untuk vendor;
4. nama;
5. nomor telepon, termasuk penyamaan format `08...`, `8...`, dan `+62...`.

Jika ID ERP cocok persis, contact yang sama diperbarui. Jika hanya nama, email, pajak, atau telepon yang mirip, sistem menahan data sebagai **PENDING REVIEW**. Operator harus memilih contact Zoho yang benar; sistem tidak boleh menebak dan membuat duplikat.

Contact yang dibuat ERP mempunyai penanda:

- `dataOrigin = ERP` untuk contact baru dari ERP;
- `dataOrigin = MANUAL_ZOHO` jika contact lama yang dibuat manual dipilih saat review;
- `managementMode = ERP_MANAGED` setelah mapping disetujui;
- external ID `RAHO:...` sebagai identitas lintas sistem.

## Cara termudah melalui layar ERP

Masuk sebagai `SUPER_ADMIN`, lalu buka:

```text
/admin/integrations/zoho
```

### 1. Periksa koneksi

1. Buka tab **Koneksi**.
2. Pastikan organisasi aktif adalah **Ether**.
3. Pastikan tidak ada pesan reconnect atau scope kurang.
4. Jalankan tes koneksi jika tersedia.

### 2. Periksa master dan mapping

1. Buka tab **Master Zoho** dan jalankan discovery bila data Zoho berubah.
2. Buka **Item & Scope Cabang**.
3. Pastikan UOM, akun, item/paket, lokasi, metode pembayaran, customer, dan vendor yang digunakan sudah memiliki mapping.
4. Jangan lanjut jika masih ada status belum siap.

### 3. Periksa antrean

1. Buka tab **Antrean Sinkronisasi**.
2. Pastikan tidak ada `DEAD_LETTER`.
3. Periksa error `FAILED`; lakukan retry hanya setelah penyebabnya diperbaiki.
4. `PENDING` berarti data menunggu dikirim dan bukan error.

### 4. Jalankan DRY_RUN

1. Buka tab **Go-live & Exception**.
2. Isi ID cabang CANARY.
3. Klik **Simpan kontrol**.
4. Klik **Approval Finance** dan **Approval Logistik**.
5. Klik **Dry-run**.
6. Periksa hasil antrean dan pastikan tidak ada data sensitif/medis di preview.

### 5. Jalankan CANARY

1. Pastikan cabang yang dipilih hanya cabang percobaan, misalnya PST.
2. Pastikan jumlah data dan tujuan Zoho sudah disetujui penanggung jawab data.
3. Klik **Canary**.
4. Baca konfirmasi pengiriman nyata, lalu klik lanjut hanya jika organisasi dan jumlah benar.
5. Pantau kotak **Hasil Sinkronisasi CANARY** dan tab **Antrean Sinkronisasi** sampai tidak ada event cabang CANARY yang tertinggal tanpa alasan.
6. Event cabang lain tidak ikut diproses selama mode CANARY.

### 6. Periksa data ganda

1. Buka tab **Customer & Vendor**.
2. Cari baris dengan status review/pending review.
3. Cocokkan nama, email, telepon, dan ID ERP.
4. Pilih contact Zoho yang sudah ada hanya jika benar-benar orang/badan yang sama.
5. Jika ragu, jangan approve. Minta Finance/Admin memeriksa.

### 7. Jalankan reconciliation

1. Buka tab **Go-live & Exception**.
2. Klik **Jalankan reconciliation**.
3. Hasil yang aman adalah `COMPLETED`, exception `0`, dan error `0`.
4. Setiap mismatch `HIGH` atau `CRITICAL` wajib diselesaikan dan diberi catatan.
5. Lakukan selama lima hari kerja CANARY tanpa mismatch sebelum memilih `LIVE`.

### 8. Hentikan segera bila ada masalah

1. Buka **Go-live & Exception**.
2. Klik **Rollback OFF**.
3. Isi alasan yang jelas.

Rollback menghentikan pengiriman berikutnya, tetapi tidak menghapus data ERP dan tidak menghapus data yang sudah telanjur tercatat di Zoho.

## Cara melalui terminal untuk administrator

Buka PowerShell pada folder proyek, lalu masuk ke API:

```powershell
cd apps/api
```

### A. Pemeriksaan awal

```powershell
npm run zoho:check
npm run zoho:discover
npm run zoho:map-uom
npm run zoho:cutover-status
```

Lanjut hanya jika:

- `ready: true`;
- `connected: true`;
- organisasi benar;
- `deadLetters: 0`;
- `unresolvedMaterial: 0`;
- jumlah `canaryDryRunEvents` masuk akal.

Discovery membaca master dari Zoho untuk keperluan mapping. Ini bukan menarik transaksi Zoho menjadi sumber data ERP.

### B. Aktivasi CANARY nyata

Gunakan email SUPER_ADMIN dan jumlah event CANARY tervalidasi dari hasil pemeriksaan terbaru:

```powershell
npm run zoho:activate-canary -- jovanku1@gmail.com 162
```

Angka terakhir adalah pengaman perubahan jumlah, bukan batas sistem. Jika hasil pemeriksaan terbaru menunjukkan 200, gunakan 200. Perintah akan gagal jika jumlah berubah agar operator memeriksa ulang scope sebelum mengirim.

Aktivasi ini:

- menyimpan persetujuan Finance dan Logistik;
- membuka antrean master yang sudah lolos rehearsal;
- mengaktifkan mode `CANARY`;
- tetap membatasi pengiriman ke cabang CANARY.

### C. Proses antrean sekarang

Perintah berikut melakukan penulisan nyata ke Zoho:

```powershell
npm run zoho:drain-canary -- 25 2
```

`25` adalah jumlah putaran worker maksimum dan `2` adalah ukuran batch aman. Keduanya bukan jumlah maksimal data. Event diproses berurutan agar tidak membanjiri concurrent request Zoho. Jika data lebih banyak, worker melanjutkan pada putaran berikutnya; event tidak hilang.

Hasil penting:

- `PROCESSED`: berhasil dikirim;
- `PENDING`: masih menunggu atau menunggu jadwal retry;
- `FAILED`: gagal dan perlu diperiksa;
- `DEAD_LETTER`: gagal berulang kali dan wajib ditangani;
- `pendingMemberReviews`: diduga duplikat dan menunggu keputusan manusia;
- `nonCanaryPendingHeld`: data di luar cabang CANARY yang sengaja ditahan.

### D. Rekonsiliasi sesudah kirim

```powershell
npm run zoho:reconcile
npm run zoho:cutover-status
```

Jangan promosi ke LIVE jika `totalChecked` masih 0 setelah pengiriman, ada exception, ada dead-letter, atau belum lima hari kerja CANARY bebas mismatch.

### E. Tombol darurat melalui terminal

```powershell
npm run zoho:hold -- jovanku1@gmail.com "Alasan penghentian"
```

Pastikan hasil menampilkan `mode: OFF`.

## Persetujuan pengiriman data

Sebelum meminta pihak lain menjalankan pengiriman, persetujuan harus menyebut jumlah, cabang, tujuan, dan jenis data. Contoh persetujuan untuk kondisi saat panduan ini dibuat:

> Saya menyetujui pengiriman nyata 162 kontak member cabang PST, berisi nama, email, nomor telepon, alamat, dan ID ERP, ke Zoho Books organisasi Ether. Data terapi/medis tidak dikirim. Kontak yang diduga duplikat harus ditahan untuk review.

Jika jumlah, cabang, organisasi, atau jenis data berubah, buat persetujuan baru dengan angka dan tujuan terbaru.

## Kapan boleh memilih LIVE?

LIVE hanya boleh dinyalakan jika semuanya terpenuhi:

- CANARY berhasil;
- reconciliation benar-benar memeriksa data (`totalChecked > 0`);
- tidak ada mismatch material;
- tidak ada dead-letter;
- review duplikasi sudah ditangani;
- lima hari kerja CANARY bebas mismatch sudah tercatat;
- Finance dan Logistik menyetujui;
- organisasi tujuan sudah diperiksa ulang.

## FAQ singkat

### Bagaimana jika data lebih dari 162?

Tetap bisa. Tidak ada batas 162. Sistem memproses data dalam batch kecil dan melanjutkan sampai antrean selesai.

### Apakah ERP berhenti jika Zoho bermasalah?

Tidak. ERP tetap berjalan. Ubah mode menjadi `OFF`, perbaiki koneksi, lalu retry setelah aman.

### Apakah data dari Zoho ditarik untuk menimpa ERP?

Tidak. Discovery dan reconciliation membaca metadata/status untuk mapping dan pembandingan. ERP tetap sumber data utama.

### Apa yang dilakukan jika ada data manual di Zoho?

Sistem menandainya sebagai kandidat manual. Operator memilih mapping yang benar. Setelah disetujui, asal data tetap tercatat sehingga data ERP dan data manual dapat dibedakan.

### Apakah sesi terapi akan terganggu jika Zoho gagal?

Tidak seharusnya. Sinkronisasi Zoho menggunakan antrean asynchronous. Sesi terapi, evaluasi, stok lokal, pembayaran, dan pembelian tetap berjalan tanpa menunggu Zoho.

## Larangan penting

- Jangan menaruh `.env`, client secret, refresh token, atau encryption key di dokumen/chat/screenshot.
- Jangan menghapus contact Zoho untuk menyelesaikan duplikasi tanpa pemeriksaan Finance.
- Jangan mengubah external RAHO ID secara manual.
- Jangan memilih LIVE hanya karena koneksi berstatus sehat.
- Jangan retry berulang-ulang tanpa membaca error; ini dapat membuat log dan API Zoho penuh.
