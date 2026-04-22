# Sessions Services - Modular Architecture

## Overview
This directory contains modular services that handle different aspects of treatment sessions. Each service is responsible for a specific domain, making the codebase more maintainable and testable.

## Services

### 1. SessionCreationService ✅
**File**: `session-creation.service.ts`
**Responsibility**: Handle session creation with all validations

**Methods**:
- `createSession(data, branchId, userId)` - Create new treatment session

**Features**:
- Validates member access to branch
- Validates member package status and remaining sessions
- Validates doctor and nurse
- Validates diagnosis exists
- Validates therapy plan
- Validates booster package (if provided)
- Calculates global and branch-specific infusKe
- Creates encounter if needed
- Updates package usage and voucher count

### 2. SessionRetrievalService ✅
**File**: `session-retrieval.service.ts`
**Responsibility**: Handle session data retrieval and formatting

**Methods**:
- `getSessionById(sessionId)` - Get session with all details
- `getAllSessions(params)` - Get sessions with filters and pagination

**Features**:
- Includes all relations (encounter, member, staff, diagnosis, etc.)
- Calculates branch-specific infusKe
- Calculates step completion status
- Formats data for API response

### 3. DiagnosisService ✅
**File**: `diagnosis.service.ts`
**Responsibility**: Handle diagnosis creation and retrieval

**Methods**:
- `createDiagnosis(encounterId, data, userId)` - Create new diagnosis
- `getDiagnosisByEncounter(encounterId)` - Get diagnosis by encounter

### 4. TherapyPlanService ✅
**File**: `therapy-plan.service.ts`
**Responsibility**: Handle therapy plan creation and retrieval

**Methods**:
- `createTherapyPlan(sessionId, data, userId)` - Create therapy plan
- `getTherapyPlan(sessionId)` - Get therapy plan for session

### 5. VitalSignsService ✅
**File**: `vital-signs.service.ts`
**Responsibility**: Handle vital signs recording

**Methods**:
- `upsertVitalSign(sessionId, data, userId)` - Create or update vital sign
- `getVitalSigns(sessionId)` - Get all vital signs for a session

**Features**:
- Upsert pattern (create or update based on unique constraint)
- Supports SEBELUM and SESUDAH timing

### 6. InfusionService ✅
**File**: `infusion.service.ts`
**Responsibility**: Handle infusion execution

**Methods**:
- `createInfusion(sessionId, data, userId, branchId)` - Create infusion record
- `getInfusion(sessionId)` - Get infusion for session

### 7. MaterialUsageService ✅
**File**: `material-usage.service.ts`
**Responsibility**: Handle material/inventory usage

**Methods**:
- `createMaterialUsage(sessionId, data, userId, branchId)` - Record material usage
- `getMaterialUsages(sessionId)` - Get all materials used in session

**Features**:
- Validates inventory availability
- Updates inventory stock
- Tracks material usage per session

### 8. PhotoService ✅
**File**: `photo.service.ts`
**Responsibility**: Handle session photo upload

**Methods**:
- `uploadPhoto(sessionId, file, uploadedBy)` - Upload session photo
- `deletePhoto(sessionId)` - Delete session photo
- `getPhoto(sessionId)` - Get session photo

### 9. EvaluationService ✅
**File**: `evaluation.service.ts`
**Responsibility**: Handle doctor evaluation

**Methods**:
- `createEvaluation(sessionId, data, userId)` - Create evaluation
- `updateEvaluation(sessionId, data, userId)` - Update evaluation
- `getEvaluation(sessionId)` - Get evaluation for session

### 10. SessionCompletionService ✅
**File**: `session-completion.service.ts`
**Responsibility**: Handle session completion and progress

**Methods**:
- `completeSession(sessionId, userId)` - Mark session as completed
- `saveProgress(sessionId, userId)` - Save session progress
- `getSessionProgress(sessionId)` - Get session progress status

### 11. BoosterService ✅
**File**: `booster.service.ts`
**Responsibility**: Handle booster package management

**Methods**:
- `updateBoosterType(sessionId, boosterType, userId, branchId)` - Update booster type
- `getBoosterStockAvailability(branchId)` - Check booster stock

### 12. EMRNotesService ✅
**File**: `emr-notes.service.ts`
**Responsibility**: Handle EMR notes creation and retrieval

**Methods**:
- `createEMRNote(sessionId, data, userId)` - Create new EMR note
- `getEMRNotes(sessionId)` - Get all EMR notes for a session

## How to Add New Services

### Step 1: Create Service File
Create a new file in `services/` directory:
```typescript
// services/my-new.service.ts
import { prisma } from '../../../lib/prisma';

export class MyNewService {
  async myMethod() {
    // Implementation
  }
}
```

### Step 2: Import in Main Service
Update `sessions.service.ts`:
```typescript
import { MyNewService } from './services/my-new.service';

export class SessionsService {
  private myNew: MyNewService;

  constructor() {
    this.myNew = new MyNewService();
  }

  async myMethod() {
    return this.myNew.myMethod();
  }
}
```

### Step 3: Add Tests
Create test file:
```typescript
// services/my-new.service.spec.ts
import { MyNewService } from './my-new.service';

describe('MyNewService', () => {
  it('should work', () => {
    // Test implementation
  });
});
```

## Design Principles

### 1. Single Responsibility
Each service handles one domain (diagnosis, vital signs, etc.)

### 2. No Circular Dependencies
Services should not depend on each other. If needed, extract shared logic to utilities.

### 3. Consistent Error Handling
All services throw errors in the same format:
```typescript
throw {
  status: 404,
  code: 'RESOURCE_NOT_FOUND',
  message: 'Resource not found'
};
```

### 4. Audit Logging
Services that modify data should log audit trails:
```typescript
await logAudit({
  userId,
  action: AuditAction.CREATE,
  resource: 'ResourceName',
  resourceId: resource.id,
  meta: { /* additional data */ },
});
```

### 5. Validation
- Validate input data
- Check resource existence
- Verify permissions
- No strict prerequisite validation (allow pending sessions)

## Migration Guide

### Current State
All logic is in `sessions.service.ts` (~1400 lines)

### Target State
Logic distributed across multiple services (~100-200 lines each)

### Migration Steps

1. **Phase 1**: Create new services (✅ COMPLETE)
   - SessionCreationService ✅
   - SessionRetrievalService ✅
   - DiagnosisService ✅
   - TherapyPlanService ✅
   - VitalSignsService ✅
   - InfusionService ✅
   - MaterialUsageService ✅
   - PhotoService ✅
   - EvaluationService ✅
   - SessionCompletionService ✅
   - BoosterService ✅
   - EMRNotesService ✅

2. **Phase 2**: Update main service to use new services (✅ COMPLETE)
   - Import all services
   - Delegate method calls
   - Keep same public API

3. **Phase 3**: Testing
   - Unit tests for each service
   - Integration tests for main service
   - E2E tests for API endpoints

4. **Phase 4**: Cleanup
   - Remove old code
   - Update documentation
   - Performance optimization

## Benefits

### Before (Monolithic)
```
sessions.service.ts (1400 lines)
├── Session management
├── Diagnosis
├── Therapy plan
├── Vital signs
├── Infusion
├── Material usage
├── EMR notes
├── Evaluation
└── Completion
```

### After (Modular) ✅
```
sessions/
├── sessions.service.ts (150 lines) - Orchestrator
└── services/
    ├── session-creation.service.ts (350 lines)
    ├── session-retrieval.service.ts (200 lines)
    ├── diagnosis.service.ts (100 lines)
    ├── therapy-plan.service.ts (100 lines)
    ├── vital-signs.service.ts (80 lines)
    ├── infusion.service.ts (150 lines)
    ├── material-usage.service.ts (120 lines)
    ├── photo.service.ts (100 lines)
    ├── evaluation.service.ts (150 lines)
    ├── session-completion.service.ts (100 lines)
    ├── booster.service.ts (120 lines)
    ├── emr-notes.service.ts (80 lines)
    └── README.md
```

### Advantages
- ✅ Easier to understand
- ✅ Easier to test
- ✅ Easier to maintain
- ✅ Better code organization
- ✅ Reusable components
- ✅ Clear dependencies
- ✅ Faster development

## Testing Strategy

### Unit Tests
Test each service independently:
```typescript
describe('DiagnosisService', () => {
  let service: DiagnosisService;

  beforeEach(() => {
    service = new DiagnosisService();
  });

  it('should create diagnosis', async () => {
    const result = await service.createDiagnosis(encounterId, data, userId);
    expect(result).toBeDefined();
  });
});
```

### Integration Tests
Test services working together:
```typescript
describe('SessionsService Integration', () => {
  it('should complete full session flow', async () => {
    // Test complete flow
  });
});
```

## Next Steps

1. Create remaining services:
   - TherapyPlanService
   - InfusionService
   - MaterialUsageService
   - EvaluationService
   - SessionManagementService
   - SessionCompletionService

2. Create validators:
   - session.validator.ts
   - completion.validator.ts
   - stock.validator.ts

3. Create utilities:
   - session-formatter.ts
   - step-calculator.ts

4. Update main service to use all new services

5. Add comprehensive tests

6. Update documentation
