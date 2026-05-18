# 🚀 Cara Menjalankan Seed Master Types

## Masalah
Tab "Master Data" di halaman Harga Paket menampilkan:
- "Belum ada tipe booster" 
- "Belum ada tipe layanan"

Padahal seharusnya menampilkan 7 tipe booster (NO, GT, MB, KCL, H2S, HK, O3) dan 5 tipe layanan (PM, PS, PTY, PDA, PHC).

## Solusi
Jalankan seed untuk mengisi data master ke database.

---

## Langkah-Langkah

### 1. Buka Terminal
Buka terminal/command prompt di folder project

### 2. Masuk ke Folder API
```bash
cd apps/api
```

### 3. Jalankan Seed Essential
```bash
npm run db:seed:essential
```

**Atau jika perintah di atas tidak ada:**
```bash
npx tsx prisma/seed-essential.ts
```

### 4. Tunggu Proses Selesai
Anda akan melihat output seperti ini:
```
🌱 Seeding ESSENTIAL system data...
👤 Creating Super Admin user...
  ✅ Super Admin created: superadmin@raho.id
📦 Seeding master products...
  ✅ Created 40 master products
📦 Seeding consolidated inventory items...
  ✅ Created 40 inventory items
⚙️ Seeding master types...
🚀 Seeding Master Booster Types...
✅ Created/Updated 7 booster types
🏥 Seeding Master Service Types...
✅ Created/Updated 5 service types

🎉 Essential data seeding completed successfully!

📊 Data summary:
  • 1 Super Admin user
  • 40 master products
  • 40 consolidated medical supplies
  • 7 booster types (NO, GT, MB, KCL, H2S, HK, O3)
  • 5 service types (PM, PS, PTY, PDA, PHC)
```

### 5. Refresh Browser
Setelah seed selesai, refresh halaman web browser Anda.

### 6. Cek Master Data Tab
1. Login sebagai Super Admin
2. Buka menu "Harga Paket"
3. Klik tab "Master Data"
4. Klik sub-tab "Tipe Booster" → Seharusnya muncul 7 tipe
5. Klik sub-tab "Tipe Layanan" → Seharusnya muncul 5 tipe

---

## Hasil yang Diharapkan

### Tab Tipe Booster akan menampilkan:
1. 🔵 NO - Nitric Oxide
2. 💚 GT - Glutathione
3. 🔷 MB - Methylene Blue
4. ⚪ KCL - Potassium Chloride
5. 🟡 H2S - Hydrogen Sulfide
6. 🔴 HK - Hypochlorous Acid
7. 🌀 O3 - Ozone

### Tab Tipe Layanan akan menampilkan:
1. PM - Premiere
2. PS - Partnership
3. PTY - Partnership Attiya
4. PDA - Partnership Dr. Abhi
5. PHC - Partnership Homecare

---

## Troubleshooting

### Error: "Cannot find module"
**Solusi**: Install dependencies terlebih dahulu
```bash
npm install
```

### Error: "Database connection failed"
**Solusi**: Pastikan database PostgreSQL sudah running dan .env sudah benar

### Error: "Table does not exist"
**Solusi**: Jalankan migration terlebih dahulu
```bash
npx prisma migrate dev
```

### Seed berhasil tapi data tidak muncul
**Solusi**: 
1. Hard refresh browser (Ctrl + Shift + R atau Cmd + Shift + R)
2. Clear browser cache
3. Logout dan login kembali

---

## Catatan Penting

- ✅ Seed ini **AMAN** untuk production
- ✅ Menggunakan `upsert` jadi tidak akan duplikat jika dijalankan ulang
- ✅ Tidak akan menghapus data yang sudah ada
- ✅ Hanya menambahkan/update master data

---

## Setelah Seed Berhasil

Anda bisa:
1. ✅ Melihat semua tipe booster dan layanan di tab Master Data
2. ✅ Edit nama, icon, deskripsi tipe yang ada
3. ✅ Aktifkan/nonaktifkan tipe tertentu
4. ✅ Tambah tipe custom baru
5. ✅ Hapus tipe yang tidak digunakan
6. ✅ Dropdown di form "Tambah Harga Paket" akan menampilkan semua tipe

---

## Butuh Bantuan?

Jika masih ada masalah, hubungi tim development atau buka issue di repository.
