# Phase 3: Critical Flow E2E Tests

## 📋 Overview
Comprehensive end-to-end tests for critical business flows in RAHO Premier Club application.

---

## ✅ Implemented Tests

### 1. **Login/Logout - All Roles** ✅
**File:** `critical/logout.spec.ts`

**Test Cases:**
- ✅ Logout successful for all 6 roles
- ✅ Session cleared on logout
- ✅ Logout from different pages
- ✅ Prevent back navigation after logout
- ✅ Handle concurrent logouts
- ✅ Logout confirmation on unsaved changes
- ✅ Session timeout after inactivity
- ✅ Keyboard accessibility
- ✅ Proper ARIA labels

**Roles Tested:**
- SUPER_ADMIN
- ADMIN_MANAGER
- ADMIN_CABANG
- ADMIN_LAYANAN
- DOCTOR
- NURSE

---

### 2. **Member CRUD** ✅
**File:** `critical/member-crud.spec.ts`

**Test Cases:**
- ✅ Create new member
- ✅ Search for member
- ✅ View member details
- ✅ Edit member information
- ✅ Delete member
- ✅ Validate required fields
- ✅ Validate email format
- ✅ Handle duplicate email
- ✅ Assign therapy package
- ✅ Assign multiple packages

**Coverage:**
- Form validation
- Data persistence
- Search functionality
- Package assignment

---

### 3. **Inventory - Stock Request Flow** ✅
**File:** `critical/inventory-flow.spec.ts`

**Test Suites:**

#### a. Stock Request Creation
- ✅ Create request for low stock item
- ✅ Validate required fields
- ✅ Validate positive quantity
- ✅ Request listing and search

#### b. Approval Flow
- ✅ Approve request as manager
- ✅ Reject request with reason
- ✅ Access control for non-managers

#### c. Shipment Flow
- ✅ Create shipment from approved request
- ✅ Mark shipment as shipped
- ✅ Receive shipment successfully
- ✅ Update stock after receiving
- ✅ Handle partial receipt
- ✅ Track shipment status changes

#### d. Filter and Search
- ✅ Filter by status
- ✅ Search products
- ✅ Filter low stock items

#### e. Access Control
- ✅ Role-based request creation
- ✅ Manager-only approval
- ✅ Permission validation

---

## 📁 File Structure

```
e2e/
├── auth/
│   ├── auth.setup.ts              # Auth state setup per role
│   └── login.smoke.spec.ts        # Login validation tests
├── critical/                       # ⭐ PHASE 3 TESTS
│   ├── logout.spec.ts             # ✅ Logout all roles
│   ├── member-crud.spec.ts        # ✅ Member CRUD
│   └── inventory-flow.spec.ts     # ✅ Inventory flow
├── pages/                          # Page Objects
│   ├── MemberPage.ts              # ✅ Member page object
│   └── InventoryPage.ts           # ✅ Inventory page object
├── helpers/
│   ├── auth.ts                    # Auth helpers
│   ├── navigation.ts              # ✅ Navigation helpers
│   └── waiters.ts                 # ✅ Wait utilities
└── fixtures/
    ├── base.ts                    # Base test fixture
    └── test-users.ts              # Test user credentials
```

---

## 🚀 Running Tests

### Run All Critical Tests
```bash
npm run e2e:web -- critical/

# Or specific test file
npm run e2e:web -- critical/logout.spec.ts
npm run e2e:web -- critical/member-crud.spec.ts
npm run e2e:web -- critical/inventory-flow.spec.ts
```

### Run with UI
```bash
npm run e2e:web:ui
```

### Run in Headed Mode
```bash
npm run e2e:web:headed
```

### Run Specific Test
```bash
npm run e2e:web -- critical/logout.spec.ts -g "should logout successfully"
```

---

## 📊 Test Coverage

### By Priority

| Priority | Flow | Status | Tests |
|----------|------|--------|-------|
| 🔴 Critical | Login/Logout All Roles | ✅ | 12 |
| 🔴 Critical | Member CRUD | ✅ | 10 |
| 🔴 Critical | Inventory Request | ✅ | 3 |
| 🔴 Critical | Approval Flow | ✅ | 3 |
| 🔴 Critical | Shipment Flow | ✅ | 5 |
| 🟡 High | Assign Package | ✅ | 2 |
| 🟡 High | Filter & Search | ✅ | 3 |
| 🟢 Medium | Access Control | ✅ | 2 |

**Total Tests Implemented:** 40+

---

## 🎯 Test Patterns Used

### 1. **Page Object Model (POM)**
```typescript
// Page objects encapsulate page interactions
const memberPage = new MemberPage(page);
await memberPage.createMember(data);
await memberPage.expectMemberExists(name);
```

### 2. **Helper Functions**
```typescript
// Reusable wait helpers
await waitForLoadingToFinish(page);
await waitForSuccessToast(page, message);
await waitForModal(page);
```

### 3. **Fixture-Based Auth**
```typescript
// Easy role-based authentication
test('test name', async ({ loginAs }) => {
  const page = await loginAs('ADMIN_CABANG');
  // Test with authenticated page
});
```

### 4. **Data-Driven Tests**
```typescript
// Test multiple scenarios with loop
for (const role of roles) {
  test(`should work for ${role}`, async ({ loginAs }) => {
    const page = await loginAs(role);
    // Test logic
  });
}
```

---

## 🔍 Test Best Practices

### ✅ DO:
- Use page objects for complex interactions
- Wait for elements properly (no hard-coded timeouts)
- Use descriptive test names
- Test both positive and negative scenarios
- Clean up test data
- Use role-based authentication fixtures

### ❌ DON'T:
- Use `page.waitForTimeout()` unnecessarily
- Hard-code selectors in tests
- Skip error scenarios
- Leave test data in database
- Use same test data across parallel tests

---

## 🧪 Test Data Strategy

### Dynamic Test Data
```typescript
// Use timestamps for uniqueness
const testName = `Test Member ${Date.now()}`;
const testEmail = `test${Date.now()}@example.com`;
```

### Test User Credentials
```typescript
// Defined in test-users.ts
E2E_SUPER_ADMIN_EMAIL=super@test.com
E2E_ADMIN_MANAGER_EMAIL=manager@test.com
// ... etc
```

---

## 📝 Adding New Tests

### 1. Create Page Object (if needed)
```typescript
// e2e/pages/NewPage.ts
export class NewPage {
  constructor(private page: Page) {}
  
  async goto() {
    await this.page.goto('/path');
  }
  
  async doAction() {
    // Implementation
  }
}
```

### 2. Create Test File
```typescript
// e2e/critical/new-feature.spec.ts
import { test } from '../fixtures/base';
import { NewPage } from '../pages/NewPage';

test.describe('New Feature', () => {
  test('should work correctly', async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    const newPage = new NewPage(page);
    
    await newPage.goto();
    await newPage.doAction();
    
    // Assertions
  });
});
```

### 3. Run Test
```bash
npm run e2e:web -- critical/new-feature.spec.ts
```

---

## 🐛 Debugging Tests

### Visual Debugging
```bash
# Run with UI mode
npm run e2e:web:ui

# Run in headed mode
npm run e2e:web:headed
```

### Debug Specific Test
```typescript
// Add .only to run single test
test.only('debug this test', async ({ page }) => {
  // Add debugger
  await page.pause();
  
  // Or screenshot
  await page.screenshot({ path: 'debug.png' });
});
```

### Check Selectors
```typescript
// Use inspector
await page.locator('button').click();
// Playwright Inspector shows what was found
```

---

## ⚡ Performance Tips

### 1. **Parallel Execution**
```typescript
// Tests run in parallel by default
test.describe.configure({ mode: 'parallel' });
```

### 2. **Reuse Auth State**
```typescript
// Auth setup runs once per role
// Tests reuse the auth state
// Much faster than logging in each test
```

### 3. **Efficient Selectors**
```typescript
// Fast ✅
page.getByRole('button', { name: 'Submit' })
page.getByLabel('Email')

// Slow ❌
page.locator('.some-complex >> div >> button')
```

---

## 🔒 Test Isolation

Each test should:
- ✅ Create its own test data
- ✅ Clean up after itself
- ✅ Not depend on other tests
- ✅ Be runnable in isolation
- ✅ Be runnable in parallel

---

## 📈 Next Steps (Phase 4)

### Pending Critical Flows:
- [ ] Session Therapy CRUD
- [ ] Payment & Verification
- [ ] Audit Log Viewing
- [ ] Report Generation
- [ ] Notification System

### Full Regression:
- [ ] Edge cases for all flows
- [ ] Error handling scenarios
- [ ] Network failure scenarios
- [ ] Concurrent user scenarios
- [ ] Data integrity tests
- [ ] Performance tests

---

## 📚 Documentation References

- **Playwright Docs:** https://playwright.dev/
- **Test Users Setup:** `test-users.ts`
- **Auth Setup:** `auth/auth.setup.ts`
- **Base Fixture:** `fixtures/base.ts`
- **Main README:** `e2e/README.md`

---

## ✅ Quality Metrics

### Current Status:
- **Total Tests:** 40+
- **Pass Rate:** Target 100%
- **Coverage:** Critical flows covered
- **Execution Time:** ~2-5 min (parallel)
- **Flakiness:** Target < 1%

### Test Execution:
```bash
# See all tests
npm run e2e:web -- --list

# Run with reporter
npm run e2e:web -- --reporter=html

# Generate report
npx playwright show-report
```

---

**Status:** ✅ Phase 3 Complete  
**Last Updated:** 29 Juni 2026  
**Version:** 1.0.0  
**Ready for:** Phase 4 - Full Regression
