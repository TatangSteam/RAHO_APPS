# Panduan Sangat Mudah — Input Manual Sesi Terapi dengan AI

## Mulai dari Sini

Panduan ini dibuat untuk Nakes dan Admin Layanan yang ingin mengetik data sesi secara manual melalui percakapan AI.

Pengguna **tidak perlu mengunggah screenshot atau foto**. Pengguna hanya mengunggah file panduan/template kosong, kemudian menjawab pertanyaan AI satu per satu.

Pengguna juga tidak perlu memahami JSON, API, kode program, atau ID internal ERP.

## Cara Memulai

1. Buka AI yang diizinkan perusahaan.
2. Unggah file panduan ini.
3. Ketik kalimat berikut:

```text
Saya ingin input manual data sesi terapi. Tolong tanyakan satu per satu dengan bahasa sederhana. Jangan meminta screenshot, foto, atau ID internal ERP. Apa yang harus saya isi pertama kali?
```

4. Jawab setiap pertanyaan AI.
5. Jika tidak tahu, jawab:

```text
BELUM TAHU
```

6. Jika data tidak digunakan pada sesi tersebut, jawab:

```text
TIDAK ADA
```

7. Setelah selesai, periksa ringkasan AI sebelum meminta Excel.

---

# Informasi yang Perlu Dibaca dari ERP atau Catatan

Pengguna mengetik data berikut secara manual ketika ditanyakan AI:

1. peran pengguna;
2. nama lengkap member;
3. kode sesi atau nomor member, hanya jika pengguna mengetahuinya;
4. kode atau nama cabang, jika diketahui;
5. tanggal terapi, jika diketahui;
6. infus ke, jika diketahui;
7. status sesi;
8. apakah infus aktual sudah tersimpan;
9. therapy plan sebelum tindakan;
10. infus yang benar-benar diberikan;
11. alasan perbedaan, jika ada;
12. pemberi instruksi perubahan; dan
13. persetujuan Nakes/dokter.

ID internal seperti `sessionId`, `memberId`, `branchId`, dan `userId` tidak perlu dicari atau diketik. Importer akan mencarinya otomatis.

---

# Instruksi Wajib untuk AI

Bagian ini ditujukan kepada AI yang membaca panduan ini.

AI wajib:

1. memakai Bahasa Indonesia sederhana;
2. memandu pengguna melalui input manual;
3. tidak meminta screenshot, foto, hasil OCR, atau dokumen pendukung;
4. tidak meminta ID internal ERP;
5. mengajukan hanya satu pertanyaan utama setiap kali;
6. memberi nomor kemajuan, misalnya `Langkah 1 dari 9`;
7. memberikan contoh jawaban;
8. menerima jawaban `BELUM TAHU` dan `TIDAK ADA`;
9. menyimpan jawaban selama percakapan;
10. mengulangi kembali angka untuk dikonfirmasi;
11. tidak menebak data yang kosong;
12. tidak membuat keputusan klinis;
13. tidak mengubah data agar plan dan aktual terlihat sama;
14. tidak menampilkan JSON atau istilah teknis sebelum pemeriksaan selesai; dan
15. tidak menyatakan data sudah masuk ERP.

## Jawaban Pertama yang Wajib Diberikan AI

Jika pengguna bertanya `Apa yang harus saya lakukan?`, AI harus menjawab:

```text
Baik, saya akan memandu Anda mengisi data secara manual, satu pertanyaan setiap kali.

Anda tidak perlu mengunggah screenshot atau foto dan tidak perlu mencari ID sistem.

Jika tidak tahu, jawab “BELUM TAHU”.
Jika komponen tidak digunakan, jawab “TIDAK ADA” atau angka 0.

Langkah 1 dari 9 — Siapa yang sedang mengisi?

A. Nakes
B. Admin Layanan
C. MSO
D. Lainnya

Balas cukup dengan A, B, C, atau D.
```

AI harus menunggu jawaban sebelum melanjutkan.

---

# Urutan Input Manual

## Langkah 1 dari 9 — Peran Pengguna

Tanyakan apakah pengguna adalah Nakes, Admin Layanan, MSO, atau peran lain.

Jika pengguna adalah Admin Layanan, jelaskan bahwa ia boleh mencatat data tetapi tidak boleh menentukan dosis atau alasan klinis sendiri.

## Langkah 2 dari 9 — Nama Member

Nama adalah data utama yang harus ditanyakan. Gunakan pertanyaan:

```text
Ketik nama lengkap member sesuai yang tertulis di ERP.

Contoh: Jovan Prabowo Kuncoro
```

Setelah pengguna menjawab, AI wajib menuliskan kembali nama tersebut:

```text
Nama yang saya catat:
“[NAMA LENGKAP]”

Pastikan ejaan, urutan nama, dan gelarnya benar.
A. Sudah benar
B. Belum benar, saya akan mengetik ulang
```

Jika pengguna memilih B, minta nama diketik ulang dan lakukan konfirmasi kembali. Jangan melanjutkan sebelum nama dikonfirmasi.

Tandai dalam data kerja AI bahwa nama telah dikonfirmasi. AI tidak boleh mengubah singkatan, gelar, atau ejaan nama sendiri.

## Langkah 3 dari 9 — Mencari Sesi Berdasarkan Nama

Tanyakan:

```text
Apakah Anda mengetahui kode sesi atau nomor member?

A. Tahu kode sesi
B. Tahu nomor member
C. Tidak tahu keduanya
```

Jika pengguna memilih C, jangan meminta pengguna mencari ID. Catat nama yang sudah dikonfirmasi sebagai acuan pencarian.

Importer harus mencari member berdasarkan nama lengkap yang telah dikonfirmasi:

- jika hanya ada satu member dan satu sesi yang sesuai, lanjutkan;
- jika ada beberapa member atau sesi dengan nama sama, tampilkan pilihan sederhana berisi nama, cabang, tanggal terapi, dan infus ke;
- pengguna harus memilih data yang benar;
- jangan menampilkan atau meminta ID internal; dan
- jangan melanjutkan import sebelum pilihan unik dikonfirmasi.

Jika kode sesi, nomor member, cabang, tanggal terapi, atau infus ke diketahui, simpan sebagai informasi tambahan. Semua informasi tambahan boleh dijawab `BELUM TAHU`.

## Langkah 4 dari 9 — Status Sesi

Tanyakan satu per satu:

```text
Apakah sesi sudah ditandai selesai di ERP?
A. Belum selesai
B. Sudah selesai
C. BELUM TAHU
```

Kemudian tanyakan:

```text
Apakah “Infus Aktual” sudah pernah disimpan di ERP?
A. Belum
B. Sudah
C. BELUM TAHU
```

Jika sesi sudah selesai atau infus sudah tersimpan, hentikan alur import biasa. Jelaskan bahwa pengguna perlu menghubungi petugas berwenang untuk prosedur koreksi/reversal.

## Langkah 5 dari 9 — Therapy Plan Awal

Tanyakan nomor therapy plan terlebih dahulu.

Setelah itu, tanyakan nilai plan satu per satu dengan urutan berikut:

1. IFA 250 dalam botol;
2. IFA 500 dalam botol;
3. HHO dalam ml;
4. HHO Konsentrat dalam ml;
5. H2 dalam ml;
6. NO total dalam plan, dalam ml;
7. Gasotransmitter/Gaso dalam ml;
8. O2 dalam ml;
9. O3/Ozone dalam ml;
10. EDTA dalam ml;
11. Methylene Blue/MB dalam ml;
12. H2S dalam ml;
13. KCL dalam ml; dan
14. Jumlah NB.

Untuk setiap pertanyaan, AI harus memberi contoh:

```text
Berapa HHO pada therapy plan?
Ketik angka saja dalam ml.
Contoh: 5
Jika tidak digunakan, ketik 0.
Jika belum tahu, ketik BELUM TAHU.
```

AI harus memastikan IFA 250 dan IFA 500 tidak sama-sama lebih dari nol.

Setelah semua nilai dijawab, tampilkan kembali tabel plan dan minta konfirmasi.

## Langkah 6 dari 9 — Infus Aktual

Jelaskan terlebih dahulu:

```text
Sekarang kita mencatat yang benar-benar diberikan kepada pasien, bukan menyalin therapy plan.
```

Tanyakan nilai aktual satu per satu dengan urutan yang sama seperti therapy plan.

Untuk NO, gunakan pertanyaan:

```text
Berapa NO tambahan di luar kandungan IFA yang benar-benar diberikan?
Ketik angka dalam ml. Jika tidak ada tambahan, ketik 0.
```

Kemudian tanyakan detail berikut satu per satu:

1. tipe botol: IFA atau EDTA;
2. jenis cairan;
3. volume carrier dalam ml;
4. jumlah jarum; dan
5. tanggal produksi dengan format `YYYY-MM-DD`.

Setelah selesai, tampilkan kembali tabel aktual dan minta konfirmasi.

## Langkah 7 dari 9 — Perbandingan Plan dan Aktual

AI harus menghitung perbedaan per komponen:

```text
Selisih = Aktual - Plan
```

AI menampilkan tabel sederhana:

| Komponen | Plan | Aktual | Selisih | Satuan | Status |
|---|---:|---:|---:|---|---|
| Contoh HHO | 5 | 7 | 2 | ml | DEVIASI |

Jika semuanya sama, jelaskan bahwa koreksi plan tidak diperlukan.

Jika ada perbedaan, lanjutkan ke langkah 8.

## Langkah 8 dari 9 — Alasan dan Persetujuan

Untuk setiap deviasi, tanyakan:

1. alasan faktual perubahan;
2. nama orang yang memberi instruksi;
3. jabatan pemberi instruksi;
4. waktu instruksi, jika diketahui; dan
5. catatan atau nomor referensi, jika ada.

Jangan membuat alasan berdasarkan selisih angka.

Kemudian tanyakan:

```text
Apakah data sudah diperiksa oleh Nakes/dokter yang berwenang?
A. Sudah
B. Belum
```

Jika sudah, minta nama pemeriksa dan waktu pemeriksaan. Identitas internal pemeriksa diambil otomatis dari akun ERP saat approval, bukan diketik pengguna.

## Langkah 9 dari 9 — Ringkasan dan Pilihan Hasil

AI harus memberikan ringkasan:

```text
Pemeriksaan input manual selesai.

Status: [BELUM LENGKAP / MENUNGGU KONFIRMASI KLINIS / SIAP DIREVIEW]

Data yang sudah lengkap:
- ...

Data yang masih kurang:
1. ...

Tindakan berikutnya:
1. ...
```

Kemudian tawarkan:

```text
Hasil apa yang Anda inginkan?

A. Tampilkan ringkasan di chat
B. Buat file Excel
C. Buat data VALIDATE_ONLY untuk importer
D. Perbaiki jawaban tertentu
```

Hasil pertama untuk importer selalu `VALIDATE_ONLY`, bukan `COMMIT`.

---

# Aturan Khusus IFA 250 dan NO

Jika aktual memakai IFA 250, AI harus menjelaskan:

```text
IFA 250 sudah mengandung NO bawaan. NO pada therapy plan adalah total NO, sedangkan NO aktual yang ditanyakan adalah NO tambahan di luar IFA.
```

Rumus:

```text
NO plan setelah koreksi
= NO aktual tambahan
+ (jumlah botol IFA 250 aktual x NO bawaan per botol)
```

Jika jumlah NO bawaan tidak disebutkan, gunakan default ERP `2.5 ml` per botol dan beri peringatan.

---

# Aturan untuk Admin Layanan

Admin Layanan boleh:

- mengetik referensi sesi dan member;
- mengetik angka plan yang terlihat di ERP;
- mengetik catatan aktual yang diberikan Nakes;
- mengetik alasan dan nama pemberi instruksi sesuai catatan;
- memperbaiki kesalahan pengetikan; dan
- meminta hasil Excel.

Admin Layanan tidak boleh:

- menentukan dosis sendiri;
- membuat alasan klinis;
- memberi persetujuan atas nama Nakes/dokter;
- mengubah aktual agar sama dengan plan; atau
- mengeksekusi koreksi jika role ERP tidak berwenang.

Jika koreksi plan diperlukan, AI harus mengarahkan hasil kepada `DOCTOR`, `NURSE`, `ADMIN_MANAGER`, atau `SUPER_ADMIN` yang memiliki akses cabang.

---

# Cara Meminta Hasil Excel

Setelah semua jawaban dikonfirmasi, pengguna mengetik:

```text
Buatkan hasil input manual ini dalam Excel yang rapi dan mudah diperiksa. Jangan masukkan screenshot, foto, atau ID internal ERP.
```

AI harus menghasilkan file `.xlsx` dengan lima sheet:

1. `Ringkasan`;
2. `Plan_vs_Aktual`;
3. `Validasi`;
4. `Catatan_Manual`; dan
5. `Import_Payload`.

Pengguna memeriksa tiga sheet pertama. Sheet `Import_Payload` digunakan oleh importer dan tidak perlu diedit.

Setelah membuat Excel, AI harus berkata:

```text
File Excel sudah dibuat dari jawaban manual Anda.

Silakan periksa:
1. Ringkasan — pastikan sesi dan member benar.
2. Plan_vs_Aktual — pastikan semua angka benar.
3. Validasi — lihat apakah masih ada data yang kurang.

Jangan mengubah sheet Import_Payload. File belum masuk ke ERP sampai diperiksa Nakes/dokter dan diproses oleh importer.
```

---

# Contoh Percakapan Awal

```text
Pengguna:
Apa yang harus dilakukan?

AI:
Baik, saya akan memandu Anda mengisi data secara manual, satu pertanyaan setiap kali.

Anda tidak perlu mengunggah screenshot atau foto dan tidak perlu mencari ID sistem.

Langkah 1 dari 9 — Siapa yang sedang mengisi?
A. Nakes
B. Admin Layanan
C. MSO
D. Lainnya

Balas cukup dengan A, B, C, atau D.
```

Contoh saat pengguna tidak tahu:

```text
Pengguna:
BELUM TAHU

AI:
Tidak apa-apa. Saya tandai data tersebut sebagai BELUM TAHU dan tidak akan menebaknya.

Data ini perlu dibaca dari halaman sesi ERP atau dikonfirmasi kepada petugas terkait. Kita lanjut ke pertanyaan berikutnya terlebih dahulu.
```

---

# Kapan AI Harus Menghentikan Proses

AI menghentikan alur biasa jika:

- sesi sudah selesai;
- infus aktual sudah tersimpan;
- stok atau jurnal sudah diposting;
- referensi sesi tidak unik;
- plan atau aktual belum dikonfirmasi;
- alasan deviasi tidak diketahui;
- pemberi instruksi tidak diketahui;
- pengguna meminta AI menentukan dosis; atau
- pengguna meminta AI membuat persetujuan palsu.

Pesan AI:

```text
Proses biasa saya hentikan agar data medis dan stok tetap aman. Data belum siap diimpor.

Yang perlu dilakukan:
1. [tindakan]
2. [petugas yang harus melakukan]
3. [data manual yang perlu dilengkapi]

Setelah datanya tersedia, ketik “LANJUTKAN” dan saya akan meneruskan dari bagian yang belum lengkap.
```

---

# Keamanan Data

- Gunakan hanya akun AI yang disetujui perusahaan.
- Jangan mengetik data pasien pada akun AI pribadi.
- Jangan menyalin hasil percakapan ke grup yang tidak berwenang.
- AI tidak boleh menyatakan data sudah masuk ERP sebelum importer memberikan hasil berhasil.

---

# Dokumen Lanjutan

Setelah input manual selesai, AI menggunakan:

```text
docs/FORM_UPLOAD_AI_PENCATATAN_SESI_TERAPI.md
docs/TEMPLATE_AI_IMPORT_KOREKSI_THERAPY_PLAN.md
```

Pengguna awam tidak perlu membaca bagian teknis tersebut.
