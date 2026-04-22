# Members Services - Modular Architecture

## Overview

The members module has been refactored into a modular architecture for better maintainability and separation of concerns.

## Structure

```
members/
├── members.service.ts          # Main orchestrator service
├── members.schema.ts            # Zod schemas and types
├── members.controller.ts        # HTTP controllers
├── members.routes.ts            # Route definitions
└── services/                    # Modular services
    ├── member-retrieval.service.ts        # Member data retrieval
    ├── member-registration.service.ts     # Member registration
    ├── member-update.service.ts           # Member updates
    ├── member-branch-access.service.ts    # Branch access management
    ├── member-medical-records.service.ts  # Medical records
    └── README.md                          # This file
```

## Services

### 1. MemberRetrievalService
**File:** `member-retrieval.service.ts`

**Responsibilities:**
- Fetch members with filtering and pagination
- Get members by branch
- Lookup member by member number
- Get member by ID
- Format member data for response

**Key Methods:**
- `getMembers()` - Get members with filters
- `getMembersByBranch()` - Get members for specific branch
- `lookupMember()` - Find member by member number
- `getMemberById()` - Get member by ID
- `formatMemberData()` - Format member data

### 2. MemberRegistrationService
**File:** `member-registration.service.ts`

**Responsibilities:**
- Register new members
- Generate member numbers
- Create user accounts
- Generate random passwords
- Send welcome notifications

**Key Methods:**
- `createMember()` - Register new member
- `generateMemberNumber()` - Generate unique member number
- `generateRandomPassword()` - Generate random password
- `formatMemberData()` - Format member data

### 3. MemberUpdateService
**File:** `member-update.service.ts`

**Responsibilities:**
- Update member information
- Validate phone and email uniqueness
- Soft delete members
- Audit logging

**Key Methods:**
- `updateMember()` - Update member data
- `deleteMember()` - Soft delete member
- `formatMemberData()` - Format member data

### 4. MemberBranchAccessService
**File:** `member-branch-access.service.ts`

**Responsibilities:**
- Grant branch access to members
- Validate branch access
- Send access notifications
- Audit logging

**Key Methods:**
- `grantAccess()` - Grant branch access to member

### 5. MemberMedicalRecordsService
**File:** `member-medical-records.service.ts`

**Responsibilities:**
- Manage member diagnoses
- Manage therapy plans
- Manage infusions
- Send notifications

**Key Methods:**
- `sendNotification()` - Send notification to member
- `getMemberDiagnoses()` - Get member diagnoses
- `createMemberDiagnosis()` - Create diagnosis
- `getMemberTherapyPlans()` - Get therapy plans
- `createMemberTherapyPlan()` - Create therapy plan
- `getMemberInfusions()` - Get infusions

## Main Service (Orchestrator)

**File:** `members.service.ts`

The main `MembersService` class acts as an orchestrator that delegates to specialized services:

```typescript
export class MembersService {
  private retrievalService: MemberRetrievalService;
  private registrationService: MemberRegistrationService;
  private updateService: MemberUpdateService;
  private branchAccessService: MemberBranchAccessService;
  private medicalRecordsService: MemberMedicalRecordsService;

  // Delegates to specialized services
  async getMembers(...) {
    return await this.retrievalService.getMembers(...);
  }
  
  async createMember(...) {
    return await this.registrationService.createMember(...);
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
// members.service.ts (1049 lines)
export class MembersService {
  async getMembers() { /* 120+ lines */ }
  async createMember() { /* 150+ lines */ }
  async updateMember() { /* 60+ lines */ }
  // ... many more methods
}
```

### After (Modular)
```typescript
// members.service.ts (180 lines)
export class MembersService {
  private retrievalService: MemberRetrievalService;
  private registrationService: MemberRegistrationService;
  
  async getMembers(...) {
    return await this.retrievalService.getMembers(...);
  }
}

// services/member-retrieval.service.ts (280 lines)
export class MemberRetrievalService {
  async getMembers() { /* focused logic */ }
}

// services/member-registration.service.ts (200 lines)
export class MemberRegistrationService {
  async createMember() { /* focused logic */ }
}
```

## Usage Example

```typescript
import { MembersService } from './members.service';

const membersService = new MembersService();

// Get members
const result = await membersService.getMembers(
  branchId,
  role,
  filters
);

// Create member
const newMember = await membersService.createMember(
  memberData,
  branchId,
  userId
);

// Update member
await membersService.updateMember(
  memberId,
  updateData,
  userId
);
```

## Testing

Each service can be tested independently:

```typescript
import { MemberRegistrationService } from './services/member-registration.service';

describe('MemberRegistrationService', () => {
  let service: MemberRegistrationService;
  
  beforeEach(() => {
    service = new MemberRegistrationService();
  });
  
  it('should generate correct member number', async () => {
    const memberNo = await service.generateMemberNumber('JKT');
    expect(memberNo).toMatch(/MBR-JKT-\d{4}/);
  });
});
```

## Future Improvements

1. **Add Unit Tests** - Test each service independently
2. **Add Integration Tests** - Test service interactions
3. **Add Caching** - Cache member data
4. **Add Events** - Emit events for member lifecycle
5. **Add Validation** - More robust input validation
6. **Add Logging** - Better logging and monitoring

## Related Modules

This modular pattern is also used in:
- `packages/` - Package management (already modular)
- `sessions/` - Session management (already modular)
- `invoices/` - Invoice management (to be modularized)
- `inventory/` - Inventory management (to be modularized)
