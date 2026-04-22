Ini akan sangat panjang — saya sarankan bagi menjadi **3 bagian** agar detail dan tidak terpotong:

- **Bagian 1** — Foundation + Auth + Member Module
- **Bagian 2** — Package + Session Module (10 steps)
- **Bagian 3** — Inventory + Procurement + Communication + Admin + Member Portal

Mulai Bagian 1 sekarang:

***

# 📋 API Contract Design — RAHO
# Bagian 1 of 3 — Foundation + Auth + Member

***

## Global Convention

### Base URL
```
Production : https://raho.domain.com/api/v1
Development: http://localhost:4000/api/v1
```

### Authentication Header
```http
Authorization: Bearer <accessToken>
```
Semua endpoint kecuali `POST /auth/login` wajib menyertakan header ini.

### Global Request Headers
```http
Content-Type: application/json
Authorization: Bearer <accessToken>
X-Branch-Id: <branchId>        ← opsional, diambil dari JWT jika tidak disertakan
```

### Global Response Envelope

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {                    // hanya ada di response list/pagination
    "total": 142,
    "page": 1,
    "limit": 10,
    "totalPages": 15
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "MEMBER_NOT_FOUND",
    "message": "Member tidak ditemukan.",
    "details": [ ]             // array field error dari Zod (hanya 400)
  }
}
```

### HTTP Status Code Convention

| Code | Makna | Kapan Digunakan |
|---|---|---|
| `200` | OK | GET, PATCH berhasil |
| `201` | Created | POST berhasil buat resource |
| `204` | No Content | DELETE berhasil |
| `400` | Bad Request | Validasi Zod gagal |
| `401` | Unauthorized | Token tidak ada / expired |
| `403` | Forbidden | Role tidak diizinkan / akses cabang ditolak |
| `404` | Not Found | Resource tidak ditemukan |
| `409` | Conflict | Duplikasi data |
| `422` | Unprocessable | Business rule violation |
| `500` | Server Error | Unexpected error |

### Error Code List

```
AUTH_INVALID_CREDENTIALS   → 401 email/password salah
AUTH_TOKEN_EXPIRED         → 401 accessToken expired
AUTH_TOKEN_INVALID         → 401 token malformed
AUTH_FORBIDDEN             → 403 role tidak diizinkan
BRANCH_ACCESS_DENIED       → 403 staff tidak punya akses ke member ini
PACKAGE_BRANCH_MISMATCH    → 403 paket bukan milik cabang ini
MEMBER_NOT_FOUND           → 404
MEMBER_EMAIL_DUPLICATE     → 409
MEMBER_NIK_DUPLICATE       → 409
MEMBER_ACCESS_EXISTS       → 409 akses lintas cabang sudah ada
PACKAGE_NOT_ACTIVE         → 422 paket belum aktif
PACKAGE_SESSIONS_EXHAUSTED → 422 sesi habis
VOUCHER_EXHAUSTED          → 422 voucher habis
REFERRAL_INVALID           → 400 referral code tidak aktif
SESSION_PHOTO_EXISTS       → 409 foto sudah diupload
STOCK_INSUFFICIENT         → 409 stok tidak mencukupi
DIAGNOSIS_EXISTS           → 409 diagnosa sudah ada di encounter ini
THERAPY_PLAN_REQUIRED      → 422 terapi plan belum ada
FILE_TOO_LARGE             → 400 file > 5MB
FILE_INVALID_TYPE          → 400 bukan JPG/PNG/WebP
```

### Pagination Query Params (semua endpoint list)
```
GET /resource?page=1&limit=10&search=keyword&sortBy=createdAt&sortOrder=desc
```

***

## Module 1 — Authentication

### `POST /auth/login`
```
Deskripsi : Login semua role
Auth       : ❌ Tidak perlu token
```

**Request Body:**
```json
{
  "email": "admin@raho.id",
  "password": "password123"
}
```

**Zod Schema:**
```ts
z.object({
  email   : z.string().email("Format email tidak valid."),
  password: z.string().min(6, "Password minimal 6 karakter.")
})
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "accessToken" : "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "userId"    : "clxxx001",
      "email"     : "admin@raho.id",
      "role"      : "ADMIN_LAYANAN",
      "branchId"  : "clxxx_branch_001",
      "branchCode": "PST",
      "fullName"  : "Admin Test",
      "staffCode" : "AL-20260410-X9KZ"
    }
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Email tidak terdaftar | `401` | `AUTH_INVALID_CREDENTIALS` |
| Password salah | `401` | `AUTH_INVALID_CREDENTIALS` |
| User `isActive: false` | `401` | `AUTH_INVALID_CREDENTIALS` |

***

### `POST /auth/refresh`
```
Deskripsi : Silent refresh accessToken
Auth       : ❌ Tidak perlu accessToken (sudah expired)
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "accessToken" : "eyJhbGci...(baru)",
    "refreshToken": "eyJhbGci...(baru, rotasi)"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| refreshToken expired | `401` | `AUTH_TOKEN_EXPIRED` |
| refreshToken invalid | `401` | `AUTH_TOKEN_INVALID` |

***

### `POST /auth/logout`
```
Deskripsi : Invalidate refreshToken
Auth       : ✅ Bearer token
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "message": "Logout berhasil."
  }
}
```

***

## Module 2 — Member

### `GET /members`
```
Deskripsi : List member di cabang staff login
Auth       : ✅ ALLSTAFF
```

**Query Params:**
```
page     : number  (default: 1)
limit    : number  (default: 10)
search   : string  (nama / memberNo / phone)
status   : ACTIVE | INACTIVE
sortBy   : createdAt | fullName | memberNo
sortOrder: asc | desc
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "memberId"   : "clxxx_mbr_001",
      "memberNo"   : "MBR-PST-2604-00001",
      "fullName"   : "Budi Santoso",
      "phone"      : "0812-3456-7890",
      "status"     : "ACTIVE",
      "voucherCount": 4,
      "isLintas"   : false,       // true jika dari cabang lain via BranchMemberAccess
      "avatarUrl"  : "https://minio.../foto-profil.jpg"
    }
  ],
  "meta": {
    "total": 142, "page": 1, "limit": 10, "totalPages": 15
  }
}
```

***

### `GET /members/lookup`
```
Deskripsi : Cari member lintas cabang by memberNo
Auth       : ✅ ALLSTAFF
```

**Query Params:**
```
memberNo: string (wajib)
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "memberId"           : "clxxx_mbr_099",
    "memberNo"           : "MBR-BDG-2604-00015",
    "fullName"           : "Ahmad Fauzi",
    "phone"              : "0813-9999-0001",
    "status"             : "ACTIVE",
    "registrationBranch" : { "branchId": "clxxx_bdg", "name": "Cabang Bandung", "branchCode": "BDG" },
    "sudahAdaAkses"      : false,
    "isRegistrationBranch": false
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| memberNo tidak ditemukan | `404` | `MEMBER_NOT_FOUND` |

***

### `POST /members/grant-access`
```
Deskripsi : Grant akses member lintas cabang ke cabang staff ini
Auth       : ✅ ALLSTAFF
```

**Request Body:**
```json
{
  "memberId": "clxxx_mbr_099",
  "notes"   : "Member request terapi di cabang Pusat"
}
```

**Zod Schema:**
```ts
z.object({
  memberId: z.string().cuid(),
  notes   : z.string().max(500).optional()
})
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "accessId" : "clxxx_access_001",
    "memberId" : "clxxx_mbr_099",
    "branchId" : "clxxx_pst",
    "grantedBy": "clxxx_user_001",
    "createdAt": "2026-04-11T10:00:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Ini adalah cabang registrasi member | `400` | `BRANCH_ACCESS_DENIED` |
| Akses sudah ada sebelumnya | `409` | `MEMBER_ACCESS_EXISTS` |

***

### `POST /members`
```
Deskripsi : Daftarkan member baru
Auth       : ✅ ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN
```

**Request Body (`multipart/form-data`):**
```
# Section A — Data Pribadi
fullName          : string (wajib)
nik               : string (16 digit, opsional)
tempatLahir       : string (opsional)
dateOfBirth       : ISO string (opsional)
jenisKelamin      : "L" | "P" (opsional)
phone             : string (opsional)
email             : string (opsional)
address           : string (opsional)
pekerjaan         : string (opsional)
statusNikah       : string (opsional)
emergencyContact  : string (opsional)
sumberInfoRaho    : string (opsional)
postalCode        : string (opsional)

# Section B — Akun Member
memberEmail       : string (wajib, email format)
memberPassword    : string (wajib, min 8)
referralCodeId    : CUID (opsional)
isConsentToPhoto  : boolean (default true)

# Section C — Dokumen
pspFile           : File (JPG/PNG/WebP, max 5MB, opsional)
profilePhotoFile  : File (JPG/PNG/WebP, max 5MB, opsional)
```

**Zod Schema (JSON part):**
```ts
z.object({
  fullName        : z.string().min(2).max(100),
  nik             : z.string().length(16).optional(),
  tempatLahir     : z.string().max(50).optional(),
  dateOfBirth     : z.string().datetime().optional(),
  jenisKelamin    : z.enum(["L","P"]).optional(),
  phone           : z.string().max(20).optional(),
  email           : z.string().email().optional(),
  address         : z.string().max(255).optional(),
  pekerjaan       : z.string().max(100).optional(),
  statusNikah     : z.string().max(30).optional(),
  emergencyContact: z.string().max(100).optional(),
  sumberInfoRaho  : z.string().max(100).optional(),
  postalCode      : z.string().max(10).optional(),
  memberEmail     : z.string().email(),
  memberPassword  : z.string().min(8),
  referralCodeId  : z.string().cuid().optional(),
  isConsentToPhoto: z.boolean().default(true)
})
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "memberId"  : "clxxx_mbr_143",
    "memberNo"  : "MBR-PST-2604-00143",
    "fullName"  : "Siti Rahayu",
    "memberEmail": "siti@email.com",
    "branchId"  : "clxxx_pst",
    "createdAt" : "2026-04-11T10:00:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Email member sudah terdaftar | `409` | `MEMBER_EMAIL_DUPLICATE` |
| NIK sudah terdaftar | `409` | `MEMBER_NIK_DUPLICATE` |
| Referral code tidak aktif | `400` | `REFERRAL_INVALID` |
| File > 5MB | `400` | `FILE_TOO_LARGE` |
| Format file tidak valid | `400` | `FILE_INVALID_TYPE` |

***

### `GET /members/:memberId`
```
Deskripsi : Detail lengkap satu member
Auth       : ✅ ALLSTAFF (harus punya akses ke member ini)
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "memberId"      : "clxxx_mbr_001",
    "memberNo"      : "MBR-PST-2604-00001",
    "status"        : "ACTIVE",
    "voucherCount"  : 4,
    "isConsentToPhoto": true,
    "profile": {
      "fullName"      : "Budi Santoso",
      "nik"           : "3271xxxxxxxxxxxxxx",
      "tempatLahir"   : "Jakarta",
      "dateOfBirth"   : "1985-01-01T00:00:00.000Z",
      "jenisKelamin"  : "L",
      "phone"         : "0812-3456-7890",
      "address"       : "Jl. Contoh No. 1, Jakarta",
      "pekerjaan"     : "Swasta",
      "statusNikah"   : "Menikah",
      "emergencyContact": "Ny. Budi · 0812-9999-8888",
      "sumberInfoRaho": "Instagram",
      "postalCode"    : "12345"
    },
    "referral": {
      "referralCodeId"  : "clxxx_ref_001",
      "code"            : "DR-SUSI-001",
      "referrerName"    : "dr. Susi Wijaya",
      "referrerType"    : "DOKTER"
    },
    "registrationBranch": {
      "branchId"  : "clxxx_pst",
      "name"      : "Cabang Pusat",
      "branchCode": "PST"
    },
    "documents": [
      {
        "documentId"  : "clxxx_doc_001",
        "documentType": "PERSETUJUAN_SETELAH_PENJELASAN",
        "fileUrl"     : "https://minio.../psp.jpg",
        "fileName"    : "psp.jpg",
        "uploadedAt"  : "2026-02-01T08:00:00.000Z"
      }
    ],
    "createdAt": "2026-02-01T08:00:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Member tidak ditemukan | `404` | `MEMBER_NOT_FOUND` |
| Staff tidak punya akses | `403` | `BRANCH_ACCESS_DENIED` |

***

### `PATCH /members/:memberId`
```
Deskripsi : Edit data profil member
Auth       : ✅ SUPER_ADMIN only
```

**Request Body:**
```json
{
  "fullName"       : "Budi Santoso Updated",
  "phone"          : "0812-0000-0001",
  "address"        : "Jl. Baru No. 5, Jakarta",
  "pekerjaan"      : "Wiraswasta",
  "emergencyContact": "Ny. Baru · 0812-1111-2222"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "memberId"  : "clxxx_mbr_001",
    "updatedAt" : "2026-04-11T12:00:00.000Z"
  }
}
```

***

### `GET /members/:memberId/packages`
```
Deskripsi : List semua paket member (Tab Paket)
Auth       : ✅ ALLSTAFF
```

**Query Params:**
```
status: PENDING_PAYMENT | ACTIVE | EXPIRED | CANCELLED
type  : BASIC | BOOSTER
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "packageId"     : "clxxx_pkg_001",
      "packageCode"   : "PKG-PST-BSC-2604-XY9A1",
      "packageType"   : "BASIC",
      "totalSessions" : 7,
      "usedSessions"  : 5,
      "remainingSessions": 2,
      "finalPrice"    : "12500000.00",
      "discountPercent": "10.00",
      "discountAmount": "1000000.00",
      "discountNote"  : "Diskon loyalitas",
      "status"        : "ACTIVE",
      "branchId"      : "clxxx_pst",
      "branchName"    : "Cabang Pusat",
      "assignedBy"    : { "userId": "clxxx_user_001", "fullName": "Admin Test" },
      "verifiedBy"    : { "userId": "clxxx_user_002", "fullName": "Admin Cabang" },
      "activatedAt"   : "2026-02-01T09:00:00.000Z",
      "createdAt"     : "2026-02-01T08:30:00.000Z"
    }
  ]
}
```

***

### `GET /members/:memberId/encounters`
```
Deskripsi : List encounter + sesi (Tab Sesi Terapi)
Auth       : ✅ ALLSTAFF
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "encounterId"  : "clxxx_enc_001",
      "encounterCode": "ENC-PST-2604-AB3Z9",
      "status"       : "ONGOING",
      "doctor"       : { "userId": "clxxx_dr_001", "fullName": "dr. Test" },
      "nurse"        : { "userId": "clxxx_nr_001", "fullName": "Nakes Test" },
      "memberPackage": {
        "packageCode"    : "PKG-PST-BSC-2604-XY9A1",
        "totalSessions"  : 7,
        "usedSessions"   : 5,
        "remainingSessions": 2
      },
      "sessions": [
        {
          "sessionId"    : "clxxx_ses_001",
          "sessionCode"  : "SES-PST-01-2604-P9QR1",
          "infusKe"      : 1,
          "treatmentDate": "2026-04-01T09:00:00.000Z",
          "pelaksanaan"  : "ON_SITE",
          "status"       : "COMPLETED",
          "stepsCompleted": {
            "diagnosis"  : true,
            "therapyPlan": true,
            "vitalBefore": true,
            "booster"    : false,
            "infusion"   : true,
            "materials"  : true,
            "photo"      : true,
            "vitalAfter" : true,
            "emrNote"    : true,
            "evaluation" : true
          }
        }
      ],
      "createdAt": "2026-04-01T08:00:00.000Z"
    }
  ]
}
```

***

### `GET /members/:memberId/diagnoses`
```
Deskripsi : List semua diagnosa member (Tab Diagnosa)
Auth       : ✅ ALLSTAFF
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "diagnosisId"     : "clxxx_dx_001",
      "diagnosisCode"   : "DX-PST-2604-00001",
      "encounterId"     : "clxxx_enc_001",
      "encounterCode"   : "ENC-PST-2604-AB3Z9",
      "doktorPemeriksa" : { "userId": "clxxx_dr_001", "fullName": "dr. Test" },
      "diagnosa"        : "Hipertensi stage 1",
      "kategoriDiagnosa": "HIPERTENSI",
      "icdPrimer"       : "I10",
      "createdAt"       : "2026-04-01T09:30:00.000Z"
    }
  ]
}
```

***

### `POST /members/:memberId/notifications`
```
Deskripsi : Kirim notifikasi manual ke member
Auth       : ✅ ALLSTAFF
```

**Request Body:**
```json
{
  "type"    : "REMINDER",
  "title"   : "Pengingat Jadwal Sesi",
  "body"    : "Jadwal infus Anda besok pukul 09:00. Harap datang tepat waktu.",
  "deepLink": "/me/sessions"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "notificationId": "clxxx_notif_001",
    "userId"        : "clxxx_user_member_001",
    "title"         : "Pengingat Jadwal Sesi",
    "sentAt"        : "2026-04-11T10:00:00.000Z"
  }
}
```

***

## Referensi Endpoint — Bagian 1

```
METHOD  ENDPOINT                              AUTH              STATUS
─────────────────────────────────────────────────────────────────────────
POST    /auth/login                           Public            ✅
POST    /auth/refresh                         Public            ✅
POST    /auth/logout                          Bearer            ✅

GET     /members                              ALLSTAFF          ✅
GET     /members/lookup                       ALLSTAFF          ✅
POST    /members/grant-access                 ALLSTAFF          ✅
POST    /members                              AL AC AM SA       ✅
GET     /members/:memberId                    ALLSTAFF          ✅
PATCH   /members/:memberId                    SA                ✅
GET     /members/:memberId/packages           ALLSTAFF          ✅
GET     /members/:memberId/encounters         ALLSTAFF          ✅
GET     /members/:memberId/diagnoses          ALLSTAFF          ✅
POST    /members/:memberId/notifications      ALLSTAFF          ✅
```

***

**Bagian 1 selesai** — 14 endpoint untuk Auth & Member Module.

**Bagian 2** akan mencakup:
- `Package` — assign, verifikasi, kelola harga
- `Session` — buat sesi, detail sesi
- `Session Steps` — semua 10 endpoint per step (diagnosis, therapy plan, vital, booster, infusion, materials, photo, emr note, evaluation)

# 📋 API Contract Design — RAHO
# Bagian 2 of 3 — Package + Session Module (10 Steps)

***

## Module 3 — Package

### `POST /members/:memberId/packages`
```
Deskripsi : Assign paket BASIC + opsional BOOSTER ke member
Auth       : ✅ ADMIN_LAYANAN, DOCTOR, NURSE, ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN
```

**Request Body:**
```json
{
  "basicPackagePricingId" : "clxxx_price_001",
  "basicTotalSessions"    : 7,
  "boosterTotalSessions"  : 3,
  "discountPercent"       : 10,
  "discountAmount"        : 1000000,
  "discountNote"          : "Diskon loyalitas",
  "notes"                 : "Custom 5 sesi basic + 3 booster"
}
```

**Zod Schema:**
```ts
z.object({
  basicPackagePricingId: z.string().cuid().optional(),  // null = custom
  basicTotalSessions   : z.number().int().min(1),
  boosterTotalSessions : z.number().int().min(1).optional(),
  discountPercent      : z.number().min(0).max(100).optional(),
  discountAmount       : z.number().min(0).optional(),
  discountNote         : z.string().max(255).optional(),
  notes                : z.string().max(500).optional()
})
```

**Backend Process:**
```
1. assertMemberAccess(memberId, branchId)
2. Resolve harga dari PackagePricing (atau custom)
3. Hitung finalPrice setelah diskon
4. prisma.$transaction:
   a. MemberPackage.create BASIC  → status: PENDING_PAYMENT
   b. MemberPackage.create BOOSTER (jika ada) → status: PENDING_PAYMENT
   c. Member.update voucherCount += basicTotalSessions
5. logAudit(CREATE, MemberPackage)
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "basic": {
      "packageId"  : "clxxx_pkg_003",
      "packageCode": "PKG-PST-BSC-2604-XY9A3",
      "packageType": "BASIC",
      "totalSessions": 7,
      "finalPrice" : "12500000.00",
      "status"     : "PENDING_PAYMENT"
    },
    "booster": {
      "packageId"  : "clxxx_pkg_004",
      "packageCode": "PKG-PST-BST-2604-AB3Z4",
      "packageType": "BOOSTER",
      "totalSessions": 3,
      "finalPrice" : "2700000.00",
      "status"     : "PENDING_PAYMENT"
    }
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Staff tidak punya akses ke member | `403` | `BRANCH_ACCESS_DENIED` |
| PackagePricing tidak ditemukan | `404` | `RESOURCE_NOT_FOUND` |
| PackagePricing nonaktif | `422` | `PACKAGE_NOT_ACTIVE` |

***

### `PATCH /members/:memberId/packages/:packageId/verify`
```
Deskripsi : Verifikasi pembayaran paket → PENDING_PAYMENT menjadi ACTIVE
Auth       : ✅ ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN
```

**Request Body:** _(kosong — tidak perlu payload)_
```json
{}
```

**Backend Process:**
```
1. Cek status = PENDING_PAYMENT → 422 jika bukan
2. prisma.$transaction:
   a. MemberPackage.update → status: ACTIVE
                           → paidAt: now()
                           → verifiedBy: userId
                           → verifiedAt: now()
                           → activatedAt: now()
3. Notifikasi otomatis ke member: "Paket Anda telah aktif"
4. logAudit(VERIFY, MemberPackage)
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "packageId"  : "clxxx_pkg_003",
    "packageCode": "PKG-PST-BSC-2604-XY9A3",
    "status"     : "ACTIVE",
    "activatedAt": "2026-04-11T10:30:00.000Z",
    "verifiedBy" : {
      "userId"  : "clxxx_user_002",
      "fullName": "Admin Cabang"
    }
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Status bukan `PENDING_PAYMENT` | `422` | `PACKAGE_INVALID_STATUS` |
| Package tidak ditemukan | `404` | `RESOURCE_NOT_FOUND` |

***

### `GET /package-pricing`
```
Deskripsi : List harga paket aktif di cabang staff login
Auth       : ✅ ALLSTAFF (untuk dropdown assign)
```

**Query Params:**
```
type    : BASIC | BOOSTER
isActive: true | false (default: true)
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "pricingId"    : "clxxx_price_001",
      "packageType"  : "BASIC",
      "name"         : "Basic 7 Sesi",
      "totalSessions": 7,
      "price"        : "12500000.00",
      "isActive"     : true,
      "branchId"     : "clxxx_pst"
    }
  ]
}
```

***

### `POST /package-pricing`
```
Deskripsi : Tambah harga paket baru di cabang
Auth       : ✅ ADMIN_MANAGER, SUPER_ADMIN
```

**Request Body:**
```json
{
  "branchId"     : "clxxx_pst",
  "packageType"  : "BASIC",
  "name"         : "Basic 15 Sesi",
  "totalSessions": 15,
  "price"        : 22500000
}
```

**Zod Schema:**
```ts
z.object({
  branchId     : z.string().cuid(),
  packageType  : z.enum(["BASIC","BOOSTER"]),
  name         : z.string().min(3).max(100),
  totalSessions: z.number().int().min(1),
  price        : z.number().positive()
})
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "pricingId"    : "clxxx_price_005",
    "packageType"  : "BASIC",
    "name"         : "Basic 15 Sesi",
    "totalSessions": 15,
    "price"        : "22500000.00",
    "branchId"     : "clxxx_pst",
    "createdAt"    : "2026-04-11T11:00:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Kombinasi sudah ada | `409` | `PACKAGE_PRICING_DUPLICATE` |

***

### `PATCH /package-pricing/:pricingId`
```
Deskripsi : Edit atau nonaktifkan harga paket
Auth       : ✅ ADMIN_MANAGER, SUPER_ADMIN
```

**Request Body:**
```json
{
  "name"    : "Basic 15 Sesi (Update)",
  "price"   : 23000000,
  "isActive": false
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "pricingId": "clxxx_price_005",
    "updatedAt": "2026-04-11T11:30:00.000Z"
  }
}
```

***

## Module 4 — Session

### `POST /treatment-sessions`
```
Deskripsi : Buat sesi terapi baru untuk member
Auth       : ✅ ALLSTAFF
```

**Request Body:**
```json
{
  "memberId"       : "clxxx_mbr_001",
  "memberPackageId": "clxxx_pkg_001",
  "boosterPackageId": null,
  "adminLayananId" : "clxxx_user_001",
  "doctorId"       : "clxxx_dr_001",
  "nurseId"        : "clxxx_nr_001",
  "treatmentDate"  : "2026-04-15T09:00:00.000Z",
  "pelaksanaan"    : "ON_SITE"
}
```

**Zod Schema:**
```ts
z.object({
  memberId        : z.string().cuid(),
  memberPackageId : z.string().cuid(),
  boosterPackageId: z.string().cuid().optional().nullable(),
  adminLayananId  : z.string().cuid(),
  doctorId        : z.string().cuid(),
  nurseId         : z.string().cuid(),
  treatmentDate   : z.string().datetime(),
  pelaksanaan     : z.enum(["ON_SITE","HOME_CARE"])
})
```

**Backend Process:**
```
1. assertMemberAccess(memberId, branchId)
2. Validasi memberPackage.branchId = staff.branchId
3. Validasi MemberPackage BASIC → status: ACTIVE, sisa sesi > 0
4. Validasi voucherCount > 0
5. Validasi doctorId role = DOCTOR, isActive = true
6. Validasi nurseId role = NURSE, isActive = true
7. Cari Encounter ONGOING dengan memberPackageId:
   → Ada: pakai existing
   → Tidak ada: Encounter.create
8. infusKe = MAX(infusKe) + 1
9. prisma.$transaction:
   a. TreatmentSession.create
   b. MemberPackage BASIC.update usedSessions += 1
   c. Member.update voucherCount -= 1
   d. (jika booster) MemberPackage BOOSTER.update usedSessions += 1
10. logAudit(CREATE, TreatmentSession)
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "sessionId"    : "clxxx_ses_003",
    "sessionCode"  : "SES-PST-03-2604-P9QR3",
    "encounterId"  : "clxxx_enc_001",
    "encounterCode": "ENC-PST-2604-AB3Z9",
    "infusKe"      : 3,
    "pelaksanaan"  : "ON_SITE",
    "treatmentDate": "2026-04-15T09:00:00.000Z",
    "isCompleted"  : false,
    "branchId"     : "clxxx_pst"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| memberPackage bukan cabang ini | `403` | `PACKAGE_BRANCH_MISMATCH` |
| Tidak ada paket BASIC ACTIVE | `422` | `PACKAGE_NOT_ACTIVE` |
| Sesi BASIC habis | `422` | `PACKAGE_SESSIONS_EXHAUSTED` |
| Sesi BOOSTER habis | `422` | `PACKAGE_SESSIONS_EXHAUSTED` |
| voucherCount = 0 | `422` | `VOUCHER_EXHAUSTED` |
| doctorId bukan DOCTOR | `403` | `AUTH_FORBIDDEN` |
| nurseId bukan NURSE | `403` | `AUTH_FORBIDDEN` |

***

### `GET /treatment-sessions/:sessionId`
```
Deskripsi : Detail lengkap satu sesi + semua step data
Auth       : ✅ ALLSTAFF
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "sessionId"    : "clxxx_ses_003",
    "sessionCode"  : "SES-PST-03-2604-P9QR3",
    "encounterId"  : "clxxx_enc_001",
    "encounterCode": "ENC-PST-2604-AB3Z9",
    "infusKe"      : 3,
    "pelaksanaan"  : "ON_SITE",
    "treatmentDate": "2026-04-15T09:00:00.000Z",
    "isCompleted"  : false,
    "member": {
      "memberId" : "clxxx_mbr_001",
      "memberNo" : "MBR-PST-2604-00001",
      "fullName" : "Budi Santoso"
    },
    "pics": {
      "adminLayanan": { "userId": "clxxx_user_001", "fullName": "Admin Test" },
      "doctor"      : { "userId": "clxxx_dr_001",   "fullName": "dr. Test" },
      "nurse"       : { "userId": "clxxx_nr_001",   "fullName": "Nakes Test" }
    },
    "boosterPackageId": null,
    "boosterType"     : null,
    "steps": {
      "diagnosis"  : { "done": true,  "data": { "diagnosisId": "clxxx_dx_001" } },
      "therapyPlan": { "done": true,  "data": { "planId": "clxxx_tp_001" } },
      "vitalBefore": { "done": true,  "data": [ ] },
      "booster"    : { "done": false, "data": null },
      "infusion"   : { "done": false, "data": null },
      "materials"  : { "done": false, "data": [ ] },
      "photo"      : { "done": false, "data": null },
      "vitalAfter" : { "done": false, "data": [ ] },
      "emrNote"    : { "done": false, "data": [ ] },
      "evaluation" : { "done": false, "data": null }
    }
  }
}
```

***

## Module 4 — Session Steps

### STEP 1 — `POST /encounters/:encounterId/diagnoses`
```
Deskripsi : Buat diagnosa (sekali per encounter)
Auth       : ✅ ALLSTAFF
```

**Request Body:**
```json
{
  "doktorPemeriksa"         : "clxxx_dr_001",
  "diagnosa"                : "Hipertensi stage 1 dengan komplikasi",
  "kategoriDiagnosa"        : "HIPERTENSI",
  "icdPrimer"               : "I10",
  "icdSekunder"             : null,
  "icdTersier"              : null,
  "keluhanRiwayatSekarang"  : "Pusing dan tekanan darah tinggi sejak 3 hari",
  "riwayatPenyakitTerdahulu": "Diabetes tipe 2 sejak 2018",
  "riwayatSosialKebiasaan"  : "Merokok 1 bungkus/hari, kurang olahraga",
  "riwayatPengobatan"       : "Amlodipine 5mg 1x1",
  "pemeriksaanFisik"        : "TD 160/100, Nadi 88x/mnt, BB 75kg",
  "pemeriksaanTambahan"     : [
    { "key": "Kolesterol Total", "value": "240 mg/dL" },
    { "key": "Gula Darah Puasa", "value": "110 mg/dL" }
  ]
}
```

**Zod Schema:**
```ts
z.object({
  doktorPemeriksa          : z.string().cuid(),
  diagnosa                 : z.string().min(3).max(1000),
  kategoriDiagnosa         : z.enum([...DiagnosisCategory]).optional(),
  icdPrimer                : z.string().max(20).optional(),
  icdSekunder              : z.string().max(20).optional(),
  icdTersier               : z.string().max(20).optional(),
  keluhanRiwayatSekarang   : z.string().max(5000).optional(),
  riwayatPenyakitTerdahulu : z.string().max(5000).optional(),
  riwayatSosialKebiasaan   : z.string().max(5000).optional(),
  riwayatPengobatan        : z.string().max(5000).optional(),
  pemeriksaanFisik         : z.string().max(5000).optional(),
  pemeriksaanTambahan      : z.array(
    z.object({ key: z.string(), value: z.string() })
  ).optional()
})
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "diagnosisId"  : "clxxx_dx_001",
    "diagnosisCode": "DX-PST-2604-00001",
    "encounterId"  : "clxxx_enc_001",
    "createdAt"    : "2026-04-15T09:30:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Diagnosa sudah ada di encounter ini | `409` | `DIAGNOSIS_EXISTS` |
| doktorPemeriksa bukan role DOCTOR | `403` | `AUTH_FORBIDDEN` |

***

### STEP 2 — `POST /treatment-sessions/:sessionId/therapy-plan`
```
Deskripsi : Buat rencana 12 dosis infus (WAJIB sebelum step 3-10)
Auth       : ✅ ALLSTAFF
```

**Request Body:**
```json
{
  "ifa"       : 500,
  "hho"       : 200,
  "h2"        : 100,
  "no"        : 50,
  "gaso"      : 0,
  "o2"        : 150,
  "o3"        : 0,
  "edta"      : 75,
  "mb"        : 0,
  "h2s"       : 0,
  "kcl"       : 30,
  "jmlNb"     : 500,
  "keterangan": "Dosis standar hipertensi stage 1"
}
```

**Zod Schema:**
```ts
z.object({
  ifa        : z.number().min(0).optional(),
  hho        : z.number().min(0).optional(),
  h2         : z.number().min(0).optional(),
  no         : z.number().min(0).optional(),
  gaso       : z.number().min(0).optional(),
  o2         : z.number().min(0).optional(),
  o3         : z.number().min(0).optional(),
  edta       : z.number().min(0).optional(),
  mb         : z.number().min(0).optional(),
  h2s        : z.number().min(0).optional(),
  kcl        : z.number().min(0).optional(),
  jmlNb      : z.number().min(0).optional(),
  keterangan : z.string().max(2000).optional()
})
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "planId"           : "clxxx_tp_003",
    "planCode"         : "TP-PST-2604-00003",
    "treatmentSessionId": "clxxx_ses_003",
    "createdAt"        : "2026-04-15T09:45:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Diagnosa belum ada di encounter ini | `422` | `DIAGNOSIS_REQUIRED` |
| Terapi plan sudah ada di sesi ini | `409` | `THERAPY_PLAN_EXISTS` |

***

### STEP 3 & 8 — `POST /treatment-sessions/:sessionId/vital-signs`
```
Deskripsi : Input tanda vital SEBELUM (step 3) atau SESUDAH (step 8)
            Endpoint sama, dibedakan oleh field waktuCatat
Auth       : ✅ ALLSTAFF
```

**Request Body:**
```json
{
  "waktuCatat": "SEBELUM",
  "vitals": [
    { "pencatatan": "SISTOL",   "value": 160, "unit": "mmHg" },
    { "pencatatan": "DIASTOL",  "value": 100, "unit": "mmHg" },
    { "pencatatan": "HR",       "value": 88,  "unit": "bpm"  },
    { "pencatatan": "SATURASI", "value": 98,  "unit": "%"    },
    { "pencatatan": "PI",       "value": 2.5, "unit": "%"    }
  ]
}
```

**Zod Schema:**
```ts
z.object({
  waktuCatat: z.enum(["SEBELUM","SESUDAH"]),
  vitals    : z.array(z.object({
    pencatatan: z.enum(["SISTOL","DIASTOL","HR","SATURASI","PI"]),
    value     : z.number(),
    unit      : z.string().max(10).optional()
  })).min(1)
})
```

**Backend Process:**
```
Upsert per vital:
  prisma.vitalSign.upsert({
    where : { treatmentSessionId_pencatatan_waktuCatat: { ... } },
    create: { ... },
    update: { value, unit, recordedBy }
  })
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "saved": [
      { "vitalId": "clxxx_vs_001", "pencatatan": "SISTOL",   "waktuCatat": "SEBELUM", "value": 160 },
      { "vitalId": "clxxx_vs_002", "pencatatan": "DIASTOL",  "waktuCatat": "SEBELUM", "value": 100 },
      { "vitalId": "clxxx_vs_003", "pencatatan": "HR",       "waktuCatat": "SEBELUM", "value": 88  },
      { "vitalId": "clxxx_vs_004", "pencatatan": "SATURASI", "waktuCatat": "SEBELUM", "value": 98  },
      { "vitalId": "clxxx_vs_005", "pencatatan": "PI",       "waktuCatat": "SEBELUM", "value": 2.5 }
    ]
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Therapy plan belum ada | `422` | `THERAPY_PLAN_REQUIRED` |

***

### STEP 4 — `PATCH /treatment-sessions/:sessionId/booster-type`
```
Deskripsi : Pilih jenis booster (sekali, tidak bisa diubah)
            Sekaligus trigger deduct stok booster
Auth       : ✅ ALLSTAFF
```

**Request Body:**
```json
{
  "boosterType": "NO"
}
```

**Zod Schema:**
```ts
z.object({
  boosterType: z.enum(["NO","GASSOTRAUS"])
})
```

**Backend Process:**
```
1. Cek sesi punya boosterPackageId → 422 jika tidak
2. Cek boosterType belum diisi → 409 jika sudah
3. prisma.$transaction:
   a. TreatmentSession.update boosterType = "NO"
   b. InventoryItem.update stock -= qty (stok NO/GASSOTRAUS)
   c. StockMutation.create type: USED
4. logAudit(UPDATE, TreatmentSession)
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "sessionId"  : "clxxx_ses_003",
    "boosterType": "NO",
    "updatedAt"  : "2026-04-15T10:00:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Sesi tidak punya boosterPackageId | `422` | `BOOSTER_NOT_APPLICABLE` |
| boosterType sudah dipilih sebelumnya | `409` | `BOOSTER_TYPE_EXISTS` |
| Stok tidak mencukupi | `409` | `STOCK_INSUFFICIENT` |

***

### STEP 5 — `POST /treatment-sessions/:sessionId/infusion`
```
Deskripsi : Input dosis aktual infus + info fisik
            Jika aktual ≠ rencana → deviationNotes wajib diisi
            Sekaligus trigger deduct stok infus
Auth       : ✅ ALLSTAFF
```

**Request Body:**
```json
{
  "ifa"   : 500,
  "hho"   : 180,
  "h2"    : 100,
  "no"    : 50,
  "gaso"  : 0,
  "o2"    : 150,
  "o3"    : 0,
  "edta"  : 75,
  "mb"    : 0,
  "h2s"   : 0,
  "kcl"   : 30,
  "jmlNb" : 500,
  "deviationNotes" : "HHO dikurangi 20ml karena reaksi ringan di lengan",
  "bottleType"     : "IFA",
  "jenisCairan"    : "NaCl 0.9%",
  "volumeCarrier"  : 500,
  "jumlahJarum"    : 1,
  "tanggalProduksi": "2026-03-01T00:00:00.000Z"
}
```

**Zod Schema:**
```ts
z.object({
  ifa   : z.number().min(0).optional(),
  hho   : z.number().min(0).optional(),
  // ... (12 field sama dengan TherapyPlan)
  deviationNotes : z.string().max(5000).optional(),
  bottleType     : z.enum(["IFA","EDTA"]).optional(),
  jenisCairan    : z.string().max(100).optional(),
  volumeCarrier  : z.number().min(0).optional(),
  jumlahJarum    : z.number().int().min(0).optional(),
  tanggalProduksi: z.string().datetime().optional()
}).superRefine((data, ctx) => {
  // Validasi: jika ada deviasi, deviationNotes wajib ada
  const plan = /* fetch dari DB */
  const hasDeviation = checkDeviation(data, plan)
  if (hasDeviation && !data.deviationNotes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Catatan deviasi wajib diisi jika dosis berbeda dari rencana.",
      path: ["deviationNotes"]
    })
  }
})
```

**Backend Process:**
```
1. Cek therapy plan ada → 422 jika tidak
2. Cek infusion belum ada → 409 jika sudah
3. Bandingkan aktual vs rencana → jika ada deviasi, cek deviationNotes
4. prisma.$transaction:
   a. InfusionExecution.create
   b. Per bahan yang dipakai:
      InventoryItem.update stock -= aktual
      StockMutation.create type: USED
5. logAudit(CREATE, InfusionExecution)
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "infusionId"       : "clxxx_inf_003",
    "treatmentSessionId": "clxxx_ses_003",
    "hasDeviation"     : true,
    "deviationNotes"   : "HHO dikurangi 20ml karena reaksi ringan",
    "stockDeducted"    : [
      { "productName": "HHO",  "qty": 180, "unit": "ml" },
      { "productName": "IFA",  "qty": 500, "unit": "mg" }
    ],
    "createdAt": "2026-04-15T10:15:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Therapy plan belum ada | `422` | `THERAPY_PLAN_REQUIRED` |
| Infusion sudah ada | `409` | `INFUSION_EXISTS` |
| Ada deviasi tanpa catatan | `400` | `DEVIATION_NOTE_REQUIRED` |
| Stok tidak mencukupi | `409` | `STOCK_INSUFFICIENT` |

***

### STEP 6 — `POST /treatment-sessions/:sessionId/materials`
```
Deskripsi : Tambah pemakaian bahan tambahan (bisa dipanggil berkali-kali)
            Setiap submit langsung deduct stok
Auth       : ✅ ALLSTAFF
```

**Request Body:**
```json
{
  "inventoryItemId": "clxxx_inv_005",
  "quantity"       : 3,
  "unit"           : "pcs"
}
```

**Zod Schema:**
```ts
z.object({
  inventoryItemId: z.string().cuid(),
  quantity       : z.number().positive(),
  unit           : z.string().max(20)
})
```

**Backend Process:**
```
1. Cek InventoryItem.branchId = staff.branchId
2. Cek stock >= quantity → 409 jika tidak
3. prisma.$transaction:
   a. MaterialUsage.create
   b. InventoryItem.update stock -= quantity
   c. StockMutation.create type: USED, referenceId: sessionId
4. Return updated stock untuk dropdown real-time
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "materialId"     : "clxxx_mat_001",
    "inventoryItemId": "clxxx_inv_005",
    "productName"    : "Alkohol Swab",
    "quantity"       : 3,
    "unit"           : "pcs",
    "stockAfter"     : 947,
    "createdAt"      : "2026-04-15T10:30:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Stok tidak mencukupi | `409` | `STOCK_INSUFFICIENT` |
| Item bukan milik cabang ini | `403` | `BRANCH_ACCESS_DENIED` |

***

### `GET /treatment-sessions/:sessionId/materials`
```
Deskripsi : List semua pemakaian bahan di sesi ini
Auth       : ✅ ALLSTAFF
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "materialId"  : "clxxx_mat_001",
      "productName" : "Alkohol Swab",
      "category"    : "CONSUMABLE",
      "quantity"    : 3,
      "unit"        : "pcs",
      "recordedBy"  : { "userId": "clxxx_user_001", "fullName": "Admin Test" },
      "createdAt"   : "2026-04-15T10:30:00.000Z"
    }
  ],
  "meta": { "totalItems": 1 }
}
```

***

### STEP 7 — `POST /treatment-sessions/:sessionId/photo`
```
Deskripsi : Upload satu foto dokumentasi sesi (singular, bukan photos)
Auth       : ✅ ALLSTAFF
Content-Type: multipart/form-data
```

**Request Body (`multipart/form-data`):**
```
photoFile: File (JPG/PNG/WebP, max 5MB, wajib)
```

**Backend Process:**
```
1. Validasi file: MIME type, ukuran
2. Cek SessionPhoto belum ada → 409 jika sudah
3. Upload ke MinIO:
   Path: uploads/sessions/{sessionId}/photo/{filename}
4. SessionPhoto.create
5. Return photoUrl
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "photoId"          : "clxxx_photo_003",
    "treatmentSessionId": "clxxx_ses_003",
    "fileUrl"          : "https://minio.../sessions/clxxx_ses_003/photo/doc.jpg",
    "fileName"         : "doc.jpg",
    "fileSize"         : 1024000,
    "uploadedBy"       : { "userId": "clxxx_user_001", "fullName": "Admin Test" },
    "createdAt"        : "2026-04-15T10:45:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Foto sudah diupload sebelumnya | `409` | `SESSION_PHOTO_EXISTS` |
| File > 5MB | `400` | `FILE_TOO_LARGE` |
| Format bukan JPG/PNG/WebP | `400` | `FILE_INVALID_TYPE` |
| File tidak disertakan | `400` | `FILE_REQUIRED` |

***

### `DELETE /treatment-sessions/:sessionId/photo`
```
Deskripsi : Hapus foto sesi
Auth       : ✅ SUPER_ADMIN only
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "message"  : "Foto sesi berhasil dihapus.",
    "deletedAt": "2026-04-15T11:00:00.000Z"
  }
}
```

***

### STEP 9 — `POST /treatment-sessions/:sessionId/emr-notes`
```
Deskripsi : Tambah catatan EMR (bisa banyak, 4 tipe berbeda)
Auth       : ✅ ALLSTAFF
```

**Request Body:**
```json
{
  "noteType": "CLINICAL_NOTE",
  "content" : "Pasien tampak tenang, tidak ada keluhan selama infus berlangsung. TD mulai turun ke 145/90."
}
```

**Zod Schema:**
```ts
z.object({
  noteType: z.enum(["CLINICAL_NOTE","OPERATIONAL_NOTE","ASSESSMENT","OUTCOME_MONITORING"]),
  content : z.string().min(1).max(5000)
})
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "noteId"           : "clxxx_emr_001",
    "treatmentSessionId": "clxxx_ses_003",
    "noteType"         : "CLINICAL_NOTE",
    "content"          : "Pasien tampak tenang...",
    "writtenBy"        : { "userId": "clxxx_user_001", "fullName": "Admin Test" },
    "createdAt"        : "2026-04-15T11:15:00.000Z"
  }
}
```

***

### `GET /treatment-sessions/:sessionId/emr-notes`
```
Deskripsi : List semua EMR note sesi, dikelompokkan per tipe
Auth       : ✅ ALLSTAFF
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "CLINICAL_NOTE": [
      {
        "noteId"   : "clxxx_emr_001",
        "content"  : "Pasien tampak tenang...",
        "writtenBy": { "userId": "clxxx_user_001", "fullName": "Admin Test" },
        "createdAt": "2026-04-15T11:15:00.000Z"
      }
    ],
    "OPERATIONAL_NOTE"  : [],
    "ASSESSMENT"        : [],
    "OUTCOME_MONITORING": []
  }
}
```

***

### STEP 10 — `POST /treatment-sessions/:sessionId/evaluation`
```
Deskripsi : Buat evaluasi SOAP dokter (pertama kali)
Auth       : ✅ ALLSTAFF
```

**Request Body:**
```json
{
  "subjective"  : "Pasien mengeluh pusing berkurang, merasa lebih ringan setelah infus.",
  "objective"   : "TD 145/90 turun dari 160/100, HR 82 stabil, Saturasi 99%.",
  "assessment"  : "Respon terapi baik. Hipertensi terkontrol dengan infus sesi ke-3.",
  "plan"        : "Lanjutkan sesi ke-4 minggu depan. Evaluasi ulang TD sebelum sesi.",
  "generalNotes": "Pasien kooperatif. Tidak ada efek samping signifikan."
}
```

**Zod Schema:**
```ts
z.object({
  subjective  : z.string().max(5000).optional(),
  objective   : z.string().max(5000).optional(),
  assessment  : z.string().max(5000).optional(),
  plan        : z.string().max(5000).optional(),
  generalNotes: z.string().max(5000).optional()
})
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "evaluationId"     : "clxxx_eval_003",
    "evaluationCode"   : "EVL-PST-2604-00003",
    "treatmentSessionId": "clxxx_ses_003",
    "writtenBy"        : { "userId": "clxxx_user_001", "fullName": "Admin Test" },
    "createdAt"        : "2026-04-15T11:30:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Evaluasi sudah ada | `409` | `EVALUATION_EXISTS` |

***

### `PATCH /treatment-sessions/:sessionId/evaluation`
```
Deskripsi : Edit evaluasi SOAP + simpan riwayat perubahan
Auth       : ✅ ALLSTAFF
```

**Request Body:**
```json
{
  "subjective": "Pasien mengeluh pusing sudah hilang sepenuhnya.",
  "plan"      : "Lanjutkan sesi ke-4. Cek kolesterol di sesi berikutnya."
}
```

**Backend Process:**
```
1. Fetch evaluasi existing
2. Per field yang berubah:
   DoctorEvaluationHistory.create { oldValue, newValue, changedBy }
3. DoctorEvaluation.update fields yang dikirim
4. logAudit(UPDATE, DoctorEvaluation)
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "evaluationId": "clxxx_eval_003",
    "changedFields": ["subjective", "plan"],
    "updatedAt"   : "2026-04-15T12:00:00.000Z"
  }
}
```

***

### `GET /treatment-sessions/:sessionId/evaluation`
```
Deskripsi : Detail evaluasi SOAP + riwayat perubahan
Auth       : ✅ ALLSTAFF
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "evaluationId" : "clxxx_eval_003",
    "evaluationCode": "EVL-PST-2604-00003",
    "subjective"   : "Pasien mengeluh pusing sudah hilang sepenuhnya.",
    "objective"    : "TD 145/90, HR 82, Saturasi 99%.",
    "assessment"   : "Respon terapi baik.",
    "plan"         : "Lanjutkan sesi ke-4. Cek kolesterol.",
    "generalNotes" : "Pasien kooperatif.",
    "writtenBy"    : { "userId": "clxxx_user_001", "fullName": "Admin Test" },
    "history": [
      {
        "fieldName": "subjective",
        "oldValue" : "Pasien mengeluh pusing berkurang...",
        "newValue" : "Pasien mengeluh pusing sudah hilang sepenuhnya.",
        "changedBy": { "userId": "clxxx_user_001", "fullName": "Admin Test" },
        "changedAt": "2026-04-15T12:00:00.000Z"
      }
    ],
    "createdAt": "2026-04-15T11:30:00.000Z",
    "updatedAt": "2026-04-15T12:00:00.000Z"
  }
}
```

***

## Referensi Endpoint — Bagian 2

```
METHOD  ENDPOINT                                          AUTH              STATUS
────────────────────────────────────────────────────────────────────────────────────
POST    /members/:id/packages                             ALLSTAFF          ✅
PATCH   /members/:id/packages/:pkgId/verify               AL AC AM SA       ✅
GET     /package-pricing                                  ALLSTAFF          ✅
POST    /package-pricing                                  AM SA             ✅
PATCH   /package-pricing/:pricingId                       AM SA             ✅

POST    /treatment-sessions                               ALLSTAFF          ✅
GET     /treatment-sessions/:sessionId                    ALLSTAFF          ✅

POST    /encounters/:encounterId/diagnoses        [S1]    ALLSTAFF          ✅
POST    /treatment-sessions/:id/therapy-plan     [S2]    ALLSTAFF          ✅
POST    /treatment-sessions/:id/vital-signs      [S3,8]  ALLSTAFF          ✅
PATCH   /treatment-sessions/:id/booster-type     [S4]    ALLSTAFF          ✅
POST    /treatment-sessions/:id/infusion         [S5]    ALLSTAFF          ✅
POST    /treatment-sessions/:id/materials        [S6]    ALLSTAFF          ✅
GET     /treatment-sessions/:id/materials        [S6]    ALLSTAFF          ✅
POST    /treatment-sessions/:id/photo            [S7]    ALLSTAFF          ✅
DELETE  /treatment-sessions/:id/photo            [S7]    SA                ✅
POST    /treatment-sessions/:id/emr-notes        [S9]    ALLSTAFF          ✅
GET     /treatment-sessions/:id/emr-notes        [S9]    ALLSTAFF          ✅
POST    /treatment-sessions/:id/evaluation       [S10]   ALLSTAFF          ✅
PATCH   /treatment-sessions/:id/evaluation       [S10]   ALLSTAFF          ✅
GET     /treatment-sessions/:id/evaluation       [S10]   ALLSTAFF          ✅
```

***

**Bagian 2 selesai** — 22 endpoint untuk Package & Session Module (10 Steps) lengkap.

**Bagian 3** akan mencakup:
- Inventory + Stock Mutations
- Stock Request + Shipment
- Notification + Chat
- Dashboard KPI
- Admin Module (Branch, Users, Master Product, Referral Code, Audit Log)
- Member Portal (`/me/*`)
- Rekapitulasi seluruh endpoint
# 📋 API Contract Design — RAHO
# Bagian 3 of 3 — Inventory · Procurement · Communication · Admin · Member Portal

***

## Module 5 — Inventory

### `GET /inventory`
```
Deskripsi : List stok inventori cabang staff login
Auth       : ✅ ALLSTAFF
```

**Query Params:**
```
page     : number (default: 1)
limit    : number (default: 20)
search   : string (nama produk)
category : MEDICINE | DEVICE | CONSUMABLE
critical : true → hanya tampilkan stock < minThreshold
sortBy   : stock | productName | category
sortOrder: asc | desc
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "inventoryItemId": "clxxx_inv_001",
      "masterProduct": {
        "productId"  : "clxxx_prod_001",
        "name"       : "NO",
        "category"   : "MEDICINE",
        "unit"       : "ml"
      },
      "stock"          : 80,
      "minThreshold"   : 100,
      "isCritical"     : true,
      "storageLocation": "Rak A1",
      "branchId"       : "clxxx_pst",
      "updatedAt"      : "2026-04-11T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 16,
    "criticalCount": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

***

### `GET /inventory/:inventoryItemId/mutations`
```
Deskripsi : Riwayat mutasi stok satu item
Auth       : ✅ ALLSTAFF
```

**Query Params:**
```
page     : number (default: 1)
limit    : number (default: 20)
type     : USED | RECEIVED | ADJUSTMENT
dateFrom : ISO string
dateTo   : ISO string
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "mutationId"   : "clxxx_mut_001",
      "type"         : "USED",
      "quantity"     : 50,
      "stockBefore"  : 130,
      "stockAfter"   : 80,
      "referenceType": "TreatmentSession",
      "referenceId"  : "clxxx_ses_003",
      "notes"        : null,
      "createdBy"    : { "userId": "clxxx_user_001", "fullName": "Admin Test" },
      "createdAt"    : "2026-04-15T10:15:00.000Z"
    }
  ],
  "meta": { "total": 24, "page": 1, "limit": 20, "totalPages": 2 }
}
```

***

### `GET /inventory/available`
```
Deskripsi : List item dengan stok > 0 (untuk dropdown pemakaian bahan Step 6)
Auth       : ✅ ALLSTAFF
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "inventoryItemId": "clxxx_inv_005",
      "productName"    : "Alkohol Swab",
      "category"       : "CONSUMABLE",
      "stock"          : 947,
      "unit"           : "pcs"
    }
  ]
}
```

***

## Module 6 — Stock Request

### `GET /stock-requests`
```
Deskripsi : List request stok cabang ini
Auth       : ✅ ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN
```

**Query Params:**
```
page    : number
limit   : number
status  : PENDING | APPROVED | REJECTED
dateFrom: ISO string
dateTo  : ISO string
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "requestId"  : "clxxx_req_001",
      "requestCode": "REQ-PST-2604-00001",
      "branchId"   : "clxxx_pst",
      "branchName" : "Cabang Pusat",
      "status"     : "PENDING",
      "items": [
        {
          "productName": "NO",
          "requestedQty": 500,
          "unit"        : "ml"
        }
      ],
      "requestedBy": { "userId": "clxxx_user_002", "fullName": "Admin Cabang" },
      "createdAt"  : "2026-04-11T08:00:00.000Z"
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 10, "totalPages": 1 }
}
```

***

### `POST /stock-requests`
```
Deskripsi : Buat request stok baru ke pusat
Auth       : ✅ ADMIN_CABANG
```

**Request Body:**
```json
{
  "items": [
    { "inventoryItemId": "clxxx_inv_001", "requestedQty": 500, "notes": "Stok hampir habis" },
    { "inventoryItemId": "clxxx_inv_004", "requestedQty": 100, "notes": null }
  ],
  "notes": "Request rutin bulanan"
}
```

**Zod Schema:**
```ts
z.object({
  items: z.array(z.object({
    inventoryItemId: z.string().cuid(),
    requestedQty   : z.number().positive(),
    notes          : z.string().max(255).optional()
  })).min(1),
  notes: z.string().max(500).optional()
})
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "requestId"  : "clxxx_req_002",
    "requestCode": "REQ-PST-2604-00002",
    "status"     : "PENDING",
    "itemsCount" : 2,
    "createdAt"  : "2026-04-11T09:00:00.000Z"
  }
}
```

***

### `GET /stock-requests/:requestId`
```
Deskripsi : Detail satu request stok
Auth       : ✅ ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "requestId"  : "clxxx_req_001",
    "requestCode": "REQ-PST-2604-00001",
    "status"     : "APPROVED",
    "notes"      : "Request rutin bulanan",
    "items": [
      {
        "itemId"        : "clxxx_req_item_001",
        "productName"   : "NO",
        "requestedQty"  : 500,
        "unit"          : "ml",
        "notes"         : "Stok hampir habis"
      }
    ],
    "requestedBy": { "userId": "clxxx_user_002", "fullName": "Admin Cabang" },
    "reviewedBy" : { "userId": "clxxx_sa_001",   "fullName": "Super Admin" },
    "reviewedAt" : "2026-04-11T10:00:00.000Z",
    "reviewNotes": "Disetujui, shipment sedang disiapkan.",
    "shipment"   : {
      "shipmentId"  : "clxxx_shp_001",
      "shipmentCode": "SHP-PST-BDG-2604-00001",
      "status"      : "PREPARING"
    },
    "createdAt"  : "2026-04-11T08:00:00.000Z"
  }
}
```

***

### `PATCH /stock-requests/:requestId/review`
```
Deskripsi : Approve atau reject request stok
            Jika APPROVED → otomatis buat Shipment
Auth       : ✅ SUPER_ADMIN only
```

**Request Body:**
```json
{
  "action"     : "APPROVE",
  "reviewNotes": "Disetujui, shipment sedang disiapkan."
}
```

**Zod Schema:**
```ts
z.object({
  action     : z.enum(["APPROVE","REJECT"]),
  reviewNotes: z.string().max(500).optional()
})
```

**Backend Process:**
```
1. Cek status = PENDING → 422 jika bukan
2. prisma.$transaction:
   a. StockRequest.update status: APPROVED/REJECTED
   b. Jika APPROVE:
      Shipment.create {
        stockRequestId,
        fromBranchId: SA.branchId (pusat),
        toBranchId  : request.branchId,
        status      : PREPARING
      }
      ShipmentItem.createMany (dari StockRequestItem)
3. Notifikasi ke ADMIN_CABANG:
   "Stock request Anda telah disetujui, pengiriman sedang disiapkan."
4. logAudit(UPDATE, StockRequest)
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "requestId": "clxxx_req_001",
    "status"   : "APPROVED",
    "shipment" : {
      "shipmentId"  : "clxxx_shp_001",
      "shipmentCode": "SHP-PST-BDG-2604-00001",
      "status"      : "PREPARING"
    }
  }
}
```

***

## Module 7 — Shipment

### `GET /shipments`
```
Deskripsi : List semua shipment
Auth       : ✅ SUPER_ADMIN (semua), ADMIN_CABANG (hanya ke cabangnya)
```

**Query Params:**
```
page    : number
limit   : number
status  : PREPARING | SHIPPED | RECEIVED | APPROVED
branchId: string (SA only — filter by cabang tujuan)
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "shipmentId"  : "clxxx_shp_001",
      "shipmentCode": "SHP-PST-BDG-2604-00001",
      "fromBranch"  : { "branchId": "clxxx_pst", "name": "Cabang Pusat" },
      "toBranch"    : { "branchId": "clxxx_bdg", "name": "Cabang Bandung" },
      "status"      : "SHIPPED",
      "itemsCount"  : 2,
      "shippedAt"   : "2026-04-11T14:00:00.000Z",
      "createdAt"   : "2026-04-11T10:00:00.000Z"
    }
  ],
  "meta": { "total": 8, "page": 1, "limit": 10, "totalPages": 1 }
}
```

***

### `GET /shipments/:shipmentId`
```
Deskripsi : Detail shipment + timeline status
Auth       : ✅ SUPER_ADMIN, ADMIN_CABANG (cabang tujuan saja)
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "shipmentId"  : "clxxx_shp_001",
    "shipmentCode": "SHP-PST-BDG-2604-00001",
    "fromBranch"  : { "branchId": "clxxx_pst", "name": "Cabang Pusat" },
    "toBranch"    : { "branchId": "clxxx_bdg", "name": "Cabang Bandung" },
    "status"      : "SHIPPED",
    "items": [
      { "productName": "NO",         "sentQty": 500, "unit": "ml" },
      { "productName": "Jarum Infus", "sentQty": 100, "unit": "pcs" }
    ],
    "timeline": [
      { "status": "PREPARING", "at": "2026-04-11T10:00:00.000Z" },
      { "status": "SHIPPED",   "at": "2026-04-11T14:00:00.000Z" },
      { "status": "RECEIVED",  "at": null },
      { "status": "APPROVED",  "at": null }
    ],
    "notes"    : null,
    "createdAt": "2026-04-11T10:00:00.000Z"
  }
}
```

***

### `PATCH /shipments/:shipmentId/status`
```
Deskripsi : Update status shipment (sesuai alur)
Auth       : ✅ SUPER_ADMIN (PREPARING→SHIPPED), ADMIN_CABANG (SHIPPED→RECEIVED→APPROVED)
```

**Request Body:**
```json
{
  "status": "SHIPPED",
  "notes" : "Dikirim via ekspedisi internal"
}
```

**Zod Schema:**
```ts
z.object({
  status: z.enum(["SHIPPED","RECEIVED","APPROVED"]),
  notes : z.string().max(500).optional()
})
```

**Backend Process (jika APPROVED):**
```
prisma.$transaction:
  Per ShipmentItem:
    InventoryItem.update stock += sentQty
    StockMutation.create type: RECEIVED, referenceType: Shipment
Notifikasi ke ADMIN_CABANG: "Stok telah diterima dan ditambahkan."
logAudit(UPDATE, Shipment)
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "shipmentId": "clxxx_shp_001",
    "status"    : "SHIPPED",
    "shippedAt" : "2026-04-11T14:00:00.000Z",
    "updatedAt" : "2026-04-11T14:00:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Transisi status tidak valid | `422` | `SHIPMENT_INVALID_TRANSITION` |
| Role tidak sesuai transisi | `403` | `AUTH_FORBIDDEN` |

***

## Module 8 — Notification

### `GET /notifications`
```
Deskripsi : List notifikasi user yang login
Auth       : ✅ SEMUA ROLE
```

**Query Params:**
```
page  : number (default: 1)
limit : number (default: 20)
status: UNREAD | READ | ALL (default: ALL)
type  : INVOICE | REMINDER | INFO
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "notificationId": "clxxx_notif_001",
      "type"          : "INVOICE",
      "status"        : "UNREAD",
      "title"         : "Paket Anda telah aktif",
      "body"          : "Basic 7 Sesi telah diverifikasi dan siap digunakan.",
      "deepLink"      : "/me/vouchers",
      "createdAt"     : "2026-04-11T09:00:00.000Z"
    }
  ],
  "meta": { "total": 5, "unreadCount": 3, "page": 1, "limit": 20, "totalPages": 1 }
}
```

***

### `GET /notifications/unread-count`
```
Deskripsi : Jumlah notifikasi belum dibaca (polling 60 detik)
Auth       : ✅ SEMUA ROLE
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "unreadCount": 3 }
}
```

***

### `PATCH /notifications/:notificationId/read`
```
Deskripsi : Tandai satu notifikasi sebagai sudah dibaca
Auth       : ✅ SEMUA ROLE
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "notificationId": "clxxx_notif_001",
    "status"        : "READ",
    "readAt"        : "2026-04-11T10:00:00.000Z"
  }
}
```

***

### `PATCH /notifications/read-all`
```
Deskripsi : Tandai semua notifikasi user sebagai dibaca
Auth       : ✅ SEMUA ROLE
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "updatedCount": 3 }
}
```

***

## Module 9 — Chat

### `GET /chat/rooms`
```
Deskripsi : List room chat
           MEMBER → hanya room miliknya
           STAFF  → semua room di cabangnya
Auth       : ✅ SEMUA ROLE
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "roomId"     : "clxxx_room_001",
      "member"     : {
        "memberId": "clxxx_mbr_001",
        "fullName": "Budi Santoso",
        "avatarUrl": null
      },
      "lastMessage": {
        "content"  : "Baik, terima kasih dok.",
        "senderId" : "clxxx_user_member_001",
        "createdAt": "2026-04-11T10:55:00.000Z"
      },
      "unreadCount": 2,
      "isActive"   : true
    }
  ]
}
```

***

### `GET /chat/rooms/:roomId/messages`
```
Deskripsi : List pesan dalam satu room (paginated, scroll ke atas)
Auth       : ✅ SEMUA ROLE (harus member/staff yang terlibat)
```

**Query Params:**
```
page   : number (default: 1)
limit  : number (default: 30)
before : ISO string (cursor-based untuk infinite scroll ke atas)
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "messageId": "clxxx_msg_050",
      "roomId"   : "clxxx_room_001",
      "sender"   : {
        "userId"  : "clxxx_user_001",
        "fullName": "Admin Test",
        "role"    : "ADMIN_LAYANAN"
      },
      "content"  : "Jadwal Anda besok pukul 09:00, harap datang tepat waktu.",
      "fileUrl"  : null,
      "fileName" : null,
      "isRead"   : true,
      "createdAt": "2026-04-11T10:50:00.000Z"
    }
  ],
  "meta": { "total": 50, "page": 1, "limit": 30, "totalPages": 2 }
}
```

***

### `POST /chat/rooms/:roomId/messages`
```
Deskripsi : Kirim pesan teks atau file attachment
Auth       : ✅ SEMUA ROLE
Content-Type: multipart/form-data (jika ada file) atau application/json
```

**Request Body (`multipart/form-data`):**
```
content    : string (teks pesan, opsional jika ada file)
attachFile : File (opsional, semua tipe file, max 10MB)
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "messageId": "clxxx_msg_051",
    "roomId"   : "clxxx_room_001",
    "content"  : "Berikut hasil pemeriksaan terlampir.",
    "fileUrl"  : "https://minio.../chat/clxxx_room_001/hasil.pdf",
    "fileName" : "hasil.pdf",
    "isRead"   : false,
    "createdAt": "2026-04-11T11:00:00.000Z"
  }
}
```

***

## Module 10 — Dashboard

### `GET /dashboard`
```
Deskripsi : KPI dashboard sesuai role dari JWT
Auth       : ✅ ALLSTAFF
```

**Response `200` — ADMIN_LAYANAN / DOCTOR / NURSE:**
```json
{
  "success": true,
  "data": {
    "role"    : "ADMIN_LAYANAN",
    "branchId": "clxxx_pst",
    "kpi": {
      "todaySessions": {
        "total"    : 8,
        "completed": 3
      },
      "activeMembers": 142
    },
	"todaySessionList": [
	  {
	    "sessionId"    : "clxxx_ses_001",
	    "memberName"   : "Budi Santoso",
	    "treatmentDate": "2026-04-11T09:00:00.000Z",
	    "pelaksanaan"  : "ON_SITE",
	    "isCompleted"  : true,            ← ✅
	    "stepsProgress": "10/10"          ← ✅ berapa step sudah selesai
	  },
	  {
	    "sessionId"    : "clxxx_ses_002",
	    "memberName"   : "Siti Rahayu",
	    "treatmentDate": "2026-04-11T11:00:00.000Z",
	    "pelaksanaan"  : "HOME_CARE",
	    "isCompleted"  : false,
	    "stepsProgress": "4/10"
	  }
	]
  }
}
```

**Response `200` — ADMIN_CABANG:**
```json
{
  "success": true,
  "data": {
    "role": "ADMIN_CABANG",
    "kpi": {
      "activeMembers"     : 142,
      "todaySessions"     : 8,
      "monthSessions"     : 87,
      "criticalStockCount": 3,
      "pendingPackages"   : 5
    },
    "criticalStockItems": [
      { "productName": "NO",        "stock": 80,  "minThreshold": 100, "unit": "ml"  },
      { "productName": "JarumInfus","stock": 20,  "minThreshold": 50,  "unit": "pcs" }
    ],
    "pendingPackageList": [
      {
        "packageCode": "PKG-PST-BSC-2604-XY9A5",
        "memberName" : "Siti Rahayu",
        "packageType": "BASIC",
        "totalSessions": 7
      }
    ]
  }
}
```

**Response `200` — ADMIN_MANAGER:**
```json
{
  "success": true,
  "data": {
    "role": "ADMIN_MANAGER",
    "kpi": {
      "totalActiveMembersAllBranches": 540,
      "totalActivePackagesAllBranches": 320,
      "sessionsByBranch": [
        { "branchName": "Cabang Pusat",   "totalSessions": 87 },
        { "branchName": "Cabang Bandung", "totalSessions": 54 }
      ]
    }
  }
}
```

**Response `200` — SUPER_ADMIN:**
```json
{
  "success": true,
  "data": {
    "role": "SUPER_ADMIN",
    "kpi": {
      "totalActiveMembersAllBranches" : 540,
      "totalActivePackagesAllBranches": 320,
      "pendingStockRequests"          : 3,
      "sessionsByBranch"              : [ ]
    },
    "recentAuditLogs": [
      {
        "logId"     : "clxxx_log_099",
        "userId"    : "clxxx_user_002",
        "userName"  : "Admin Cabang",
        "action"    : "VERIFY",
        "resource"  : "MemberPackage",
        "resourceId": "clxxx_pkg_003",
        "createdAt" : "2026-04-11T10:30:00.000Z"
      }
    ]
  }
}
```

***

## Module 11 — Admin

### `GET /admin/branches`
```
Auth: ✅ SUPER_ADMIN, ADMIN_MANAGER
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "branchId"    : "clxxx_pst",
      "branchCode"  : "PST",
      "name"        : "Cabang Pusat",
      "city"        : "Jakarta",
      "type"        : "KLINIK",
      "isActive"    : true,
      "userCount"   : 8,
      "memberCount" : 142
    }
  ],
  "meta": { "total": 4, "page": 1, "limit": 10, "totalPages": 1 }
}
```

***

### `POST /admin/branches`
```
Auth: ✅ SUPER_ADMIN, ADMIN_MANAGER
```

**Request Body:**
```json
{
  "branchCode"    : "SBY",
  "name"          : "Cabang Surabaya",
  "address"       : "Jl. Raya Surabaya No. 10",
  "city"          : "Surabaya",
  "phone"         : "031-1234567",
  "type"          : "KLINIK",
  "operatingHours": "08:00 - 20:00"
}
```

**Zod Schema:**
```ts
z.object({
  branchCode    : z.string().min(2).max(10).toUpperCase(),
  name          : z.string().min(3).max(100),
  address       : z.string().max(255).optional(),
  city          : z.string().max(100).optional(),
  phone         : z.string().max(20).optional(),
  type          : z.enum(["KLINIK","HOMECARE"]),
  operatingHours: z.string().max(100).optional()
})
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "branchId"  : "clxxx_sby",
    "branchCode": "SBY",
    "name"      : "Cabang Surabaya",
    "createdAt" : "2026-04-11T12:00:00.000Z"
  }
}
```

***

### `GET /admin/branches/:branchId`
```
Auth: ✅ SUPER_ADMIN, ADMIN_MANAGER
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "branchId"    : "clxxx_pst",
    "branchCode"  : "PST",
    "name"        : "Cabang Pusat",
    "address"     : "Jl. Pusat No. 1, Jakarta",
    "city"        : "Jakarta",
    "type"        : "KLINIK",
    "operatingHours": "08:00 - 20:00",
    "isActive"    : true,
    "users": [
      { "userId": "clxxx_user_001", "fullName": "Admin Test", "role": "ADMIN_LAYANAN", "isActive": true }
    ],
    "createdAt"   : "2026-01-01T00:00:00.000Z"
  }
}
```

***

### `PATCH /admin/branches/:branchId`
```
Auth: ✅ SUPER_ADMIN, ADMIN_MANAGER
```

**Request Body:**
```json
{
  "name"          : "Cabang Pusat Jakarta",
  "operatingHours": "07:00 - 21:00",
  "isActive"      : true
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "branchId": "clxxx_pst", "updatedAt": "2026-04-11T12:00:00.000Z" }
}
```

***

### `GET /settings/users`
```
Deskripsi : List user di cabang staff login
Auth       : ✅ ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "userId"   : "clxxx_user_001",
      "fullName" : "Admin Test",
      "email"    : "admin@raho.id",
      "role"     : "ADMIN_LAYANAN",
      "staffCode": "AL-20260410-X9KZ",
      "isActive" : true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 8, "page": 1, "limit": 10, "totalPages": 1 }
}
```

***

### `POST /settings/users`
```
Deskripsi : Tambah user baru di cabang ini
Auth       : ✅ ADMIN_CABANG (role AL/DR/NR only), SUPER_ADMIN (semua role)
```

**Request Body:**
```json
{
  "email"   : "dokter@raho.id",
  "password": "password123",
  "fullName": "dr. Baru",
  "role"    : "DOCTOR",
  "phone"   : "0812-0000-1111"
}
```

**Zod Schema:**
```ts
z.object({
  email   : z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(100),
  role    : z.enum(["ADMIN_LAYANAN","DOCTOR","NURSE"]),
  phone   : z.string().max(20).optional()
})
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "userId"   : "clxxx_user_new",
    "email"    : "dokter@raho.id",
    "fullName" : "dr. Baru",
    "role"     : "DOCTOR",
    "staffCode": "DR-20260411-K8MZ",
    "branchId" : "clxxx_pst",
    "createdAt": "2026-04-11T13:00:00.000Z"
  }
}
```

***

### `PATCH /settings/users/:userId`
```
Deskripsi : Edit atau nonaktifkan user
Auth       : ✅ ADMIN_CABANG, SUPER_ADMIN
```

**Request Body:**
```json
{
  "fullName": "dr. Baru Updated",
  "isActive": false
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "userId": "clxxx_user_new", "updatedAt": "2026-04-11T13:30:00.000Z" }
}
```

***

### `GET /admin/master-products`
```
Auth: ✅ SUPER_ADMIN
```

**Query Params:**
```
search  : string
category: MEDICINE | DEVICE | CONSUMABLE
isActive: true | false
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "productId"  : "clxxx_prod_001",
      "name"       : "NO",
      "category"   : "MEDICINE",
      "unit"       : "ml",
      "description": "Nitrogen Oksida untuk terapi",
      "isActive"   : true
    }
  ],
  "meta": { "total": 12, "page": 1, "limit": 20, "totalPages": 1 }
}
```

***

### `POST /admin/master-products`
```
Auth: ✅ SUPER_ADMIN
```

**Request Body:**
```json
{
  "name"       : "HHO Plus",
  "category"   : "MEDICINE",
  "unit"       : "ml",
  "description": "Varian baru HHO konsentrasi tinggi"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "productId": "clxxx_prod_013",
    "name"     : "HHO Plus",
    "category" : "MEDICINE",
    "unit"     : "ml",
    "isActive" : true,
    "createdAt": "2026-04-11T14:00:00.000Z"
  }
}
```

***

### `GET /admin/inventory`
```
Deskripsi : List stok semua cabang (lintas cabang)
Auth       : ✅ SUPER_ADMIN
```

**Query Params:**
```
branchId : string (filter by cabang)
category : MEDICINE | DEVICE | CONSUMABLE
critical : true
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "inventoryItemId": "clxxx_inv_001",
      "productName"    : "NO",
      "category"       : "MEDICINE",
      "branchName"     : "Cabang Pusat",
      "stock"          : 80,
      "minThreshold"   : 100,
      "isCritical"     : true,
      "unit"           : "ml"
    }
  ],
  "meta": { "total": 64, "criticalCount": 5, "page": 1, "limit": 20 }
}
```

***

### `POST /admin/inventory`
```
Deskripsi : Tambah inventory item ke cabang tertentu
Auth       : ✅ SUPER_ADMIN
```

**Request Body:**
```json
{
  "masterProductId": "clxxx_prod_001",
  "branchId"       : "clxxx_sby",
  "stock"          : 1000,
  "minThreshold"   : 100,
  "storageLocation": "Rak B2"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "inventoryItemId": "clxxx_inv_new",
    "productName"    : "NO",
    "branchName"     : "Cabang Surabaya",
    "stock"          : 1000,
    "createdAt"      : "2026-04-11T14:30:00.000Z"
  }
}
```

***

### `GET /admin/referral-codes`
```
Auth: ✅ SUPER_ADMIN
```

**Query Params:**
```
search      : string (nama/kode)
referrerType: DOKTER | MEMBER | MEDIA | LAINNYA
isActive    : true | false
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "referralCodeId": "clxxx_ref_001",
      "code"          : "DR-SUSI-001",
      "referrerName"  : "dr. Susi Wijaya",
      "referrerType"  : "DOKTER",
      "memberCount"   : 12,
      "isActive"      : true,
      "createdAt"     : "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 4, "page": 1, "limit": 10, "totalPages": 1 }
}
```

***

### `POST /admin/referral-codes`
```
Auth: ✅ SUPER_ADMIN
```

**Request Body:**
```json
{
  "code"        : "DR-SUSI-001",
  "referrerName": "dr. Susi Wijaya",
  "referrerType": "DOKTER"
}
```

**Zod Schema:**
```ts
z.object({
  code        : z.string().min(3).max(50).toUpperCase(),
  referrerName: z.string().min(2).max(100),
  referrerType: z.enum(["DOKTER","MEMBER","MEDIA","LAINNYA"]).optional()
})
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "referralCodeId": "clxxx_ref_005",
    "code"          : "DR-SUSI-001",
    "referrerName"  : "dr. Susi Wijaya",
    "referrerType"  : "DOKTER",
    "isActive"      : true,
    "createdAt"     : "2026-04-11T15:00:00.000Z"
  }
}
```

**Error Cases:**
| Kondisi | Status | Code |
|---|---|---|
| Kode sudah ada | `409` | `REFERRAL_CODE_DUPLICATE` |

***

### `PATCH /admin/referral-codes/:referralCodeId`
```
Auth: ✅ SUPER_ADMIN
```

**Request Body:**
```json
{
  "referrerName": "dr. Susi Wijaya Sp.PD",
  "referrerType": "DOKTER",
  "isActive"    : false
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "referralCodeId": "clxxx_ref_001", "updatedAt": "2026-04-11T15:30:00.000Z" }
}
```

***

### `GET /admin/audit-log`
```
Auth: ✅ SUPER_ADMIN
```

**Query Params:**
```
page      : number
limit     : number (default: 20)
userId    : string
action    : CREATE | UPDATE | DELETE | VERIFY | GRANT_ACCESS
resource  : Member | TreatmentSession | MemberPackage | ...
resourceId: string
dateFrom  : ISO string
dateTo    : ISO string
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "logId"     : "clxxx_log_099",
      "user"      : { "userId": "clxxx_user_002", "fullName": "Admin Cabang", "role": "ADMIN_CABANG" },
      "action"    : "VERIFY",
      "resource"  : "MemberPackage",
      "resourceId": "clxxx_pkg_003",
      "meta"      : { "packageCode": "PKG-PST-BSC-2604-XY9A3", "status": "ACTIVE" },
      "ipAddress" : "192.168.1.10",
      "createdAt" : "2026-04-11T10:30:00.000Z"
    }
  ],
  "meta": { "total": 1024, "page": 1, "limit": 20, "totalPages": 52 }
}
```

***

## Module 12 — Member Portal (`/me`)

### `GET /me/dashboard`
```
Auth: ✅ MEMBER only
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "voucherCount"    : 4,
    "activePackages"  : [
      { "packageCode": "PKG-PST-BSC-2604-XY9A1", "packageType": "BASIC", "remainingSessions": 2 }
    ],
    "lastSession"     : {
      "sessionId"    : "clxxx_ses_002",
      "infusKe"      : 2,
      "treatmentDate": "2026-04-08T10:00:00.000Z",
      "status"       : "COMPLETED"
    }
  }
}
```

***

### `GET /me/sessions`
```
Auth: ✅ MEMBER only
```

**Query Params:**
```
page     : number
limit    : number
status   : PLANNED | IN_PROGRESS | COMPLETED
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "sessionId"    : "clxxx_ses_001",
      "sessionCode"  : "SES-PST-01-2604-P9QR1",
      "infusKe"      : 1,
      "treatmentDate": "2026-04-01T09:00:00.000Z",
      "pelaksanaan"  : "ON_SITE",
      "status"       : "COMPLETED"
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 10, "totalPages": 1 }
}
```

***

### `GET /me/sessions/:sessionId`
```
Deskripsi : Detail sesi untuk member — read-only, subset dari staff view
Auth       : ✅ MEMBER only (sesi miliknya sendiri)
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "sessionId"    : "clxxx_ses_001",
    "sessionCode"  : "SES-PST-01-2604-P9QR1",
    "infusKe"      : 1,
    "treatmentDate": "2026-04-01T09:00:00.000Z",
    "pelaksanaan"  : "ON_SITE",
    "isCompleted"  : true ,
    "therapyPlan"  : {
      "ifa": 500, "hho": 200, "no": 50,
      "keterangan": "Dosis standar hipertensi stage 1"
    },
    "vitalSigns"   : {
      "SEBELUM": [
        { "pencatatan": "SISTOL", "value": 160, "unit": "mmHg" }
      ],
      "SESUDAH": [
        { "pencatatan": "SISTOL", "value": 145, "unit": "mmHg" }
      ]
    },
    "evaluation"   : {
      "subjective": "Pusing berkurang.",
      "objective" : "TD turun ke 145/90.",
      "assessment": "Respon baik.",
      "plan"      : "Lanjut sesi ke-2.",
      "generalNotes": null
    },
    "photo"        : {
      "fileUrl": "https://minio.../sessions/clxxx_ses_001/photo/doc.jpg"
    }
  }
}
```

***

### `GET /me/diagnoses`
```
Auth: ✅ MEMBER only
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "diagnosisId"     : "clxxx_dx_001",
      "diagnosisCode"   : "DX-PST-2604-00001",
      "diagnosa"        : "Hipertensi stage 1",
      "kategoriDiagnosa": "HIPERTENSI",
      "icdPrimer"       : "I10",
      "createdAt"       : "2026-04-01T09:30:00.000Z"
    }
  ]
}
```

***

### `GET /me/vouchers`
```
Auth: ✅ MEMBER only
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "packageId"       : "clxxx_pkg_001",
      "packageCode"     : "PKG-PST-BSC-2604-XY9A1",
      "packageType"     : "BASIC",
      "totalSessions"   : 7,
      "usedSessions"    : 5,
      "remainingSessions": 2,
      "status"          : "ACTIVE",
      "activatedAt"     : "2026-02-01T09:00:00.000Z"
    }
  ]
}
```

***

### `GET /me/profile`
```
Auth: ✅ MEMBER only
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "memberId"  : "clxxx_mbr_001",
    "memberNo"  : "MBR-PST-2604-00001",
    "fullName"  : "Budi Santoso",
    "email"     : "budi@email.com",
    "phone"     : "0812-3456-7890",
    "address"   : "Jl. Contoh No. 1, Jakarta",
    "dateOfBirth": "1985-01-01T00:00:00.000Z",
    "jenisKelamin": "L",
    "registrationBranch": {
      "branchId": "clxxx_pst",
      "name"    : "Cabang Pusat"
    }
  }
}
```

***

## Rekap Lengkap Semua Endpoint

### Auth (3)
```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
```

### Member (10)
```
GET    /members
GET    /members/lookup
POST   /members/grant-access
POST   /members
GET    /members/:memberId
PATCH  /members/:memberId
GET    /members/:memberId/packages
GET    /members/:memberId/encounters
GET    /members/:memberId/diagnoses
POST   /members/:memberId/notifications
```

### Package (5)
```
POST   /members/:memberId/packages
PATCH  /members/:memberId/packages/:packageId/verify
GET    /package-pricing
POST   /package-pricing
PATCH  /package-pricing/:pricingId
```

### Session (22)
```
POST   /treatment-sessions
GET    /treatment-sessions/:sessionId
POST   /encounters/:encounterId/diagnoses          [S1]
POST   /treatment-sessions/:id/therapy-plan        [S2]
POST   /treatment-sessions/:id/vital-signs         [S3,8]
PATCH  /treatment-sessions/:id/booster-type        [S4]
POST   /treatment-sessions/:id/infusion            [S5]
POST   /treatment-sessions/:id/materials           [S6]
GET    /treatment-sessions/:id/materials           [S6]
POST   /treatment-sessions/:id/photo               [S7]
DELETE /treatment-sessions/:id/photo               [S7]
POST   /treatment-sessions/:id/emr-notes           [S9]
GET    /treatment-sessions/:id/emr-notes           [S9]
POST   /treatment-sessions/:id/evaluation          [S10]
PATCH  /treatment-sessions/:id/evaluation          [S10]
GET    /treatment-sessions/:id/evaluation          [S10]
```

### Inventory (3)
```
GET    /inventory
GET    /inventory/available
GET    /inventory/:inventoryItemId/mutations
```

### Stock Request (4)
```
GET    /stock-requests
POST   /stock-requests
GET    /stock-requests/:requestId
PATCH  /stock-requests/:requestId/review
```

### Shipment (3)
```
GET    /shipments
GET    /shipments/:shipmentId
PATCH  /shipments/:shipmentId/status
```

### Notification (4)
```
GET    /notifications
GET    /notifications/unread-count
PATCH  /notifications/:notificationId/read
PATCH  /notifications/read-all
```

### Chat (3)
```
GET    /chat/rooms
GET    /chat/rooms/:roomId/messages
POST   /chat/rooms/:roomId/messages
```

### Dashboard (1)
```
GET    /dashboard
```

### Admin (14)
```
GET    /admin/branches
POST   /admin/branches
GET    /admin/branches/:branchId
PATCH  /admin/branches/:branchId
GET    /settings/users
POST   /settings/users
PATCH  /settings/users/:userId
GET    /admin/master-products
POST   /admin/master-products
PATCH  /admin/master-products/:productId
GET    /admin/inventory
POST   /admin/inventory
PATCH  /admin/inventory/:inventoryItemId
GET    /admin/referral-codes
POST   /admin/referral-codes
PATCH  /admin/referral-codes/:referralCodeId
GET    /admin/audit-log
```

### Member Portal (6)
```
GET    /me/dashboard
GET    /me/sessions
GET    /me/sessions/:sessionId
GET    /me/diagnoses
GET    /me/vouchers
GET    /me/profile
```

***

## Total Endpoint Summary

| Module | Jumlah Endpoint |
|---|---|
| Auth | 3 |
| Member | 10 |
| Package | 5 |
| Session + 10 Steps | 16 |
| Inventory | 3 |
| Stock Request | 4 |
| Shipment | 3 |
| Notification | 4 |
| Chat | 3 |
| Dashboard | 1 |
| Admin | 17 |
| Member Portal | 6 |
| **TOTAL** | **75 endpoint** |

***

**API Contract Design selesai** — 75 endpoint mencakup seluruh modul RAHO dengan request/response format, Zod schema, backend process, dan error cases lengkap.