/**
 * Modular Seed Index
 * 
 * This file exports all seed functions for easy importing
 * 
 * IMPORTANT: seedMaterials is DEPRECATED and should NOT be used!
 * Use seedProducts + seedConsolidatedInventoryItems instead.
 * These follow the official "List Barang RAHO" exactly.
 */

export { seedBranches, assignBranchesToManager } from './branches.seed';
export { seedUsers, assignStaffToBranches, assignManagerToBranches } from './users.seed';
export { seedProducts } from './products.seed';
export { seedPackagePricing } from './packages.seed';
export { seedNonTherapyProducts } from './non-therapy-products.seed';
export { seedReferralCodes } from './referrals.seed';
export { seedMembersMultiBranch } from './members-multibranch.seed';
export { seedInventoryItems } from './inventory-items.seed';
export { seedOfficialInventoryItems } from './inventory-items-official.seed';
export { seedConsolidatedInventoryItems } from './inventory-items-consolidated.seed';
export { seedInfusionMaterialUsage } from './infusion-material-usage.seed';
// DEPRECATED: seedMaterials creates products with wrong names (e.g., "EDTA 100ml", "GASO 100ml")
// Use seedProducts + seedConsolidatedInventoryItems instead which follow List Barang RAHO exactly
// export { seedMaterials } from './materials.seed';
export { cleanupOrphanProducts } from './cleanup-orphan-products.seed';
