# RAIN V1 — API personal dan chat task

## Penggunaan

Login dengan akun internal ERP, lalu buka **Ekstra → RAIN · Asisten Task** (`/extra/rain`).

Versi awal adalah **asisten berbasis aturan**, bukan integrasi model AI. Tidak perlu API key atau layanan AI eksternal. Jawaban menggunakan data ERP; tidak ada fallback data demo. Chat hanya membaca data dan tidak mengubah workflow Tim & Tugas, stok, klinik, maupun transaksi.

Contoh pertanyaan:

- `Kinerja hari ini`
- `Daftar task hari ini`
- `Task belum selesai minggu ini`
- `Task perlu revisi`
- `Task terlambat`
- `Bandingkan minggu ini dengan minggu lalu`
- `Kinerja 2026-09-01 sampai 2026-09-15`
- `Bandingkan 2026-09-01 sampai 2026-09-15 dengan 2026-08-01 sampai 2026-08-15`

Klik **Lanjut hasil berikutnya** atau ketik `lanjut` jika tersedia halaman berikutnya. **Bersihkan** menghapus percakapan dari layar saja. Percakapan tidak disimpan ke database/localStorage; maksimal 60 pesan ditampilkan dan hilang saat halaman ditutup atau akun berubah. Pertanyaan di luar kemampuan akan dijawab dengan petunjuk, bukan data yang direka.

## Kontrak endpoint

Semua endpoint membutuhkan `Authorization: Bearer <access-token>`. Identitas diambil dari `req.user.userId`; query/body `userId`, `role`, atau `branchId` tidak diterima. Header cabang dari UI tidak mengubah scope: semua task personal pada tim aktif yang pengguna ikuti. Akun MEMBER tidak dapat mengakses modul.

| Metode | Path | Parameter |
|---|---|---|
| GET | `/api/v1/ai/me/performance/today` | Tidak ada; shortcut today |
| GET | `/api/v1/ai/me/performance` | `period`, `startDate`, `endDate` |
| GET | `/api/v1/ai/me/performance/compare` | `periodA`, `periodB`, tanggal custom dengan suffix A/B |
| GET | `/api/v1/ai/me/tasks` | `period`, tanggal custom, `status`, `limit`, `offset` |
| GET | `/api/v1/ai/me/tasks/overdue` | `period` opsional, tanggal custom, `limit`, `offset`; tanpa status |
| POST | `/api/v1/ai/chat` | JSON `message` dan `context` opsional untuk pagination |

`period`: `today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `custom`. Pada daftar task biasa period wajib. Tanggal `YYYY-MM-DD` hanya untuk custom; kedua tanggal wajib, awal <= akhir, maksimal 366 hari inklusif.

`status`: `TODO`, `IN_PROGRESS`, `SUBMITTED`, `NEEDS_REVISION`, `COMPLETED`, `CANCELLED`, atau filter virtual `OPEN` (selain COMPLETED/CANCELLED). Default daftar task semua status. `limit` default 10, maksimal 50; `offset` default 0, maksimal 100000. `nextOffset: null` berarti tidak ada halaman berikutnya.

Semua respons sukses mempunyai `contractVersion: "rain.v1"`, `success: true`, `source: "erp"`, `isDemo: false`, `asOf`, serta identitas pengguna. Respons dibaca langsung dari body JSON, **bukan** envelope ERP `data` yang umum dipakai modul lain. Respons chat punya `reply`, `mode: "rules"`, `intent`, `data` (hasil bisnis), dan `context` (filter/offset berikutnya, atau null).

Contoh request chat:

```json
{ "message": "Daftar task minggu ini" }
```

Untuk melanjutkan, kirim context dari respons terakhir:

```json
{
  "message": "lanjut",
  "context": { "intent": "tasks", "period": "this_week", "limit": 10, "offset": 10 }
}
```

Context tidak memuat data task/identitas dan bukan pemberian akses. Backend tetap menghitung serta menyaring ulang berdasarkan token. Tidak ada endpoint mutasi task dalam modul AI.

## Aturan data dan perhitungan

- Model yang dibaca: `TeamTask`, `TaskAssignment`, `TeamMembership`, dan `CollaborationTeam` yang sudah ada. Tidak ada migrasi baru.
- Assignment harus aktif (`unassignedAt = null`) dan membership pengguna serta tim harus ACTIVE. Task yang dihapus, atau subtask di bawah parent yang dihapus, dikeluarkan.
- Task yang hanya dibuat pengguna tidak masuk tanpa assignment kepada dirinya. Parent dan subtask dihitung terpisah bila masing-masing assigned.
- Cohort menggunakan `dueAt`, bukan `createdAt` atau `completedAt`. Task tanpa deadline tidak termasuk.
- Semua batas kalender menggunakan Asia/Jakarta (UTC+07); minggu dimulai Senin. Minggu/bulan berjalan berhenti pada tanggal request. Batas query adalah awal hari inklusif hingga awal hari berikutnya eksklusif.
- `eligibleTasks = totalTasks - cancelled`; `unfinished = eligibleTasks - completed`; completion rate dibulatkan satu desimal dan bernilai null jika eligibleTasks nol.
- Overdue: `dueAt < asOf`, status selain COMPLETED/CANCELLED. SUBMITTED tetap terbuka. Metrik performance menghitung overdue hanya dalam cohort periode.
- Overdue tanpa period mencakup **90 tanggal kalender termasuk hari ini**, bukan seluruh histori. Contoh 16 September 2026: mulai 19 Juni 2026, berakhir sebelum asOf. `overdueDays` menghitung pergantian tanggal Jakarta, bukan durasi 24 jam.
- Daftar biasa diurutkan overdue dahulu, deadline ascending, prioritas URGENT/HIGH/MEDIUM/LOW, createdAt descending, lalu ID. Overdue memakai deadline terlama dahulu. Pengurutan dilakukan di SQL sebelum pagination.
- Comparison memakai A minus B dan selisih **poin persentase**. Delta rate null jika salah satu rate null. Durasi berbeda disertai warning.
- Status adalah status **saat request**, bukan snapshot akhir periode historis. Angka periode lama dapat berubah. Setiap request membaca snapshot konsisten, tetapi halaman pagination berikutnya adalah request baru; data dapat berubah di antaranya.
- Daftar kosong dan metrik nol tetap sukses. Database gagal tidak boleh berubah menjadi respons task kosong.

## Error, keamanan, dan operasional

| HTTP | Code | Arti |
|---|---|---|
| 400 | INVALID_ARGUMENT | Parameter/body tidak valid atau tidak dikenal |
| 401 | UNAUTHENTICATED | Login/token tidak valid |
| 403 | FORBIDDEN | Akun tidak boleh mengakses |
| 429 | RATE_LIMIT_EXCEEDED | Maksimal 30 request RAIN per akun per menit, per proses API |
| 503 | SERVICE_UNAVAILABLE | Database/autentikasi tidak tersedia |
| 504 | TIMEOUT | Batas waktu database/transaction terlewati |

Endpoint menggunakan `Cache-Control: no-store`. Query bisnis berada dalam transaksi read-only RepeatableRead; statement timeout 7 detik, transaction timeout 8 detik, waktu tunggu koneksi maksimal 2 detik. Rate limiter ERP global tetap berlaku. Komentar, deskripsi panjang, histori aktivitas, email assignee, dan data anggota lain tidak dikirim ke chat.

Integrasi model AI belum disediakan. Jika ditambahkan nanti, gunakan kelima service/API personal sebagai sumber data read-only; jangan memberikan alat mutasi atau mengambil identitas dari prompt.

## Verifikasi sebelum produksi

Tes HTTP/service API menggunakan database mock dan tes web menggunakan API mock. Ini memverifikasi kontrak, perhitungan, scope query, serta interaksi; bukan bukti deployment atau transaksi database produksi.

Setelah deploy web dan API, login dengan dua akun berbeda, cocokkan hasil terhadap task assigned masing-masing, cek batas hari Jakarta serta task overdue, dan pastikan create/review/delete Tim & Tugas masih berjalan seperti sebelumnya. Jika database belum memiliki tabel kolaborasi, jalankan migrasi ERP yang sudah ada sesuai prosedur deployment. Jangan mengisi data demo atau menjalankan seed produksi untuk membuat chat tampak berhasil.
