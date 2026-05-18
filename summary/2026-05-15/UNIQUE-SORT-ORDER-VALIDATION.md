# Validasi Urutan Unik untuk Master Data

**Date:** May 15, 2026  
**Status:** ✅ Completed  
**Task:** Mencegah duplikasi sortOrder pada tipe booster dan tipe layanan

---

## Summary

Menambahkan validasi backend untuk memastikan bahwa `sortOrder` (urutan tampilan) harus unik untuk setiap tipe booster dan tipe layanan. Ini mencegah konflik urutan dan memastikan tampilan yang konsisten.

---

## Problem

Sebelumnya, sistem mengizinkan beberapa tipe booster atau tipe layanan memiliki `sortOrder` yang sama, yang dapat menyebabkan:
- Urutan tampilan yang tidak konsisten
- Konflik saat mengurutkan data
- Pengalaman pengguna yang membingungkan

---

## Solution

Menambahkan validasi di backend service untuk:
1. **Create** - Cek apakah `sortOrder` sudah digunakan sebelum membuat data baru
2. **Update** - Cek apakah `sortOrder` baru sudah digunakan oleh data lain

---

## Changes Made

### File Modified
**`apps/api/src/modules/admin/services/master-types-admin.service.ts`**

### 1. Create Booster Type - Validasi SortOrder

```typescript
async createBoosterType(data: {
  code: string;
  name: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
}) {
  // Check if code already exists
  const existing = await prisma.masterBoosterType.findUnique({
    where: { code: data.code },
  });

  if (existing) {
    throw {
      status: 409,
      code: 'CODE_EXISTS',
      message: 'Kode tipe booster sudah digunakan',
    };
  }

  // ✅ NEW: Check if sortOrder already exists
  const sortOrder = data.sortOrder ?? 999;
  const existingSortOrder = await prisma.masterBoosterType.findFirst({
    where: { sortOrder },
  });

  if (existingSortOrder) {
    throw {
      status: 409,
      code: 'SORT_ORDER_EXISTS',
      message: `Urutan ${sortOrder} sudah digunakan oleh tipe booster lain`,
    };
  }

  // ... create logic
}
```

### 2. Update Booster Type - Validasi SortOrder

```typescript
async updateBoosterType(
  id: string,
  data: {
    name?: string;
    icon?: string;
    description?: string;
    isActive?: boolean;
    sortOrder?: number;
  }
) {
  const type = await prisma.masterBoosterType.findUnique({
    where: { id },
  });

  if (!type) {
    throw {
      status: 404,
      code: 'NOT_FOUND',
      message: 'Tipe booster tidak ditemukan',
    };
  }

  // ✅ NEW: Check if sortOrder is being changed and if it already exists
  if (data.sortOrder !== undefined && data.sortOrder !== type.sortOrder) {
    const existingSortOrder = await prisma.masterBoosterType.findFirst({
      where: { 
        sortOrder: data.sortOrder,
        id: { not: id },
      },
    });

    if (existingSortOrder) {
      throw {
        status: 409,
        code: 'SORT_ORDER_EXISTS',
        message: `Urutan ${data.sortOrder} sudah digunakan oleh tipe booster lain`,
      };
    }
  }

  // ... update logic
}
```

### 3. Create Service Type - Validasi SortOrder

```typescript
async createServiceType(data: {
  code: string;
  name: string;
  description?: string;
  price?: number;
  sortOrder?: number;
}) {
  // Check if code already exists
  const existing = await prisma.masterServiceType.findUnique({
    where: { code: data.code },
  });

  if (existing) {
    throw {
      status: 409,
      code: 'CODE_EXISTS',
      message: 'Kode tipe layanan sudah digunakan',
    };
  }

  // ✅ NEW: Check if sortOrder already exists
  const sortOrder = data.sortOrder ?? 999;
  const existingSortOrder = await prisma.masterServiceType.findFirst({
    where: { sortOrder },
  });

  if (existingSortOrder) {
    throw {
      status: 409,
      code: 'SORT_ORDER_EXISTS',
      message: `Urutan ${sortOrder} sudah digunakan oleh tipe layanan lain`,
    };
  }

  // ... create logic
}
```

### 4. Update Service Type - Validasi SortOrder

```typescript
async updateServiceType(
  id: string,
  data: {
    name?: string;
    description?: string;
    price?: number;
    isActive?: boolean;
    sortOrder?: number;
  }
) {
  const type = await prisma.masterServiceType.findUnique({
    where: { id },
  });

  if (!type) {
    throw {
      status: 404,
      code: 'NOT_FOUND',
      message: 'Tipe layanan tidak ditemukan',
    };
  }

  // ✅ NEW: Check if sortOrder is being changed and if it already exists
  if (data.sortOrder !== undefined && data.sortOrder !== type.sortOrder) {
    const existingSortOrder = await prisma.masterServiceType.findFirst({
      where: { 
        sortOrder: data.sortOrder,
        id: { not: id },
      },
    });

    if (existingSortOrder) {
      throw {
        status: 409,
        code: 'SORT_ORDER_EXISTS',
        message: `Urutan ${data.sortOrder} sudah digunakan oleh tipe layanan lain`,
      };
    }
  }

  // ... update logic
}
```

---

## Validation Logic

### Create Operation
1. User submits form dengan `sortOrder` (atau default 999)
2. Backend cek apakah `sortOrder` sudah ada di database
3. Jika sudah ada → Return error 409 dengan pesan yang jelas
4. Jika belum ada → Lanjutkan create

### Update Operation
1. User mengubah `sortOrder` di form
2. Backend cek apakah `sortOrder` berubah dari nilai sebelumnya
3. Jika berubah → Cek apakah nilai baru sudah digunakan oleh data lain
4. Jika sudah digunakan → Return error 409 dengan pesan yang jelas
5. Jika belum digunakan → Lanjutkan update

---

## Error Responses

### Error Code: `SORT_ORDER_EXISTS`
**Status:** 409 Conflict

**Response untuk Booster Type:**
```json
{
  "error": {
    "status": 409,
    "code": "SORT_ORDER_EXISTS",
    "message": "Urutan 1 sudah digunakan oleh tipe booster lain"
  }
}
```

**Response untuk Service Type:**
```json
{
  "error": {
    "status": 409,
    "code": "SORT_ORDER_EXISTS",
    "message": "Urutan 1 sudah digunakan oleh tipe layanan lain"
  }
}
```

---

## User Experience

### Scenario 1: Create dengan SortOrder yang Sudah Ada

**User Action:**
1. Buka form "Tambah Tipe Booster"
2. Isi Kode: "NEW"
3. Isi Nama: "New Booster"
4. Isi Urutan: 1 (sudah digunakan oleh NO)
5. Klik "Tambah"

**System Response:**
- ❌ Error toast: "Urutan 1 sudah digunakan oleh tipe booster lain"
- Form tetap terbuka
- User dapat mengubah urutan ke nilai lain

### Scenario 2: Update dengan SortOrder yang Sudah Ada

**User Action:**
1. Edit tipe booster "GT" (urutan saat ini: 2)
2. Ubah urutan menjadi: 1 (sudah digunakan oleh NO)
3. Klik "Update"

**System Response:**
- ❌ Error toast: "Urutan 1 sudah digunakan oleh tipe booster lain"
- Form tetap terbuka
- User dapat mengubah urutan ke nilai lain

### Scenario 3: Update dengan SortOrder yang Sama (Tidak Berubah)

**User Action:**
1. Edit tipe booster "GT" (urutan saat ini: 2)
2. Ubah nama atau field lain
3. Urutan tetap: 2
4. Klik "Update"

**System Response:**
- ✅ Success: Update berhasil
- Tidak ada validasi error karena urutan tidak berubah

---

## Testing

### Test Cases

#### 1. Create Booster Type dengan SortOrder Duplikat
```bash
POST /admin/master/booster-types
{
  "code": "NEW",
  "name": "New Booster",
  "sortOrder": 1  // Already used by NO
}

Expected: 409 Error
Message: "Urutan 1 sudah digunakan oleh tipe booster lain"
```

#### 2. Create Service Type dengan SortOrder Duplikat
```bash
POST /admin/master/service-types
{
  "code": "NEW",
  "name": "New Service",
  "sortOrder": 1  // Already used by PM
}

Expected: 409 Error
Message: "Urutan 1 sudah digunakan oleh tipe layanan lain"
```

#### 3. Update Booster Type dengan SortOrder Duplikat
```bash
PATCH /admin/master/booster-types/{id}
{
  "sortOrder": 1  // Already used by another booster
}

Expected: 409 Error
Message: "Urutan 1 sudah digunakan oleh tipe booster lain"
```

#### 4. Update Service Type dengan SortOrder Duplikat
```bash
PATCH /admin/master/service-types/{id}
{
  "sortOrder": 1  // Already used by another service
}

Expected: 409 Error
Message: "Urutan 1 sudah digunakan oleh tipe layanan lain"
```

#### 5. Update dengan SortOrder yang Sama (Valid)
```bash
PATCH /admin/master/booster-types/{id}
{
  "name": "Updated Name",
  "sortOrder": 2  // Same as current sortOrder
}

Expected: 200 Success
```

---

## Current SortOrder Values

### Booster Types
| Code | Name | SortOrder |
|------|------|-----------|
| NO | Nitric Oxide | 1 |
| GT | Glutathione | 2 |
| MB | Methylene Blue | 3 |
| KCL | Potassium Chloride | 4 |
| H2S | Hydrogen Sulfide | 5 |
| HK | Hypochlorous Acid | 6 |
| O3 | Ozone | 7 |

### Service Types
| Code | Name | SortOrder |
|------|------|-----------|
| PM | Premiere | 1 |
| PS | Partnership | 2 |
| PTY | Partnership Attiya | 3 |
| PDA | Partnership Dr. Abhi | 4 |
| PHC | Partnership Homecare | 5 |

---

## Benefits

1. ✅ **Data Integrity** - Mencegah duplikasi urutan
2. ✅ **Consistent Display** - Urutan tampilan selalu konsisten
3. ✅ **Better UX** - Pesan error yang jelas membantu user memilih urutan yang tepat
4. ✅ **Predictable Sorting** - Tidak ada konflik saat mengurutkan data

---

## Notes

- Validasi hanya berlaku untuk data dalam tabel yang sama (booster types terpisah dari service types)
- Default `sortOrder` adalah 999 jika tidak diisi
- Validasi hanya berjalan di backend, frontend tidak perlu perubahan
- Error message dalam Bahasa Indonesia untuk kemudahan user

---

## Related User Query

> "Buat urutanya kalo sama tidak bisa dibuat"

**Translation:** "Make it so that if the order is the same, it cannot be created"

**Status:** ✅ Resolved
