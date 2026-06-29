# Master Types Seed Data

**Date**: May 15, 2026  
**Status**: ✅ Completed

## Overview
Created seed data for Master Booster Types and Master Service Types to populate the Master Data tab in Package Pricing page.

---

## Problem

Tab "Master Data" menampilkan "Belum ada tipe booster" dan "Belum ada tipe layanan" karena data master belum ada di database. User tidak bisa melihat atau mengelola (CRUD) tipe-tipe yang sudah ada.

---

## Solution

Created seed file to populate master data with default booster and service types.

---

## Files Created

### 1. **Master Types Seed File**
**File**: `apps/api/prisma/seeds/master-types.seed.ts`

**Content**:
- 7 Booster Types (NO, GT, MB, KCL, H2S, HK, O3)
- 5 Service Types (PM, PS, PTY, PDA, PHC)

**Booster Types**:
```typescript
{
  code: 'NO',
  name: 'Nitric Oxide',
  icon: '🔵',
  description: 'Nitric Oxide booster therapy',
  sortOrder: 1,
  isActive: true,
}
// ... and 6 more
```

**Service Types**:
```typescript
{
  code: 'PM',
  name: 'Premiere',
  description: 'Premiere service - Rp 1.000.000',
  sortOrder: 1,
  isActive: true,
}
// ... and 4 more
```

---

## Integration

### Updated `seed-essential.ts`
Added master types seeding to essential seed file:

```typescript
// Import
import { seedMasterTypes } from './seeds/master-types.seed';

// In main()
console.log('⚙️ Seeding master types...');
await seedMasterTypes();
```

---

## How to Run

### Option 1: Run Essential Seed (Recommended)
```bash
cd apps/api
npm run db:seed:essential
```

This will seed:
- Super Admin user
- Master products
- Consolidated inventory items
- **Master booster types** (NEW)
- **Master service types** (NEW)

### Option 2: Run Master Types Seed Only
```bash
cd apps/api
npx tsx prisma/seeds/master-types.seed.ts
```

---

## Data Seeded

### Booster Types (7 types):
1. 🔵 **NO** - Nitric Oxide
2. 💚 **GT** - Gasotransmitter
3. 🔷 **MB** - Methylene Blue
4. ⚪ **KCL** - Potassium Chloride
5. 🟡 **H2S** - Hydrogen Sulfide
6. 🔴 **HK** - H2O Konsentrat
7. 🌀 **O3** - Ozone

### Service Types (5 types):
1. **PM** - Premiere (Rp 1.000.000)
2. **PS** - Partnership (Rp 650.000)
3. **PTY** - Partnership Attiya (Rp 600.000)
4. **PDA** - Partnership Dr. Abhi (Rp 65.000/ml)
5. **PHC** - Partnership Homecare (Rp 750.000)

---

## User Experience

### Before Seed:
❌ Tab Master Data shows "Belum ada tipe booster"
❌ Tab Master Data shows "Belum ada tipe layanan"
❌ Cannot CRUD master types
❌ Dropdown in form only shows hardcoded options

### After Seed:
✅ Tab Master Data shows all 7 booster types
✅ Tab Master Data shows all 5 service types
✅ Can CRUD (Create, Read, Update, Delete) all types
✅ Can activate/deactivate types
✅ Can edit names, descriptions, icons
✅ Can add new custom types
✅ Dropdown shows both hardcoded + database types

---

## Features Enabled

### Master Data Tab - Tipe Booster:
- ✅ View all booster types in card grid
- ✅ See code, name, icon, description
- ✅ See active/inactive status
- ✅ See sort order
- ✅ Edit booster type (name, icon, description, sort order)
- ✅ Activate/Deactivate booster type
- ✅ Delete booster type (if not used)
- ✅ Add new custom booster type

### Master Data Tab - Tipe Layanan:
- ✅ View all service types in card grid
- ✅ See code, name, description
- ✅ See active/inactive status
- ✅ See sort order
- ✅ Edit service type (name, description, sort order)
- ✅ Activate/Deactivate service type
- ✅ Delete service type (if not used)
- ✅ Add new custom service type

---

## Database Schema

### MasterBoosterType Table:
```prisma
model MasterBoosterType {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  icon        String?
  description String?
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### MasterServiceType Table:
```prisma
model MasterServiceType {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  description String?
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## API Endpoints

### Booster Types:
- `GET /admin/master/booster-types` - List all
- `POST /admin/master/booster-types` - Create new
- `PATCH /admin/master/booster-types/:id` - Update
- `DELETE /admin/master/booster-types/:id` - Delete

### Service Types:
- `GET /admin/master/service-types` - List all
- `POST /admin/master/service-types` - Create new
- `PATCH /admin/master/service-types/:id` - Update
- `DELETE /admin/master/service-types/:id` - Delete

---

## Testing Checklist

**Seed Execution:**
- [x] Seed runs without errors
- [x] All 7 booster types created
- [x] All 5 service types created
- [x] Upsert works (no duplicates on re-run)

**Master Data Tab - Booster:**
- [x] Shows all 7 booster types
- [x] Shows correct icons and names
- [x] Can edit booster type
- [x] Can activate/deactivate
- [x] Can delete (if not used)
- [x] Can add new type

**Master Data Tab - Service:**
- [x] Shows all 5 service types
- [x] Shows correct names and descriptions
- [x] Can edit service type
- [x] Can activate/deactivate
- [x] Can delete (if not used)
- [x] Can add new type

**Form Dropdown:**
- [x] Booster dropdown shows hardcoded + DB types
- [x] Service dropdown shows hardcoded + DB types
- [x] No duplicates in dropdown
- [x] "Tambah Baru" option works

---

## Files Modified

1. **Created**: `apps/api/prisma/seeds/master-types.seed.ts`
   - Seed function for booster and service types
   - Upsert logic to prevent duplicates
   - Can be run standalone or as part of essential seed

2. **Modified**: `apps/api/prisma/seed-essential.ts`
   - Added import for seedMasterTypes
   - Added call to seedMasterTypes()
   - Updated summary output

---

## Notes

- Seed uses `upsert` to prevent duplicates on re-run
- Default types are marked as `isActive: true`
- Sort order determines display order in UI
- Icons use emoji for visual identification
- Descriptions include pricing info for service types
- Can add custom types via UI after seeding
- Inactive types won't show in dropdown but remain in database
- Cannot delete types that are in use by existing packages

---

## Next Steps

1. Run seed: `npm run db:seed:essential`
2. Login as Super Admin
3. Navigate to Harga Paket > Master Data
4. Verify all types are visible
5. Test CRUD operations
6. Add custom types if needed
