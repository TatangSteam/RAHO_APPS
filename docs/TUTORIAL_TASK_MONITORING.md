# Tutorial Penggunaan Task Monitoring

Dokumen ini menjelaskan penggunaan fitur **Tim & Tugas** pada versi aplikasi saat ini.

## 1. Akses fitur

1. Login menggunakan akun internal ERP. Akun `MEMBER` tidak menggunakan workspace ini.
2. Buka menu **Ekstra → Tim & Tugas**.
3. Pilih salah satu halaman:
   - **Dashboard Monitoring** — ringkasan KPI, fokus tugas, dan aktivitas tim.
   - **Tugas & Subtask** — daftar tugas, pencarian, filter status, dan detail tugas.
   - **Tim Saya** — anggota tim, role, dan Primary Leader.

URL langsung:

- `/extra/collaboration`
- `/extra/collaboration/tasks`
- `/extra/collaboration/teams`

## 2. Membuat tim

1. Klik **Buat Tim**.
2. Isi nama tim minimal 3 karakter.
3. Isi deskripsi (opsional).
4. Pilih visibilitas tugas:
   - **Semua anggota tim** — anggota dapat melihat tugas sesuai scope tim.
   - **Hanya assignee dan leader** — Staff hanya melihat tugas yang ditugaskan kepadanya; Owner/Leader tetap dapat memantau sesuai kewenangan.
5. Klik **Buat Tim**.

Pembuat tim otomatis menjadi **Owner** dan **Primary Leader** awal.

## 3. Mengelola anggota dan role

Hanya Owner yang dapat mengelola anggota.

1. Buka **Tim Saya** dan pilih tim.
2. Klik **Tambah Anggota**.
3. Pilih akun aktif dan role **Staff** atau **Leader**, lalu klik **Tambahkan**.
4. Untuk mengubah role, gunakan pilihan role pada baris anggota.
5. Untuk memilih Primary Leader, klik **Jadikan Primary Leader** pada anggota Owner/Leader yang aktif.

Menghapus anggota dilakukan sebagai penonaktifan membership melalui API saat ini. Tugas, komentar, dan histori yang sudah ada tetap disimpan; assignment aktif anggota tersebut dilepas.

## 4. Membuat tugas

1. Pilih tim aktif pada dropdown **Tim aktif**.
2. Klik **Tugas Baru** (tersedia untuk Owner/Leader).
3. Isi judul, deskripsi, prioritas, tenggat, dan satu atau beberapa assignee.
4. Klik **Buat Tugas**.

Assignee harus merupakan anggota aktif dari tim yang sama. Tugas baru dimulai dengan status **Belum dimulai** (`TODO`).

## 5. Membuat dan memantau subtask

1. Buka **Tugas & Subtask**.
2. Pada kartu tugas parent, klik ikon **+**.
3. Isi data subtask dan centang **Subtask wajib diselesaikan sebelum parent task** bila diperlukan.
4. Klik **Tambah Subtask**.
5. Buka kartu parent untuk melihat progres `selesai/total` subtask wajib.

Subtask hanya boleh satu tingkat di bawah parent dan maksimal 50 subtask aktif per parent. Tenggat subtask tidak boleh melewati tenggat parent.

## 6. Alur status tugas

- **Belum dimulai** → assignee klik **Mulai kerjakan**.
- **Dikerjakan** atau **Perlu revisi** → assignee klik **Kirim untuk review**.
- **Menunggu review** → Owner/Leader memilih **Setujui & selesai** atau **Minta revisi**.
- Owner/Leader dapat memilih **Batalkan** dan wajib mengisi alasan.

Parent task tidak dapat diselesaikan jika subtask wajib masih belum selesai. Perubahan status memakai pengaman versi agar perubahan bersamaan tidak menimpa data terbaru.

## 7. Melihat detail dan berdiskusi

Klik judul/kartu tugas untuk membuka detail. Detail menampilkan status, prioritas, tenggat, assignee, subtask, dan histori komentar. Tulis komentar pada bagian **Diskusi**, kemudian klik tombol kirim.

## 8. Memakai dashboard monitoring

Dashboard menampilkan:

- total pekerjaan;
- pekerjaan yang sedang dikerjakan;
- pekerjaan menunggu review;
- pekerjaan selesai;
- pekerjaan terlambat;
- fokus tugas terbaru dan aktivitas tim.

Gunakan dropdown tim untuk berpindah scope. Pada halaman tugas, gunakan kotak pencarian dan filter status. Data yang tampil dibatasi oleh membership aktif dan kebijakan visibilitas tim.

## 9. Matriks CRUD versi saat ini

| Objek | Create | Read | Update | Delete |
|---|---|---|---|---|
| Tim | UI | UI | Endpoint tersedia; form edit belum ada di UI | UI mengarsipkan tim (bukan hard delete) |
| Anggota | UI | UI | UI untuk role; status removal tersedia di API | Removal/soft delete tersedia di API |
| Tugas | UI | UI | Endpoint tersedia; form edit belum ada di UI | Belum tersedia |
| Subtask | UI | UI | Status melalui detail; edit field belum ada di UI | Belum tersedia |
| Komentar | UI (buat) | UI | Belum tersedia | Belum tersedia |

Dengan demikian, fitur sudah dapat dipakai untuk monitoring dan workflow status, tetapi belum dapat disebut CRUD penuh dari UI. Jangan mengandalkan penghapusan permanen; penghapusan tim saat ini bersifat arsip agar histori tetap tersimpan.

## 10. Jika terjadi masalah

- Pastikan akun masih aktif dan memiliki membership aktif pada tim.
- Jika perubahan status ditolak karena konflik versi, tutup detail lalu buka kembali tugas untuk memuat versi terbaru.
- Jika tombol **Tugas Baru** atau pengaturan anggota tidak muncul, role akun kemungkinan Staff atau bukan Owner pada tim tersebut.
- Jika tugas tidak terlihat, periksa tim aktif, filter status, pencarian, dan kebijakan visibilitas tim.
