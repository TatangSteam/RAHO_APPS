# Impersonation Service Test Summary

## Overview
Comprehensive unit tests for the `ImpersonationService` class covering all major functionality including multi-level impersonation, permission validation, and user management.

## Test Coverage
- **Statement Coverage**: 97.87%
- **Branch Coverage**: 84.61%
- **Function Coverage**: 93.33%
- **Line Coverage**: 97.84%

## Test Suites

### 1. createImpersonationToken
Tests the creation of impersonation tokens for different scenarios:

#### Super Admin → Admin Manager Impersonation (4 tests)
- ✅ Successfully creates impersonation token
- ✅ Throws error if target user not found
- ✅ Throws error if target user is inactive
- ✅ Throws error if Super Admin tries to impersonate non-Admin Manager

#### Admin Manager → Admin Cabang Impersonation (3 tests)
- ✅ Successfully creates impersonation token
- ✅ Throws error if Admin Manager tries to impersonate Admin Cabang from unassigned branch
- ✅ Throws error if Admin Manager tries to impersonate non-Admin Cabang

#### Nested Impersonation (Super Admin → Admin Manager → Admin Cabang) (2 tests)
- ✅ Successfully creates nested impersonation token
- ✅ Validates branch access in nested impersonation

#### Permission Validation (1 test)
- ✅ Throws error if non-Super Admin/Admin Manager tries to impersonate

### 2. stopImpersonation (3 tests)
Tests stopping impersonation and returning to previous level:
- ✅ Stops single level impersonation (Admin Manager → Super Admin)
- ✅ Stops nested impersonation (goes back one level: Admin Cabang → Admin Manager)
- ✅ Throws error if not currently impersonating

### 3. canImpersonate (5 tests)
Tests permission checks for impersonation capability:
- ✅ Returns true for Super Admin without impersonation
- ✅ Returns true for Super Admin already impersonating (can continue nested)
- ✅ Returns true for Admin Manager
- ✅ Returns false for Admin Manager at max depth (2 levels)
- ✅ Returns false for other roles (ADMIN_CABANG, etc.)

### 4. getImpersonationChain (3 tests)
Tests extraction of impersonation chain from token:
- ✅ Returns chain for single level impersonation
- ✅ Returns chain for nested impersonation
- ✅ Returns single email for non-impersonating token

### 5. getAdminManagers (4 tests)
Tests retrieval of Admin Manager list with filtering:
- ✅ Returns list of admin managers with pagination
- ✅ Filters by search term (name or email)
- ✅ Filters by active status
- ✅ Handles pagination correctly

### 6. getBranchAdmins (5 tests)
Tests retrieval of Branch Admin list with filtering:
- ✅ Returns list of branch admins with pagination
- ✅ Filters by manager branch IDs
- ✅ Filters by specific branch
- ✅ Filters by search term (name or email)
- ✅ Filters by active status

## Total Tests: 30 (All Passing ✅)

## Test Setup

### Dependencies
- **Jest**: Testing framework
- **ts-jest**: TypeScript support for Jest
- **@types/jest**: TypeScript definitions

### Mocking Strategy
- Prisma client methods (`findUnique`, `findMany`, `count`) are mocked
- JWT signing function (`signAccessToken`) is mocked
- Logger is mocked to prevent console noise

### Test Structure
Each test suite follows the AAA pattern:
1. **Arrange**: Set up mock data and expectations
2. **Act**: Call the service method
3. **Assert**: Verify the results and mock calls

## Key Features Tested

### Multi-Level Impersonation
- ✅ Super Admin → Admin Manager
- ✅ Admin Manager → Admin Cabang
- ✅ Super Admin → Admin Manager → Admin Cabang (nested)

### Security & Permissions
- ✅ Role-based access control
- ✅ Branch access validation
- ✅ Inactive user prevention
- ✅ Invalid target role prevention

### Token Management
- ✅ JWT token generation with impersonation data
- ✅ Nested impersonation token structure
- ✅ Token expiration (8h for impersonation, 24h for normal)

### User Management
- ✅ Admin Manager listing with pagination
- ✅ Branch Admin listing with pagination
- ✅ Search and filter functionality
- ✅ Branch-based access control

## Running Tests

```bash
# Run all tests
npm test

# Run impersonation service tests only
npm test -- impersonation.service.test.ts

# Run with coverage
npm run test:coverage -- impersonation.service.test.ts

# Run in watch mode
npm run test:watch -- impersonation.service.test.ts
```

## Uncovered Lines
Only 2 lines remain uncovered (97.84% coverage):
- Line 49: Error case when current user is not found (edge case)
- Line 272: Undefined branch case for non-ADMIN_MANAGER roles (edge case)

These are difficult to test without more complex mocking and represent edge cases that are unlikely to occur in practice.

## Future Improvements
1. Add integration tests with real database
2. Add E2E tests for complete impersonation flow
3. Test error handling for database failures
4. Test concurrent impersonation scenarios
5. Add performance tests for large datasets

## Conclusion
The impersonation service is thoroughly tested with excellent coverage (97.87%). All critical functionality including multi-level impersonation, permission validation, and user management is covered by comprehensive unit tests.
