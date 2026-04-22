# Branch Detail Page - Modular Structure

Halaman detail cabang dengan struktur modular yang lebih maintainable dan scalable.

## Struktur File

```
[branchId]/
├── page.tsx                 # Main page component (orchestrator)
├── types.ts                 # Type definitions
├── useBranchData.ts         # Custom hook untuk data fetching
├── BranchHeader.tsx         # Header dengan info cabang
├── StatsCards.tsx           # Kartu statistik
├── TabNavigation.tsx        # Tab navigation
├── OverviewTab.tsx          # Tab informasi cabang
├── UsersTab.tsx             # Tab kelola user
├── MembersTab.tsx           # Tab kelola member
├── page.module.css          # Styling
└── README.md                # Dokumentasi ini
```

## Komponen

### page.tsx
Main page component yang mengorkestra semua sub-komponen. Menangani:
- State management (activeTab, showCreateUserModal, mounted)
- Auth check dan redirect
- Data loading orchestration
- Modal management

### types.ts
Definisi tipe TypeScript untuk:
- `BranchDetail` - Info cabang dengan stats
- `User` - Data user/staff
- `BranchMember` - Data member

### useBranchData.ts
Custom hook yang berisi semua logic data fetching:
- `loadBranchDetail()` - Fetch detail cabang
- `loadBranchUsers()` - Fetch daftar user
- `loadBranchMembers()` - Fetch daftar member
- `toggleUserActive()` - Toggle status user

### BranchHeader.tsx
Menampilkan header dengan:
- Tombol kembali
- Nama dan kode cabang
- Badge tipe cabang (Klinik, Homecare, Premiere, Partnership)
- Badge status (Aktif/Nonaktif)

### StatsCards.tsx
Menampilkan 3 kartu statistik:
- User Aktif
- Total Member
- Paket Aktif

### TabNavigation.tsx
Navigation tabs untuk 3 section:
- Informasi Cabang
- Kelola User
- Kelola Member

### OverviewTab.tsx
Menampilkan informasi detail cabang:
- Informasi Lokasi (alamat, kota, telepon, jam operasional)
- Informasi Sistem (dibuat, terakhir diupdate)

### UsersTab.tsx
Menampilkan daftar user dengan:
- User card dengan info lengkap
- Role badge
- Status aktif/nonaktif
- Tombol toggle status
- Tombol tambah user

### MembersTab.tsx
Menampilkan daftar member dengan:
- Member card dengan avatar
- Info member (email, telepon, cabang registrasi)
- Badge voucher dan paket aktif
- Badge member lintas cabang
- Tombol lihat detail

## Keuntungan Struktur Modular

1. **Separation of Concerns**: Setiap komponen punya tanggung jawab spesifik
2. **Reusability**: Hook `useBranchData` bisa digunakan di komponen lain
3. **Maintainability**: Mudah menemukan dan update logic tertentu
4. **Testability**: Setiap komponen bisa di-test independen
5. **Scalability**: Mudah menambah tab atau fitur baru
6. **Readability**: Main page component lebih clean dan mudah dipahami

## Data Flow

```
page.tsx (orchestrator)
  ├── useBranchData hook (data fetching & state)
  ├── BranchHeader (display)
  ├── StatsCards (display)
  ├── TabNavigation (control)
  └── Tab Content (display)
      ├── OverviewTab
      ├── UsersTab
      └── MembersTab
```

## Usage

Komponen sudah siap digunakan. Struktur modular memudahkan:
- Menambah tab baru (buat komponen baru + update TabNavigation)
- Mengubah logic data (edit useBranchData hook)
- Styling (update page.module.css)
- Testing (test setiap komponen independen)

## Auth & Permissions

- Hanya ADMIN_MANAGER dan SUPER_ADMIN yang bisa akses
- Redirect ke login jika tidak authenticated
- Redirect ke dashboard jika tidak punya permission
