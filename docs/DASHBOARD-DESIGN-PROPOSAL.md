# 📊 Dashboard Design Proposal - RAHO ERP

## Ringkasan Role & Tanggung Jawab

| Role | Fokus Utama | Scope |
|------|-------------|-------|
| **SUPER_ADMIN** | Kontrol sistem keseluruhan | Semua cabang |
| **ADMIN_MANAGER** | Manajemen multi-cabang | Cabang yang ditugaskan |
| **ADMIN_CABANG** | Operasional cabang | 1 cabang |
| **ADMIN_LAYANAN** | Pelayanan member | 1 cabang |
| **DOCTOR** | Terapi & medis | 1 cabang |
| **NURSE** | Pendukung terapi | 1 cabang |
| **MEMBER** | Self-service | Data pribadi |

---

## 1. 🛡️ SUPER_ADMIN Dashboard

### Tujuan
Memberikan visibilitas penuh terhadap performa seluruh sistem RAHO.

### Layout Wireframe
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🛡️ Super Admin Panel                              [Refresh] [Settings] │
│ Selamat datang, {nama} - Kontrol penuh sistem RAHO                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 🏢       │ │ 👥       │ │ 🧑‍🤝‍🧑       │ │ 📦       │ │ 💰       │      │
│  │ Cabang   │ │ Staff    │ │ Member   │ │ Produk   │ │ Revenue  │      │
│  │ 12/15    │ │ 89/95    │ │ 2,450    │ │ 156      │ │ 2.5M     │      │
│  │ aktif    │ │ aktif    │ │ aktif    │ │ aktif    │ │ bulan ini│      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ [Overview] [Admin Managers] [Branches] [Audit Logs]                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────┐ ┌─────────────────────────────────┐│
│  │ 📈 Performa Cabang              │ │ 🗺️ Peta Cabang                  ││
│  │ ┌─────────────────────────────┐ │ │                                 ││
│  │ │ Cabang A  ████████░░ 85%   │ │ │    [Interactive Map]            ││
│  │ │ Cabang B  ██████░░░░ 62%   │ │ │    showing branch locations     ││
│  │ │ Cabang C  █████████░ 91%   │ │ │    with revenue indicators      ││
│  │ │ Cabang D  ███████░░░ 73%   │ │ │                                 ││
│  │ └─────────────────────────────┘ │ │                                 ││
│  └─────────────────────────────────┘ └─────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────┐ ┌─────────────────────────────────┐│
│  │ 👥 Distribusi Role              │ │ 🕐 Aktivitas Terbaru            ││
│  │ ┌─────────────────────────────┐ │ │ • Admin A login - 5m ago       ││
│  │ │ Admin Manager    ██░░ 8    │ │ │ • Member baru - 12m ago        ││
│  │ │ Admin Cabang     ████ 15   │ │ │ • Paket dibeli - 25m ago       ││
│  │ │ Admin Layanan    █████ 24  │ │ │ • Sesi selesai - 30m ago       ││
│  │ │ Doctor           ███░ 12   │ │ │ • Invoice paid - 45m ago       ││
│  │ │ Nurse            ██████ 30 │ │ │                                 ││
│  │ └─────────────────────────────┘ │ │ [Lihat Semua Audit Log →]      ││
│  └─────────────────────────────────┘ └─────────────────────────────────┘│
│                                                                         │
│  ⚡ Aksi Cepat                                                          │
│  [📦 Tambah Produk] [🏢 Tambah Cabang] [👤 Tambah User] [📜 Audit Log] │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Komponen Utama
1. **System Health Cards** - Total cabang, staff, member, produk, revenue
2. **Branch Performance Chart** - Perbandingan performa antar cabang
3. **Interactive Map** - Lokasi cabang dengan indikator revenue
4. **Role Distribution** - Pie/bar chart distribusi role
5. **Recent Activities** - Feed aktivitas real-time
6. **Quick Actions** - Shortcut ke fitur yang sering digunakan

### Data yang Dibutuhkan
- Total & aktif: cabang, staff, member, produk
- Revenue total & bulanan per cabang
- Distribusi user per role
- 10 aktivitas terbaru (audit log)
- Performa cabang (target vs actual)

---

## 2. 👔 ADMIN_MANAGER Dashboard

### Tujuan
Monitoring dan manajemen multi-cabang yang ditugaskan.

### Layout Wireframe
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📊 Dashboard Admin Manager                    [Filter Cabang ▼] [🔄]   │
│ Ringkasan performa cabang Anda                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ 💰 Total Revenue Multi-Cabang                    +12.5% vs bulan   ││
│  │ Rp 850.000.000                                   lalu              ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ 📦       │ │ 👥       │ │ 💳       │ │ ⏳       │                   │
│  │ Paket    │ │ Member   │ │ Transaksi│ │ Pending  │                   │
│  │ Terjual  │ │ Aktif    │ │          │ │ Payment  │                   │
│  │ 156      │ │ 892      │ │ 234      │ │ 18       │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 📈 Perbandingan Revenue Cabang                                      ││
│  │ ┌─────────────────────────────────────────────────────────────────┐ ││
│  │ │                                                                 │ ││
│  │ │     ████                                                        │ ││
│  │ │     ████  ████                                                  │ ││
│  │ │     ████  ████  ████                                            │ ││
│  │ │     ████  ████  ████  ████                                      │ ││
│  │ │     Cab A Cab B Cab C Cab D                                     │ ││
│  │ │                                                                 │ ││
│  │ └─────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌──────────────────────────────┐ ┌────────────────────────────────────┐│
│  │ 📋 Stock Request Pending     │ │ 🚚 Pengiriman Aktif               ││
│  │ ┌──────────────────────────┐ │ │ ┌────────────────────────────────┐││
│  │ │ Cab A - 5 items - Review │ │ │ │ SHP-001 → Cab A - In Transit  │││
│  │ │ Cab B - 3 items - Review │ │ │ │ SHP-002 → Cab B - Shipped     │││
│  │ │ Cab C - 8 items - Review │ │ │ │ SHP-003 → Cab C - Preparing   │││
│  │ └──────────────────────────┘ │ │ └────────────────────────────────┘││
│  │ [Lihat Semua →]              │ │ [Lihat Semua →]                   ││
│  └──────────────────────────────┘ └────────────────────────────────────┘│
│                                                                         │
│  ┌──────────────────────────────┐ ┌────────────────────────────────────┐│
│  │ 🏆 Top Performing Branches   │ │ 📊 Referral Performance           ││
│  │ 1. Cabang Jakarta - 95%     │ │ Total Referral: 45                ││
│  │ 2. Cabang Bandung - 88%     │ │ Converted: 32 (71%)               ││
│  │ 3. Cabang Surabaya - 82%    │ │ [Kelola Referral →]               ││
│  └──────────────────────────────┘ └────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Komponen Utama
1. **Multi-Branch Revenue Card** - Total revenue dari semua cabang
2. **KPI Cards** - Paket terjual, member aktif, transaksi, pending payment
3. **Branch Comparison Chart** - Bar chart perbandingan revenue per cabang
4. **Stock Request Queue** - Request yang perlu di-review
5. **Active Shipments** - Status pengiriman ke cabang
6. **Branch Ranking** - Peringkat performa cabang
7. **Referral Stats** - Performa kode referral

### Data yang Dibutuhkan
- Revenue agregat multi-cabang
- KPI per cabang dan total
- Stock request pending approval
- Shipment status
- Branch performance metrics
- Referral conversion rate

---

## 3. 🏢 ADMIN_CABANG Dashboard

### Tujuan
Manajemen operasional harian cabang secara menyeluruh.

### Layout Wireframe
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📊 Dashboard Cabang {Nama Cabang}           [Hari Ini ▼] [Minggu] [Bulan]│
│ Ringkasan performa cabang Anda                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ 💰 Revenue Cabang                                    +8.2% ↑       ││
│  │ Rp 125.500.000                                       vs bulan lalu ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 📦       │ │ 👥       │ │ ✅       │ │ ⏳       │ │ 👤       │      │
│  │ Paket    │ │ Member   │ │ Sesi     │ │ Pending  │ │ Member   │      │
│  │ Terjual  │ │ Aktif    │ │ Selesai  │ │ Payment  │ │ Baru     │      │
│  │ 45       │ │ 234      │ │ 89       │ │ 12       │ │ 8        │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 📈 Trend Revenue (30 Hari)                                          ││
│  │ ┌─────────────────────────────────────────────────────────────────┐ ││
│  │ │         ╭─╮                                                     │ ││
│  │ │    ╭───╯  ╰──╮      ╭──╮                                        │ ││
│  │ │ ──╯          ╰────╯    ╰───────                                 │ ││
│  │ │ 1   5   10   15   20   25   30                                  │ ││
│  │ └─────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌──────────────────────────────┐ ┌────────────────────────────────────┐│
│  │ 📅 Sesi Hari Ini             │ │ 🏆 Top Staff Bulan Ini            ││
│  │ ┌──────────────────────────┐ │ │ ┌────────────────────────────────┐││
│  │ │ 09:00 - Budi (Dr. Andi)  │ │ │ │ 1. Dr. Andi - 45 sesi        │││
│  │ │ 10:30 - Siti (Dr. Budi)  │ │ │ │ 2. Dr. Budi - 38 sesi        │││
│  │ │ 13:00 - Rina (Dr. Andi)  │ │ │ │ 3. Ns. Citra - 32 sesi       │││
│  │ │ 14:30 - Doni (Dr. Citra) │ │ │ └────────────────────────────────┘││
│  │ └──────────────────────────┘ │ │ [Lihat Kinerja Staff →]          ││
│  │ Total: 12 sesi terjadwal     │ │                                   ││
│  └──────────────────────────────┘ └────────────────────────────────────┘│
│                                                                         │
│  ┌──────────────────────────────┐ ┌────────────────────────────────────┐│
│  │ 📦 Stok Menipis              │ │ 💳 Transaksi Terbaru              ││
│  │ ┌──────────────────────────┐ │ │ ┌────────────────────────────────┐││
│  │ │ ⚠️ NaCl 0.9% - 5 unit    │ │ │ │ INV-001 - Budi - Rp 5.5jt ✓  │││
│  │ │ ⚠️ Vitamin C - 8 unit    │ │ │ │ INV-002 - Siti - Rp 3.2jt ✓  │││
│  │ │ ⚠️ Infus Set - 3 unit    │ │ │ │ INV-003 - Rina - Rp 7.8jt ⏳ │││
│  │ └──────────────────────────┘ │ │ └────────────────────────────────┘││
│  │ [Request Stok →]             │ │ [Lihat Semua →]                   ││
│  └──────────────────────────────┘ └────────────────────────────────────┘│
│                                                                         │
│  ┌──────────────────────────────┐ ┌────────────────────────────────────┐│
│  │ 📊 Top Paket Terjual         │ │ 🎫 Referral Aktif                 ││
│  │ 1. Paket Premium - 18       │ │ Total: 12 kode                    ││
│  │ 2. Paket Basic - 15         │ │ Digunakan: 8 (67%)                ││
│  │ 3. Paket Booster - 12       │ │ [Kelola Referral →]               ││
│  └──────────────────────────────┘ └────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Komponen Utama
1. **Revenue Card** - Revenue cabang dengan trend
2. **KPI Cards** - Paket, member, sesi, pending, member baru
3. **Revenue Trend Chart** - Line chart 30 hari
4. **Today's Sessions** - Jadwal sesi hari ini
5. **Top Staff** - Peringkat staff berdasarkan sesi
6. **Low Stock Alert** - Item yang perlu di-restock
7. **Recent Transactions** - Transaksi terbaru
8. **Top Packages** - Paket terlaris
9. **Referral Stats** - Performa referral cabang

### Data yang Dibutuhkan
- Revenue cabang dengan growth
- KPI metrics cabang
- Revenue by day (30 hari)
- Today's session schedule
- Staff performance ranking
- Inventory low stock alerts
- Recent transactions
- Package sales ranking
- Referral usage stats

---

## 4. 🎯 ADMIN_LAYANAN Dashboard

### Tujuan
Fokus pada pelayanan member dan manajemen sesi terapi.

### Layout Wireframe
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎯 Dashboard Layanan - {Nama Cabang}                    [Hari Ini ▼]   │
│ Fokus pelayanan member dan sesi terapi                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ 📅       │ │ ✅       │ │ ⏳       │ │ 👥       │                   │
│  │ Sesi     │ │ Selesai  │ │ Pending  │ │ Member   │                   │
│  │ Hari Ini │ │ Hari Ini │ │ Payment  │ │ Aktif    │                   │
│  │ 15       │ │ 8        │ │ 5        │ │ 234      │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 📅 Jadwal Sesi Hari Ini                                             ││
│  │ ┌─────────────────────────────────────────────────────────────────┐ ││
│  │ │ Waktu   │ Member        │ Paket      │ Dokter    │ Status      │ ││
│  │ ├─────────┼───────────────┼────────────┼───────────┼─────────────┤ ││
│  │ │ 09:00   │ Budi Santoso  │ Premium    │ Dr. Andi  │ ✅ Selesai  │ ││
│  │ │ 10:30   │ Siti Rahayu   │ Basic      │ Dr. Budi  │ 🔄 Ongoing  │ ││
│  │ │ 13:00   │ Rina Dewi     │ Premium    │ Dr. Andi  │ ⏳ Scheduled│ ││
│  │ │ 14:30   │ Doni Pratama  │ Booster    │ Dr. Citra │ ⏳ Scheduled│ ││
│  │ │ 16:00   │ Maya Sari     │ Basic      │ Dr. Budi  │ ⏳ Scheduled│ ││
│  │ └─────────────────────────────────────────────────────────────────┘ ││
│  │ [+ Buat Sesi Baru]                                                  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌──────────────────────────────┐ ┌────────────────────────────────────┐│
│  │ 💳 Pembayaran Pending        │ │ 👤 Member Perlu Follow-up         ││
│  │ ┌──────────────────────────┐ │ │ ┌────────────────────────────────┐││
│  │ │ Budi - Rp 5.5jt - 3 hari │ │ │ │ Rina - Voucher habis 2 hari  │││
│  │ │ Siti - Rp 3.2jt - 5 hari │ │ │ │ Doni - Belum sesi 14 hari    │││
│  │ │ Rina - Rp 7.8jt - 7 hari │ │ │ │ Maya - Paket expired soon    │││
│  │ └──────────────────────────┘ │ │ └────────────────────────────────┘││
│  │ [Verifikasi Pembayaran →]    │ │ [Hubungi Member →]                ││
│  └──────────────────────────────┘ └────────────────────────────────────┘│
│                                                                         │
│  ┌──────────────────────────────┐ ┌────────────────────────────────────┐│
│  │ 📦 Stok Tersedia             │ │ 📊 Statistik Minggu Ini           ││
│  │ NaCl 0.9%: 45 unit          │ │ Sesi Selesai: 52                  ││
│  │ Vitamin C: 38 unit          │ │ Member Baru: 5                    ││
│  │ Infus Set: 25 unit          │ │ Paket Terjual: 12                 ││
│  │ [Lihat Inventori →]          │ │ Revenue: Rp 45.5jt               ││
│  └──────────────────────────────┘ └────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Komponen Utama
1. **Quick Stats** - Sesi hari ini, selesai, pending payment, member aktif
2. **Today's Schedule Table** - Jadwal sesi dengan detail lengkap
3. **Pending Payments** - Pembayaran yang perlu diverifikasi
4. **Member Follow-up** - Member yang perlu dihubungi
5. **Stock Overview** - Ketersediaan stok utama
6. **Weekly Stats** - Ringkasan performa minggu ini

### Data yang Dibutuhkan
- Today's session count & status
- Session schedule with member & doctor details
- Pending payment list with aging
- Members needing follow-up (voucher habis, inactive)
- Current stock levels
- Weekly performance metrics

---

## 5. 👨‍⚕️ DOCTOR Dashboard

### Tujuan
Fokus pada sesi terapi dan data medis pasien.

### Layout Wireframe
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 👨‍⚕️ Dashboard Dokter - {Nama Dokter}                    [Hari Ini ▼]   │
│ Selamat datang, Dr. {Nama}                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ 📅       │ │ ✅       │ │ 🔄       │ │ 📊       │                   │
│  │ Sesi     │ │ Selesai  │ │ Ongoing  │ │ Total    │                   │
│  │ Hari Ini │ │          │ │          │ │ Bulan Ini│                   │
│  │ 8        │ │ 3        │ │ 1        │ │ 45       │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 📅 Jadwal Sesi Saya Hari Ini                                        ││
│  │ ┌─────────────────────────────────────────────────────────────────┐ ││
│  │ │ ┌─────────────────────────────────────────────────────────────┐ │ ││
│  │ │ │ 🕐 09:00 - Budi Santoso                          ✅ Selesai │ │ ││
│  │ │ │    Paket Premium | Infus ke-5 | On-Site                     │ │ ││
│  │ │ │    [Lihat Detail]                                           │ │ ││
│  │ │ └─────────────────────────────────────────────────────────────┘ │ ││
│  │ │ ┌─────────────────────────────────────────────────────────────┐ │ ││
│  │ │ │ 🕐 10:30 - Siti Rahayu                           🔄 Ongoing │ │ ││
│  │ │ │    Paket Basic | Infus ke-3 | On-Site                       │ │ ││
│  │ │ │    [Lanjutkan Sesi →]                                       │ │ ││
│  │ │ └─────────────────────────────────────────────────────────────┘ │ ││
│  │ │ ┌─────────────────────────────────────────────────────────────┐ │ ││
│  │ │ │ 🕐 13:00 - Rina Dewi                            ⏳ Scheduled│ │ ││
│  │ │ │    Paket Premium | Infus ke-8 | Home Care                   │ │ ││
│  │ │ │    [Mulai Sesi →]                                           │ │ ││
│  │ │ └─────────────────────────────────────────────────────────────┘ │ ││
│  │ └─────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌──────────────────────────────┐ ┌────────────────────────────────────┐│
│  │ 📋 Pasien Terbaru            │ │ 📊 Performa Saya                  ││
│  │ ┌──────────────────────────┐ │ │ ┌────────────────────────────────┐││
│  │ │ Budi - Premium - 5/10    │ │ │ │ Sesi Bulan Ini: 45            │││
│  │ │ Siti - Basic - 3/8       │ │ │ │ Rating: ⭐ 4.8/5              │││
│  │ │ Rina - Premium - 8/10    │ │ │ │ Completion Rate: 98%          │││
│  │ └──────────────────────────┘ │ │ └────────────────────────────────┘││
│  │ [Lihat Semua Pasien →]       │ │                                   ││
│  └──────────────────────────────┘ └────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Komponen Utama
1. **Quick Stats** - Sesi hari ini, selesai, ongoing, total bulan ini
2. **My Schedule Cards** - Jadwal sesi dengan aksi langsung
3. **Recent Patients** - Pasien yang baru ditangani
4. **My Performance** - Statistik performa pribadi

### Data yang Dibutuhkan
- Doctor's sessions today (count & details)
- Session status breakdown
- Monthly session count
- Recent patients with progress
- Performance metrics (completion rate, rating)

---

## 6. 👩‍⚕️ NURSE Dashboard

### Tujuan
Mendukung pelaksanaan sesi terapi dan monitoring pasien.

### Layout Wireframe
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 👩‍⚕️ Dashboard Perawat - {Nama Perawat}                  [Hari Ini ▼]   │
│ Selamat datang, {Nama}                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ 📅       │ │ ✅       │ │ 🔄       │ │ 📦       │                   │
│  │ Sesi     │ │ Selesai  │ │ Ongoing  │ │ Material │                   │
│  │ Hari Ini │ │          │ │          │ │ Dipakai  │                   │
│  │ 12       │ │ 5        │ │ 2        │ │ 24       │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 📅 Sesi Aktif & Mendatang                                           ││
│  │ ┌─────────────────────────────────────────────────────────────────┐ ││
│  │ │ 🔄 ONGOING - Siti Rahayu                                        │ ││
│  │ │    Dr. Budi | Infus ke-3 | Mulai 10:30                          │ ││
│  │ │    Vital: TD 120/80 | Nadi 72 | Suhu 36.5°C                     │ ││
│  │ │    [Update Vital] [Catat Material] [Foto Sesi]                  │ ││
│  │ ├─────────────────────────────────────────────────────────────────┤ ││
│  │ │ ⏳ 13:00 - Rina Dewi | Dr. Andi | Infus ke-8                    │ ││
│  │ │ ⏳ 14:30 - Doni Pratama | Dr. Citra | Infus ke-2                │ ││
│  │ │ ⏳ 16:00 - Maya Sari | Dr. Budi | Infus ke-6                    │ ││
│  │ └─────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌──────────────────────────────┐ ┌────────────────────────────────────┐│
│  │ 📦 Stok Material             │ │ 📋 Checklist Hari Ini             ││
│  │ ┌──────────────────────────┐ │ │ ┌────────────────────────────────┐││
│  │ │ NaCl 0.9%: 45 unit       │ │ │ │ ✅ Cek stok pagi              │││
│  │ │ Vitamin C: 38 unit       │ │ │ │ ✅ Siapkan ruangan            │││
│  │ │ Infus Set: 25 unit       │ │ │ │ ⬜ Update vital Siti          │││
│  │ │ Abocath: 50 unit         │ │ │ │ ⬜ Foto sesi Siti             │││
│  │ └──────────────────────────┘ │ │ │ ⬜ Siapkan material Rina      │││
│  │ [Lihat Inventori →]          │ │ └────────────────────────────────┘││
│  └──────────────────────────────┘ └────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Komponen Utama
1. **Quick Stats** - Sesi hari ini, selesai, ongoing, material dipakai
2. **Active Sessions** - Sesi yang sedang berjalan dengan aksi
3. **Upcoming Sessions** - Sesi yang akan datang
4. **Stock Overview** - Ketersediaan material
5. **Daily Checklist** - Task list harian

### Data yang Dibutuhkan
- Today's sessions (all, not just nurse's)
- Active session details with vital signs
- Material stock levels
- Daily task checklist

---

## 7. 👤 MEMBER Dashboard

### Tujuan
Self-service portal untuk member melihat status keanggotaan dan terapi.

### Layout Wireframe
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 👋 Halo, {Nama Member}                                                 │
│ Selamat datang kembali di Portal Member RAHO                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────┐ ┌─────────────────────────────────┐│
│  │ 🎫 Voucher Tersisa              │ │ 📦 Paket Aktif                  ││
│  │                                 │ │                                 ││
│  │         ┌─────────┐             │ │         ┌─────────┐             ││
│  │         │   12    │             │ │         │    2    │             ││
│  │         └─────────┘             │ │         └─────────┘             ││
│  │                                 │ │                                 ││
│  │   Voucher yang dapat digunakan  │ │   Paket terapi yang berjalan   ││
│  │                                 │ │                                 ││
│  └─────────────────────────────────┘ └─────────────────────────────────┘│
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 📦 Paket Terapi Saya                                                ││
│  │ ┌─────────────────────────────────────────────────────────────────┐ ││
│  │ │ ┌─────────────────────────────────────────────────────────────┐ │ ││
│  │ │ │ 🏆 Paket Premium                                   AKTIF    │ │ ││
│  │ │ │    Progress: ████████░░ 8/10 sesi                           │ │ ││
│  │ │ │    Voucher: 8 tersisa | Expired: 15 Des 2026                │ │ ││
│  │ │ │    [Lihat Detail →]                                         │ │ ││
│  │ │ └─────────────────────────────────────────────────────────────┘ │ ││
│  │ │ ┌─────────────────────────────────────────────────────────────┐ │ ││
│  │ │ │ 💪 Paket Booster                                   AKTIF    │ │ ││
│  │ │ │    Progress: ██░░░░░░░░ 2/10 sesi                           │ │ ││
│  │ │ │    Voucher: 4 tersisa | Expired: 20 Jan 2027                │ │ ││
│  │ │ │    [Lihat Detail →]                                         │ │ ││
│  │ │ └─────────────────────────────────────────────────────────────┘ │ ││
│  │ └─────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 📅 Sesi Terapi Terakhir                                             ││
│  │ ┌─────────────────────────────────────────────────────────────────┐ ││
│  │ │ 📍 Cabang Jakarta Selatan                                       │ ││
│  │ │ 📅 12 Mei 2026 - 10:30                                          │ ││
│  │ │ 👨‍⚕️ Dr. Andi Wijaya                                              │ ││
│  │ │ 💉 Infus ke-8 dari 10 | Paket Premium                           │ ││
│  │ │ 📍 Di Klinik (On-Site)                                          │ ││
│  │ │                                                                 │ ││
│  │ │ [Lihat Riwayat Sesi →]                                          │ ││
│  │ └─────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌──────────────────────────────┐ ┌────────────────────────────────────┐│
│  │ 💳 Invoice Terbaru           │ │ 📞 Butuh Bantuan?                 ││
│  │ ┌──────────────────────────┐ │ │                                   ││
│  │ │ INV-2026-001             │ │ │ Hubungi cabang Anda:              ││
│  │ │ Rp 5.500.000             │ │ │ 📱 +62 812-3456-7890              ││
│  │ │ ✅ Lunas - 10 Mei 2026   │ │ │ 📧 jakarta@raho.id                ││
│  │ └──────────────────────────┘ │ │                                   ││
│  │ [Lihat Semua Invoice →]      │ │ [WhatsApp →]                      ││
│  └──────────────────────────────┘ └────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Komponen Utama
1. **Welcome Banner** - Greeting personal
2. **KPI Cards** - Voucher tersisa, paket aktif
3. **Active Packages** - Daftar paket dengan progress bar
4. **Last Session** - Detail sesi terakhir
5. **Recent Invoice** - Invoice terbaru
6. **Contact Info** - Informasi kontak cabang

### Data yang Dibutuhkan
- Total voucher tersisa
- Active packages count
- Package details with progress
- Last session info
- Recent invoices
- Branch contact info

---

## 📋 Ringkasan Perbandingan Dashboard

| Fitur | SA | AM | AC | AL | DR | NR | MB |
|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| System Stats | ✅ | - | - | - | - | - | - |
| Multi-Branch View | ✅ | ✅ | - | - | - | - | - |
| Revenue Chart | ✅ | ✅ | ✅ | - | - | - | - |
| Branch Comparison | ✅ | ✅ | - | - | - | - | - |
| Stock Request | - | ✅ | ✅ | - | - | - | - |
| Shipment Status | ✅ | ✅ | ✅ | - | - | - | - |
| Session Schedule | - | - | ✅ | ✅ | ✅ | ✅ | - |
| My Sessions | - | - | - | - | ✅ | ✅ | - |
| Pending Payment | - | ✅ | ✅ | ✅ | - | - | - |
| Staff Performance | ✅ | ✅ | ✅ | - | ✅ | - | - |
| Inventory Alert | - | - | ✅ | ✅ | - | ✅ | - |
| Member Follow-up | - | - | - | ✅ | - | - | - |
| Referral Stats | - | ✅ | ✅ | - | - | - | - |
| Audit Log | ✅ | - | - | - | - | - | - |
| My Vouchers | - | - | - | - | - | - | ✅ |
| My Packages | - | - | - | - | - | - | ✅ |
| My Sessions | - | - | - | - | - | - | ✅ |

**Legenda:** SA=Super Admin, AM=Admin Manager, AC=Admin Cabang, AL=Admin Layanan, DR=Doctor, NR=Nurse, MB=Member

---

## 🎨 Design Guidelines

### Color Palette
```
Primary:     #F59E0B (Amber 500) - Brand color
Success:     #22C55E (Green 500) - Positive metrics
Warning:     #EAB308 (Yellow 500) - Alerts
Danger:      #EF4444 (Red 500) - Critical alerts
Info:        #3B82F6 (Blue 500) - Information
Purple:      #A855F7 (Purple 500) - Special highlights

Dark Mode Background: #0A0A0A
Dark Mode Card: #171717 (Neutral 900)
Dark Mode Border: #262626 (Neutral 800)
```

### Typography
```
Headings: Inter, font-weight: 700
Body: Inter, font-weight: 400-500
Numbers/Stats: Inter, font-weight: 700, tabular-nums
```

### Card Styles
```css
.stat-card {
  background: linear-gradient(135deg, rgba(color, 0.15), rgba(color, 0.05));
  border: 1px solid rgba(color, 0.3);
  border-radius: 16px;
  padding: 24px;
}

.content-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
}
```


### Responsive Breakpoints
```
Mobile:  < 640px  - Single column, stacked cards
Tablet:  640-1024px - 2 columns
Desktop: > 1024px - 3-4 columns, full layout
```

---

## 🔧 Implementasi yang Disarankan

### Prioritas Tinggi (Harus Ada)
1. **SUPER_ADMIN** - Branch performance comparison, audit log feed
2. **ADMIN_MANAGER** - Multi-branch revenue, stock request queue
3. **ADMIN_CABANG** - Revenue trend, low stock alerts, today's sessions
4. **ADMIN_LAYANAN** - Session schedule table, pending payments
5. **DOCTOR** - My sessions today, patient progress
6. **NURSE** - Active sessions with vital signs, material checklist
7. **MEMBER** - Voucher count, package progress, last session

### Prioritas Sedang (Nice to Have)
1. Interactive branch map (Super Admin)
2. Real-time session status updates
3. Push notifications for alerts
4. Export dashboard to PDF
5. Custom date range filters

### Prioritas Rendah (Future Enhancement)
1. AI-powered insights
2. Predictive analytics
3. Gamification elements
4. Mobile app dashboard

---

## 📊 API Endpoints yang Dibutuhkan

### Existing (Sudah Ada)
- `GET /dashboard/branch` - Branch dashboard stats
- `GET /admin/system-stats` - Super admin stats
- `GET /me/dashboard` - Member dashboard

### Perlu Ditambahkan
```
GET /dashboard/multi-branch          # Admin Manager multi-branch view
GET /dashboard/sessions/today        # Today's session schedule
GET /dashboard/sessions/my           # Doctor/Nurse personal sessions
GET /dashboard/inventory/alerts      # Low stock alerts
GET /dashboard/payments/pending      # Pending payment list
GET /dashboard/members/followup      # Members needing follow-up
GET /dashboard/staff/performance     # Staff performance metrics
```

---

## 📝 Catatan Implementasi

1. **Caching**: Gunakan SWR/React Query untuk caching data dashboard
2. **Real-time**: Pertimbangkan WebSocket untuk update real-time pada sesi aktif
3. **Skeleton Loading**: Tampilkan skeleton saat loading untuk UX yang lebih baik
4. **Error Handling**: Tampilkan pesan error yang informatif jika gagal load
5. **Accessibility**: Pastikan semua komponen accessible (ARIA labels, keyboard nav)
6. **Performance**: Lazy load komponen yang tidak terlihat di viewport

---

*Dokumen ini dibuat pada: 25 Mei 2026*
*Versi: 1.0*
