# Admin Services - Modular Architecture

## Overview

The admin module has been refactored into a modular architecture for better maintainability and separation of concerns.

## Structure

```
admin/
├── admin.service.ts          # Main orchestrator service
├── admin.schema.ts            # Zod schemas and types
├── admin.controller.ts        # HTTP controllers
├── admin.routes.ts            # Route definitions
└── services/                  # Modular services
    ├── system-stats.service.ts              # System statistics & health
    ├── branch-performance.service.ts        # Branch performance analytics
    ├── audit-logs.service.ts                # Audit log management
    ├── package-pricing-admin.service.ts     # Package pricing management
    ├── user-management.service.ts           # User management
    └── README.md                            # This file
```

## Services

### 1. SystemStatsService
**File:** `system-stats.service.ts`

**Responsibilities:**
- Get system statistics (members, branches, users, packages, revenue)
- Monitor system health
- Get recent activities
- Database health checks

**Key Methods:**
- `getSystemStats()` - Get comprehensive system statistics
- `getSystemHealth()` - Check system health status
- `getRecentActivities()` - Get recent audit activities
- `checkDatabaseHealth()` - Verify database connection

**Statistics Provided:**
- Members: total, active, inactive
- Branches: total, active, inactive
- Users: total, active, inactive
- Packages: total, active, completed
- Revenue: total, monthly

### 2. BranchPerformanceService
**File:** `branch-performance.service.ts`

**Responsibilities:**
- Calculate branch performance metrics
- Aggregate branch statistics
- Compare branch performance

**Key Methods:**
- `getBranchPerformance()` - Get performance metrics for all branches

**Metrics Provided:**
- Total members per branch
- Total users per branch
- Total packages per branch
- Total revenue per branch
- Monthly revenue per branch

### 3. AuditLogsService
**File:** `audit-logs.service.ts`

**Responsibilities:**
- Retrieve audit logs with filtering
- Paginate audit logs
- Format audit log data

**Key Methods:**
- `getAuditLogs()` - Get audit logs with filters

**Filters Supported:**
- userId - Filter by user
- action - Filter by action type (CREATE, UPDATE, DELETE, etc.)
- resource - Filter by resource type
- startDate - Filter by start date
- endDate - Filter by end date
- page - Pagination page
- limit - Items per page

### 4. PackagePricingAdminService
**File:** `package-pricing-admin.service.ts`

**Responsibilities:**
- Manage package pricing (CRUD operations)
- Validate pricing data
- Check pricing usage before deletion
- Support branch-specific and global pricing

**Key Methods:**
- `getAllPackagePricing()` - Get all pricing with filters
- `getPackagePricing()` - Get pricing by ID
- `createPackagePricing()` - Create new pricing
- `updatePackagePricing()` - Update existing pricing
- `deletePackagePricing()` - Delete pricing (with usage check)

**Features:**
- Branch-specific pricing support
- Global pricing (branchId = null)
- Active/inactive status
- Usage validation before deletion

### 5. UserManagementService
**File:** `user-management.service.ts`

**Responsibilities:**
- Create admin managers
- Manage user accounts
- Assign branches to managers
- Filter and search users

**Key Methods:**
- `createAdminManager()` - Create admin manager with branch assignments
- `getAllUsers()` - Get all users with filters

**Features:**
- Multi-branch assignment for managers
- Role-based filtering
- Branch-based filtering
- Search by email, name, phone
- Active/inactive status

## Main Service (Orchestrator)

**File:** `admin.service.ts`

The main `AdminService` class acts as an orchestrator that delegates to specialized services:

```typescript
export class AdminService {
  private systemStatsService: SystemStatsService;
  private branchPerformanceService: BranchPerformanceService;
  private auditLogsService: AuditLogsService;
  private packagePricingService: PackagePricingAdminService;
  private userManagementService: UserManagementService;

  // Delegates to specialized services
  async getSystemStats() {
    return await this.systemStatsService.getSystemStats();
  }
  
  async getBranchPerformance() {
    return await this.branchPerformanceService.getBranchPerformance();
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
// admin.service.ts (859 lines)
export class AdminService {
  async getSystemStats() { /* 70+ lines */ }
  async getBranchPerformance() { /* 60+ lines */ }
  async getAuditLogs() { /* 120+ lines */ }
  async getAllPackagePricing() { /* 100+ lines */ }
  async createAdminManager() { /* 90+ lines */ }
  // ... many more methods
}
```

### After (Modular)
```typescript
// admin.service.ts (150 lines)
export class AdminService {
  private systemStatsService: SystemStatsService;
  private branchPerformanceService: BranchPerformanceService;
  
  async getSystemStats() {
    return await this.systemStatsService.getSystemStats();
  }
}

// services/system-stats.service.ts (140 lines)
export class SystemStatsService {
  async getSystemStats() { /* focused logic */ }
}

// services/branch-performance.service.ts (70 lines)
export class BranchPerformanceService {
  async getBranchPerformance() { /* focused logic */ }
}
```

## Usage Example

```typescript
import { AdminService } from './admin.service';

const adminService = new AdminService();

// Get system stats
const stats = await adminService.getSystemStats();

// Get branch performance
const performance = await adminService.getBranchPerformance();

// Get audit logs
const logs = await adminService.getAuditLogs({
  action: 'CREATE',
  resource: 'Member',
  page: 1,
  limit: 50,
});

// Create admin manager
const manager = await adminService.createAdminManager({
  email: 'manager@example.com',
  password: 'securePassword',
  fullName: 'John Doe',
  phoneNumber: '08123456789',
  branchIds: ['branch-id-1', 'branch-id-2'],
});
```

## Testing

Each service can be tested independently:

```typescript
import { SystemStatsService } from './services/system-stats.service';

describe('SystemStatsService', () => {
  let service: SystemStatsService;
  
  beforeEach(() => {
    service = new SystemStatsService();
  });
  
  it('should get system statistics', async () => {
    const stats = await service.getSystemStats();
    expect(stats).toHaveProperty('members');
    expect(stats).toHaveProperty('branches');
    expect(stats).toHaveProperty('revenue');
  });
  
  it('should check database health', async () => {
    const health = await service.getSystemHealth();
    expect(health.status).toBe('healthy');
  });
});
```

## API Endpoints

### System Statistics
- `GET /api/admin/stats` - Get system statistics
- `GET /api/admin/health` - Get system health
- `GET /api/admin/activities` - Get recent activities

### Branch Performance
- `GET /api/admin/branch-performance` - Get branch performance

### Audit Logs
- `GET /api/admin/audit-logs` - Get audit logs with filters

### Package Pricing
- `GET /api/admin/package-pricing` - Get all pricing
- `GET /api/admin/package-pricing/:id` - Get pricing by ID
- `POST /api/admin/package-pricing` - Create pricing
- `PUT /api/admin/package-pricing/:id` - Update pricing
- `DELETE /api/admin/package-pricing/:id` - Delete pricing

### User Management
- `POST /api/admin/managers` - Create admin manager
- `GET /api/admin/users` - Get all users

## Future Improvements

1. **Add Unit Tests** - Test each service independently
2. **Add Integration Tests** - Test service interactions
3. **Add Caching** - Cache statistics and performance data
4. **Add Real-time Updates** - WebSocket for live statistics
5. **Add Export Features** - Export audit logs, reports
6. **Add Dashboard Widgets** - Customizable admin dashboard

## Related Modules

This modular pattern is also used in:
- `packages/` - Package management (already modular)
- `members/` - Member management (already modular)
- `sessions/` - Session management (already modular)
- `invoices/` - Invoice management (to be modularized)
- `inventory/` - Inventory management (to be modularized)
