# Rancangan Perubahan Therapy Plan Menjadi Satu Set Bulk

## Tujuan

Therapy plan tidak lagi dibuat satuan. Therapy plan dibuat sebagai satu set untuk satu paket member, lalu dipakai sebagai acuan ketika membuat sesi terapi.

Dengan alur ini, staff tidak membuat atau mengubah therapy plan per sesi secara manual. Staff memilih plan dari daftar therapy plan yang sudah disiapkan untuk paket tersebut.

## Kondisi Saat Ini

Saat ini sistem masih punya beberapa jalur therapy plan:

1. Member bisa dibuatkan therapy plan secara satuan melalui `POST /members/:memberId/therapy-plans`.
2. Member bisa dibuatkan therapy plan secara bulk melalui `POST /members/:memberId/therapy-plans/bulk`.
3. Di sesi terapi masih ada step untuk membuat therapy plan langsung melalui `POST /treatment-sessions/:sessionId/therapy-plan`.
4. Saat sesi dibuat, `therapyPlanId` sudah dipilih sebagai referensi sesi.
5. Infus aktual memakai nilai therapy plan untuk auto-fill, tetapi realisasi infus tetap dicatat di data infus aktual.

Masalahnya: karena masih ada jalur satuan dan jalur sesi, data therapy plan bisa terpecah dan tidak terasa sebagai satu set paket.

## Target Alur Baru

### 1. Therapy Plan Dibuat Per Set Paket

Setiap paket member memiliki satu set therapy plan.

Contoh:

- Member membeli paket 15 sesi.
- Staff membuat satu set therapy plan berisi 15 baris.
- Setiap baris mewakili acuan terapi ke-1 sampai terapi ke-15.

Therapy plan tidak dibuat satu per satu dari tombol terpisah. Pembuatan harus melalui modal bulk.

### 2. Edit Therapy Plan Juga Berbasis Set

Jika ada perubahan, perubahan dilakukan dari layar edit set, bukan dari edit satu baris terpisah.

Prinsip yang disarankan:

- Baris yang belum dipakai sesi bisa berubah mengikuti edit set.
- Baris yang sudah dipakai sesi tidak mengubah riwayat sesi lama.
- Jika perlu audit/history, sistem membuat versi baru untuk set atau baris yang berubah.
- Sesi lama tetap menyimpan acuan yang dipakai saat sesi dibuat.

Ini menjaga data medis dan riwayat terapi tetap konsisten.

### 3. Therapy Plan Di Sesi Terapi Hanya Sebagai Acuan

Di sesi terapi, therapy plan bukan tempat input utama lagi.

Alurnya menjadi:

1. Staff pilih member.
2. Staff pilih paket member.
3. Sistem tampilkan list therapy plan dari paket tersebut.
4. Staff pilih satu therapy plan yang tersedia.
5. Sesi dibuat dengan `therapyPlanId`.
6. Step terapi plan di sesi hanya menampilkan review acuan.
7. Infus aktual tetap bisa mencatat realisasi aktual berdasarkan kondisi lapangan.

Jadi therapy plan adalah rencana/acuan, bukan catatan eksekusi final.

### 4. List Therapy Plan Paket Terlihat Sebelum Masuk Sesi

Sebelum masuk ke step terapi plan atau membuat sesi, staff harus bisa melihat list therapy plan dari paket yang dipilih.

Minimal informasi yang ditampilkan:

- Nomor terapi, misalnya Terapi ke-1, Terapi ke-2.
- Kode therapy plan.
- Ringkasan IFA dan booster.
- Status: belum dipakai, sudah dipakai, atau versi lama.
- Jika sudah dipakai, tampilkan kode sesi dan tanggal sesi.

Tujuannya agar staff memilih acuan yang benar sebelum sesi berjalan.

## Perubahan API Yang Disarankan

### Endpoint Yang Dipertahankan

`GET /members/:memberId/therapy-plans`

Dipakai untuk menampilkan semua therapy plan member, dengan filter paket/set bila diperlukan.

`POST /members/:memberId/therapy-plans/bulk`

Dipakai sebagai satu-satunya cara membuat therapy plan baru.

### Endpoint Yang Perlu Dinonaktifkan Atau Diubah

`POST /members/:memberId/therapy-plans`

Jalur satuan ini sebaiknya tidak dipakai lagi. Pilihannya:

- Backend return `410 Gone` atau `400 Bad Request` dengan pesan agar memakai bulk.
- Frontend menghapus tombol dan form "Buat Therapy Plan" satuan.

`POST /treatment-sessions/:sessionId/therapy-plan`

Jalur ini sebaiknya tidak membuat therapy plan baru lagi. Pilihannya:

- Step sesi hanya membaca therapy plan yang sudah dipilih saat create session.
- Endpoint create session tetap menerima `therapyPlanId`.
- Jika butuh ganti acuan sebelum sesi dimulai, buat endpoint khusus untuk mengganti `therapyPlanId`, bukan membuat plan baru.

## Perubahan Data Yang Disarankan

Agar therapy plan benar-benar menjadi satu set paket, perlu penanda group.

Opsi data model:

1. Tambah model baru `TherapyPlanSet`.
2. Atau tambah field group pada `TherapyPlan`, seperti `setId`, `memberPackageId`, dan `therapyNumber`.

Rekomendasi yang lebih rapi:

```text
TherapyPlanSet
- id
- memberId
- memberPackageId
- setCode
- version
- status
- createdAt
- updatedAt

TherapyPlan
- id
- therapyPlanSetId
- memberId
- memberPackageId
- therapyNumber
- planCode
- dosis fields
- treatmentSessionId nullable
- versioning fields
```

Dengan struktur ini, sistem bisa membedakan:

- set therapy plan untuk paket A
- set therapy plan untuk paket B
- baris therapy plan yang sudah dipakai sesi
- baris therapy plan yang masih tersedia

## Perubahan Frontend Yang Disarankan

### Member Detail - Tab Therapy Plan

Perubahan:

- Hapus tombol/form "Buat Therapy Plan" satuan.
- Sisakan tombol "Buat Bulk" atau ubah label menjadi "Buat Set Therapy Plan".
- Tampilkan therapy plan sebagai group per paket/set.
- Edit dilakukan lewat tombol "Edit Set", bukan edit satu baris.

### Modal Bulk

Perubahan:

- Modal menjadi sumber utama pembuatan set.
- Jika paket memiliki 15 sesi, modal bisa menyiapkan 15 row.
- Staff tetap bisa copy row ke bawah untuk mempercepat.
- Submit menyimpan semua row sebagai satu set.

### Create Session Modal

Perubahan:

- Setelah paket dipilih, tampilkan list therapy plan dari paket tersebut.
- Hanya therapy plan status "belum dipakai" yang bisa dipilih.
- Therapy plan yang sudah dipakai tetap terlihat sebagai referensi, tapi disabled.
- Sebelum submit sesi, staff sudah tahu plan mana yang akan jadi acuan.

### Step 2 Di Sesi Terapi

Perubahan:

- Ubah dari form input menjadi halaman review.
- Judul bisa menjadi "Acuan Therapy Plan".
- Tidak ada tombol simpan therapy plan baru.
- Tampilkan ringkasan dosis dan zat IFA dari plan yang dipilih.
- Jika belum ada `therapyPlanId`, arahkan staff kembali ke pemilihan paket/plan sebelum sesi dibuat.

## Aturan Bisnis Yang Disarankan

1. Satu paket aktif memiliki satu set therapy plan aktif.
2. Therapy plan hanya dibuat bulk.
3. Therapy plan yang sudah dipakai tidak diedit langsung untuk menghindari perubahan riwayat.
4. Edit set membuat versi baru atau hanya mengubah baris yang belum dipakai.
5. Sesi terapi memakai therapy plan sebagai acuan.
6. Infus aktual adalah catatan eksekusi yang boleh berbeda dari acuan.
7. Therapy plan yang sudah superseded tidak bisa dipilih untuk sesi baru.

## Urutan Implementasi Yang Aman

1. Matikan UI pembuatan therapy plan satuan di member detail.
2. Ubah step 2 sesi menjadi review-only.
3. Pastikan create session selalu memilih `therapyPlanId` dari list paket.
4. Tambahkan grouping set bila diperlukan di database.
5. Ubah bulk modal menjadi "buat set".
6. Ubah edit menjadi edit set/versioning.
7. Matikan endpoint satuan setelah frontend tidak memakai lagi.
8. Tambahkan migration dan backfill untuk therapy plan lama agar masuk ke set default.

## Hal Yang Perlu Diputuskan Sebelum Implementasi

1. Apakah satu paket hanya boleh punya satu set aktif, atau boleh beberapa set versi draft?
2. Jika row therapy plan sudah dipakai, apakah edit set boleh membuat versi baru untuk row itu, atau row itu dikunci total?
3. Jika member tidak punya paket aktif, apakah masih boleh membuat therapy plan set?
4. Saat paket di-refund/cancel, apakah therapy plan set ikut nonaktif?
5. Apakah terapi ke-X mengikuti urutan paket global atau urutan cabang?

## Ringkasan Keputusan Target

Target perubahan yang akan diimplementasikan setelah rancangan ini disetujui:

- Therapy plan hanya bisa dibuat bulk.
- Therapy plan diperlakukan sebagai satu set paket.
- Sesi terapi hanya memilih dan membaca therapy plan sebagai acuan.
- List therapy plan paket terlihat sebelum sesi berjalan.
- Infus aktual tetap menjadi catatan realisasi sebenarnya.
