Langsung saya buatkan versi final lengkap dengan semua revisi:

***



> **Prinsip Bisnis Utama:**
> - Member membayar **sekali di awal** saat membeli paket — tidak ada biaya tambahan per sesi
> - Paket hanya bisa dipakai **di cabang tempat paket dibeli**
> - `ADMIN_LAYANAN`, `DOCTOR`, `NURSE` memiliki kapabilitas **identik** — satu-satunya perbedaan adalah hanya `ADMIN_LAYANAN` yang bisa mendaftarkan member baru
> - Hanya `SUPER_ADMIN` yang bisa mengelola list stok & master produk

***

## 👥 Identifikasi User Role

| Role | Level | Lingkup | Deskripsi |
|---|---|---|---|
| `SUPER_ADMIN` | 1 | Global | Akses penuh seluruh sistem, override semua data, kelola master data & stok |
| `ADMIN_MANAGER` | 2 | Lintas cabang | Monitoring semua cabang, konfigurasi harga paket, KPI regional |
| `ADMIN_CABANG` | 3 | Per cabang | Manajer operasional cabang, verifikasi paket, kelola user & request stok |
| `ADMIN_LAYANAN` | 4 | Per cabang | Front-office + klinis — **satu-satunya yang bisa daftarkan member baru** |
| `DOCTOR` | 4 | Per cabang | Klinis — kapabilitas identik dengan `ADMIN_LAYANAN` kecuali daftarkan member |
| `NURSE` | 4 | Per cabang | Klinis — kapabilitas identik dengan `ADMIN_LAYANAN` kecuali daftarkan member |
| `MEMBER` | - | Personal | Portal read-only — lihat data sendiri, chat klinik |

***

***

# 🔵 FUNCTIONAL REQUIREMENTS

***

## FR-01 — Autentikasi & Otorisasi

**Semua Role**

- Login via `email` + `password`, validasi Zod: email wajib format email, password min 6 karakter
- Response: `accessToken` (short-lived) + `refreshToken` (long-lived) + data user
- Token disimpan di `authStore` (Zustand); setiap request menyertakan `Authorization: Bearer <token>`
- Sidebar dan tombol aksi ditampilkan **dinamis** berdasarkan `roleName` dari JWT
- Setiap endpoint dilindungi middleware `authorize(roles[])` → `403` jika role tidak sesuai
- Akses member ke data cabang lain dikontrol via `BranchMemberAccess`
- Refresh token digunakan untuk perpanjang sesi tanpa login ulang

***

## FR-02 — Manajemen Member

### FR-02.1 — Daftarkan Member Baru
**Authorize:** `ADMIN_LAYANAN`, `ADMIN_CABANG+`

Form dibagi 3 section:

**Section A — Data Pribadi**

| Field | Validasi |
|---|---|
| `fullName` | wajib, min 2, max 100 |
| `nik` | exactly 16 digit, opsional |
| `tempatLahir` | max 50, opsional |
| `dateOfBirth` | ISO datetime, opsional |
| `jenisKelamin` | `L` / `P`, opsional |
| `phone` | max 20, opsional |
| `email` | format email, opsional |
| `address` | max 255, opsional |
| `pekerjaan` | max 100, opsional |
| `statusNikah` | max 30, opsional |
| `emergencyContact` | max 100, opsional |
| `sumberInfoRaho` | max 100, opsional |
| `postalCode` | max 10, opsional |

**Section B — Akun Member**

| Field              | Validasi                                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `memberEmail`      | **wajib**, format email valid                                                                                                                            |
| `memberPassword`   | **wajib**, min 8 karakter                                                                                                                                |
| `referralCodeId`   | CUID, opsional — dropdown daftar referrer aktif; digunakan sebagai **penanda siapa yang merekomendasikan** member ini datang ke RAHO (bukan kode diskon) |
| `isConsentToPhoto` | checkbox, default `true`                                                                                                                                 |
**Section C — Upload Dokumen**

| Dokumen | `documentType` |
|---|---|
| PSP / Informed Consent | `PERSETUJUAN_SETELAH_PENJELASAN` |
| Foto Profil | `FOTO_PROFIL` |

> Format: `image/jpeg`, `image/png`, `image/webp` — Maks **5MB** per file
> Path MinIO: `uploads/members/{memberId}/documents/{filename}`

**Proses backend (satu Prisma transaction):**
```
1. Validasi duplikasi email           → 409 "Email sudah terdaftar."
2. Validasi duplikasi NIK             → 409 "NIK sudah terdaftar."
3. Validasi referralCode aktif        → 400 jika nonaktif
4. generateMemberNo(branchId)         → "MBR-PST-2604-00001"
5. generateStaffCode("MEMBER")        → "MBR-20260410-X9KZ"
6. bcrypt.hash(password, 12)
7. prisma.transaction:
   a. User.create        (role: MEMBER, branchId dari staff)
   b. UserProfile.create (fullName)
   c. Member.create      (semua field + memberNo)
8. Upload dokumen → MemberDocument.create
9. logAudit(CREATE, Member, memberId)
```

**Error States:**

| Kondisi | HTTP | Pesan |
|---|---|---|
| Email sudah ada | 409 | "Email sudah terdaftar." |
| NIK sudah ada | 409 | "NIK sudah terdaftar." |
| Referral code nonaktif | 400 | "Referral code tidak valid." |
| File > 5MB | 400 | "Ukuran file maksimal 5MB." |
| Format file tidak valid | 400 | "Hanya JPG, PNG, WebP yang diizinkan." |

***

### FR-02.2 — Lihat & Kelola Member
**Authorize lihat:** `ALLSTAFF`
**Authorize edit/hapus:** `SUPER_ADMIN` only

- Semua staff bisa melihat daftar & detail member di cabangnya
- Edit profil member dan hapus member hanya `SUPER_ADMIN`; dicatat ke `AuditLog`

### FR-02.3 — Cari Member Lintas Cabang
**Authorize:** `ALLSTAFF`

```
GET /members/lookup?memberNo=...
Response: { memberId, memberNo, fullName, phone, status,
            registrationBranch, sudahAdaAkses, isRegistrationBranch }

[Jika belum ada akses di cabang ini]
  → POST /members/grant-access { memberId, notes }
  → BranchMemberAccess.create
  → Member muncul di list dengan badge "Lintas Cabang"

Guard:
  ❌ 400 — ini cabang registrasi member sendiri
  ❌ 409 — akses sudah ada sebelumnya
```

> **Catatan penting:** Grant akses lintas cabang hanya mengizinkan staff melihat & mengelola **data member**, bukan memakai paket yang dibeli di cabang lain.

***

## FR-03 — Manajemen Paket

### FR-03.1 — Assign Paket ke Member
**Authorize:** `ADMIN_LAYANAN`, `DOCTOR`, `NURSE`, `ADMIN_CABANG+`

- Paket diassign **hanya oleh staff di cabang yang sama** → `MemberPackage.branchId = staff.branchId`
- Assign paket `BASIC` + opsional `BOOSTER` sekaligus dalam satu modal
- Bisa pilih dari `PackagePricing` atau input custom jumlah sesi
- Kalkulasi otomatis: `finalPrice = (basicPrice + boosterPrice) - discountAmount`
- Paket baru dibuat dengan status `PENDING_PAYMENT`
- Saat assign paket BASIC: `member.voucherCount += basicTotalSessions`
- Jenis booster (`NO`/`GASSOTRAUS`) **tidak dipilih saat assign** — dipilih saat sesi berlangsung
- Auto-generate kode: `PKG-PST-BSC-2604-XY9A1` (BASIC), `PKG-PST-BST-2604-AB3Z2` (BOOSTER)

**Payload:**
```json
{
  "basicPackagePricingId": "clxxxxxx",
  "basicTotalSessions": 5,
  "boosterTotalSessions": 3,
  "discountPercent": 10,
  "discountAmount": 1000000,
  "discountNote": "Diskon loyalitas",
  "notes": "Custom 5 sesi basic + 3 booster"
}
```

**Proses backend:**
```
1. assertMemberAccess(memberId, branchId)
2. Resolve harga dari PackagePricing
3. Hitung subtotal + finalPrice setelah diskon
4. prisma.transaction:
   a. MemberPackage.create (BASIC)  → status: PENDING_PAYMENT
   b. MemberPackage.create (BOOSTER) jika ada → status: PENDING_PAYMENT, boosterType: null
   c. Member.update → voucherCount += basicTotalSessions
5. generatePackageCode()
6. logAudit(CREATE, MemberPackage)
```

***

### FR-03.2 — Verifikasi Pembayaran Paket
**Authorize:** `ADMIN_LAYANAN`, `ADMIN_CABANG+`

```
PATCH /members/:memberId/packages/:packageId/verify

Proses:
1. Cek status == PENDING_PAYMENT → 422 jika bukan
2. MemberPackage.update:
   status      → ACTIVE
   paidAt      → now()
   verifiedBy  → user.userId
   verifiedAt  → now()
   activatedAt → now()
3. Notifikasi otomatis ke member: "Paket Anda telah aktif ✅"
4. logAudit(VERIFY, MemberPackage)
```

> Ini adalah **satu-satunya momen pembayaran** dalam seluruh sistem. Tidak ada tagihan lain setelah paket aktif.

***

### FR-03.3 — Kelola Harga Paket
**Authorize:** `ADMIN_MANAGER`, `SUPER_ADMIN`

- CRUD `PackagePricing` per cabang (tipe BASIC/BOOSTER, nama, jumlah sesi, harga)
- Paket nonaktif tidak muncul di dropdown assign
- `@@unique([branchId, packageType, totalSessions])` — tidak boleh duplikasi

***

## FR-04 — Sesi Terapi

### FR-04.1 — Buat Sesi Terapi
**Authorize:** `ADMIN_LAYANAN`, `DOCTOR`, `NURSE`, `ADMIN_CABANG+`

**Modal form:**

| Field | Keterangan |
|---|---|
| `adminLayananId` | Auto-fill dari user login |
| `doctorId` | Wajib, dropdown lintas cabang (role DOCTOR) |
| `nurseId` | Wajib, dropdown lintas cabang (role NURSE) |
| `memberPackageId` | Wajib — hanya tampil MemberPackage BASIC ACTIVE milik cabang ini |
| `boosterPackageId` | Opsional — hanya tampil BOOSTER ACTIVE milik cabang ini |
| `treatmentDate` | Wajib |
| `pelaksanaan` | `ON_SITE` (member ke klinik) / `HOME_CARE` (tim ke rumah member) |

**Proses backend (satu transaksi):**
```
1.  assertMemberAccess(memberId, branchId)
2.  ✅ Validasi paket di cabang ini:
    memberPackage.branchId == staff.branchId
    → 403 "Paket ini hanya bisa digunakan di cabang pembelian."
3.  Validasi MemberPackage BASIC: status ACTIVE, sisa sesi > 0
    → 422 "Member belum memiliki paket aktif."
    → 422 "Sesi paket basic sudah habis terpakai."
4.  Jika boosterPackageId ada:
    ✅ boosterPackage.branchId == staff.branchId
    → 403 "Paket booster hanya bisa digunakan di cabang pembelian."
    → 422 "Sesi booster sudah habis terpakai."
5.  Validasi voucherCount > 0
    → 422 "Voucher habis, tidak bisa menambah sesi."
6.  Validasi doctorId: role DOCTOR, isActive true → 403/404
7.  Validasi nurseId: role NURSE, isActive true  → 403/404
8.  Cari Encounter ONGOING dengan memberPackageId yang sama:
    - Ada   → pakai encounter existing
    - Tidak → Encounter.create { type: TREATMENT, status: ONGOING,
               adminLayananId, doctorId, nurseId,
               memberPackageId, memberId, branchId }
               generateEncounterCode → "ENC-PST-2604-AB3Z9"
9.  infusKe = MAX(infusKe di encounterId) + 1
10. TreatmentSession.create {
      encounterId, infusKe, pelaksanaan,
      adminLayananId, doctorId, nurseId,
      boosterPackageId (nullable), boosterType: null,
      status: PLANNED, treatmentDate }
    generateSessionCode → "SES-PST-03-2604-P9QR2"
11. MemberPackage (BASIC).update → usedSessions += 1
12. Member.update → voucherCount -= 1
13. Jika booster: MemberPackage (BOOSTER).update → usedSessions += 1
    (stok belum berkurang — berkurang saat pilih jenis booster)
14. logAudit(CREATE, TreatmentSession)
```

**Guard Errors:**

| Kondisi | HTTP | Pesan |
|---|---|---|
| `memberPackage.branchId ≠ staff.branchId` | 403 | "Paket ini hanya bisa digunakan di cabang pembelian." |
| `boosterPackage.branchId ≠ staff.branchId` | 403 | "Paket booster hanya bisa digunakan di cabang pembelian." |
| Tidak ada paket BASIC ACTIVE | 422 | "Member belum memiliki paket aktif." |
| Sisa sesi BASIC = 0 | 422 | "Sesi paket basic sudah habis terpakai." |
| Sisa sesi BOOSTER = 0 | 422 | "Sesi booster sudah habis terpakai." |
| `voucherCount == 0` | 422 | "Voucher habis, tidak bisa menambah sesi." |
| doctorId bukan DOCTOR | 403 | "User yang dipilih bukan dokter." |
| nurseId bukan NURSE | 403 | "User yang dipilih bukan nakes." |
| Member tidak accessible | 403 | "Anda tidak memiliki akses ke member ini." |

***

### FR-04.2 — Alur Pendataan Per Sesi (10 Step Berurutan)

> Setiap step **terkunci** sampai step sebelumnya selesai. Setelah disubmit → **read-only** (edit hanya `SUPER_ADMIN`).

```
[STEP 1]  Diagnosa            ← wajib sekali per encounter
      ↓   (unlock step 2)
[STEP 2]  Terapi Plan         ← WAJIB per sesi, unlock semua step berikutnya
      ↓
[STEP 3]  Tanda Vital SEBELUM
      ↓
[STEP 4]  Pilih Jenis Booster ← hanya jika sesi punya boosterPackageId
      ↓
[STEP 5]  Infus Aktual        ← auto-deduct stok
      ↓
[STEP 6]  Pemakaian Bahan     ← auto-deduct stok
      ↓
[STEP 7]  Foto Sesi
      ↓
[STEP 8]  Tanda Vital SESUDAH
      ↓
[STEP 9]  EMR Note
      ↓
[STEP 10] Evaluasi SOAP       ← setelah sesi selesai
```

***

#### STEP 1 — Diagnosa (Sekali per Encounter)
**Route:** `POST /encounters/:encounterId/diagnoses`
**Authorize:** `ALLSTAFF`

- Diisi **sekali per encounter** — tombol tambah tersembunyi otomatis jika sudah ada
- Wajib ada sebelum Terapi Plan bisa dibuat (tombol plan di-disabled + tooltip)
- Kode auto-generate: `DX-PST-2604-00001`
- Edit & hapus → `SUPER_ADMIN` only

**Field form:**

| Field | Validasi |
|---|---|
| `doktorPemeriksa` | **wajib**, dropdown user DOCTOR |
| `diagnosa` | **wajib**, min 3, max 1000 |
| `kategoriDiagnosa` | opsional — Hipertensi/Neurologi/Diabetes/Kardiovaskular/Ortopedi/Imunologi/Hematologi/Lainnya |
| `icdPrimer` | max 20 |
| `icdSekunder` | max 20 |
| `icdTersier` | max 20 |
| `keluhanRiwayatSekarang` | max 5000 |
| `riwayatPenyakitTerdahulu` | max 5000 |
| `riwayatSosialKebiasaan` | max 5000 |
| `riwayatPengobatan` | max 5000 |
| `pemeriksaanFisik` | max 5000 |
| `pemeriksaanTambahan` | array `{key, value}[]` — dinamis |

***

#### STEP 2 — Terapi Plan (WAJIB per Sesi)
**Route:** `POST /treatment-sessions/:sessionId/therapy-plan`
**Authorize:** `ALLSTAFF`

- **Wajib diisi** sebelum step 3–10 bisa diakses — semua terkunci tanpa terapi plan
- Setelah disimpan → read-only sepenuhnya
- Kode auto-generate: `TP-PST-2604-00001`

**12 field dosis:**

| Bahan | Satuan |
|---|---|
| IFA | mg |
| HHO, H2, NO, GASO, O2, O3, EDTA, MB, H2S, KCL, Jml. NB | ml |

***

#### STEP 3 — Tanda Vital SEBELUM
**Route:** `POST /treatment-sessions/:sessionId/vital-signs`
**Authorize:** `ALLSTAFF`

- Inline edit + **auto-save** (optimistic update) per field
- `waktuCatat: SEBELUM`
- 5 jenis: Sistol, Diastol, HR, Saturasi, PI
- Constraint unik: `[treatmentSessionId, pencatatan, waktuCatat]`

***

#### STEP 4 — Pilih Jenis Booster *(kondisional)*
**Route:** `PATCH /treatment-sessions/:sessionId/booster-type`
**Authorize:** `ALLSTAFF`

- **Hanya muncul** jika sesi memiliki `boosterPackageId`
- Pilih sekali: `NO` (Nitrogen Oksida) / `GASSOTRAUS` — tidak bisa diubah setelah simpan
- Saat simpan: stok booster otomatis berkurang (`StockMutation USED`) + `AuditLog`

***

#### STEP 5 — Infus Aktual
**Route:** `POST /treatment-sessions/:sessionId/infusion`
**Authorize:** `ALLSTAFF`

- Kolom kiri = dosis rencana dari terapi plan (read-only)
- Kolom kanan = dosis aktual (input staff)
- Jika aktual ≠ rencana → field highlight merah + **catatan deviasi wajib diisi** → tombol simpan diblokir
- Info fisik wajib: jenis botol (IFA/EDTA), jenis cairan, volume carrier, jumlah jarum, tanggal produksi cairan
- Saat simpan: tiap bahan → `InventoryItem.stock -= aktual` + `StockMutation USED`
- Stok tidak cukup → `409 "Stok tidak mencukupi"`

***

#### STEP 6 — Pemakaian Bahan Tambahan
**Route:** `POST /treatment-sessions/:sessionId/materials`
**Authorize:** `ALLSTAFF`

- Dropdown hanya tampilkan produk dengan stok > 0
- Saat simpan: `MaterialUsage.create` + `InventoryItem.stock -= quantity` + `StockMutation USED`
- Dropdown terupdate real-time setelah simpan

***

#### STEP 7 — Foto Sesi
**Route:** `POST /treatment-sessions/:sessionId/photo`
**Authorize:** `ALLSTAFF`

- **Satu foto per sesi** — tombol upload hilang otomatis setelah foto berhasil disimpan
- Format: JPG/PNG/WebP, maks 5MB
- Disimpan ke MinIO; URL disimpan di `SessionPhoto`
- Guard backend: jika `SessionPhoto` untuk sesi ini sudah ada → `409 "Foto sesi sudah diupload."`
- Tidak ada caption atau tanggal tambahan — foto bersifat dokumentasi murni
- Hapus foto → `SUPER_ADMIN` only

**Error States:**

| Kondisi                    | HTTP | Pesan                                  |
| -------------------------- | ---- | -------------------------------------- |
| Foto sudah pernah diupload | 409  | "Foto sesi sudah diupload."            |
| Format file tidak valid    | 400  | "Hanya JPG, PNG, WebP yang diizinkan." |
| File > 5MB                 | 400  | "Ukuran file maksimal 5MB."            |

***

#### STEP 8 — Tanda Vital SESUDAH
**Route:** `POST /treatment-sessions/:sessionId/vital-signs`
**Authorize:** `ALLSTAFF`

- Sama dengan step 3 namun `waktuCatat: SESUDAH`
- Inline edit + auto-save

***

#### STEP 9 — EMR Note
**Route:** `POST /treatment-sessions/:sessionId/emr-notes`
**Authorize:** `ALLSTAFF`

4 tipe tersedia untuk semua staff:

| Tipe | Keterangan |
|---|---|
| `CLINICAL_NOTE` | Catatan klinis umum |
| `OPERATIONAL_NOTE` | Catatan operasional sesi |
| `ASSESSMENT` | Penilaian kondisi pasien |
| `OUTCOME_MONITORING` | Monitoring hasil terapi |

- Maks 5000 karakter per catatan

***

#### STEP 10 — Evaluasi SOAP
**Route:** `POST /treatment-sessions/:sessionId/evaluation`
**Authorize:** `ALLSTAFF`

- 5 field: Subjective, Objective, Assessment, Plan, Catatan Umum
- Kode auto-generate: `EVL-PST-2604-00001`
- Riwayat perubahan bisa di-expand (nilai lama vs baru per field)
- Setiap simpan → `AuditLog` dicatat

***

## FR-05 — Manajemen Stok & Inventori

### FR-05.1 — Kelola Master Produk
**Authorize:** `SUPER_ADMIN` only

- CRUD master produk: nama, kategori (`MEDICINE`/`DEVICE`/`CONSUMABLE`), satuan, deskripsi
- Nonaktifkan produk → tidak muncul di dropdown input tindakan
- Soft-delete: `isActive = false`

### FR-05.2 — Kelola Inventory per Cabang
**Authorize:** `SUPER_ADMIN` only

- Tambah & edit `InventoryItem` per cabang (stok awal, `minThreshold`, lokasi penyimpanan)
- Stok awal diisi via seeding atau input manual `SUPER_ADMIN`

### FR-05.3 — Monitor Stok
**Authorize:** `ALLSTAFF` (read-only)

- Semua staff bisa lihat stok cabangnya
- Badge merah otomatis jika `stock < minThreshold`
- Riwayat mutasi stok bisa dilihat per item (`StockMutation` log)

### FR-05.4 — Pemakaian Stok Otomatis (via Tindakan Sesi)
**Trigger:** STEP 4 (booster), STEP 5 (infus aktual), STEP 6 (bahan tambahan)

```
Setiap tindakan:
  InventoryItem.stock   -= jumlah terpakai
  StockMutation.create   { type: USED, quantity, stockBefore, stockAfter }
```
- Stok tidak bisa minus → sistem tolak `409` jika tidak mencukupi
- Staff tidak perlu input pengurangan stok secara manual

### FR-05.5 — Request Stok ke Pusat
**Authorize request:** `ADMIN_CABANG+`
**Authorize approve & kirim:** `SUPER_ADMIN` only

```
Alur:
ADMIN_CABANG request → StockRequest (PENDING)
        ↓
SUPER_ADMIN approve  → StockRequest (APPROVED) + Shipment (PREPARING) dibuat otomatis
        ↓
SUPER_ADMIN kirim    → Shipment (SHIPPED) → Notifikasi ke ADMIN_CABANG
        ↓
ADMIN_CABANG terima  → Shipment (RECEIVED)
        ↓
ADMIN_CABANG approve → Shipment (APPROVED) → InventoryItem.stock += qty + StockMutation RECEIVED
```

***

## FR-06 — Notifikasi

**Authorize kirim manual:** `ALLSTAFF`
**Authorize terima:** `MEMBER`

**Notifikasi otomatis sistem:**

| Trigger | Penerima | Isi |
|---|---|---|
| Paket diverifikasi ACTIVE | Member | "Paket Anda telah aktif ✅" |
| Stok cabang < `minThreshold` | `ADMIN_CABANG` | "Stok [produk] hampir habis 🔴" |
| Shipment berstatus SHIPPED | `ADMIN_CABANG` | "Pengiriman sedang dalam perjalanan 🚚" |

**Notifikasi manual staff:**

| Tipe | Penggunaan |
|---|---|
| `REMINDER` | Pengingat jadwal sesi |
| `INFO` | Informasi umum klinik |

- Unread count polling setiap 60 detik via `useUnreadCount()`
- Tandai dibaca: satu notif `PATCH /notifications/:id/read` atau semua `PATCH /notifications/read-all`
- Keduanya menggunakan **optimistic update**

***

## FR-07 — Chat
**Authorize:** `MEMBER` ↔ `ALLSTAFF`

- Member bisa membuka ruang chat dengan staff klinik via `ChatRoom`
- Mendukung pesan teks dan upload file
- Riwayat chat tersimpan dan bisa di-scroll

***

## FR-08 — Dashboard & KPI

| Role | KPI yang Ditampilkan |
|---|---|
| `ADMIN_LAYANAN / DOCTOR / NURSE` | Sesi hari ini, member aktif di cabang |
| `ADMIN_CABANG` | Member aktif, sesi hari ini & bulan ini, stok kritis, paket pending verifikasi |
| `ADMIN_MANAGER` | KPI agregat semua cabang, chart sesi per cabang, total paket aktif |
| `SUPER_ADMIN` | Semua KPI + stock request pending + audit log terbaru |

***

## FR-09 — Manajemen Cabang & User

### FR-09.1 — Kelola Cabang
**Authorize:** `ADMIN_MANAGER`, `SUPER_ADMIN`

- Tambah cabang baru (kode, nama, alamat, kota, telepon, tipe KLINIK/HOMECARE, jam operasi)
- Nonaktifkan cabang → `isActive: false`
- Buat `ADMIN_CABANG` langsung dari halaman cabang

### FR-09.2 — Kelola User Cabang
**Authorize:** `ADMIN_CABANG+`

- Tambah user di cabangnya (role: `ADMIN_LAYANAN`, `DOCTOR`, `NURSE` only)
- Nonaktifkan user → `isActive: false` (soft delete, data terjaga)
- Hapus user → hard delete dengan konfirmasi

### FR-09.3 — Buat Admin Manager
**Authorize:** `SUPER_ADMIN` only

- User `ADMIN_MANAGER` tidak terikat ke satu cabang (akses global)

***

## FR-10 — Audit Log
**Authorize:** `SUPER_ADMIN` only

- Seluruh aksi sensitif (`CREATE`, `UPDATE`, `DELETE`, `VERIFY`) tercatat **otomatis**
- Log menyimpan: `userId`, `action`, `resource`, `resourceId`, `meta (JSON)`, `ipAddress`, `createdAt`
- Filter per: user, resource, action, rentang tanggal
- Pagination untuk log besar

***

## FR-11 — Master Data
**Authorize:** `SUPER_ADMIN` only

- **Referral Code**: tambah, edit, nonaktifkan
  - Berfungsi sebagai **penanda identitas — siapa yang merekomendasikan** member ini
    datang ke RAHO. Tidak mempengaruhi harga, diskon, atau alur bisnis apapun.
  - Setiap referral code wajib memiliki `referrerName` (nama pemberi rekomendasi)
    dan opsional `referrerType` (kategori: Dokter / Member / Media / Lainnya)
  - Contoh: `{ code: "DR-SUSI-001", referrerName: "dr. Susi Wijaya", referrerType: "Dokter" }`
  - Kode aktif tampil di dropdown "Direferensikan Oleh" saat pendaftaran member baru
  - Data referral di profil member bersifat **read-only** setelah pendaftaran
  - `referralCode` unik: `@@unique([code])`

- **Master Produk**: katalog produk yang bisa di-request oleh cabang (via `StockRequest`)

***

## FR-12 — Portal Member (Read-Only)
**Authorize:** `MEMBER`

| Halaman | Konten |
|---|---|
| `/me/dashboard` | Voucher sisa, paket aktif, sesi terakhir |
| `/me/sessions` | Riwayat semua sesi (tanggal, status, tempat) |
| `/me/diagnoses` | Semua diagnosa yang pernah ditegakkan |
| `/me/vouchers` | Daftar semua paket + status + sesi terpakai |
| `/me/notifications` | List semua notifikasi, tandai dibaca |
| `/me/chat` | Chat dengan staff klinik |

- Semua halaman **read-only** — member tidak bisa ubah data, beli paket, atau bayar sendiri

***

***

# 🟡 NON-FUNCTIONAL REQUIREMENTS

***

## NFR-01 — Keamanan

| Aspek | Implementasi |
|---|---|
| Password hashing | `bcrypt` cost factor 12 |
| Autentikasi | JWT `accessToken` (short-lived) + `refreshToken` (long-lived) |
| Otorisasi | Middleware `authorize(roles[])` di setiap endpoint |
| Data isolation | Staff hanya akses member di cabangnya via `BranchMemberAccess` |
| Paket isolation | `memberPackage.branchId == staff.branchId` divalidasi saat buat sesi |
| Immutability | Terapi plan & diagnosa read-only setelah submit — cegah manipulasi rekam medis |
| Audit trail | Semua aksi sensitif wajib tercatat di `AuditLog` tanpa pengecualian |
| File upload | Validasi tipe MIME + ukuran di **backend**, bukan hanya frontend |
| Stock management | Hanya `SUPER_ADMIN` yang bisa tambah/edit/hapus master produk & inventory |

***

## NFR-02 — Integritas Data

| Aspek                    | Implementasi                                                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomicity                | Pembuatan member, sesi, mutasi stok dalam **Prisma transaction**                                                                                                                                                                       |
| No orphan data           | Foreign key constraint di semua relasi                                                                                                                                                                                                 |
| No duplicate             | `@@unique` pada: inventory `[masterProductId, branchId]`, vital sign `[treatmentSessionId, pencatatan, waktuCatat]`, infusion/evaluation/sessionPhoto `[treatmentSessionId]`, package pricing `[branchId, packageType, totalSessions]` |
| Stock consistency        | Deduct stok dan catat `StockMutation` dalam transaksi yang sama                                                                                                                                                                        |
| Voucher consistency      | `voucherCount` diupdate dalam transaksi yang sama dengan pembuatan sesi                                                                                                                                                                |
| Branch-package integrity | Validasi `memberPackage.branchId == staff.branchId` di level service, bukan hanya frontend                                                                                                                                             |

***

## NFR-03 — Performa

| Aspek | Implementasi |
|---|---|
| Query optimization | Index pada: `[userId, createdAt]` (audit log), `[chatRoomId, createdAt]` (chat), `[memberId, branchId, status]` (paket), `[resource, resourceId]` (audit log) |
| Dashboard | Filter berbasis `branchId` dari JWT — tidak fetch data lintas cabang yang tidak perlu |
| Notifikasi | Polling 60 detik untuk unread count |
| Pagination | Semua list data menggunakan pagination (audit log, chat, sesi, member) |
| Dropdown stok | Real-time update setelah pemakaian bahan tanpa full page reload |

***

## NFR-04 — Pengalaman Pengguna

| Aspek | Implementasi |
|---|---|
| Progressive locking | Step pendataan sesi terkunci berurutan — tidak bisa skip |
| Auto-save | Tanda vital menggunakan inline edit + optimistic update per field |
| Real-time dropdown | Stok berkurang → dropdown pemakaian bahan langsung terupdate |
| Deviasi infus | Field highlight merah otomatis + catatan wajib muncul tanpa reload |
| Read-only guard | Form dikunci visual setelah submit + tooltip informatif |
| Error messaging | Semua error response menggunakan pesan dalam Bahasa Indonesia yang jelas |

***

## NFR-05 — Penyimpanan File

| Aspek | Implementasi |
|---|---|
| Storage engine | MinIO (object storage, self-hosted) |
| Path struktur | `uploads/members/{memberId}/documents/{filename}` |
| Format diterima | `image/jpeg`, `image/png`, `image/webp` |
| Ukuran maks | 5MB per file |
| Database | Hanya simpan URL string — tidak ada binary blob di PostgreSQL |

***

***

# 📊 Matriks Akses Lengkap Final

| Fitur | NURSE | DOCTOR | ADM. LAYANAN | ADM. CABANG | ADM. MANAGER | SUPER ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Daftarkan Member Baru** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Lihat Member | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit / Hapus Member | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cari Member Lintas Cabang | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Grant Akses Lintas Cabang | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Assign Paket | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Verifikasi Pembayaran | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Buat Sesi Terapi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Diagnosa | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terapi Plan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tanda Vital | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pilih Jenis Booster | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Infus Aktual | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pemakaian Bahan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Foto Sesi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| EMR Note | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Evaluasi SOAP | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kirim Notifikasi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lihat Stok | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Request Stok | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Terima & Approve Pengiriman | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Verifikasi Pembayaran Paket | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kelola User Cabang | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| KPI Cabang | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Buat & Kelola Cabang | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Atur Harga Paket | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| KPI Lintas Cabang | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Monitor Pengiriman Lintas Cabang | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Kelola Master Produk** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Kelola Inventory Cabang** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Approve Request Stok** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Buat & Kirim Shipment** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Referral Code** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Audit Log** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Override CRUD** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

 [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/52826684/b8c836b5-bacc-4921-ae1b-5d5a90a604ee/Usecase_ALL.md)

***

## ⚡ Business Rules Kritis

```
1. PEMBAYARAN (SEKALI)
   → Member hanya membayar saat paket diverifikasi ACTIVE
   → Tidak ada biaya tambahan per sesi — tidak ada invoice
   → Semua sesi dijalankan menggunakan voucher dari paket yang sudah dibayar

2. PAKET & CABANG
   → Paket hanya bisa diassign oleh staff di cabang yang sama
   → Paket hanya bisa dipakai di cabang tempat paket dibeli
     (memberPackage.branchId == staff.branchId)
   → Grant akses lintas cabang ≠ izin pakai paket di cabang lain
   → Untuk pakai layanan di cabang lain → harus beli paket baru di cabang tersebut
   → SUPER_ADMIN dapat override validasi ini

3. ALUR SESI (BERURUTAN)
   → Diagnosa wajib ada sebelum Terapi Plan bisa dibuat
   → Terapi Plan WAJIB per sesi — semua step pendataan terkunci tanpanya
   → Setiap step read-only setelah disubmit (edit hanya SUPER_ADMIN)
   → Deviasi dosis infus WAJIB dicatat — simpan diblokir tanpa keterangan

4. STOK
   → Stok tidak bisa minus — sistem tolak 409 jika tidak mencukupi
   → Hanya SUPER_ADMIN yang bisa tambah/edit list stok & master produk
   → Setiap pemakaian stok otomatis tercatat sebagai StockMutation USED

5. AKSES DATA
   → Staff hanya akses member di cabangnya (via BranchMemberAccess)
   → Akses lintas cabang wajib di-grant manual
   → Semua aksi sensitif dicatat AuditLog tanpa pengecualian
   → Hapus foto sesi hanya SUPER_ADMIN
```