# 🚀 NEXT STEPS - Quick Action Guide

**Generated:** 30 Juni 2026

---

## ⚡ Quick Start (3 Steps)

### ✅ Step 1: Install Playwright Browsers (REQUIRED)

**Open Terminal in:** `apps/web`

**Run:**
```bash
npm run e2e:install
```

**Wait for:** "Browsers installed successfully" message (~2-3 minutes)

---

### ✅ Step 2: Setup E2E Environment

**Create `.env.e2e` file:**
```bash
copy .env.e2e.example .env.e2e
```

**Edit `apps/web/.env.e2e`** with your test user credentials:
```env
E2E_BASE_URL=http://127.0.0.1:3000
E2E_WEB_PORT=3000
E2E_API_URL=http://127.0.0.1:4000/api/v1
E2E_START_WEB_SERVER=true

# Add your test user credentials for each role
E2E_SUPER_ADMIN_EMAIL=super@test.com
E2E_SUPER_ADMIN_PASSWORD=YourPassword123
E2E_ADMIN_MANAGER_EMAIL=manager@test.com
E2E_ADMIN_MANAGER_PASSWORD=YourPassword123
E2E_ADMIN_CABANG_EMAIL=cabang@test.com
E2E_ADMIN_CABANG_PASSWORD=YourPassword123
E2E_ADMIN_LAYANAN_EMAIL=layanan@test.com
E2E_ADMIN_LAYANAN_PASSWORD=YourPassword123
E2E_DOCTOR_EMAIL=doctor@test.com
E2E_DOCTOR_PASSWORD=YourPassword123
E2E_NURSE_EMAIL=nurse@test.com
E2E_NURSE_PASSWORD=YourPassword123
```

**⚠️ Important:** Use real test accounts from your database!

---

### ✅ Step 3: Run Tests

**Verify tests are detected:**
```bash
npm run e2e -- --list
```

**You should see:** "40+ tests" listed

**Run all critical tests:**
```bash
npm run e2e -- critical/
```

---

## 📊 Test Execution Options

### Option 1: Run All Critical Tests (Recommended First)
```bash
npm run e2e -- critical/
```

**Runs:**
- 12 logout tests
- 10 member CRUD tests
- 18+ inventory flow tests

**Time:** ~5-10 minutes

---

### Option 2: Run Individual Test Files

**Logout tests (all 6 roles):**
```bash
npm run e2e -- critical/logout.spec.ts
```

**Member CRUD tests:**
```bash
npm run e2e -- critical/member-crud.spec.ts
```

**Inventory flow tests:**
```bash
npm run e2e -- critical/inventory-flow.spec.ts
```

---

### Option 3: Run with Visual UI (Debugging)
```bash
npm run e2e:ui
```

**Features:**
- Click to run individual tests
- See test execution in real-time
- Time travel through test steps
- View screenshots and traces

---

### Option 4: Run in Headed Mode (See Browser)
```bash
npm run e2e:headed -- critical/
```

**Shows:** Real browser window during test execution

---

### Option 5: Run Single Test by Name
```bash
npm run e2e -- critical/logout.spec.ts -g "should logout successfully as SUPER_ADMIN"
```

---

## 📈 After Running Tests

### View HTML Report
```bash
npm run e2e:report
```

**Opens:** Browser with test results

**Shows:**
- ✅ Passed tests
- ❌ Failed tests
- 📸 Screenshots on failure
- 🎥 Videos on failure
- 🔍 Test traces
- ⏱️ Execution timeline

---

## 🐛 If Tests Fail

### Debug Method 1: Run with UI
```bash
npm run e2e:ui
```

Click on failed test → View trace → See what went wrong

---

### Debug Method 2: Run in Headed Mode
```bash
npm run e2e:headed -- critical/logout.spec.ts
```

Watch browser execute test step-by-step

---

### Debug Method 3: Check Screenshots
Failed tests automatically save screenshots to:
```
apps/web/test-results/
```

---

### Debug Method 4: Check Trace
```bash
npx playwright show-trace apps/web/test-results/[test-name]/trace.zip
```

---

## ⚠️ Important Prerequisites

### Before Running Tests, Make Sure:

1. **API Server is Running**
   ```bash
   # Terminal 1
   cd apps/api
   npm run dev
   ```

2. **Database Has Test Users**
   - Verify test users exist for all 6 roles
   - Use test database (not production!)

3. **Ports Are Available**
   - Port 3000 (Web) - free or configured
   - Port 4000 (API) - running API server

4. **Environment Variables Set**
   - `.env.e2e` file created and filled

---

## 📊 Expected Results

### If Everything Works:

```
Running 40+ tests using 2 workers

  ✓ [chromium] › critical/logout.spec.ts:8:5 › should logout as SUPER_ADMIN (2.3s)
  ✓ [chromium] › critical/logout.spec.ts:8:5 › should logout as ADMIN_MANAGER (2.1s)
  ✓ [chromium] › critical/member-crud.spec.ts:12:5 › should create member (3.4s)
  ... (all tests pass)

  40 passed (2.5m)
```

---

## 🎯 Success Criteria

- ✅ Browser installation successful
- ✅ `npm run e2e -- --list` shows 40+ tests
- ✅ All critical tests pass (40/40)
- ✅ HTML report shows green checkmarks
- ✅ No flaky tests (consistent results)

---

## 📞 Quick Troubleshooting

### Issue: "Browsers not installed"
**Solution:** Run `npm run e2e:install`

---

### Issue: "Cannot connect to localhost:3000"
**Solution:** 
1. Check if web server is running (`npm run dev`)
2. Or set `E2E_START_WEB_SERVER=true` in `.env.e2e`

---

### Issue: "Cannot connect to API"
**Solution:** Start API server in separate terminal

---

### Issue: "Login failed for test user"
**Solution:** 
1. Verify test user exists in database
2. Check credentials in `.env.e2e`
3. Verify password is correct

---

### Issue: "Tests are flaky"
**Solution:**
1. Check network connection
2. Ensure database is stable
3. Run tests again (retries configured)
4. Check for timing issues in test code

---

## 🎉 After Successful Test Run

### You'll have:
1. ✅ Confidence that critical flows work
2. ✅ HTML report with test evidence
3. ✅ Screenshots of application state
4. ✅ Foundation for Phase 4 (more tests)

### Next Phase (Phase 4):
- Session Therapy CRUD tests
- Payment & Verification tests
- Audit Log tests
- Report Generation tests
- Edge cases & error scenarios

---

## 📋 Commands Cheat Sheet

```bash
# Installation
npm run e2e:install              # Install browsers (do this first!)

# Test Execution
npm run e2e -- --list            # List all tests
npm run e2e                      # Run all tests
npm run e2e -- critical/         # Run critical tests only
npm run e2e:ui                   # Run with visual UI
npm run e2e:headed               # Run in headed mode

# Specific Tests
npm run e2e -- critical/logout.spec.ts
npm run e2e -- critical/member-crud.spec.ts
npm run e2e -- critical/inventory-flow.spec.ts

# Debugging
npm run e2e -- --debug           # Debug mode
npm run e2e:report               # View HTML report
npx playwright show-trace [path] # View trace file

# Utilities
npm run type-check               # Check TypeScript
npm run lint                     # Run linter
```

---

## 📚 Documentation

- `PROJECT_STATUS.md` - Complete project status
- `COMPREHENSIVE_LOADING_SYSTEM.md` - Loading system guide
- `e2e/PHASE3_CRITICAL_FLOWS.md` - E2E testing guide
- `e2e/QUICK_REFERENCE.md` - E2E quick reference
- `e2e/README.md` - E2E getting started

---

**YOU ARE HERE:** 👉 Step 1 - Install Browsers

**Action Required:** Run `npm run e2e:install`

**Estimated Time:** 2-3 minutes

---

**Last Updated:** 30 Juni 2026  
**Generated by:** Kiro AI

