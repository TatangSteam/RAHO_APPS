# Form Input Manual AI — Pencatatan Sesi Terapi dan Deviasi Infus

## Jika Anda Bingung Harus Mulai dari Mana

Gunakan panduan yang paling sederhana berikut:

```text
docs/PANDUAN_MUDAH_AI_PENCATATAN_SESI_TERAPI.md
```

Unggah panduan tersebut ke AI lalu ketik:

```text
Saya ingin input manual data sesi terapi. Tolong tanyakan satu per satu dengan bahasa sederhana. Jangan meminta screenshot, foto, atau ID internal ERP. Apa yang harus saya isi pertama kali?
```

AI akan bertanya satu per satu. Anda tidak perlu mengisi seluruh form sekaligus dan tidak perlu memahami istilah teknis.

## Petunjuk Singkat

Form ini diisi secara manual oleh **Nakes atau Admin Layanan** melalui percakapan AI. Pengguna cukup mengunggah template kosong, lalu AI menanyakan isi form satu per satu.

Cara menggunakan:

1. Unggah file template ini ke AI.
2. Minta AI melakukan input manual satu pertanyaan setiap kali.
3. Jawab berdasarkan data yang benar-benar tersedia di ERP atau catatan Nakes.
4. Jangan menebak data yang tidak diketahui. Tulis `BELUM ADA`.
5. Jangan mengunggah screenshot atau foto.
6. Setelah seluruh pertanyaan selesai, minta AI menampilkan ringkasan untuk diperiksa.

ID internal ERP seperti `sessionId`, `memberId`, `branchId`, dan `userId` **tidak perlu diisi**. Jika kode sesi dan nomor member tidak diketahui, pengguna cukup mengetik nama lengkap member dan mengonfirmasi bahwa ejaannya benar. Importer akan mencari data yang cocok secara otomatis.

> Form ini bukan persetujuan klinis dan tidak langsung mengubah data ERP. AI hanya memeriksa kelengkapan dan memberikan urutan tindakan. Keputusan klinis tetap dilakukan oleh Nakes/dokter yang berwenang.

## Arti Status Pengisian

Gunakan salah satu nilai berikut:

- `TERISI`: data tersedia dan telah diperiksa;
- `BELUM ADA`: data belum diperoleh;
- `TIDAK BERLAKU`: field tidak diperlukan pada sesi ini;
- `PERLU KONFIRMASI`: data tersedia tetapi belum dapat dipastikan.

Jangan menggunakan tanda `-` karena artinya dapat menjadi ambigu.

---

# A. Identitas Pencatatan

| Data | Isian |
|---|---|
| Tanggal form dibuat | BELUM ADA |
| Jam form dibuat | BELUM ADA |
| Nama pengisi | BELUM ADA |
| Jabatan pengisi | NAKES / ADMIN LAYANAN |
| Nomor/referensi dokumen sumber | BELUM ADA |

# B. Identitas Sesi dan Member

| Data | Isian |
|---|---|
| Nama lengkap member — wajib | BELUM ADA |
| Nama sudah dikonfirmasi benar? | YA / TIDAK |
| Kode sesi — opsional | BELUM TAHU |
| Nomor member — opsional | BELUM TAHU |
| Tanggal dan jam terapi — opsional | BELUM TAHU |
| Kode atau nama cabang — opsional | BELUM TAHU |
| Infus ke — opsional | BELUM TAHU |

> Nama lengkap member adalah acuan utama ketika kode/nomor tidak diketahui. AI wajib mengulang nama dan meminta pengguna memastikan ejaan, urutan nama, serta gelarnya. Importer hanya boleh melanjutkan jika nama mengarah ke satu member dan satu sesi. Jika ada nama yang sama, importer menampilkan pilihan berdasarkan cabang, tanggal terapi, dan infus ke untuk dikonfirmasi pengguna.

# C. Status Sesi di ERP

| Pemeriksaan | Isian |
|---|---|
| Apakah sesi sudah selesai/completed? | YA / TIDAK / BELUM DIKETAHUI |
| Completion status ERP | PENDING / COMPLETED / CANCELLED / BELUM DIKETAHUI |
| Apakah infus aktual sudah pernah disimpan? | YA / TIDAK / BELUM DIKETAHUI |
| Apakah material/stok sudah diposting? | YA / TIDAK / BELUM DIKETAHUI |
| Apakah jurnal sesi sudah terbentuk? | YA / TIDAK / BELUM DIKETAHUI |

Jika sesi sudah completed, infus sudah tersimpan, atau stok/jurnal sudah diposting, jangan melakukan import standar. AI harus mengarahkan kasus tersebut ke prosedur koreksi/reversal yang disetujui pihak berwenang.

# D. Petugas Sesi

| Data | Isian |
|---|---|
| Nama dokter | BELUM ADA |
| Nama Nakes pelaksana | BELUM ADA |
| Nama MSO, jika terlibat | TIDAK BERLAKU |
| Role ERP petugas yang akan melakukan koreksi | BELUM ADA |

Role backend yang dapat mengoreksi therapy plan sesi saat ini adalah:

- `SUPER_ADMIN`;
- `ADMIN_MANAGER`;
- `DOCTOR`; atau
- `NURSE`.

`ADMIN_LAYANAN` dapat menyiapkan dan mengunggah form, tetapi saat ini tidak dapat mengeksekusi endpoint koreksi therapy plan sesi. Jika koreksi diperlukan, Admin Layanan harus meneruskan hasil pemeriksaan kepada role yang berwenang.

# E. Therapy Plan Sebelum Tindakan

Salin nilai dari therapy plan yang sedang terhubung dengan sesi. Gunakan angka tanpa menuliskan satuan di kolom nilai.

| Komponen | Nilai Plan | Satuan | Status |
|---|---:|---|---|
| Nomor therapy plan | BELUM ADA | nomor | BELUM ADA |
| IFA 250 | BELUM ADA | botol | BELUM ADA |
| IFA 500 | BELUM ADA | botol | BELUM ADA |
| HHO | BELUM ADA | ml | BELUM ADA |
| HHO Konsentrat | BELUM ADA | ml | BELUM ADA |
| H2 | BELUM ADA | ml | BELUM ADA |
| NO total dalam plan | BELUM ADA | ml | BELUM ADA |
| Gasotransmitter/Gaso | BELUM ADA | ml | BELUM ADA |
| O2 | BELUM ADA | ml | BELUM ADA |
| O3/Ozone | BELUM ADA | ml | BELUM ADA |
| EDTA | BELUM ADA | ml | BELUM ADA |
| Methylene Blue/MB | BELUM ADA | ml | BELUM ADA |
| H2S | BELUM ADA | ml | BELUM ADA |
| KCL | BELUM ADA | ml | BELUM ADA |
| Jumlah NB | BELUM ADA | jumlah | BELUM ADA |

## Kandungan IFA

| Nama zat | Jumlah | Satuan | Keterangan |
|---|---:|---|---|
| NO | BELUM ADA | ml | NO bawaan IFA 250 atau BELUM ADA |

Keterangan therapy plan awal:

```text
BELUM ADA
```

# F. Infus Aktual yang Dilaksanakan

Isi berdasarkan tindakan yang benar-benar diberikan kepada member, bukan dengan menyalin plan.

| Komponen | Nilai Aktual | Satuan | Catatan Manual |
|---|---:|---|---|
| IFA 250 | BELUM ADA | botol | BELUM ADA |
| IFA 500 | BELUM ADA | botol | BELUM ADA |
| HHO | BELUM ADA | ml | BELUM ADA |
| HHO Konsentrat | BELUM ADA | ml | BELUM ADA |
| H2 | BELUM ADA | ml | BELUM ADA |
| NO tambahan di luar IFA | BELUM ADA | ml | BELUM ADA |
| Gasotransmitter/Gaso | BELUM ADA | ml | BELUM ADA |
| O2 | BELUM ADA | ml | BELUM ADA |
| O3/Ozone | BELUM ADA | ml | BELUM ADA |
| EDTA | BELUM ADA | ml | BELUM ADA |
| Methylene Blue/MB | BELUM ADA | ml | BELUM ADA |
| H2S | BELUM ADA | ml | BELUM ADA |
| KCL | BELUM ADA | ml | BELUM ADA |
| Jumlah NB | BELUM ADA | jumlah | BELUM ADA |

## Detail Pelaksanaan Infus

| Data | Isian |
|---|---|
| Tipe botol | IFA / EDTA / BELUM ADA |
| Jenis cairan/carrier | BELUM ADA |
| Volume carrier | BELUM ADA ml |
| Jumlah jarum | BELUM ADA |
| Tanggal produksi | BELUM ADA |
| Jam produksi, jika tersedia | BELUM ADA |

> `IFA 250` dan `IFA 500` tidak boleh digunakan bersamaan. Jika keduanya tercatat lebih dari nol, tandai `PERLU KONFIRMASI`.

# G. Deviasi antara Plan dan Aktual

| Pertanyaan | Isian |
|---|---|
| Apakah ada perbedaan plan dan aktual? | YA / TIDAK / BELUM DIKETAHUI |
| Komponen yang berbeda | BELUM ADA |
| Alasan deviasi faktual | BELUM ADA |
| Kondisi pasien yang mendasari, jika dicatat Nakes | BELUM ADA |
| Siapa yang memberikan instruksi perubahan? | BELUM ADA |
| Waktu instruksi perubahan | BELUM ADA |
| Media/sumber instruksi | VERBAL / TERTULIS / SISTEM / BELUM ADA |
| Nomor referensi catatan, jika ada | BELUM ADA |

Catatan deviasi lengkap:

```text
BELUM ADA
```

AI tidak boleh membuat alasan klinis dari selisih angka. Jika alasan tidak dicatat, AI harus meminta konfirmasi kepada Nakes/dokter.

# H. Usulan Pembenahan Therapy Plan

Bagian ini hanya diisi jika sudah ada instruksi atau konfirmasi klinis. Admin Layanan tidak boleh menentukan dosis koreksi sendiri.

| Data | Isian |
|---|---|
| Apakah plan perlu disesuaikan dengan aktual? | YA / TIDAK / PERLU KONFIRMASI |
| Nomor therapy plan yang dikoreksi | BELUM ADA |
| Field yang dikoreksi | BELUM ADA |
| Nilai plan setelah koreksi | BELUM ADA |
| Alasan koreksi | BELUM ADA |
| Nama pemberi instruksi klinis | BELUM ADA |

## Aturan Khusus NO

Untuk IFA 250, NO pada therapy plan adalah total NO, sedangkan NO aktual adalah NO tambahan di luar IFA.

```text
NO plan setelah koreksi
= NO aktual tambahan
+ (jumlah botol IFA 250 aktual x NO bawaan per botol)
```

Jika NO bawaan tidak tercantum, ERP menggunakan default `2.5 ml` per botol IFA 250. AI harus memberikan peringatan bahwa nilai default digunakan.

# I. Catatan Manual dan Referensi

Isi referensi yang diketik pengguna. Tidak perlu mengunggah dokumen, screenshot, atau foto.

| Sumber catatan | Nomor/referensi | Keterangan |
|---|---|---|
| Therapy plan yang dibaca dari ERP | BELUM ADA | BELUM ADA |
| Catatan pelaksanaan Nakes | BELUM ADA | BELUM ADA |
| Instruksi dokter/Nakes | BELUM ADA | BELUM ADA |
| Referensi lain | BELUM ADA | BELUM ADA |

Jika tidak ada nomor referensi, tulis sumbernya secara sederhana, misalnya `dibaca dari halaman sesi ERP` atau `disampaikan oleh Nakes [nama]`.

# J. Persetujuan Manusia

| Data | Isian |
|---|---|
| Sudah diperiksa Nakes? | YA / TIDAK |
| Nama pemeriksa Nakes | BELUM ADA |
| Sudah disetujui dokter/petugas klinis berwenang? | YA / TIDAK / TIDAK DIPERLUKAN |
| Nama pemberi persetujuan | BELUM ADA |
| Tanggal dan jam persetujuan | BELUM ADA |
| Catatan persetujuan | BELUM ADA |

Persetujuan tidak boleh diisi atau disimpulkan oleh AI. Harus berasal dari manusia yang disebutkan secara jelas. Saat import, identitas internal pelaksana dan pemberi approval diambil otomatis dari akun ERP yang login.

# K. Pertanyaan kepada AI

Gunakan pertanyaan berikut setelah mengunggah template kosong ini:

```text
Isi form pencatatan sesi terapi ini melalui input manual. Tanyakan satu pertanyaan setiap kali dan simpan jawaban saya sampai selesai.

Jangan meminta screenshot, foto, lampiran, atau ID internal ERP. Jangan menebak data medis atau identitas yang tidak tersedia. Jangan langsung membuat payload COMMIT dan jangan menyatakan bahwa data telah masuk ke ERP.

Berikan jawaban dengan urutan berikut:
1. Ringkasan sesi dan status yang berhasil Anda baca.
2. Ulangi nama lengkap member dan minta saya memastikan namanya benar sebelum melanjutkan.
3. Daftar data wajib yang masih kosong, ambigu, atau bertentangan.
4. Daftar deviasi antara therapy plan dan infus aktual per field beserta satuannya.
5. Pemeriksaan aturan IFA dan perhitungan khusus NO bawaan IFA 250.
6. Apakah sesi aman diproses melalui alur standar atau harus dihentikan/escalate.
7. Tindakan berikutnya secara berurutan dan siapa yang harus melakukannya: Admin Layanan, Nakes, dokter, MSO, atau role ERP berwenang.
8. Status akhir: BELUM LENGKAP, MENUNGGU KONFIRMASI KLINIS, SIAP DIREVIEW, atau SIAP DIBUATKAN PAYLOAD VALIDATE_ONLY.
9. Jika saya meminta Excel, buat hasil akhir dalam file .xlsx dengan sheet Ringkasan, Plan_vs_Aktual, Validasi, Catatan_Manual, dan Import_Payload. Jangan menaruh ID internal ERP dalam kolom input.

Jika data sudah lengkap, tanyakan persetujuan saya sebelum membuat RAHO_AI_IMPORT_PAYLOAD. Payload pertama harus selalu VALIDATE_ONLY.
```

# L. Panduan Keputusan yang Harus Diikuti AI

AI harus memberi instruksi berdasarkan kondisi berikut.

## Kondisi 1 — Nama Member Belum Dikonfirmasi

Jika nama lengkap member belum ada atau belum dikonfirmasi:

1. hentikan penyusunan payload;
2. minta pengguna mengetik nama lengkap sesuai ERP;
3. tuliskan kembali nama tersebut dan minta konfirmasi `SUDAH BENAR`; dan
4. beri status `BELUM LENGKAP`.

Jika nama cocok dengan lebih dari satu member atau sesi, AI/importer harus menghentikan proses dan menampilkan pilihan sederhana berdasarkan cabang, tanggal terapi, dan infus ke. Pengguna wajib memilih data yang benar sebelum proses dilanjutkan.

## Kondisi 2 — Tidak Ada Deviasi

Jika semua nilai plan dan aktual cocok:

1. minta Nakes memastikan nilai aktual dan detail infus sudah benar;
2. pastikan sesi belum memiliki infus tersimpan;
3. minta persetujuan untuk membuat payload `VALIDATE_ONLY`; dan
4. jangan meminta koreksi therapy plan.

## Kondisi 3 — Ada Deviasi dan Alasan Sudah Jelas

Jika ada deviasi, alasan faktual tersedia, dan sesi belum selesai:

1. tampilkan perbedaan per field;
2. minta Nakes/dokter memverifikasi nilai aktual dan koreksi plan;
3. minta role ERP berwenang melakukan atau menyetujui koreksi plan;
4. setelah disetujui, buat payload `VALIDATE_ONLY`; dan
5. jangan membuat `COMMIT` tanpa persetujuan manusia lengkap.

## Kondisi 4 — Ada Deviasi tetapi Alasan Belum Ada

Jika angka berbeda tetapi alasan atau pemberi instruksi tidak tercatat:

1. jangan menyimpulkan alasan dari angka;
2. minta konfirmasi Nakes/dokter;
3. beri status `MENUNGGU KONFIRMASI KLINIS`; dan
4. kosongkan request import.

## Kondisi 5 — Pengisi adalah Admin Layanan

Jika koreksi therapy plan diperlukan dan pengisi memakai role `ADMIN_LAYANAN`:

1. izinkan Admin Layanan melengkapi form dan referensi catatan secara manual;
2. jangan menginstruksikan Admin Layanan mengeksekusi koreksi;
3. arahkan kepada `DOCTOR`, `NURSE`, `ADMIN_MANAGER`, atau `SUPER_ADMIN` yang memiliki akses cabang; dan
4. tunggu hasil koreksi/persetujuan sebelum melanjutkan.

## Kondisi 6 — Sesi Sudah Selesai atau Infus Sudah Tersimpan

Jika sesi completed, stok/jurnal sudah diposting, atau infus sudah ada:

1. hentikan import standar;
2. jangan mengubah therapy plan atau infus melalui payload biasa;
3. arahkan ke pihak berwenang untuk pemeriksaan audit dan prosedur reversal/koreksi; dan
4. beri status `HARUS DIEKSKALASI`.

# M. Checklist Sebelum Meminta Hasil Akhir

- [ ] Nama lengkap member sudah diketik dan dikonfirmasi benar.
- [ ] Jika nama tidak unik, pengguna sudah memilih member/sesi yang benar dari daftar kandidat.
- [ ] Status completion dan keberadaan infus aktual sudah diperiksa di ERP.
- [ ] Therapy plan awal disalin lengkap.
- [ ] Infus aktual dicatat berdasarkan tindakan nyata.
- [ ] Satuan setiap dosis jelas.
- [ ] Alasan deviasi dan pemberi instruksi tercatat.
- [ ] Sumber catatan manual atau nomor referensi sudah ditulis.
- [ ] Data sudah diperiksa Nakes.
- [ ] Tidak ada persetujuan yang diisi atas nama orang lain.
- [ ] Percakapan dilakukan melalui akun AI yang diizinkan organisasi.

# N. Cara Meminta Hasil Akhir dalam Excel

Setelah AI menyatakan data lengkap, gunakan permintaan berikut:

```text
Buat hasil pemeriksaan ini sebagai file Excel (.xlsx) yang rapi dan siap diunggah ke importer ERP.

Gunakan sheet:
1. Ringkasan — referensi sesi, member, cabang, status sesi, pengisi, dan approval.
2. Plan_vs_Aktual — satu baris per komponen dosis dengan kolom Komponen, Plan, Aktual, Delta, Satuan, Status, dan Catatan.
3. Validasi — seluruh pemeriksaan, hasil PASS/FAIL/PENDING, dan tindakan yang diperlukan.
4. Catatan_Manual — sumber catatan, nomor referensi, nama pemberi informasi, dan catatan.
5. Import_Payload — sel A1 berisi RAHO_AI_IMPORT_PAYLOAD_JSON dan sel A2 berisi satu JSON valid sesuai kontrak import teknis.

Jangan meminta atau menambahkan sessionId, memberId, branchId, userId, atau ID internal lain. Jika kode sesi dan nomor member tidak diketahui, gunakan nama lengkap member yang sudah dikonfirmasi. ID internal akan di-resolve otomatis saat import. Jika nama tidak unik, tandai PENDING dan minta pengguna memilih kandidat yang benar.

Jangan mengarang data kosong. Tandai dengan BELUM ADA. Jangan membuat payload COMMIT tanpa persetujuan manusia.
```

Ketentuan Excel:

- file harus berformat `.xlsx`, bukan gambar atau PDF;
- angka dosis harus tersimpan sebagai angka, bukan teks;
- tanggal menggunakan format `YYYY-MM-DD` dan waktu menggunakan `HH:mm`;
- satuan wajib berada pada kolom tersendiri;
- nilai input tidak boleh ditimpa oleh hasil perhitungan;
- delta dihitung dengan formula `Aktual - Plan`;
- gunakan status `SESUAI`, `DEVIASI`, `BELUM ADA`, atau `PERLU KONFIRMASI`;
- jangan memasukkan ID internal ERP sebagai kolom yang harus diisi pengguna.

# O. Hubungan dengan Template Import Teknis

Setelah AI menyatakan form lengkap dan pengguna menyetujui pembuatan payload, AI harus mengikuti kontrak teknis pada:

```text
docs/TEMPLATE_AI_IMPORT_KOREKSI_THERAPY_PLAN.md
```

Urutannya:

```text
Form ini diisi
  -> AI memeriksa dan memberi instruksi
  -> Nakes/Admin Layanan melengkapi kekurangan
  -> Nakes/dokter memberi konfirmasi klinis
  -> AI menghasilkan payload VALIDATE_ONLY
  -> ERP/importer memvalidasi
  -> Manusia menyetujui
  -> Import dilakukan dan dicatat dalam audit
```
