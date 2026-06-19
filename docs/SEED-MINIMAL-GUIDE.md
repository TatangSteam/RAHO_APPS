# Minimal Seed Guide - SUPER_ADMIN Only

## Overview

Seed script minimal yang hanya membuat:
1. **1 Branch** (Head Office / HQ)
2. **1 SUPER_ADMIN** user

Berguna untuk:
- Fresh installation / setup awal
- Development environment yang clean
- Testing tanpa data dummy yang banyak
- Production deployment awal

## File Location

```
apps/api/prisma/seed-minimal.ts
```

## What It Creates

### 1. Branch: Head Office
```
Branch Code: HQ
Name: Head Office
City: Jakarta
Type: PUSAT
Status: Active
```

### 2. SUPER_ADMIN User
```
Email: admin@raho.com
Password: Admin123!
Staff Code: SA001
Full Name: Super Administrator
Phone: 08123456789
Role: SUPER_ADMIN
Branch: Head Office (HQ)
Status: Active
```

## How to Use

### Method 1: Reset Database + Seed Minimal (RECOMMENDED)

Jika ingin **RESET SEMUA DATA** dan mulai dari awal dengan hanya super admin:

```bash
# Navigate to API directory
cd apps/api

# Reset database (TANPA auto-seed)
npm run db:reset

# Then manually run minimal seed
npm run db:seed:minimal
```

**⚠️ WARNING**: `db:reset` akan **MENGHAPUS SEMUA DATA** dan reset database ke state awal!

**ℹ️ CATATAN PENTING**: 
- Sejak update terbaru, `npm run db:reset` **TIDAK OTOMATIS** menjalankan seeding
- Anda harus **MANUAL** menjalankan seed script yang diinginkan
- Ini memberikan kontrol penuh kepada Anda untuk memilih seed script mana yang akan dijalankan

### Method 2: Seed Minimal Only

Jika database sudah bersih/kosong dan hanya ingin create super admin:

```bash
cd apps/api
npm run db:seed:minimal
```

**Note**: Jika branch HQ atau user admin@raho.com sudah ada, akan terjadi error. Gunakan Method 1 untuk reset terlebih dahulu.

### Method 3: Manual Execution

```bash
cd apps/api
npx tsx prisma/seed-minimal.ts
```

## Expected Output

```
🌱 Starting minimal seed (SUPER_ADMIN only)...

📍 Creating default branch...
✅ Branch created: Head Office (HQ)

👤 Creating SUPER_ADMIN user...
✅ SUPER_ADMIN user created:
   Email: admin@raho.com
   Password: Admin123!
   Staff Code: SA001
   Name: Super Administrator
   Branch: Head Office (HQ)
   Role: SUPER_ADMIN

✅ Minimal seed completed successfully!

📋 Login Credentials:
   Email: admin@raho.com
   Password: Admin123!

⚠️  IMPORTANT: Change the password after first login!
```

## After Seeding

### 1. Login ke Aplikasi
```
Email: admin@raho.com
Password: Admin123!
```

### 2. ⚠️ WAJIB: Ganti Password
Setelah login pertama kali, **SEGERA GANTI PASSWORD** untuk keamanan!

### 3. Setup Data Lainnya
Setelah login sebagai SUPER_ADMIN, Anda bisa mulai setup:

1. **Branches** - Buat cabang-cabang lain
2. **Users** - Buat user staff (ADMIN_MANAGER, ADMIN_CABANG, NURSE, DOCTOR, dll)
3. **Package Pricing** - Setup harga paket global dan per cabang
4. **Master Data** - Booster types, inventory items, dll
5. **Members** - Mulai register member

## Use Cases

### Use Case 1: Fresh Development Environment
```bash
# Clone repo
git clone <repo-url>
cd RAHO

# Setup database
cd apps/api
npm install
npx prisma migrate dev

# Seed dengan super admin only
npm run db:seed:minimal

# Start development
npm run dev
```

### Use Case 2: Clean Testing Environment
```bash
# Reset dan seed ulang untuk testing
npm run db:reset
npm run db:seed:minimal

# Run tests
npm test
```

### Use Case 3: Production Initial Setup
```bash
# Deploy database migrations
npm run db:migrate:prod

# Seed initial super admin
npm run db:seed:minimal

# Setup akan dilanjutkan via web interface oleh super admin
```

## Comparison dengan Seed Scripts Lain

| Script | Branch | Users | Members | Packages | Use Case |
|--------|--------|-------|---------|----------|----------|
| **seed-minimal.ts** | 1 (HQ) | 1 (Super Admin) | 0 | 0 | Production/Clean Start |
| **seed-essential.ts** | Multiple | Multiple roles | 0 | Some packages | Development |
| **seed-testing.ts** | Multiple | Multiple roles | Sample data | Full packages | Testing |
| **seed.ts** | Multiple | All roles | Full dummy data | Everything | Full Demo |

## Security Notes

### Default Credentials
```
Email: admin@raho.com
Password: Admin123!
```

### ⚠️ PRODUCTION SECURITY CHECKLIST

Untuk deployment production, WAJIB:

1. ✅ **Ganti password** setelah login pertama
2. ✅ **Gunakan strong password** (min 12 characters, kombinasi upper/lower/number/symbol)
3. ✅ **Enable 2FA** (jika sudah diimplementasi)
4. ✅ **Batasi IP access** ke database
5. ✅ **Regular backup** database
6. ✅ **Monitor audit logs** untuk aktivitas super admin

### Password Requirements
Saat ganti password, gunakan password yang memenuhi:
- Minimal 8 karakter (recommended: 12+)
- Kombinasi huruf besar dan kecil
- Minimal 1 angka
- Minimal 1 karakter spesial
- Tidak mudah ditebak

## Troubleshooting

### Error: Branch already exists
```
Error: Unique constraint failed on the fields: (`branchCode`)
```

**Solution**: Branch HQ sudah ada. Reset database terlebih dahulu:
```bash
npm run db:reset
npm run db:seed:minimal
```

### Error: User already exists
```
Error: Unique constraint failed on the fields: (`email`)
```

**Solution**: User dengan email admin@raho.com sudah ada. Reset atau gunakan email lain.

### Error: bcryptjs not found
```
Error: Cannot find module 'bcryptjs'
```

**Solution**: Install dependencies:
```bash
npm install
```

### Error: Database connection failed
```
Error: Can't reach database server
```

**Solution**: 
1. Pastikan database PostgreSQL running
2. Check connection string di `.env`
3. Test connection: `npx prisma db push`

## Script Commands Reference

```bash
# Seed Scripts
npm run db:seed              # Full seed dengan semua data
npm run db:seed:essential    # Essential data untuk development
npm run db:seed:testing      # Testing data dengan sample
npm run db:seed:minimal      # ✨ Super admin only (minimal)

# Database Commands
npm run db:generate          # Generate Prisma client
npm run db:migrate           # Run migrations (development)
npm run db:migrate:prod      # Run migrations (production)
npm run db:reset             # ⚠️ Reset database (DELETE ALL DATA)
npm run db:studio            # Open Prisma Studio GUI
```

## File Structure

```
apps/api/
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── seed.ts                    # Full seed
│   ├── seed-essential.ts          # Essential seed
│   ├── seed-testing.ts            # Testing seed
│   └── seed-minimal.ts            # ✨ Minimal seed (SUPER_ADMIN only)
└── package.json                   # NPM scripts
```

## Next Steps After Seeding

1. **Login** dengan credentials super admin
2. **Ganti password** (security first!)
3. **Create branches** sesuai kebutuhan
4. **Create users**:
   - ADMIN_MANAGER untuk management
   - ADMIN_CABANG untuk setiap cabang
   - NURSE, DOCTOR untuk operasional
5. **Setup pricing**:
   - Global pricing (default untuk semua cabang)
   - Branch-specific pricing (custom per cabang)
6. **Import master data** jika ada
7. **Register members** dan mulai operasional

## Support

Untuk pertanyaan atau issues:
1. Check dokumentasi: `docs/` directory
2. Check seed script: `apps/api/prisma/seed-minimal.ts`
3. Check database schema: `apps/api/prisma/schema.prisma`

## Summary

✅ **Simple & Clean**: Hanya 1 branch dan 1 super admin  
✅ **Fast**: Execution time < 1 detik  
✅ **Safe**: Tidak create data dummy  
✅ **Production-ready**: Cocok untuk production initial setup  
✅ **Easy to use**: Single command `npm run db:seed:minimal`

**Perfect untuk fresh start!** 🚀
