# Packages Services - Modular Architecture

## Overview

The packages module has been refactored into a modular architecture for better maintainability and separation of concerns.

## Structure

```
packages/
├── packages.service.ts          # Main orchestrator service
├── packages.schema.ts            # Zod schemas and types
├── packages.controller.ts        # HTTP controllers
├── packages.routes.ts            # Route definitions
└── services/                     # Modular services
    ├── package-assignment.service.ts      # Package assignment logic
    ├── payment-verification.service.ts    # Payment verification logic
    ├── invoice-generation.service.ts      # Invoice generation logic
    ├── package-retrieval.service.ts       # Package data retrieval
    ├── package-pricing.service.ts         # Pricing management
    └── README.md                          # This file
```

## Services

### 1. PackageAssignmentService
**File:** `package-assignment.service.ts`

**Responsibilities:**
- Assign packages to members
- Calculate pricing and discounts
- Generate package codes and product codes
- Handle purchase grouping
- Create packages and add-ons in transactions
- Update member voucher counts

**Key Methods:**
- `assignPackage()` - Main entry point for package assignment
- `generatePackageCode()` - Generate unique package codes
- `generateProductCode()` - Generate product codes based on package type
- `calculatePackagePricing()` - Calculate total pricing with discounts
- `determinePurchaseGroup()` - Decide if packages should be grouped
- `getNextSequences()` - Get next sequence numbers for codes
- `createPackagesTransaction()` - Create packages in database transaction

### 2. PaymentVerificationService
**File:** `payment-verification.service.ts`

**Responsibilities:**
- Verify payments for packages and add-ons
- Handle single and group payment verification
- Update payment status and proof
- Generate invoices after payment
- Send notifications to members

**Key Methods:**
- `verifyPayment()` - Main entry point for payment verification
- `verifyAddOnPayment()` - Verify add-on payment
- `verifyGroupPayment()` - Verify payment for grouped purchases
- `verifySinglePackagePayment()` - Verify single package payment

### 3. InvoiceGenerationService
**File:** `invoice-generation.service.ts`

**Responsibilities:**
- Generate invoices from packages
- Calculate invoice totals
- Create invoice items with proper descriptions
- Generate invoice numbers

**Key Methods:**
- `generateInvoiceForPackages()` - Generate invoice for packages
- `generateInvoiceNumber()` - Generate unique invoice number

### 4. PackageRetrievalService
**File:** `package-retrieval.service.ts`

**Responsibilities:**
- Fetch member packages
- Group packages by purchase group
- Format package and add-on data
- Include user information

**Key Methods:**
- `getMemberPackages()` - Get all packages for a member
- `formatPackageData()` - Format package data for response
- `formatAddOnData()` - Format add-on data for response

### 5. PackagePricingService
**File:** `package-pricing.service.ts`

**Responsibilities:**
- Manage package pricing
- CRUD operations for pricing
- Handle branch-specific and global pricing

**Key Methods:**
- `getPackagePricings()` - Get pricings for a branch
- `getAllPackagePricings()` - Get all pricings (super admin)
- `createPackagePricing()` - Create new pricing
- `updatePackagePricing()` - Update existing pricing
- `deletePackagePricing()` - Delete pricing

## Main Service (Orchestrator)

**File:** `packages.service.ts`

The main `PackagesService` class acts as an orchestrator that delegates to specialized services:

```typescript
export class PackagesService {
  private assignmentService: PackageAssignmentService;
  private verificationService: PaymentVerificationService;
  private retrievalService: PackageRetrievalService;
  private pricingService: PackagePricingService;

  // Delegates to specialized services
  async assignPackage(...) {
    return await this.assignmentService.assignPackage(...);
  }
  
  async verifyPayment(...) {
    return await this.verificationService.verifyPayment(...);
  }
  
  // ... other methods
}
```

## Benefits of Modular Architecture

### 1. **Separation of Concerns**
Each service has a single, well-defined responsibility.

### 2. **Easier Testing**
Services can be tested independently with mocked dependencies.

### 3. **Better Maintainability**
Smaller files are easier to understand and modify.

### 4. **Reusability**
Services can be reused in different contexts.

### 5. **Scalability**
Easy to add new features without affecting existing code.

## Migration Guide

### Before (Monolithic)
```typescript
// packages.service.ts (1160 lines)
export class PackagesService {
  async assignPackage() { /* 400+ lines */ }
  async verifyPayment() { /* 200+ lines */ }
  async getMemberPackages() { /* 150+ lines */ }
  // ... many more methods
}
```

### After (Modular)
```typescript
// packages.service.ts (100 lines)
export class PackagesService {
  private assignmentService: PackageAssignmentService;
  private verificationService: PaymentVerificationService;
  
  async assignPackage(...) {
    return await this.assignmentService.assignPackage(...);
  }
}

// services/package-assignment.service.ts (400 lines)
export class PackageAssignmentService {
  async assignPackage() { /* focused logic */ }
}

// services/payment-verification.service.ts (250 lines)
export class PaymentVerificationService {
  async verifyPayment() { /* focused logic */ }
}
```

## Usage Example

```typescript
import { PackagesService } from './packages.service';

const packagesService = new PackagesService();

// Assign package
const result = await packagesService.assignPackage(
  memberId,
  assignData,
  branchId,
  userId
);

// Verify payment
await packagesService.verifyPayment(
  packageId,
  verifyData,
  userId
);

// Get member packages
const packages = await packagesService.getMemberPackages(
  memberId,
  branchId
);
```

## Testing

Each service can be tested independently:

```typescript
import { PackageAssignmentService } from './services/package-assignment.service';

describe('PackageAssignmentService', () => {
  let service: PackageAssignmentService;
  
  beforeEach(() => {
    service = new PackageAssignmentService();
  });
  
  it('should generate correct package code', () => {
    const code = service.generatePackageCode('JKT', 'BASIC', 1);
    expect(code).toMatch(/PKG-JKT-BSC-\d{4}-0001/);
  });
});
```

## Future Improvements

1. **Add Unit Tests** - Test each service independently
2. **Add Integration Tests** - Test service interactions
3. **Add Caching** - Cache pricing data
4. **Add Events** - Emit events for package lifecycle
5. **Add Validation** - More robust input validation
6. **Add Logging** - Better logging and monitoring

## Related Modules

This modular pattern is also used in:
- `sessions/` - Session management (already modular)
- `members/` - Member management (to be modularized)
- `invoices/` - Invoice management (to be modularized)
- `inventory/` - Inventory management (to be modularized)
