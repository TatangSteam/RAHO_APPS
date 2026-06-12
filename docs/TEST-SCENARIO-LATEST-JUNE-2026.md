# Test Scenario Komprehensif - RAHO Premier Club
# Update Juni 2026

**Versi**: 4.0  
**Tanggal**: 12 Juni 2026  
**Aplikasi**: RAHO Premier Club Management System  
**Tujuan**: Panduan testing lengkap dengan fitur-fitur terbaru

---

## 📋 Daftar Isi

1. [Persiapan Environment](#1-persiapan-environment)
2. [Kredensial Login](#2-kredensial-login)
3. [Autentikasi & Otorisasi](#3-autentikasi--otorisasi)
4. [Dashboard](#4-dashboard)
5. [Manajemen Member](#5-manajemen-member)
6. [Lab Results Upload](#6-lab-results-upload-new)
7. [Manajemen Paket](#7-manajemen-paket)
8. [Sesi Terapi](#8-sesi-terapi)
9. [Invoice & Pembayaran](#9-invoice--pembayaran)
10. [Inventory & Stock Request](#10-inventory--stock-request)
11. [Referral](#11-referral)
12. [Manajemen Cabang](#12-manajemen-cabang)
13. [Staff Management](#13-staff-management-updated)
14. [Admin & Super Admin](#14-admin--super-admin)
15. [Export Data](#15-export-data)
16. [Member Portal](#16-member-portal)
17. [UI/UX Features](#17-uiux-features-new)

---

## 1. Persiapan Environment

### 1.1 Jalankan Server

**Terminal 1 - Database & MinIO (Docker):**
```bash
cd c:\Users\jovan\Documents\RAHO\agpROJ
docker-compose up -d
```

**Terminal 2 - API Server:**
```bash
cd apps/api
npm run dev
```
✅ Tunggu: `🚀 Server running on http://localhost:3001`

**Terminal 3 - Web Server:**
```bash
cd apps/web
npm run dev
```
✅ Tunggu: `✓ Ready on http://localhost:3000`


### 1.2 Seed Database

**Essential Seed (Production-safe):**
```bash
cd apps/api
npm run db:seed:essential
```

**Testing Seed (Development only):**
```bash
npm run db:seed:testing
```

### 1.3 Verifikasi Environment

| Komponen | URL | Status Check |
|----------|-----|--------------|
| Web App | http://localhost:3000 | Halaman login muncul |
| API Server | http://localhost:3001/api/v1/health | `{"status":"ok"}` |
| MinIO Console | http://localhost:9001 | Login: `minioadmin` / `minioadmin` |
| PostgreSQL | localhost:5432 | Database: `raho_dev` |

---

## 2. Kredensial Login

### 2.1 Akun Admin (Cross-Branch)

| Role | Email | Password | Akses |
|------|-------|----------|-------|
| SUPER_ADMIN | `superadmin@raho.id` | `Sup3r4dM1n` | Semua cabang + fitur |
| ADMIN_MANAGER | `manager@raho.id` | `Manager@123` | Multi-branch |

### 2.2 Akun Staff Jakarta (PST)

| Role | Email | Password |
|------|-------|----------|
| ADMIN_CABANG | `admincabang.jakarta@raho.id` | `AdminCabang@123` |
| ADMIN_LAYANAN | `adminlayanan.jakarta@raho.id` | `AdminLayanan@123` |
| DOCTOR | `dokter.jakarta@raho.id` | `Dokter@123` |
| NURSE | `nakes.jakarta@raho.id` | `Nakes@123` |


### 2.3 Akun Staff Bandung (BDG)

| Role | Email | Password |
|------|-------|----------|
| ADMIN_CABANG | `admincabang.bandung@raho.id` | `AdminCabang@123` |
| ADMIN_LAYANAN | `adminlayanan.bandung@raho.id` | `AdminLayanan@123` |
| DOCTOR | `dokter.bandung@raho.id` | `Dokter@123` |
| NURSE | `nakes.bandung@raho.id` | `Nakes@123` |

### 2.4 Akun Staff Surabaya (SBY)

| Role | Email | Password |
|------|-------|----------|
| ADMIN_CABANG | `admincabang.surabaya@raho.id` | `AdminCabang@123` |
| ADMIN_LAYANAN | `adminlayanan.surabaya@raho.id` | `AdminLayanan@123` |
| DOCTOR | `dokter.surabaya@raho.id` | `Dokter@123` |
| NURSE | `nakes.surabaya@raho.id` | `Nakes@123` |

### 2.5 Akun Member (Testing Member Portal)

| Nama | Email | Password |
|------|-------|----------|
| Budi Santoso | `budi.santoso@example.com` | `member123` |
| Ani Lestari | `ani.lestari@example.com` | `member123` |

---

## 3. Autentikasi & Otorisasi

### ✅ TC-AUTH-001: Login dengan kredensial valid

**Tujuan**: Memastikan user dapat login dengan akun valid

**Langkah**:
1. Buka `http://localhost:3000/login`
2. Masukkan email: `superadmin@raho.id`
3. Masukkan password: `Sup3r4dM1n`
4. Klik tombol "Masuk"

**Expected Result**:
- ✅ Redirect ke `/dashboard`
- ✅ Token tersimpan di localStorage
- ✅ Nama user tampil di header
- ✅ Badge role "SUPER_ADMIN" tampil
