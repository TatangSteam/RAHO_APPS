# Database Seeding System

## Overview

The seed system is separated into two distinct seed files for different purposes:

1. **Essential Seed** (`seed-essential.ts`) - Production-safe data
2. **Testing Seed** (`seed-testing.ts`) - Dummy data for development/testing

Both seeds use modular functions from the `seeds/` directory for maintainability and reusability.

## Structure

```
prisma/
├── seed.ts                  # Complete seed (calls both essential + testing)
├── seed-essential.ts        # Essential system data (PRODUCTION-SAFE)
├── seed-testing.ts          # Testing/dummy data (DEVELOPMENT ONLY)
└── seeds/
    ├── index.ts                              # Export all seed functions
    ├── branches.seed.ts                      # Branch seeding
    ├── users.seed.ts                         # User & staff seeding
    ├── products.seed.ts                      # Products seeding
    ├── packages.seed.ts                      # Package pricing seeding
    ├── referrals.seed.ts                     # Referral codes seeding
    ├── members-multibranch.seed.ts           # Test members with packages
    ├── inventory-items-consolidated.seed.ts  # Consolidated inventory
    └── ... (other seed modules)
```

## Seed Types

### 1. Essential Seed (Production-Safe) ✅

**File:** `seed-essential.ts`

**Purpose:** Seeds ONLY master data required for system operation

**Includes:**
- ✅ Super Admin user (first admin account for system access)
- ✅ Master products (medical supplies catalog - ~50 products)
- ✅ Consolidated inventory items (40 medical supplies)

**Does NOT include:**
- ❌ Branches (will be created by admin in production)
- ❌ Admin Manager users (will be created by super admin in production)
- ❌ Referral codes (will be created by admin in production)
- ❌ Package pricing (will be configured per branch in production)

**Safe for:** Production, Staging, Development

**Run with:**
```bash
npm run db:seed:essential
```

**Use case:** Fresh production deployment where you need the master product catalog and initial Super Admin account

---

### 2. Testing Seed (Development Only) ⚠️

**File:** `seed-testing.ts`

**Purpose:** Seeds dummy data for testing and development

**Includes:**
- ⚠️ 3 branches (Jakarta, Bandung, Surabaya)
- ⚠️ 1 admin manager user (ADMIN_MANAGER)
- ⚠️ 12 branch staff users (4 per branch)
- ⚠️ 3 referral codes
- ⚠️ Package pricing for all branches
- ⚠️ 28 test members with packages
- ⚠️ Invoices for all packages
- ⚠️ Audit log entries

**Safe for:** Development, Testing ONLY

**Prerequisites:** Essential seed must be run first (provides Super Admin)

**Run with:**
```bash
npm run db:seed:testing
```

**Admin Accounts:**
- `superadmin@raho.id` → `Sup3r4dM1n@123` [SUPER_ADMIN] *(from essential seed)*
- `manager@raho.id` → `Manager@123` [ADMIN_MANAGER] *(from testing seed)*

**Test Accounts Created:**
- Jakarta: `admincabang.jakarta@raho.id`, `dokter.jakarta@raho.id`, etc.
- Bandung: `admincabang.bandung@raho.id`, `dokter.bandung@raho.id`, etc.
- Surabaya: `admincabang.surabaya@raho.id`, `dokter.surabaya@raho.id`, etc.
- Members: `budi.santoso@example.com` → `member123`

---

### 3. Complete Seed (Both)

**File:** `seed.ts`

**Purpose:** Runs both essential and testing seeds

**Run with:**
```bash
npm run db:seed
```

This is equivalent to running:
```bash
npm run db:seed:essential
npm run db:seed:testing
```

## Benefits

### Separation of Concerns
- ✅ Production data separated from test data
- ✅ Safe to run essential seed in production
- ✅ Clear distinction between required and optional data
- ✅ Prevents accidental test data in production

### Modularity
- ✅ ~100-200 lines per module
- ✅ Easy to maintain
- ✅ Easy to test individual modules
- ✅ Reusable functions
- ✅ Can seed specific domains only

## Usage

### Quick Start

#### For Production/Staging
```bash
# Reset database and seed essential data only
npm run db:reset
npm run db:seed:essential
```

#### For Development
```bash
# Reset database and seed all data (essential + testing)
npm run db:reset
npm run db:seed
```

#### For Testing Environment
```bash
# Seed essential first, then testing
npm run db:seed:essential
npm run db:seed:testing
```

### Full Seed (All Data)

```bash
# Using npm script (runs both essential + testing)
npm run db:seed

# Or directly
npx tsx prisma/seed.ts
```

### Essential Seed Only

```bash
# Using npm script
npm run db:seed:essential

# Or directly
npx tsx prisma/seed-essential.ts
```

### Testing Seed Only

```bash
# Using npm script (requires essential seed first)
npm run db:seed:testing

# Or directly
npx tsx prisma/seed-testing.ts
```

### Partial Seed (Specific Modules)

You can import and use specific seed functions:

```typescript
import { PrismaClient } from '@prisma/client';
import { seedBranches, seedUsers } from './seeds';

const prisma = new PrismaClient();

async function seedOnlyBranchesAndUsers() {
  const { branchPusat } = await seedBranches(prisma);
  await seedUsers(prisma, branchPusat.id, branchBandung.id, branchSurabaya.id);
}
```

## Modules

### Core Seed Modules

#### 1. branches.seed.ts

Seeds branch data (clinics/locations).

**Returns:**
- `branchPusat`: Main branch object (Jakarta)
- `branchBandung`: Bandung branch object
- `branchSurabaya`: Surabaya branch object

**Example:**
```typescript
const { branchPusat, branchBandung, branchSurabaya } = await seedBranches(prisma);
```

#### 2. users.seed.ts

Seeds staff users (super admin, admin, doctor, nurse, etc.).

**Parameters:**
- `prisma`: PrismaClient instance
- `branchPusatId`: ID of main branch
- `branchBandungId`: ID of Bandung branch
- `branchSurabayaId`: ID of Surabaya branch

**Returns:**
- `superAdminUser`: Super admin user object
- `managerUser`: Admin manager user object
- `allUsers`: Array of all created users (including branch staff)

**Example:**
```typescript
const { superAdminUser, allUsers } = await seedUsers(
  prisma, 
  branchPusat.id, 
  branchBandung.id, 
  branchSurabaya.id
);
```

#### 3. products.seed.ts

Seeds master products catalog.

**Returns:**
- Array of created products

**Example:**
```typescript
const products = await seedProducts(prisma);
```

#### 4. packages.seed.ts

Seeds package pricing for all branches.

**Parameters:**
- `prisma`: PrismaClient instance
- `branches`: Array of branch objects with id and name

**Example:**
```typescript
await seedPackagePricing(prisma, [branchPusat, branchBandung, branchSurabaya]);
```

#### 5. referrals.seed.ts

Seeds referral codes.

**Example:**
```typescript
await seedReferralCodes(prisma);
```

#### 6. inventory-items-consolidated.seed.ts

Seeds consolidated inventory items (40 medical supplies).

**Example:**
```typescript
await seedConsolidatedInventoryItems(prisma);
```

### Testing Seed Modules

#### 7. members-multibranch.seed.ts

Seeds test members with packages across all branches.

**Parameters:**
- `prisma`: PrismaClient instance
- `branches`: Array of branch objects
- `allUsers`: Array of user objects (for assignment)

**Example:**
```typescript
await seedMembersMultiBranch(prisma, [branchPusat, branchBandung, branchSurabaya], allUsers);
```

## Deployment Scenarios

### Scenario 1: Fresh Production Deployment

```bash
# 1. Run migrations
npm run db:migrate:prod

# 2. Seed essential data (master products + Super Admin)
npm run db:seed:essential

# 3. Configure via admin panel
# - Login as superadmin@raho.id (password: Sup3r4dM1n@123)
# - Create your first branch
# - Create Admin Manager users
# - Configure package pricing per branch
# - Create referral codes
# - Adjust inventory stock levels
```

### Scenario 2: Development Environment Setup

```bash
# 1. Reset database
npm run db:reset

# 2. Seed all data (essential + testing)
npm run db:seed

# 3. Start development
npm run dev
```

### Scenario 3: Staging Environment

```bash
# 1. Run migrations
npm run db:migrate:prod

# 2. Seed essential data
npm run db:seed:essential

# 3. Optionally add testing data
npm run db:seed:testing

# 4. Test with realistic data
```

### Scenario 4: CI/CD Testing

```bash
# In your CI pipeline
npm run db:migrate:prod
npm run db:seed:essential
npm run db:seed:testing
npm run test
```

## Data Summary

### Essential Seed Creates:
- 1 Super Admin user (superadmin@raho.id)
- ~50 master products (medical supplies catalog)
- 40 consolidated medical supplies (inventory items template)

### Testing Seed Creates:
- 3 branches (Jakarta, Bandung, Surabaya)
- 1 admin manager user (ADMIN_MANAGER)
- 12 branch staff users (4 per branch)
- 3 referral codes
- Package pricings (BASIC + BOOSTER) for all branches
- 28 test members with packages
- Invoices for all packages
- Audit log entries for all operations

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

3. Use in appropriate seed file:

**For essential data:**
```typescript
// seed-essential.ts
import { seedNewModule } from './seeds';

async function main() {
  // ... other seeds
  await seedNewModule(prisma, params);
}
```

**For testing data:**
```typescript
// seed-testing.ts
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

## Best Practices

### 1. Separation of Concerns
- ✅ Keep essential data in `seed-essential.ts`
- ✅ Keep test data in `seed-testing.ts`
- ✅ Never mix production and test data

### 2. Module Design
- ✅ Keep modules focused on one domain
- ✅ Use upsert to prevent duplicate data
- ✅ Return created data for other modules to use
- ✅ Log progress with console.log
- ✅ Handle errors with try-catch blocks

### 3. Documentation
- ✅ Add JSDoc comments to functions
- ✅ Document parameters and return values
- ✅ Include usage examples

### 4. Testing
- ✅ Test each module independently
- ✅ Verify data integrity after seeding
- ✅ Check foreign key relationships

### 5. Production Safety
- ✅ Always run essential seed first
- ✅ Never run testing seed in production
- ✅ Use environment checks if needed:

```typescript
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Testing seed cannot run in production!');
  process.exit(1);
}
```

## Troubleshooting

### Error: Essential data not found

**Problem:** Running testing seed before essential seed

**Solution:**
```bash
npm run db:seed:essential
npm run db:seed:testing
```

### Error: Module not found

**Problem:** Running from wrong directory

**Solution:**
```bash
cd apps/api
npm run db:seed
```

### Error: Unique constraint violation

**Problem:** Duplicate data on multiple runs

**Solution:** The seed uses upsert, but if you still get this error:
1. Check unique fields in your schema
2. Ensure upsert `where` clause matches unique constraint
3. Consider using `findUnique` + `create` instead

### Error: Foreign key constraint

**Problem:** Seeding in wrong order

**Solution:** Ensure correct order:
1. Branches (no dependencies)
2. Users (depends on branches)
3. Products (no dependencies)
4. Inventory (depends on products + branches)
5. Packages (depends on branches)
6. Members (depends on users + branches)

### Error: Staff users already exist

**Problem:** Running testing seed multiple times

**Solution:** This is expected behavior. The seed checks for existing staff and skips creation if they exist.

## Migration Guide

### From Old Monolithic Seed

If you have an old monolithic seed file:

1. **Backup old seed:**
   ```bash
   cp prisma/seed.ts prisma/seed.old.ts
   ```

2. **Use new separated seeds:**
   ```bash
   npm run db:seed:essential
   npm run db:seed:testing
   ```

3. **Verify:**
   - Check all data is seeded correctly
   - Test login with seed accounts
   - Verify inventory items
   - Check package pricings

4. **Remove old backup:**
   ```bash
   rm prisma/seed.old.ts
   ```

## Future Enhancements

Potential improvements:

1. **Environment-Specific Seeds**: Different seed profiles (minimal, full, demo)
2. **Faker Integration**: Use faker.js for realistic test data
3. **Seed Validation**: Verify data integrity after seeding
4. **Incremental Seeding**: Add data without full reset
5. **Seed Rollback**: Undo specific seed operations
6. **Performance Optimization**: Batch inserts for large datasets
7. **Seed Analytics**: Track what data was seeded and when

## Command Reference

| Command | Description | Safe for Production? |
|---------|-------------|---------------------|
| `npm run db:seed` | Run complete seed (essential + testing) | ❌ No |
| `npm run db:seed:essential` | Run essential seed only | ✅ Yes |
| `npm run db:seed:testing` | Run testing seed only | ❌ No |
| `npm run db:reset` | Reset database and run complete seed | ❌ No |
| `npm run db:migrate:prod` | Run migrations (production) | ✅ Yes |

## Account Reference

### Essential Seed Accounts

| Email | Password | Role | Access |
|-------|----------|------|--------|
| superadmin@raho.id | Sup3r4dM1n@123 | SUPER_ADMIN | All branches, all features, impersonation |

### Testing Seed Accounts

#### Admin Manager
| Email | Password | Role | Access |
|-------|----------|------|--------|
| manager@raho.id | Manager@123 | ADMIN_MANAGER | All branches, management features |

#### Jakarta Branch
| Email | Password | Role |
|-------|----------|------|
| admincabang.jakarta@raho.id | AdminCabang@123 | ADMIN_CABANG |
| adminlayanan.jakarta@raho.id | AdminLayanan@123 | ADMIN_LAYANAN |
| dokter.jakarta@raho.id | Dokter@123 | DOCTOR |
| nakes.jakarta@raho.id | Nakes@123 | NURSE |

#### Bandung Branch
| Email | Password | Role |
|-------|----------|------|
| admincabang.bandung@raho.id | AdminCabang@123 | ADMIN_CABANG |
| adminlayanan.bandung@raho.id | AdminLayanan@123 | ADMIN_LAYANAN |
| dokter.bandung@raho.id | Dokter@123 | DOCTOR |
| nakes.bandung@raho.id | Nakes@123 | NURSE |

#### Surabaya Branch
| Email | Password | Role |
|-------|----------|------|
| admincabang.surabaya@raho.id | AdminCabang@123 | ADMIN_CABANG |
| adminlayanan.surabaya@raho.id | AdminLayanan@123 | ADMIN_LAYANAN |
| dokter.surabaya@raho.id | Dokter@123 | DOCTOR |
| nakes.surabaya@raho.id | Nakes@123 | NURSE |

#### Test Members
| Email | Password | Branch |
|-------|----------|--------|
| budi.santoso@example.com | member123 | Jakarta |
| siti.rahayu@example.com | member123 | Jakarta |
| ahmad.wijaya@example.com | member123 | Bandung |
| ... (more test members) | member123 | Various |

---

**Status**: ✅ READY
**Last Updated**: 2026-05-13
**Seed Types**: 2 (Essential + Testing)
**Modules**: 7+ seed modules
**Production Safe**: Essential seed only
**Maintainability**: Excellent
