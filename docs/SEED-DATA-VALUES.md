# RAHO Klinik - Data Seed Lengkap

## Daftar Isi
1. [Cabang (Branches)](#cabang-branches)
2. [Pengguna Staff (Users)](#pengguna-staff-users)
3. [Paket Terapi (Packages)](#paket-terapi-packages)
4. [Kode Referral](#kode-referral)
5. [Produk Non-Terapi](#produk-non-terapi)
6. [Item Inventori](#item-inventori)
7. [Data Member](#data-member)
8. [Konfigurasi Seed](#konfigurasi-seed)

---

## Cabang (Branches)

### 1. Cabang Pusat (PST)
```typescript
{
  code: "PST",
  name: "RAHO Pusat",
  type: "PUSAT",
  address: "Jl. Sudirman No. 123, Jakarta Pusat",
  phone: "021-12345678",
  email: "pusat@raho.com",
  isActive: true
}
```

### 2. Cabang Bandung (BDG)
```typescript
{
  code: "BDG",
  name: "RAHO Bandung",
  type: "CABANG",
  address: "Jl. Asia Afrika No. 456, Bandung",
  phone: "022-87654321",
  email: "bandung@raho.com",
  isActive: true
}
```

### 3. Cabang Surabaya (SBY)
```typescript
{
  code: "SBY",
  name: "RAHO Surabaya",
  type: "CABANG",
  address: "Jl. Pemuda No. 789, Surabaya",
  phone: "031-11223344",
  email: "surabaya@raho.com",
  isActive: true
}
```

---

## Pengguna Staff (Users)

### Super Admin & Manager (Cross-Branch)
| No | Email | Role | Nama Lengkap | Password | Cabang Primary |
|----|-------|------|--------------|----------|----------------|
| 1 | superadmin@raho.id | SUPER_ADMIN | Super Admin RAHO | SuperAdmin@123 | - (Semua) |
| 2 | manager1@raho.id | ADMIN_MANAGER | Admin Manager Regional 1 | Manager@123 | PST (Jakarta) |
| 3 | manager2@raho.id | ADMIN_MANAGER | Admin Manager Regional 2 | Manager@123 | SBY (Surabaya) |

### Cabang Pusat Jakarta (PST) - 5 Staff
| No | Email | Role | Nama Lengkap | Password | Staff Code |
|----|-------|------|--------------|----------|------------|
| 1 | admincabang.pst@raho.id | ADMIN_CABANG | Admin Cabang Pusat | AdminCabang@123 | AC-20260413-PST1 |
| 2 | adminlayanan.pst@raho.id | ADMIN_LAYANAN | Admin Layanan Pusat | AdminLayanan@123 | AL-20260413-PST1 |
| 3 | dokter@raho.id | DOCTOR | dr. Ahmad Fauzi, SpPD | Dokter@123 | DR-20260413-SHARED1 |
| 4 | nakes@raho.id | NURSE | Siti Rahayu, Amd.Kep | Nakes@123 | NR-20260413-SHARED1 |
| 5 | - | - | - | - | - |

### Cabang Bandung (BDG) - 4 Staff
| No | Email | Role | Nama Lengkap | Password | Staff Code |
|----|-------|------|--------------|----------|------------|
| 1 | admincabang.bdg@raho.id | ADMIN_CABANG | Admin Cabang Bandung | AdminCabang@123 | AC-20260413-BDG1 |
| 2 | adminlayanan.bdg@raho.id | ADMIN_LAYANAN | Admin Layanan Bandung | AdminLayanan@123 | AL-20260413-BDG1 |
| 3 | dokter2@raho.id | DOCTOR | dr. Budi Santoso, SpPD | Dokter@123 | DR-20260413-SHARED2 |
| 4 | nakes2@raho.id | NURSE | Dewi Lestari, Amd.Kep | Nakes@123 | NR-20260413-SHARED2 |

### Cabang Surabaya (SBY) - 4 Staff
| No | Email | Role | Nama Lengkap | Password | Staff Code |
|----|-------|------|--------------|----------|------------|
| 1 | admincabang.sby@raho.id | ADMIN_CABANG | Admin Cabang Surabaya | AdminCabang@123 | AC-20260413-SBY1 |
| 2 | adminlayanan.sby@raho.id | ADMIN_LAYANAN | Admin Layanan Surabaya | AdminLayanan@123 | AL-20260413-SBY1 |
| 3 | dokter3@raho.id | DOCTOR | dr. Citra Wijaya, SpPD | Dokter@123 | DR-20260413-SHARED3 |
| 4 | nakes3@raho.id | NURSE | Eko Prasetyo, Amd.Kep | Nakes@123 | NR-20260413-SHARED3 |

**Total Staff**: 16 pengguna (3 Cross-Branch + 5 PST + 4 BDG + 4 SBY)

**Catatan:**
- SUPER_ADMIN tidak memiliki cabang (akses ke semua cabang)
- ADMIN_MANAGER memiliki cabang primary tapi bisa manage multiple branches via ManagerBranch table
- DOCTOR dan NURSE memiliki cabang primary tapi bisa bekerja di cabang lain via StaffBranch table
- Manager 1 mengelola: Jakarta Pusat & Bandung
- Manager 2 mengelola: Surabaya & Jakarta Pusat

---

## Paket Terapi (Packages)

### Struktur Paket per Cabang
Setiap cabang memiliki **44 paket** yang terdiri dari:
- **9 Paket BASIC** (B1-B9)
- **35 Paket BOOSTER** (kombinasi dari 5 tipe booster × 7 varian)

### Paket BASIC (9 Paket)
| Kode | Nama | Harga | Sesi | Deskripsi |
|------|------|-------|------|-----------|
| B1 | Basic 1 Sesi | Rp 150,000 | 1 | Paket dasar 1 sesi terapi |
| B2 | Basic 2 Sesi | Rp 280,000 | 2 | Paket dasar 2 sesi terapi |
| B3 | Basic 3 Sesi | Rp 400,000 | 3 | Paket dasar 3 sesi terapi |
| B4 | Basic 4 Sesi | Rp 520,000 | 4 | Paket dasar 4 sesi terapi |
| B5 | Basic 5 Sesi | Rp 625,000 | 5 | Paket dasar 5 sesi terapi |
| B6 | Basic 6 Sesi | Rp 720,000 | 6 | Paket dasar 6 sesi terapi |
| B7 | Basic 7 Sesi | Rp 805,000 | 7 | Paket dasar 7 sesi terapi |
| B8 | Basic 8 Sesi | Rp 880,000 | 8 | Paket dasar 8 sesi terapi |
| B9 | Basic 9 Sesi | Rp 945,000 | 9 | Paket dasar 9 sesi terapi |

### Paket BOOSTER (35 Paket)
**5 Tipe Booster:**
1. **VITAMIN_C** - Vitamin C Booster
2. **GLUTATHIONE** - Glutathione Booster  
3. **COLLAGEN** - Collagen Booster
4. **DETOX** - Detox Booster
5. **IMMUNE** - Immune Booster

**7 Varian per Tipe:**
- 1 Sesi: Rp 200,000
- 2 Sesi: Rp 380,000  
- 3 Sesi: Rp 540,000
- 4 Sesi: Rp 680,000
- 5 Sesi: Rp 800,000
- 6 Sesi: Rp 900,000
- 7 Sesi: Rp 980,000

**Contoh Kode Paket Booster:**
- `VC1` = Vitamin C 1 Sesi
- `GT3` = Glutathione 3 Sesi  
- `CL5` = Collagen 5 Sesi
- `DT2` = Detox 2 Sesi
- `IM7` = Immune 7 Sesi

**Total Paket per Cabang**: 44 paket (9 Basic + 35 Booster)
**Total Paket Sistem**: 132 paket (44 × 3 cabang)

---

## Kode Referral

| No | Kode | Nama Referrer | Tipe | Komisi | Status |
|----|------|---------------|------|--------|--------|
| 1 | REF001 | Dr. Ahmad Referral | DOKTER | 10% | Aktif |
| 2 | REF002 | Klinik Partner A | KLINIK | 15% | Aktif |
| 3 | REF003 | Agent Marketing B | AGENT | 8% | Aktif |
| 4 | REF004 | Influencer Health C | INFLUENCER | 12% | Aktif |
| 5 | REF005 | Corporate Partner D | CORPORATE | 20% | Aktif |
| 6 | REF006 | Dr. Sari Medical | DOKTER | 10% | Aktif |
| 7 | REF007 | Beauty Clinic E | KLINIK | 15% | Aktif |
| 8 | REF008 | Health Agent F | AGENT | 8% | Aktif |

**Total Kode Referral**: 8 kode aktif

---

## Produk Non-Terapi

### Air Nano (12 Varian)
| No | Nama Produk | Harga | Kategori | Deskripsi |
|----|-------------|-------|----------|-----------|
| 1 | Air Nano 330ml | Rp 15,000 | AIR_NANO | Air nano ukuran 330ml |
| 2 | Air Nano 500ml | Rp 20,000 | AIR_NANO | Air nano ukuran 500ml |
| 3 | Air Nano 600ml | Rp 25,000 | AIR_NANO | Air nano ukuran 600ml |
| 4 | Air Nano 1L | Rp 35,000 | AIR_NANO | Air nano ukuran 1 liter |
| 5 | Air Nano 1.5L | Rp 45,000 | AIR_NANO | Air nano ukuran 1.5 liter |
| 6 | Air Nano Galon 19L | Rp 150,000 | AIR_NANO | Air nano galon 19 liter |
| 7 | Air Nano Premium 330ml | Rp 18,000 | AIR_NANO | Air nano premium 330ml |
| 8 | Air Nano Premium 500ml | Rp 25,000 | AIR_NANO | Air nano premium 500ml |
| 9 | Air Nano Premium 1L | Rp 40,000 | AIR_NANO | Air nano premium 1 liter |
| 10 | Air Nano Alkaline 500ml | Rp 30,000 | AIR_NANO | Air nano alkaline 500ml |
| 11 | Air Nano Alkaline 1L | Rp 50,000 | AIR_NANO | Air nano alkaline 1 liter |
| 12 | Air Nano Mineral 1L | Rp 35,000 | AIR_NANO | Air nano mineral 1 liter |

### Rokok Kenkou (1 Produk)
| No | Nama Produk | Harga | Kategori | Deskripsi |
|----|-------------|-------|----------|-----------|
| 13 | Rokok Kenkou Herbal | Rp 75,000 | ROKOK_KENKOU | Rokok herbal untuk terapi |

**Total Produk Non-Terapi**: 13 produk (12 Air Nano + 1 Rokok Kenkou)

---

## Item Inventori

### Kategori Utama
1. **INFUSION_MATERIALS** - Bahan infus dan terapi
2. **MEDICAL_SUPPLIES** - Perlengkapan medis
3. **CONSUMABLES** - Bahan habis pakai
4. **EQUIPMENT** - Peralatan medis

### Contoh Item Inventori (40+ Item)
| SKU | Nama Item | Kategori | Unit | Stok | Harga Satuan |
|-----|-----------|----------|------|------|--------------|
| INF001 | Vitamin C 1000mg | INFUSION_MATERIALS | Ampul | 100 | Rp 25,000 |
| INF002 | Glutathione 600mg | INFUSION_MATERIALS | Ampul | 80 | Rp 45,000 |
| INF003 | Collagen Peptide | INFUSION_MATERIALS | Vial | 60 | Rp 35,000 |
| MED001 | Jarum Suntik 23G | MEDICAL_SUPPLIES | Pcs | 500 | Rp 2,500 |
| MED002 | Selang Infus | MEDICAL_SUPPLIES | Set | 200 | Rp 15,000 |
| CON001 | Kapas Steril | CONSUMABLES | Pack | 150 | Rp 8,000 |
| CON002 | Alkohol 70% | CONSUMABLES | Botol | 100 | Rp 12,000 |
| EQP001 | Timbangan Digital | EQUIPMENT | Unit | 5 | Rp 500,000 |

### Konversi Unit
- **Ampul**: 1 Box = 10 Ampul
- **Vial**: 1 Box = 5 Vial  
- **Pack**: 1 Karton = 20 Pack
- **Botol**: 1 Karton = 12 Botol

**Total Item Inventori**: 40+ item dengan berbagai kategori dan unit

---

## Data Member

### Distribusi Member per Cabang
- **Cabang Pusat (PST)**: 10 member
- **Cabang Bandung (BDG)**: 10 member  
- **Cabang Surabaya (SBY)**: 10 member

### Contoh Data Member PST
| No | Kode Member | Nama | Email | Telepon | Alamat |
|----|-------------|------|-------|---------|--------|
| 1 | PST001 | Budi Santoso | budi.santoso@email.com | 081234567890 | Jl. Merdeka No. 1, Jakarta |
| 2 | PST002 | Siti Nurhaliza | siti.nurhaliza@email.com | 081234567891 | Jl. Sudirman No. 2, Jakarta |
| 3 | PST003 | Ahmad Fauzi | ahmad.fauzi@email.com | 081234567892 | Jl. Thamrin No. 3, Jakarta |
| ... | ... | ... | ... | ... | ... |
| 10 | PST010 | Dewi Sartika | dewi.sartika@email.com | 081234567899 | Jl. Gatot Subroto No. 10, Jakarta |

### Contoh Data Member BDG
| No | Kode Member | Nama | Email | Telepon | Alamat |
|----|-------------|------|-------|---------|--------|
| 1 | BDG001 | Andi Wijaya | andi.wijaya@email.com | 082234567890 | Jl. Asia Afrika No. 1, Bandung |
| 2 | BDG002 | Rina Melati | rina.melati@email.com | 082234567891 | Jl. Braga No. 2, Bandung |
| ... | ... | ... | ... | ... | ... |

### Contoh Data Member SBY
| No | Kode Member | Nama | Email | Telepon | Alamat |
|----|-------------|------|-------|---------|--------|
| 1 | SBY001 | Joko Susilo | joko.susilo@email.com | 083234567890 | Jl. Pemuda No. 1, Surabaya |
| 2 | SBY002 | Maya Sari | maya.sari@email.com | 083234567891 | Jl. Diponegoro No. 2, Surabaya |
| ... | ... | ... | ... | ... | ... |

**Total Member**: 30 member (10 per cabang)

---

## Konfigurasi Seed

### Urutan Eksekusi Seed
```typescript
// 1. Data Master
await seedBranches(prisma);        // Cabang
await seedUsers(prisma);           // Staff pengguna
await seedReferrals(prisma);       // Kode referral

// 2. Data Produk & Paket
await seedPackages(prisma);        // Paket terapi
await seedNonTherapyProducts(prisma); // Produk non-terapi
await seedInventoryItems(prisma);  // Item inventori

// 3. Data Operasional
await seedMembers(prisma);         // Data member
await seedTherapySessions(prisma); // Sesi terapi (opsional)

// 4. Audit Log
await logAudit(prisma, {
  action: 'SEED_DATABASE',
  details: 'Database seeded successfully',
  userId: 'system'
});
```

### Statistik Total Data Seed
- **Cabang**: 3 cabang
- **Staff**: 16 pengguna  
- **Paket Terapi**: 132 paket (44 per cabang)
- **Kode Referral**: 8 kode
- **Produk Non-Terapi**: 13 produk
- **Item Inventori**: 40+ item
- **Member**: 30 member (10 per cabang)

### Environment Variables
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/raho_db"

# JWT
JWT_SECRET="your-jwt-secret-key"
JWT_REFRESH_SECRET="your-jwt-refresh-secret"

# MinIO
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET_NAME="raho-files"
```

### Perintah Seed
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed database
npm run seed
# atau
npx tsx prisma/seed.ts
```

---

## Catatan Penting

1. **Password Default**: Semua staff menggunakan password default sesuai role (admin123, manager123, dll.)
2. **Kode Unik**: Setiap cabang memiliki kode unik (PST, BDG, SBY) yang digunakan dalam kode member dan paket
3. **Harga Konsisten**: Harga paket sama di semua cabang, hanya kode yang berbeda
4. **Data Realistis**: Semua data menggunakan nama, alamat, dan informasi yang realistis
5. **Audit Trail**: Setiap operasi seed dicatat dalam audit log untuk tracking
6. **Modular**: Seed data dibagi dalam modul terpisah untuk kemudahan maintenance

---

*Dokumen ini berisi data seed lengkap untuk sistem RAHO Klinik Management System. Semua nilai adalah data exact yang digunakan dalam proses seeding database.*