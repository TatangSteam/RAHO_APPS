# Fitur Riwayat Penggunaan Barang

## Deskripsi
Fitur ini memungkinkan pengguna untuk melihat riwayat penggunaan barang inventaris dengan kemampuan filtering berdasarkan staf dan grup staf.

## Lokasi
- **Path**: `/inventory/material-usage-history`
- **Menu**: Sidebar → Inventori → Riwayat Penggunaan Barang

## Akses
Semua staff dapat mengakses fitur ini:
- SUPER_ADMIN
- ADMIN_MANAGER
- ADMIN_CABANG
- ADMIN_LAYANAN
- DOCTOR
- NURSE

## Fitur Utama

### 1. Tabel Riwayat Penggunaan
Menampilkan daftar riwayat penggunaan barang dengan kolom:
- **Tanggal & Waktu**: Kapan barang digunakan
- **Nama Barang**: Nama produk yang digunakan
- **Jumlah (Qty)**: Jumlah dan satuan yang digunakan
- **Nama Staf**: Staf yang menggunakan barang (dengan role)
- **Grup Staf**: Cabang/grup tempat staf bekerja
- **Kode Sesi**: Kode sesi terapi terkait

### 2. Panel Filter
Filter tersedia untuk mempersempit data yang ditampilkan:

#### a. Filter Grup Staf (Dropdown)
- Memfilter berdasarkan cabang/grup staf
- Ketika grup dipilih, menampilkan riwayat dari semua staf di grup tersebut
- Otomatis menyesuaikan daftar staf yang tersedia

#### b. Filter Staf (Dropdown)
- Memfilter berdasarkan nama staf spesifik
- Menampilkan nama dan role staf
- Dinamis berdasarkan grup yang dipilih

#### c. Filter Nama Barang
- Pencarian text untuk nama produk
- Case-insensitive search

#### d. Filter Tanggal (Range)
- **Tanggal Mulai**: Batas awal periode
- **Tanggal Akhir**: Batas akhir periode

### 3. Logika Filtering
- Filter dapat dikombinasikan (AND logic)
- Filter "Grup Staf" otomatis membatasi pilihan "Filter Staf"
- Filter bersifat optional, bisa menggunakan salah satu atau kombinasi
- Indikator jumlah filter aktif ditampilkan di tombol Filter

### 4. Tombol Aksi
- **Terapkan Filter**: Mengaplikasikan filter yang dipilih
- **Reset**: Menghapus semua filter dan reload data
- **Refresh**: Memuat ulang data dengan filter yang sama

## API Endpoints

### Backend (Express.js)

#### 1. Get Material Usage History
```
GET /api/v1/inventory/material-usage-history
```
**Query Parameters:**
- `branchId`: Filter by branch (optional)
- `staffId`: Filter by staff (optional)
- `staffGroupId`: Filter by staff group/branch code (optional)
- `startDate`: Start date filter (optional)
- `endDate`: End date filter (optional)
- `productName`: Product name search (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "date": "2026-06-29T10:30:00Z",
      "productName": "IFA 500ml",
      "quantity": 450.00,
      "unit": "ml",
      "staffName": "Dr. John Doe",
      "staffGroup": "Cabang Jakarta Pusat",
      "staffRole": "Dokter",
      "sessionCode": "SES-20260629-001",
      "notes": null
    }
  ]
}
```

#### 2. Get Staff List
```
GET /api/v1/inventory/material-usage-history/staff
```
**Query Parameters:**
- `branchId`: Filter staff by branch (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "usr...",
      "name": "Dr. John Doe",
      "role": "DOCTOR",
      "roleLabel": "Dokter",
      "branchName": "Cabang Jakarta Pusat",
      "branchCode": "JKT-PST",
      "staffBranches": [...]
    }
  ]
}
```

#### 3. Get Branch Groups
```
GET /api/v1/inventory/material-usage-history/branch-groups
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "brn...",
      "name": "Cabang Jakarta Pusat",
      "branchCode": "JKT-PST",
      "type": "PREMIER"
    }
  ]
}
```

## Teknologi yang Digunakan

### Backend
- **Express.js**: REST API framework
- **Prisma**: ORM untuk query database
- **TypeScript**: Type safety

### Frontend
- **Next.js 14**: React framework (App Router)
- **React**: UI library
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **date-fns**: Date formatting
- **lucide-react**: Icon library

## Database Schema

Data diambil dari tabel:
- `material_usages`: Riwayat penggunaan barang
- `treatment_sessions`: Informasi sesi terapi
- `inventory_items`: Data inventaris
- `master_products`: Data master produk
- `users`: Data staf
- `user_profiles`: Profil staf
- `branches`: Data cabang
- `staff_branches`: Relasi staf dengan multiple cabang

## Alur Data

```
Frontend Request → API Controller → Service Layer → Prisma → Database
                                                           ↓
                                        Response ← Data Processing
```

1. User membuka halaman `/inventory/material-usage-history`
2. Frontend load filter options (staff list & branch groups)
3. Frontend load history data dengan default filter
4. User mengubah filter dan klik "Terapkan Filter"
5. Frontend request data baru dengan filter yang dipilih
6. Backend memproses query dengan filter
7. Data dikembalikan dan ditampilkan di tabel

## Role-based Access Control

| Role | Can View Own Branch | Can View All Branches |
|------|-------------------|---------------------|
| SUPER_ADMIN | ✓ | ✓ |
| ADMIN_MANAGER | ✓ (managed branches) | ✓ (managed branches) |
| ADMIN_CABANG | ✓ | ✗ |
| ADMIN_LAYANAN | ✓ | ✗ |
| DOCTOR | ✓ | ✗ |
| NURSE | ✓ | ✗ |

## Acceptance Criteria

- [x] Menu baru muncul di sidebar dan dapat diklik
- [x] Halaman menampilkan daftar riwayat penggunaan barang
- [x] Filter "Staf" berfungsi dengan benar
- [x] Filter "Grup Staf" berfungsi dengan benar
- [x] Filter "Grup Staf" otomatis menyesuaikan dropdown "Filter Staf"
- [x] Filter dapat dikombinasikan
- [x] Tombol "Terapkan Filter" memuat data sesuai filter
- [x] Tombol "Reset" menghapus semua filter
- [x] Tombol "Refresh" memuat ulang data
- [x] Data ditampilkan dalam format yang mudah dibaca
- [x] Role-based access control diterapkan
- [x] Responsive design untuk mobile dan desktop

## Future Enhancements

Beberapa peningkatan yang bisa ditambahkan di masa depan:
1. Export data ke CSV/Excel
2. Pagination untuk dataset besar
3. Sorting kolom
4. Detail view per item
5. Grafik statistik penggunaan
6. Filter berdasarkan kategori produk
7. Notifikasi real-time untuk penggunaan baru
