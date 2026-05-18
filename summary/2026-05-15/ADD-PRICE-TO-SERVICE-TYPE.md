# Add Price Field to Service Type Master Data

**Date:** May 15, 2026  
**Status:** ✅ Completed  
**Task:** Add price field to service type form in Master Data tab

---

## Summary

Successfully added a price field to the `MasterServiceType` model, allowing users to set default prices when creating or editing service types in the Master Data tab.

---

## Changes Made

### 1. Database Schema Update

**File:** `apps/api/prisma/schema.prisma`

Added `price` field to `MasterServiceType` model:
```prisma
model MasterServiceType {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String
  description String?
  price       Decimal? @db.Decimal(12, 2)  // ← NEW FIELD
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([isActive])
  @@index([sortOrder])
  @@map("master_service_types")
}
```

**Migration:** `20260515101902_add_price_to_master_service_type`

---

### 2. Seed Data Update

**File:** `apps/api/prisma/seeds/master-types.seed.ts`

Updated service types seed data to include prices:

| Code | Name | Price | Description |
|------|------|-------|-------------|
| PM | Premiere | Rp 1.000.000 | Premiere service |
| PS | Partnership | Rp 650.000 | Partnership service |
| PTY | Partnership Attiya | Rp 600.000 | Partnership Attiya service |
| PDA | Partnership Dr. Abhi | Rp 65.000 | Partnership Dr. Abhi service (per ml) |
| PHC | Partnership Homecare | Rp 750.000 | Partnership Homecare service |

---

### 3. Backend Service Update

**File:** `apps/api/src/modules/admin/services/master-types-admin.service.ts`

Updated methods to handle price field:

- `getAllServiceTypes()` - Returns price in response
- `createServiceType()` - Accepts price parameter
- `updateServiceType()` - Accepts price parameter

---

### 4. Frontend Updates

**File:** `apps/web/src/app/(staff)/admin/package-pricing/page.tsx`

#### Interface Update
```typescript
interface MasterServiceType {
  id: string;
  code: string;
  name: string;
  description?: string;
  price?: number;  // ← NEW FIELD
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```

#### Form State Update
```typescript
const [masterFormData, setMasterFormData] = useState({
  code: '',
  name: '',
  icon: '',
  description: '',
  price: 0,  // ← NEW FIELD
  sortOrder: 0,
  isActive: true
});
```

#### Form UI - Added Price Input Field
- Only visible when `masterTab === 'service'` (not for booster types)
- Number input with step of 10,000
- Shows formatted preview using `formatCurrency()`
- Labeled as "Harga (Opsional)"

#### Display Update - Service Type Cards
- Shows price in green badge if set
- Format: "Harga Default: Rp X.XXX.XXX"
- Uses green background (`rgba(34, 197, 94, 0.1)`)

---

## Testing

### Verification Steps

1. ✅ Migration applied successfully
2. ✅ Seed data populated with prices
3. ✅ Database verification shows all 5 service types have prices

### Manual Testing Required

1. Open `/admin/package-pricing` page
2. Go to "Master Data" tab
3. Select "Tipe Layanan" sub-tab
4. Verify existing service types show prices
5. Click "Tambah Tipe Layanan"
6. Verify price field appears in form
7. Create new service type with price
8. Edit existing service type and update price
9. Verify price displays correctly in card

---

## Files Modified

### Backend
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seeds/master-types.seed.ts`
- `apps/api/src/modules/admin/services/master-types-admin.service.ts`

### Frontend
- `apps/web/src/app/(staff)/admin/package-pricing/page.tsx`

### Migration
- `apps/api/prisma/migrations/20260515101902_add_price_to_master_service_type/migration.sql`

---

## Notes

- Price field is **optional** (nullable in database)
- Price is stored as `Decimal(12, 2)` for precision
- Frontend displays price with `formatCurrency()` helper
- Price field only appears for service types, not booster types
- Existing service types were updated with default prices via seed
- Backend API accepts and returns price in all CRUD operations

---

## Next Steps

- ✅ Migration applied
- ✅ Seed data updated
- ✅ Backend service updated
- ✅ Frontend form updated
- ✅ Frontend display updated
- ⏳ Manual testing by user
- ⏳ Verify price field works in production

---

## Related User Query

> "di tambah tipe layanan tolong bisa set harganya"

**Translation:** "When adding service type, please allow setting the price"

**Status:** ✅ Resolved
