# Modular Database Seeder

## Overview

The seed system has been refactored into modular functions for better maintainability, reusability, and testability.

## Structure

```
prisma/
├── seed.ts              # Original monolithic seed (800+ lines)
├── seed.new.ts          # New modular seed (orchestrator)
└── seeds/
    ├── index.ts         # Export all seed functions
    ├── branches.seed.ts # Branch seeding
    ├── users.seed.ts    # User & staff seeding
    ├── products.seed.ts # Products & inventory seeding
    ├── packages.seed.ts # Package pricing seeding
    └── referrals.seed.ts# Referral codes seeding
```

## Benefits

### Before (Monolithic)
- ❌ 800+ lines in single file
- ❌ Hard to maintain
- ❌ Hard to test individual sections
- ❌ Difficult to reuse functions
- ❌ No clear separation of concerns

### After (Modular)
- ✅ ~100 lines per module
- ✅ Easy to maintain
- ✅ Easy to test individual modules
- ✅ Reusable functions
- ✅ Clear separation of concerns
- ✅ Can seed specific domains only

## Usage

### Full Seed (All Modules)

```bash
# Using npm script
npm run db:seed

# Or directly
npx tsx prisma/seed.new.ts
```

### Partial Seed (Specific Modules)

You can import and use specific seed functions:

```typescript
import { PrismaClient } from '@prisma/client';
import { seedBranches, seedUsers } from './seeds';

const prisma = new PrismaClient();

async function seedOnlyBranchesAndUsers() {
  const { branchPusat } = await seedBranches(prisma);
  await seedUsers(prisma, branchPusat.id);
}
```

## Modules

### 1. branches.seed.ts

Seeds branch data (clinics/locations).

**Returns:**
- `branchPusat`: Main branch object
- `branchBandung`: Bandung branch object

**Example:**
```typescript
const { branchPusat, branchBandung } = await seedBranches(prisma);
```

### 2. users.seed.ts

Seeds staff users (super admin, admin, doctor, nurse, etc.).

**Parameters:**
- `prisma`: PrismaClient instance
- `branchPusatId`: ID of main branch

**Returns:**
- `superAdminUser`: Super admin user object
- `adminLayananUser`: Admin layanan user object
- `doctorUser`: Doctor user object
- `nurseUser`: Nurse user object
- `allUsers`: Array of all created users

**Example:**
```typescript
const { doctorUser, nurseUser } = await seedUsers(prisma, branchPusat.id);
```

### 3. products.seed.ts

Seeds master products and inventory items.

**Functions:**
- `seedProducts(prisma)`: Seeds master product catalog
- `seedInventory(prisma, products, branchId)`: Seeds inventory for a branch

**Returns:**
- `seedProducts`: Array of created products
- `seedInventory`: void

**Example:**
```typescript
const products = await seedProducts(prisma);
await seedInventory(prisma, products, branchPusat.id);
```

### 4. packages.seed.ts

Seeds package pricing for all branches.

**Parameters:**
- `prisma`: PrismaClient instance
- `branches`: Array of branch objects with id and name

**Example:**
```typescript
await seedPackagePricing(prisma, [branchPusat, branchBandung]);
```

### 5. referrals.seed.ts

Seeds referral codes.

**Example:**
```typescript
await seedReferralCodes(prisma);
```

## Adding New Seed Modules

1. Create new file in `seeds/` directory:

```typescript
// seeds/newmodule.seed.ts
import { PrismaClient } from '@prisma/client';

export async function seedNewModule(prisma: PrismaClient, ...params) {
  console.log('🆕 Seeding new module...');
  
  // Your seeding logic here
  
  console.log('✅ New module seeded');
  
  return { /* return created data */ };
}
```

2. Export from `seeds/index.ts`:

```typescript
export { seedNewModule } from './newmodule.seed';
```

3. Use in main seed file:

```typescript
import { seedNewModule } from './seeds';

async function main() {
  // ... other seeds
  await seedNewModule(prisma, params);
}
```

## Testing Individual Modules

You can test individual seed modules:

```typescript
// test-seed.ts
import { PrismaClient } from '@prisma/client';
import { seedProducts } from './seeds/products.seed';

const prisma = new PrismaClient();

async function testProductSeed() {
  const products = await seedProducts(prisma);
  console.log(`Created ${products.length} products`);
}

testProductSeed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## Migration from Old Seed

To migrate from old seed to new modular seed:

1. **Backup old seed:**
   ```bash
   cp prisma/seed.ts prisma/seed.old.ts
   ```

2. **Replace with new seed:**
   ```bash
   cp prisma/seed.new.ts prisma/seed.ts
   ```

3. **Test:**
   ```bash
   npm run db:reset
   ```

4. **Verify:**
   - Check all data is seeded correctly
   - Test login with seed accounts
   - Verify inventory items
   - Check package pricings

## Rollback

If you need to rollback to old seed:

```bash
cp prisma/seed.old.ts prisma/seed.ts
npm run db:reset
```

## Best Practices

1. **Keep modules focused**: Each module should handle one domain
2. **Use upsert**: Prevent duplicate data on multiple runs
3. **Return created data**: Allow other modules to use the data
4. **Log progress**: Use console.log for visibility
5. **Handle errors**: Wrap in try-catch blocks
6. **Document parameters**: Add JSDoc comments
7. **Test independently**: Test each module separately

## Future Enhancements

Potential improvements:

1. **Dashboard Data Seeder**: Separate module for dashboard test data
2. **Member Seeder**: Module for creating test members
3. **Session Seeder**: Module for creating test treatment sessions
4. **Audit Log Seeder**: Module for creating audit logs
5. **Configuration Seeder**: Module for system configurations
6. **Faker Integration**: Use faker.js for realistic test data
7. **Seed Profiles**: Different seed profiles (minimal, full, demo)

## Troubleshooting

### Error: Module not found

Make sure you're running from the correct directory:
```bash
cd apps/api
npm run db:seed
```

### Error: Unique constraint violation

The seed uses upsert, but if you get this error:
1. Check unique fields in your schema
2. Ensure upsert `where` clause matches unique constraint
3. Consider using `findUnique` + `create` instead

### Error: Foreign key constraint

Ensure you seed in the correct order:
1. Branches (no dependencies)
2. Users (depends on branches)
3. Products (no dependencies)
4. Inventory (depends on products + branches)
5. Packages (depends on branches)

---

**Status**: ✅ READY
**Date**: 2026-04-14
**Modules**: 5 seed modules
**Lines Reduced**: 800+ → ~100 per module
**Maintainability**: Excellent
