# Price Field Visual Guide - Service Type Master Data

## 📋 What Was Added

### 1. Form - Price Input Field

When creating or editing a **Service Type** in Master Data tab:

```
┌─────────────────────────────────────────────┐
│  Tambah Tipe Layanan                        │
├─────────────────────────────────────────────┤
│                                             │
│  Kode *                                     │
│  ┌─────────────────────────────────────┐   │
│  │ PM                                  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Nama *                                     │
│  ┌─────────────────────────────────────┐   │
│  │ Premiere                            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Deskripsi (Opsional)                       │
│  ┌─────────────────────────────────────┐   │
│  │ Premiere service                    │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Harga (Opsional)                    ← NEW │
│  ┌─────────────────────────────────────┐   │
│  │ 1000000                             │   │
│  └─────────────────────────────────────┘   │
│  Harga default untuk tipe layanan ini       │
│  (dalam Rupiah)                             │
│  Preview: Rp 1.000.000                      │
│                                             │
│  Urutan Tampilan                            │
│  ┌─────────────────────────────────────┐   │
│  │ 1                                   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ☑ Aktif                                    │
│                                             │
├─────────────────────────────────────────────┤
│              [Batal]  [➕ Tambah]           │
└─────────────────────────────────────────────┘
```

### 2. Display - Service Type Card

Service types now show price in the card:

```
┌─────────────────────────────────────────────┐
│  🏥 PM                        ✅ Aktif      │
│  Premiere                                   │
│  Premiere service                           │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐   │
│  │ Urutan:                          #1 │   │ (Blue background)
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ Harga Default:      Rp 1.000.000   │   │ (Green background) ← NEW
│  └─────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│  [✏️ Edit] [🔒 Nonaktifkan] [🗑️ Hapus]    │
└─────────────────────────────────────────────┘
```

---

## 🎨 Visual Differences

### Before (No Price Field)

**Form:**
- Kode
- Nama
- Deskripsi
- Urutan Tampilan
- Aktif checkbox

**Card Display:**
- Only showed "Urutan" (sort order)

### After (With Price Field)

**Form:**
- Kode
- Nama
- Deskripsi
- **Harga** ← NEW (only for service types)
- Urutan Tampilan
- Aktif checkbox

**Card Display:**
- Shows "Urutan" (sort order) in blue
- Shows "Harga Default" in green ← NEW

---

## 🔍 Key Features

### Price Input Field
- **Type:** Number input
- **Step:** 10,000 (for easier input)
- **Min:** 0
- **Placeholder:** "Contoh: 1000000"
- **Preview:** Shows formatted currency below input
- **Visibility:** Only shown for service types (not booster types)

### Price Display
- **Format:** `formatCurrency()` helper (e.g., "Rp 1.000.000")
- **Color:** Green (#22c55e)
- **Background:** Light green (rgba(34, 197, 94, 0.1))
- **Conditional:** Only shows if price is set

---

## 📊 Default Prices

| Code | Service Type | Price |
|------|-------------|-------|
| PM | Premiere | Rp 1.000.000 |
| PS | Partnership | Rp 650.000 |
| PTY | Partnership Attiya | Rp 600.000 |
| PDA | Partnership Dr. Abhi | Rp 65.000 |
| PHC | Partnership Homecare | Rp 750.000 |

---

## 🎯 User Flow

### Creating New Service Type with Price

1. Go to `/admin/package-pricing`
2. Click "Master Data" tab
3. Select "Tipe Layanan" sub-tab
4. Click "➕ Tambah Tipe Layanan"
5. Fill in:
   - Kode (e.g., "PM")
   - Nama (e.g., "Premiere")
   - Deskripsi (optional)
   - **Harga** (e.g., 1000000) ← NEW
   - Urutan Tampilan (e.g., 1)
6. Check "Aktif"
7. Click "➕ Tambah"
8. See new service type card with price displayed

### Editing Existing Service Type Price

1. Find service type card
2. Click "✏️ Edit"
3. Update **Harga** field ← NEW
4. Click "💾 Update"
5. See updated price in card

---

## 💡 Notes

- Price is **optional** - can be left empty
- Price is stored in database as `Decimal(12, 2)`
- Frontend shows live preview as you type
- Price only appears for service types, not booster types
- All existing service types have been seeded with default prices
