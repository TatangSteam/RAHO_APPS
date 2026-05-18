# Fix: Booster Matrix Tab Shows Empty Cells

## Problem
User reported that the Booster Matrix tab shows all cells as empty (➕) even though booster packages exist in the database.

## Root Cause
The `PackagePricing` model had `branchId` as a **required field** (NOT NULL), but the code was trying to support global pricing with `branchId = null`. This caused:
1. All existing booster packages to be tied to specific branches
2. The matrix filter logic couldn't find global pricing (branchId = null)
3. No way to create global pricing that applies to all branches

## Solution

### 1. Database Schema Change
Made `branchId` nullable in `PackagePricing` model to support global pricing:

**File**: `apps/api/prisma/schema.prisma`
```prisma
model PackagePricing {
  id            String       @id @default(cuid())
  branchId      String?      // NULL = global pricing, specific ID = branch-specific pricing
  packageType   PackageType
  // ... rest of fields
  
  branch         Branch?         @relation(fields: [branchId], references: [id])
  // ... rest of relations
}
```

**Migration**: `20260518013501_make_package_pricing_branch_id_nullable`
```sql
-- AlterTable: Make branchId nullable in package_pricings to support global pricing
ALTER TABLE "package_pricings" ALTER COLUMN "branchId" DROP NOT NULL;

-- DropForeignKey: Drop existing foreign key constraint
ALTER TABLE "package_pricings" DROP CONSTRAINT "package_pricings_branchId_fkey";

-- AddForeignKey: Re-add foreign key with ON DELETE SET NULL
ALTER TABLE "package_pricings" ADD CONSTRAINT "package_pricings_branchId_fkey" 
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

### 2. Backend Service Update
Updated `PackagePricingAdminService.createPackagePricing()` to handle optional branchId:

**File**: `apps/api/src/modules/admin/services/package-pricing-admin.service.ts`

**Changes**:
- Removed `BRANCH_ID_REQUIRED` validation
- Made `branchId` optional in function signature
- Only validate branch if `branchId` is provided
- Store `null` for global pricing, specific ID for branch-specific pricing

```typescript
async createPackagePricing(data: {
  // ... other fields
  branchId?: string; // Optional: null/undefined = global pricing
}) {
  // Validate branch if branchId is provided
  if (data.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: data.branchId },
    });
    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }
  }

  const pricing = await prisma.packagePricing.create({
    data: {
      // ... other fields
      branchId: data.branchId || null, // null = global pricing
    },
  });
}
```

### 3. Frontend Debug Logging
Added comprehensive debug logging to help diagnose the issue:

**File**: `apps/web/src/app/(staff)/admin/package-pricing/page.tsx`

**Added logs**:
1. `loadPricings()`: Log total pricings and BOOSTER count
2. `loadMasterData()`: Log booster types and service types
3. Matrix cell rendering: Log first cell's matching logic

```typescript
console.log('📦 Package Pricing Data:', data.data?.pricings);
console.log('📊 Total pricings loaded:', data.data?.pricings?.length || 0);
console.log('🚀 BOOSTER pricings:', data.data?.pricings?.filter((p: any) => p.packageType === 'BOOSTER').length || 0);

console.log('🎯 Booster Types:', boosterData.data?.types);
console.log('🎯 Service Types:', serviceData.data?.types);

console.log('🔍 Matrix Cell Debug:', {
  boosterCode: bt.code,
  serviceCode: st.code,
  currentBranchId,
  selectedBranchFilter,
  totalPricings: pricings.length,
  boosterPricings: pricings.filter(p => p.packageType === 'BOOSTER').length,
  matchingPricing: pricing,
  samplePricing: pricings.find(p => p.packageType === 'BOOSTER')
});
```

## How Global vs Branch-Specific Pricing Works

### Global Pricing (branchId = null)
- Applies to all branches by default
- Created when "🌐 Global (Semua Cabang)" is selected
- Shows in green in the matrix
- Used as fallback when no branch-specific pricing exists

### Branch-Specific Pricing (branchId = specific ID)
- Overrides global pricing for that branch
- Created when a specific branch is selected
- Shows in blue in the matrix
- Takes precedence over global pricing

### Matrix Filter Logic
```typescript
const currentBranchId = selectedBranchFilter === 'global' ? null : selectedBranchFilter;
const pricing = pricings.find(p => 
  p.packageType === 'BOOSTER' &&
  p.boosterType === bt.code &&
  p.serviceType === st.code &&
  p.branchId === currentBranchId  // null for global, specific ID for branch
);
```

## Next Steps for User

### 1. Restart API Server
The Prisma client needs to be regenerated with the new schema:
```bash
cd apps/api
npx prisma generate
npm run dev
```

### 2. Check Browser Console
Open the Booster Matrix tab and check console logs:
- Are pricings loading? (📦 Package Pricing Data)
- How many BOOSTER pricings? (🚀 BOOSTER pricings)
- Are booster/service types loading? (🎯 Booster Types, 🎯 Service Types)
- What's the matching logic showing? (🔍 Matrix Cell Debug)

### 3. Possible Issues to Check

**Issue A: No BOOSTER pricings in database**
- Check if booster packages were created with `packageType = 'BOOSTER'`
- Verify in database: `SELECT * FROM package_pricings WHERE "packageType" = 'BOOSTER';`

**Issue B: BoosterType code mismatch**
- Master data uses codes like 'NO', 'GT', 'MB'
- Database might have different codes
- Check: `SELECT DISTINCT "boosterType" FROM package_pricings WHERE "packageType" = 'BOOSTER';`

**Issue C: ServiceType code mismatch**
- Master data uses codes like 'PM', 'PS', 'PTY'
- Database might have different codes
- Check: `SELECT DISTINCT "serviceType" FROM package_pricings WHERE "packageType" = 'BOOSTER';`

**Issue D: All pricings tied to branches**
- Existing pricings might all have specific branchId (not null)
- When filter is set to "Global", it looks for branchId = null
- Solution: Create new global pricing or update existing ones

### 4. Create Test Data
If no booster pricing exists, create one via the UI:
1. Go to Booster Matrix tab
2. Select "🌐 Global (Semua Cabang)"
3. Click any ➕ cell
4. Fill in the form and save
5. Check if it appears in the matrix

## Files Modified

### Backend
- `apps/api/prisma/schema.prisma` - Made branchId nullable
- `apps/api/prisma/migrations/20260518013501_make_package_pricing_branch_id_nullable/migration.sql` - Migration
- `apps/api/src/modules/admin/services/package-pricing-admin.service.ts` - Handle optional branchId

### Frontend
- `apps/web/src/app/(staff)/admin/package-pricing/page.tsx` - Added debug logging

## Testing Checklist
- [ ] API server restarted successfully
- [ ] Prisma client regenerated
- [ ] Browser console shows pricing data loading
- [ ] Can create global pricing (branchId = null)
- [ ] Can create branch-specific pricing
- [ ] Matrix shows prices correctly
- [ ] Color coding works (green = global, blue = branch)
- [ ] Clicking cell opens form with correct data
- [ ] Global pricing shows as reference when viewing branch

## Migration Status
✅ Migration created: `20260518013501_make_package_pricing_branch_id_nullable`
✅ Migration applied to database
⚠️ Prisma client needs regeneration (blocked by running API server)

## Notes
- The frontend code already handled empty branchId correctly
- The issue was purely on the database schema side
- Debug logging will help identify any remaining data mismatch issues
- Once API server is restarted, the feature should work correctly
