# Test Scenarios - Table Format

**Date:** 11 Mei 2026  
**Version:** 1.5.0  
**Status:** Pending Testing

---

## 📋 Overview - All Test Scenarios

| ID | Scenario | Priority | Status | Blocker |
|----|----------|----------|--------|---------|
| TS-001 | Login sebagai SUPER_ADMIN | HIGH | ⏳ Pending | - |
| TS-002 | Login sebagai ADMIN | HIGH | ⏳ Pending | - |
| TS-003 | Login sebagai ADMIN_LAYANAN | HIGH | ⏳ Pending | - |
| TS-004 | Login sebagai DOCTOR | HIGH | ✅ Fixed | - |
| TS-005 | Login sebagai NURSE | HIGH | ✅ Fixed | - |
| TS-006 | Audit Log BranchId | CRITICAL | ✅ Fixed | - |
| TS-007 | Create Member (Valid) | HIGH | ⏳ Pending | - |
| TS-008 | Create Member (Invalid Referral) | HIGH | ✅ Fixed | - |
| TS-009 | View Member Detail | MEDIUM | ⏳ Pending | - |
| TS-010 | Edit Member | MEDIUM | ⏳ Pending | - |
| TS-011 | Delete Member | LOW | ⏳ Pending | - |
| TS-012 | Assign Package to Member | HIGH | ⏳ Pending | - |
| TS-013 | Verify Payment | HIGH | ⏳ Pending | - |
| TS-014 | View Package Detail | MEDIUM | ⏳ Pending | - |
| TS-015 | Edit Package | MEDIUM | ⏳ Pending | - |
| TS-016 | Cancel Package | LOW | ⏳ Pending | - |
| TS-017 | Package Usage Tracking | HIGH | ⏳ Pending | Session Workflow |
| TS-018 | Package Auto-Expire | MEDIUM | ⏳ Pending | Session Workflow |
| TS-019 | Create Session (ADMIN_LAYANAN) | HIGH | ⏳ Pending | - |
| TS-020 | Create Session (DOCTOR) | HIGH | ✅ Fixed | Session Workflow |
| TS-021 | Create Session (NURSE) | HIGH | ✅ Fixed | Session Workflow |
| TS-022 | Complete Session Workflow | CRITICAL | ⏳ Pending | Session Workflow |
| TS-023 | Session Material Usage | HIGH | ⏳ Pending | Session Workflow |
| TS-024 | Session Invoice Generation | HIGH | ⏳ Pending | Session Workflow |
| TS-025 | View Session Detail | MEDIUM | ⏳ Pending | - |
| TS-026 | Edit Session | MEDIUM | ⏳ Pending | - |
| TS-027 | Cancel Session | LOW | ⏳ Pending | - |
| TS-028 | View Invoice | MEDIUM | ⏳ Pending | - |
| TS-029 | Invoice Payment Method | HIGH | ⏳ Pending | - |
| TS-030 | Print Invoice | LOW | ⏳ Pending | - |
| TS-031 | Incentive Calculation (First Package) | HIGH | ✅ Fixed | - |
| TS-032 | Incentive Calculation (Next Package) | HIGH | ✅ Fixed | - |
| TS-033 | Referral Validation | HIGH | ✅ Fixed | - |
| TS-034 | Dashboard Metrics (ADMIN) | MEDIUM | ⏳ Pending | - |
| TS-035 | Dashboard Metrics (DOCTOR) | MEDIUM | ⏳ Pending | - |
| TS-036 | Dashboard Metrics (NURSE) | MEDIUM | ⏳ Pending | - |
| TS-037 | Rate Limiting Login | MEDIUM | ✅ Fixed | - |
| TS-038 | Branch Management | LOW | ⏳ Pending | - |
| TS-039 | Inventory Management | LOW | ⏳ Pending | - |
| TS-040 | User Management | LOW | ⏳ Pending | - |

**Summary:**
- ✅ **Fixed:** 8 scenarios
- ⏳ **Pending:** 32 scenarios
- 🚫 **Blocked:** 5 scenarios (Session Workflow)

---

## 🎯 Test Scenarios - Detailed

### TS-004: Login sebagai DOCTOR ✅ FIXED

**Priority:** HIGH  
**Status:** ✅ FIXED  
**Date Fixed:** 11 Mei 2026

#### Test Steps
| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to login page | Login form displayed | ✅ Pass |
| 2 | Enter DOCTOR credentials | Fields filled | ✅ Pass |
| 3 | Click "Login" button | Redirect to dashboard | ✅ Pass |
| 4 | Verify dashboard access | Dashboard displayed | ✅ Pass |
| 5 | Verify "Buat Sesi" button | Button visible | ✅ Pass |
| 6 | Click "Buat Sesi" button | Modal opens | ✅ Pass |
| 7 | Verify form fields | Admin + Nakes dropdowns, Dokter auto-filled | ✅ Pass |

#### Test Data
- **Email:** dokter1@example.com
- **Password:** password123
- **Expected Role:** DOCTOR
- **Expected Branch:** Cabang Jakarta Pusat

#### Result
✅ **PASS** - DOCTOR dapat login dan membuat sesi

---

### TS-005: Login sebagai NURSE ✅ FIXED

**Priority:** HIGH  
**Status:** ✅ FIXED  
**Date Fixed:** 11 Mei 2026

#### Test Steps
| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to login page | Login form displayed | ✅ Pass |
| 2 | Enter NURSE credentials | Fields filled | ✅ Pass |
| 3 | Click "Login" button | Redirect to dashboard | ✅ Pass |
| 4 | Verify dashboard access | Dashboard displayed | ✅ Pass |
| 5 | Verify "Buat Sesi" button | Button visible | ✅ Pass |
| 6 | Click "Buat Sesi" button | Modal opens | ✅ Pass |
| 7 | Verify form fields | Admin + Dokter dropdowns, Nakes auto-filled | ✅ Pass |
| 8 | Fill all required fields | All fields filled | ✅ Pass |
| 9 | Verify button enabled | Button "Buat Sesi" enabled | ✅ Pass |
| 10 | Click "Buat Sesi" | Session created | ✅ Pass |

#### Test Data
- **Email:** nakes1@example.com
- **Password:** password123
- **Expected Role:** NURSE
- **Expected Branch:** Cabang Jakarta Pusat

#### Result
✅ **PASS** - NURSE dapat login dan membuat sesi

---

### TS-006: Audit Log BranchId ✅ FIXED

**Priority:** CRITICAL  
**Status:** ✅ FIXED  
**Date Fixed:** 11 Mei 2026

#### Test Steps
| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Create new member | Member created | ✅ Pass |
| 2 | Check audit log | Record created | ✅ Pass |
| 3 | Verify branchId field | branchId NOT NULL | ✅ Pass |
| 4 | Assign package to member | Package assigned | ✅ Pass |
| 5 | Check audit log | Record created | ✅ Pass |
| 6 | Verify branchId field | branchId NOT NULL | ✅ Pass |
| 7 | Update member | Member updated | ✅ Pass |
| 8 | Check audit log | Record created | ✅ Pass |
| 9 | Verify branchId field | branchId NOT NULL | ✅ Pass |

#### SQL Query
```sql
SELECT id, action, userId, branchId, createdAt 
FROM "AuditLog" 
WHERE branchId IS NOT NULL
ORDER BY createdAt DESC 
LIMIT 20;
```

#### Result
✅ **PASS** - All audit logs record branchId correctly

---

### TS-008: Create Member (Invalid Referral) ✅ FIXED

**Priority:** HIGH  
**Status:** ✅ FIXED  
**Date Fixed:** 11 Mei 2026

#### Test Steps
| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to create member page | Form displayed | ✅ Pass |
| 2 | Fill all required fields | Fields filled | ✅ Pass |
| 3 | Type invalid referral code "REF 9999" | Value entered | ✅ Pass |
| 4 | Click outside field (blur) | Value captured | ✅ Pass |
| 5 | Click "Daftar Member" | Error toast displayed | ✅ Pass |
| 6 | Verify error message | "Kode referral tidak valid" | ✅ Pass |
| 7 | Verify member NOT created | No new member in database | ✅ Pass |

#### Test Data
- **Invalid Codes:** REF 9999, REF999, INVALID, ABC123
- **Valid Codes:** REF1, REF2, REF3, REF4, REF5

#### Result
✅ **PASS** - Invalid referral codes rejected

---

### TS-020: Create Session (DOCTOR) ✅ FIXED

**Priority:** HIGH  
**Status:** ✅ FIXED (Form Fixed, Workflow Blocked)  
**Date Fixed:** 11 Mei 2026

#### Test Steps
| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Login as DOCTOR | Dashboard displayed | ✅ Pass |
| 2 | Click "Buat Sesi Baru" | Modal opens | ✅ Pass |
| 3 | Verify Dokter field | Auto-filled with green background | ✅ Pass |
| 4 | Select Member | Member selected | ✅ Pass |
| 5 | Select Admin Layanan | Admin selected | ✅ Pass |
| 6 | Select Nakes | Nakes selected | ✅ Pass |
| 7 | Verify button enabled | Button "Buat Sesi" enabled | ✅ Pass |
| 8 | Click "Buat Sesi" | Session created | ✅ Pass |
| 9 | Complete 8-step workflow | **BLOCKED** | 🚫 Blocked |

#### Test Data
- **DOCTOR:** dokter1@example.com
- **Member:** Any active member
- **Admin Layanan:** adminlayanan1@example.com
- **Nakes:** nakes1@example.com

#### Result
✅ **PARTIAL PASS** - Form fixed, workflow blocked

---

### TS-021: Create Session (NURSE) ✅ FIXED

**Priority:** HIGH  
**Status:** ✅ FIXED (Form Fixed, Workflow Blocked)  
**Date Fixed:** 11 Mei 2026

#### Test Steps
| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Login as NURSE | Dashboard displayed | ✅ Pass |
| 2 | Click "Buat Sesi Baru" | Modal opens | ✅ Pass |
| 3 | Verify Nakes field | Auto-filled with green background | ✅ Pass |
| 4 | Verify NO duplicate dropdown | Only auto-filled box shown | ✅ Pass |
| 5 | Select Member | Member selected | ✅ Pass |
| 6 | Select Admin Layanan | Admin selected | ✅ Pass |
| 7 | Select Dokter | Dokter selected | ✅ Pass |
| 8 | Verify button enabled | Button "Buat Sesi" enabled | ✅ Pass |
| 9 | Click "Buat Sesi" | Session created | ✅ Pass |
| 10 | Complete 8-step workflow | **BLOCKED** | 🚫 Blocked |

#### Test Data
- **NURSE:** nakes1@example.com
- **Member:** Any active member
- **Admin Layanan:** adminlayanan1@example.com
- **Dokter:** dokter1@example.com

#### Result
✅ **PARTIAL PASS** - Form fixed, workflow blocked

---

### TS-031: Incentive Calculation (First Package) ✅ FIXED

**Priority:** HIGH  
**Status:** ✅ FIXED  
**Date Fixed:** 11 Mei 2026

#### Test Steps
| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Create member with referral code | Member created | ✅ Pass |
| 2 | Assign first package (Rp 1.000.000) | Package assigned | ✅ Pass |
| 3 | Verify payment | Payment verified | ✅ Pass |
| 4 | Check incentive record | Record created | ✅ Pass |
| 5 | Verify incentive amount | Rp 100.000 (10%) | ✅ Pass |

#### Test Data
- **Referrer:** Member with referralCode "REF1"
- **New Member:** Created with referralCode "REF1"
- **Package Price:** Rp 1.000.000
- **Expected Incentive:** Rp 100.000 (10%)

#### SQL Query
```sql
SELECT mi.id, mi.memberId, mi.amount, mi.packageId, p.totalPrice
FROM "MemberIncentive" mi
JOIN "Package" p ON p.id = mi.packageId
WHERE mi.memberId = 1
ORDER BY mi.createdAt DESC;
```

#### Result
✅ **PASS** - First package incentive calculated correctly (10%)

---

### TS-032: Incentive Calculation (Next Package) ✅ FIXED

**Priority:** HIGH  
**Status:** ✅ FIXED  
**Date Fixed:** 11 Mei 2026

#### Test Steps
| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Use member from TS-031 | Member exists | ✅ Pass |
| 2 | Assign second package (Rp 1.000.000) | Package assigned | ✅ Pass |
| 3 | Verify payment | Payment verified | ✅ Pass |
| 4 | Check incentive record | Record created | ✅ Pass |
| 5 | Verify incentive amount | Rp 50.000 (5%) | ✅ Pass |

#### Test Data
- **Referrer:** Same member from TS-031
- **New Member:** Same member (second package)
- **Package Price:** Rp 1.000.000
- **Expected Incentive:** Rp 50.000 (5%)

#### Result
✅ **PASS** - Next package incentive calculated correctly (5%)

---

### TS-033: Referral Validation ✅ FIXED

**Priority:** HIGH  
**Status:** ✅ FIXED  
**Date Fixed:** 11 Mei 2026

#### Test Steps
| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Try invalid code "REF 9999" | Error: "Kode referral tidak valid" | ✅ Pass |
| 2 | Try invalid code "REF999" | Error: "Kode referral tidak valid" | ✅ Pass |
| 3 | Try invalid code "INVALID" | Error: "Kode referral tidak valid" | ✅ Pass |
| 4 | Try valid code "REF1" | Member created successfully | ✅ Pass |
| 5 | Try valid code "REF2" | Member created successfully | ✅ Pass |
| 6 | Try empty code | Member created (no referral) | ✅ Pass |

#### Test Data
- **Invalid Codes:** REF 9999, REF999, INVALID, ABC123
- **Valid Codes:** REF1, REF2, REF3, REF4, REF5

#### Result
✅ **PASS** - Referral validation working correctly

---

### TS-037: Rate Limiting Login ✅ FIXED

**Priority:** MEDIUM  
**Status:** ✅ FIXED  
**Date Fixed:** 11 Mei 2026

#### Test Steps
| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Try login with wrong password (1st) | 401 Unauthorized | ✅ Pass |
| 2 | Try login with wrong password (2nd) | 401 Unauthorized | ✅ Pass |
| 3 | Try login with wrong password (3rd) | 401 Unauthorized | ✅ Pass |
| 4 | Try login with wrong password (4th) | 401 Unauthorized | ✅ Pass |
| 5 | Try login with wrong password (5th) | 401 Unauthorized | ✅ Pass |
| 6 | Try login with wrong password (6th) | 429 Too Many Requests | ✅ Pass |
| 7 | Verify error message | "Terlalu banyak percobaan login..." | ✅ Pass |
| 8 | Wait 15 minutes | Rate limit reset | ✅ Pass |
| 9 | Try login again | 401 or 200 (depending on credentials) | ✅ Pass |

#### Test Script
```bash
cd apps/api
npx ts-node scripts/test-rate-limit.ts
```

#### Result
✅ **PASS** - Rate limiting working correctly (5 attempts per 15 min)

---

## 🚫 Blocked Test Scenarios

### Session Workflow Blocker

The following test scenarios are blocked due to incomplete session workflow:

| ID | Scenario | Blocker |
|----|----------|---------|
| TS-017 | Package Usage Tracking | Cannot complete session |
| TS-018 | Package Auto-Expire | Cannot complete session |
| TS-022 | Complete Session Workflow | 8-step workflow not working |
| TS-023 | Session Material Usage | Cannot complete session |
| TS-024 | Session Invoice Generation | Cannot complete session |

**Issue:** Session 8-step workflow belum berfungsi dengan baik
- Cannot complete diagnosis step
- Cannot progress through therapy plan
- Cannot complete session

**Action Required:** Fix session workflow di sprint berikutnya

---

## 📊 Test Coverage

### By Priority
| Priority | Total | Fixed | Pending | Blocked |
|----------|-------|-------|---------|---------|
| CRITICAL | 2 | 2 | 0 | 0 |
| HIGH | 15 | 6 | 7 | 2 |
| MEDIUM | 8 | 0 | 8 | 0 |
| LOW | 5 | 0 | 5 | 0 |
| **TOTAL** | **30** | **8** | **20** | **2** |

### By Module
| Module | Total | Fixed | Pending | Blocked |
|--------|-------|-------|---------|---------|
| Authentication | 6 | 3 | 3 | 0 |
| Members | 5 | 2 | 3 | 0 |
| Packages | 5 | 2 | 2 | 1 |
| Sessions | 7 | 2 | 2 | 3 |
| Invoices | 3 | 0 | 3 | 0 |
| Dashboard | 3 | 0 | 3 | 0 |
| Others | 1 | 0 | 1 | 0 |
| **TOTAL** | **30** | **9** | **17** | **4** |

---

## 🎯 Testing Workflow

### ASCII Workflow Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                     TESTING WORKFLOW                         │
└─────────────────────────────────────────────────────────────┘

1. LOGIN TESTS
   ├─ TS-001: SUPER_ADMIN ⏳
   ├─ TS-002: ADMIN ⏳
   ├─ TS-003: ADMIN_LAYANAN ⏳
   ├─ TS-004: DOCTOR ✅
   ├─ TS-005: NURSE ✅
   └─ TS-037: Rate Limiting ✅

2. MEMBER TESTS
   ├─ TS-007: Create Member (Valid) ⏳
   ├─ TS-008: Create Member (Invalid Referral) ✅
   ├─ TS-009: View Member Detail ⏳
   ├─ TS-010: Edit Member ⏳
   └─ TS-011: Delete Member ⏳

3. PACKAGE TESTS
   ├─ TS-012: Assign Package ⏳
   ├─ TS-013: Verify Payment ⏳
   ├─ TS-014: View Package Detail ⏳
   ├─ TS-015: Edit Package ⏳
   ├─ TS-016: Cancel Package ⏳
   ├─ TS-017: Package Usage Tracking 🚫 (Blocked)
   └─ TS-018: Package Auto-Expire 🚫 (Blocked)

4. SESSION TESTS
   ├─ TS-019: Create Session (ADMIN_LAYANAN) ⏳
   ├─ TS-020: Create Session (DOCTOR) ✅ (Workflow Blocked)
   ├─ TS-021: Create Session (NURSE) ✅ (Workflow Blocked)
   ├─ TS-022: Complete Session Workflow 🚫 (Blocked)
   ├─ TS-023: Session Material Usage 🚫 (Blocked)
   ├─ TS-024: Session Invoice Generation 🚫 (Blocked)
   ├─ TS-025: View Session Detail ⏳
   ├─ TS-026: Edit Session ⏳
   └─ TS-027: Cancel Session ⏳

5. INCENTIVE TESTS
   ├─ TS-031: First Package Incentive ✅
   ├─ TS-032: Next Package Incentive ✅
   └─ TS-033: Referral Validation ✅

6. AUDIT TESTS
   └─ TS-006: Audit Log BranchId ✅

7. INVOICE TESTS
   ├─ TS-028: View Invoice ⏳
   ├─ TS-029: Invoice Payment Method ⏳
   └─ TS-030: Print Invoice ⏳

8. DASHBOARD TESTS
   ├─ TS-034: Dashboard (ADMIN) ⏳
   ├─ TS-035: Dashboard (DOCTOR) ⏳
   └─ TS-036: Dashboard (NURSE) ⏳

9. OTHER TESTS
   ├─ TS-038: Branch Management ⏳
   ├─ TS-039: Inventory Management ⏳
   └─ TS-040: User Management ⏳
```

---

## 📚 Quick Reference

### Test Accounts
| Role | Email | Password | Branch |
|------|-------|----------|--------|
| SUPER_ADMIN | superadmin@example.com | password123 | All |
| ADMIN | admin1@example.com | password123 | Jakarta Pusat |
| ADMIN_LAYANAN | adminlayanan1@example.com | password123 | Jakarta Pusat |
| DOCTOR | dokter1@example.com | password123 | Jakarta Pusat |
| NURSE | nakes1@example.com | password123 | Jakarta Pusat |

### Valid Referral Codes
- REF1, REF2, REF3, REF4, REF5
- REF6, REF7, REF8, REF9, REF10
- REF11, REF12, REF13, REF14, REF15

### Test URLs
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:5000
- **Login:** http://localhost:3000/login
- **Dashboard:** http://localhost:3000/dashboard

### Documentation
- **Patch Notes:** `docs/PATCH-NOTES-11-MEI-2026.md`
- **Summary:** `docs/SUMMARY-11-MEI-2026.md`
- **Troubleshooting:** `docs/TROUBLESHOOT-NURSE-CREATE-SESSION.md`

---

**Version:** 1.5.0  
**Date:** 11 Mei 2026  
**Status:** 8/40 scenarios fixed, 32 pending

---

**End of Test Scenarios**
