# E2E Testing Quick Reference

## 🚀 Quick Commands

```bash
# Run all tests
npm run e2e:web

# Run with UI (recommended for development)
npm run e2e:web:ui

# Run in headed mode (see browser)
npm run e2e:web:headed

# Run specific file
npm run e2e:web -- critical/member-crud.spec.ts

# Run specific test
npm run e2e:web -- -g "should create new member"

# List all tests
npm run e2e:web -- --list

# Debug mode
npm run e2e:web -- --debug

# Generate HTML report
npx playwright show-report
```

---

## 📝 Writing Tests

### Basic Test Structure
```typescript
import { test, expect } from '../fixtures/base';

test.describe('Feature Name', () => {
  test('should do something', async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    
    // Navigate
    await page.goto('/path');
    
    // Interact
    await page.getByRole('button', { name: 'Submit' }).click();
    
    // Assert
    await expect(page).toHaveURL('/success');
  });
});
```

### With Page Object
```typescript
import { MemberPage } from '../pages/MemberPage';

test('test with page object', async ({ loginAs }) => {
  const page = await loginAs('ADMIN_CABANG');
  const memberPage = new MemberPage(page);
  
  await memberPage.goto();
  await memberPage.createMember({ name: 'Test', email: 'test@example.com' });
  await memberPage.expectMemberExists('Test');
});
```

---

## 🎯 Common Selectors

```typescript
// By role (preferred)
page.getByRole('button', { name: 'Submit' })
page.getByRole('link', { name: /home/i })
page.getByRole('textbox', { name: 'Email' })

// By label
page.getByLabel('Email')
page.getByLabel(/password/i)

// By placeholder
page.getByPlaceholder('Search...')

// By text
page.getByText('Welcome')
page.getByText(/success/i)

// By test ID
page.getByTestId('submit-button')

// Generic locator
page.locator('button.submit')
```

---

## ⏱️ Waiting

```typescript
// Wait for element
await page.waitForSelector('button')

// Wait for navigation
await page.waitForURL('/dashboard')

// Wait for load state
await page.waitForLoadState('networkidle')

// Wait for response
await page.waitForResponse(response => 
  response.url().includes('/api/') && response.ok()
)

// Custom wait helpers
await waitForLoadingToFinish(page)
await waitForSuccessToast(page, 'Saved')
await waitForModal(page)
await waitForTableToLoad(page)
```

---

## ✅ Assertions

```typescript
// Visibility
await expect(element).toBeVisible()
await expect(element).toBeHidden()

// State
await expect(element).toBeEnabled()
await expect(element).toBeDisabled()
await expect(element).toBeChecked()

// Text
await expect(element).toHaveText('Expected')
await expect(element).toContainText(/pattern/i)

// URL
await expect(page).toHaveURL('/dashboard')
await expect(page).toHaveURL(/\/members\/\d+/)

// Count
await expect(page.locator('tr')).toHaveCount(5)

// Value
await expect(input).toHaveValue('test@example.com')
```

---

## 🔐 Authentication

```typescript
// Login as specific role
const page = await loginAs('ADMIN_CABANG')
const page = await loginAs('ADMIN_MANAGER')
const page = await loginAs('DOCTOR')

// Available roles:
// - SUPER_ADMIN
// - ADMIN_MANAGER
// - ADMIN_CABANG
// - ADMIN_LAYANAN
// - DOCTOR
// - NURSE
```

---

## 🎭 Test Hooks

```typescript
test.describe('Feature', () => {
  // Run once before all tests in describe
  test.beforeAll(async () => {
    // Setup
  });

  // Run before each test
  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    // Setup for each test
  });

  // Run after each test
  test.afterEach(async ({ page }) => {
    // Cleanup
  });

  // Run once after all tests
  test.afterAll(async () => {
    // Teardown
  });

  test('test 1', async () => {});
  test('test 2', async () => {});
});
```

---

## 🐛 Debugging

```typescript
// Pause execution
await page.pause()

// Screenshot
await page.screenshot({ path: 'debug.png', fullPage: true })

// Console logs
page.on('console', msg => console.log(msg.text()))

// Network logs
page.on('response', response => {
  console.log(response.url(), response.status())
})

// Slow down
test.use({ launchOptions: { slowMo: 1000 } })

// Debug specific test
test.only('debug this', async () => {
  // Only this test runs
})

// Skip test
test.skip('skip this', async () => {
  // Test is skipped
})
```

---

## 📦 Page Objects

### Creating
```typescript
// e2e/pages/MyPage.ts
export class MyPage {
  constructor(private page: Page) {}
  
  async goto() {
    await this.page.goto('/my-page')
    await waitForLoadingToFinish(this.page)
  }
  
  async fillForm(data: FormData) {
    await this.page.getByLabel('Name').fill(data.name)
    await this.page.getByLabel('Email').fill(data.email)
  }
  
  async submit() {
    await this.page.getByRole('button', { name: 'Submit' }).click()
    await waitForSuccessToast(this.page)
  }
  
  async expectSuccess() {
    await expect(this.page).toHaveURL('/success')
  }
}
```

### Using
```typescript
import { MyPage } from '../pages/MyPage'

test('test', async ({ loginAs }) => {
  const page = await loginAs('ADMIN_CABANG')
  const myPage = new MyPage(page)
  
  await myPage.goto()
  await myPage.fillForm({ name: 'Test', email: 'test@example.com' })
  await myPage.submit()
  await myPage.expectSuccess()
})
```

---

## 📊 Test Organization

```
✅ Good:
- One feature per file
- Related tests in describe blocks
- Clear test names
- Proper cleanup

❌ Bad:
- Multiple features in one file
- No describe blocks
- Vague test names
- No cleanup
```

---

## 🎯 Test Data

```typescript
// Dynamic data (preferred)
const testName = `Test User ${Date.now()}`
const testEmail = `test${Date.now()}@example.com`

// Unique per test
test('test 1', async () => {
  const data = {
    name: `User ${Math.random()}`,
    email: `user${Date.now()}@test.com`
  }
})

// Cleanup
test.afterEach(async () => {
  // Delete test data
})
```

---

## 🔥 Common Patterns

### Form Submission
```typescript
await page.getByLabel('Name').fill('Test')
await page.getByLabel('Email').fill('test@example.com')
await page.getByRole('button', { name: 'Submit' }).click()
await waitForSuccessToast(page)
```

### Table Interaction
```typescript
const row = page.locator('tr').filter({ hasText: 'John' })
await row.getByRole('button', { name: 'Edit' }).click()
```

### Modal Interaction
```typescript
await page.getByRole('button', { name: 'Open' }).click()
await waitForModal(page)
await page.getByLabel('Field').fill('Value')
await page.getByRole('button', { name: 'Save' }).click()
await waitForModalClose(page)
```

### Search
```typescript
await page.getByPlaceholder('Search').fill('query')
await page.waitForTimeout(500) // Debounce
await waitForLoadingToFinish(page)
```

---

## 🚨 Error Handling

```typescript
// Try-catch for expected errors
try {
  await page.locator('.maybe-not-exists').click()
} catch (error) {
  // Handle gracefully
}

// Conditional checks
const exists = await page.locator('.element').isVisible()
if (exists) {
  await page.locator('.element').click()
}

// Default timeout
test.setTimeout(60000) // 60 seconds
```

---

## 📚 Resources

- **Playwright Docs:** https://playwright.dev/
- **Best Practices:** https://playwright.dev/docs/best-practices
- **API Reference:** https://playwright.dev/docs/api/class-page
- **Selectors:** https://playwright.dev/docs/selectors

---

## 💡 Tips

1. **Use page.getByRole()** - Most accessible and reliable
2. **Wait properly** - Use built-in waits, avoid hard-coded timeouts
3. **Keep tests independent** - Each test should run standalone
4. **Use page objects** - DRY principle, easier maintenance
5. **Name tests clearly** - "should create member" not "test1"
6. **Clean up data** - Don't pollute test database
7. **Run in parallel** - Faster execution
8. **Check flakiness** - Rerun flaky tests to identify issues

---

**Need Help?** Check `PHASE3_CRITICAL_FLOWS.md` for detailed documentation.
