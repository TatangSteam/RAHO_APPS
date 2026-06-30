# Phase 4: Full Regression & Extended Critical Flows

**Status:** 🚀 In Progress  
**Started:** 30 Juni 2026

---

## 📋 Overview

Phase 4 extends Phase 3 by adding:
1. **Remaining Critical Flows** - Session therapy, payments, audit logs
2. **Edge Cases** - Error scenarios, validation, boundary conditions
3. **Concurrent Operations** - Multi-user scenarios
4. **Performance Tests** - Load times, API response times
5. **Regression Tests** - Ensure existing features still work

---

## 🎯 Goals

- [ ] Add 50+ more tests (total ~90+ tests)
- [ ] Cover all critical business flows
- [ ] Test error handling thoroughly
- [ ] Verify data integrity
- [ ] Test concurrent user scenarios
- [ ] Performance baseline

---

## 📊 Phase 4 Test Categories

### 1. Session Therapy CRUD ⭐ Priority: HIGH
**Estimated:** 15 tests

- [ ] Create new therapy session
- [ ] View session details
- [ ] Update session notes
- [ ] Complete session
- [ ] Cancel session
- [ ] Assign doctor to session
- [ ] Assign nurse to session
- [ ] Record vital signs
- [ ] Add diagnosis (ICD codes)
- [ ] Create therapy plan
- [ ] Add therapy plan items
- [ ] Schedule follow-up session
- [ ] Validate required fields
- [ ] Handle concurrent session updates
- [ ] Session history tracking

---

### 2. Payment & Verification Flow ⭐ Priority: HIGH
**Estimated:** 12 tests

- [ ] Create invoice for session
- [ ] Add invoice items
- [ ] Calculate totals (subtotal, tax, discount)
- [ ] Process payment
- [ ] Multiple payment methods
- [ ] Partial payment
- [ ] Payment verification workflow
- [ ] Approve payment
- [ ] Reject payment with reason
- [ ] Refund payment
- [ ] Invoice PDF generation
- [ ] Receipt printing

---

### 3. Audit Log Viewing ⭐ Priority: MEDIUM
**Estimated:** 8 tests

- [ ] View audit logs
- [ ] Filter by user
- [ ] Filter by action type
- [ ] Filter by date range
- [ ] Search audit logs
- [ ] View audit details
- [ ] Export audit logs
- [ ] Verify log accuracy (create/update/delete tracked)

---

### 4. Report Generation ⭐ Priority: MEDIUM
**Estimated:** 10 tests

- [ ] Generate member report
- [ ] Generate session report
- [ ] Generate payment report
- [ ] Generate inventory report
- [ ] Filter reports by date range
- [ ] Filter reports by branch
- [ ] Export report to PDF
- [ ] Export report to Excel
- [ ] Schedule report generation
- [ ] Email report

---

### 5. Notification System ⭐ Priority: LOW
**Estimated:** 6 tests

- [ ] View notifications
- [ ] Mark notification as read
- [ ] Clear all notifications
- [ ] Notification badge count
- [ ] Real-time notification updates
- [ ] Notification preferences

---

### 6. Edge Cases & Error Handling ⭐ Priority: HIGH
**Estimated:** 15 tests

#### Validation Edge Cases
- [ ] Create member with minimum valid data
- [ ] Create member with maximum character limits
- [ ] Invalid email formats
- [ ] Invalid phone formats
- [ ] Invalid date formats
- [ ] Negative numbers in quantity fields
- [ ] Zero values in price fields

#### Network & API Errors
- [ ] Handle 400 Bad Request
- [ ] Handle 401 Unauthorized
- [ ] Handle 403 Forbidden
- [ ] Handle 404 Not Found
- [ ] Handle 500 Server Error
- [ ] Handle network timeout
- [ ] Handle network disconnection
- [ ] Retry failed requests

---

### 7. Concurrent Operations ⭐ Priority: MEDIUM
**Estimated:** 8 tests

- [ ] Two users edit same member
- [ ] Two users create stock request for same item
- [ ] Manager approves while user cancels request
- [ ] Doctor and nurse update same session
- [ ] Concurrent payment processing
- [ ] Concurrent inventory updates
- [ ] Race condition handling
- [ ] Optimistic locking verification

---

### 8. Data Integrity ⭐ Priority: HIGH
**Estimated:** 10 tests

- [ ] Member deletion removes related data
- [ ] Session completion updates member history
- [ ] Payment completion updates invoice status
- [ ] Stock shipment updates inventory levels
- [ ] Therapy plan versioning works correctly
- [ ] Audit logs capture all changes
- [ ] Soft delete preserves referential integrity
- [ ] Cascade operations work correctly
- [ ] Transaction rollback on error
- [ ] Data consistency across tables

---

### 9. Access Control & Permissions ⭐ Priority: HIGH
**Estimated:** 12 tests

#### Role-Based Access
- [ ] SUPER_ADMIN can access all features
- [ ] ADMIN_MANAGER can approve stock requests
- [ ] ADMIN_CABANG can manage branch data only
- [ ] ADMIN_LAYANAN can view sessions only
- [ ] DOCTOR can create therapy plans
- [ ] NURSE can record vital signs
- [ ] Users cannot access unauthorized routes
- [ ] API returns 403 for unauthorized actions

#### Branch-Based Access
- [ ] User sees only their branch data
- [ ] PUSAT branch sees all branches
- [ ] Cross-branch data access denied
- [ ] Stock requests respect branch boundaries

---

### 10. Search & Filter Performance ⭐ Priority: MEDIUM
**Estimated:** 6 tests

- [ ] Search with 1000+ members
- [ ] Complex filter combinations
- [ ] Pagination with large datasets
- [ ] Sort by different columns
- [ ] Search with special characters
- [ ] Filter performance baseline

---

## 🗂️ New Page Objects to Create

### 1. SessionPage.ts
```typescript
class SessionPage {
  createSession(data)
  viewSession(id)
  updateSession(id, data)
  completeSession(id)
  cancelSession(id)
  assignDoctor(sessionId, doctorId)
  assignNurse(sessionId, nurseId)
  recordVitalSigns(sessionId, vitals)
  addDiagnosis(sessionId, icdCode)
  createTherapyPlan(sessionId, plan)
  expectSessionStatus(status)
}
```

### 2. PaymentPage.ts
```typescript
class PaymentPage {
  createInvoice(sessionId)
  addInvoiceItem(invoiceId, item)
  processPayment(invoiceId, method, amount)
  verifyPayment(invoiceId)
  approvePayment(invoiceId)
  rejectPayment(invoiceId, reason)
  refundPayment(invoiceId, amount)
  generateInvoicePDF(invoiceId)
  expectPaymentStatus(status)
  expectTotalAmount(amount)
}
```

### 3. AuditLogPage.ts
```typescript
class AuditLogPage {
  goto()
  filterByUser(userId)
  filterByAction(action)
  filterByDateRange(start, end)
  searchLogs(query)
  viewDetails(logId)
  exportLogs(format)
  expectLogExists(action, entity)
  expectLogCount(count)
}
```

### 4. ReportPage.ts
```typescript
class ReportPage {
  goto()
  generateMemberReport(filters)
  generateSessionReport(filters)
  generatePaymentReport(filters)
  generateInventoryReport(filters)
  filterByDateRange(start, end)
  filterByBranch(branchId)
  exportToPDF()
  exportToExcel()
  expectReportGenerated()
}
```

---

## 🔧 New Helper Utilities

### 1. Data Generators
```typescript
// e2e/helpers/dataGenerators.ts
export function generateMember(overrides?)
export function generateSession(overrides?)
export function generatePayment(overrides?)
export function generateStockRequest(overrides?)
export function generateRandomEmail()
export function generateRandomPhone()
```

### 2. Assertion Helpers
```typescript
// e2e/helpers/assertions.ts
export function expectToastMessage(page, message)
export function expectModalOpen(page, title)
export function expectTableRowCount(page, count)
export function expectFormError(page, field, message)
export function expectApiError(page, statusCode)
```

### 3. Performance Helpers
```typescript
// e2e/helpers/performance.ts
export function measurePageLoadTime(page)
export function measureApiResponseTime(page, endpoint)
export function expectLoadTimeBelow(time, threshold)
export function trackMemoryUsage()
```

---

## 📁 Phase 4 File Structure

```
e2e/
├── critical/                    # Phase 3 (existing)
│   ├── logout.spec.ts          ✅
│   ├── member-crud.spec.ts     ✅
│   └── inventory-flow.spec.ts  ✅
│
├── flows/                       # 🆕 Phase 4 - Critical Flows
│   ├── session-therapy.spec.ts
│   ├── payment-flow.spec.ts
│   ├── audit-logs.spec.ts
│   ├── reports.spec.ts
│   └── notifications.spec.ts
│
├── regression/                  # 🆕 Phase 4 - Edge Cases
│   ├── validation-edge-cases.spec.ts
│   ├── error-handling.spec.ts
│   ├── concurrent-operations.spec.ts
│   ├── data-integrity.spec.ts
│   ├── access-control.spec.ts
│   └── search-performance.spec.ts
│
├── pages/                       # Page Objects
│   ├── MemberPage.ts           ✅
│   ├── InventoryPage.ts        ✅
│   ├── SessionPage.ts          🆕
│   ├── PaymentPage.ts          🆕
│   ├── AuditLogPage.ts         🆕
│   └── ReportPage.ts           🆕
│
└── helpers/
    ├── auth.ts                 ✅
    ├── navigation.ts           ✅
    ├── waiters.ts              ✅
    ├── dataGenerators.ts       🆕
    ├── assertions.ts           🆕
    └── performance.ts          🆕
```

---

## 🚀 Implementation Order

### Week 1: Critical Flows
1. ✅ Session Therapy CRUD (15 tests)
2. ✅ Payment & Verification (12 tests)
3. ✅ Audit Logs (8 tests)

### Week 2: Supporting Features
4. Reports Generation (10 tests)
5. Notifications (6 tests)

### Week 3: Regression & Edge Cases
6. Validation Edge Cases (15 tests)
7. Access Control (12 tests)
8. Data Integrity (10 tests)

### Week 4: Performance & Concurrent
9. Concurrent Operations (8 tests)
10. Search Performance (6 tests)

---

## 📊 Expected Outcomes

### Test Coverage
- **Phase 3:** 40+ tests ✅
- **Phase 4:** 50+ tests 🎯
- **Total:** 90+ tests

### Coverage Areas
- ✅ Authentication & Authorization
- ✅ Member Management
- ✅ Inventory Management
- 🆕 Session Therapy
- 🆕 Payment Processing
- 🆕 Audit Logging
- 🆕 Reporting
- 🆕 Notifications
- 🆕 Edge Cases
- 🆕 Error Handling
- 🆕 Concurrent Operations
- 🆕 Data Integrity

---

## 🎯 Success Criteria

### Phase 4 Complete When:
- [ ] All 50+ new tests written
- [ ] All tests passing consistently
- [ ] Test execution time < 15 minutes
- [ ] Flakiness rate < 1%
- [ ] All page objects documented
- [ ] All helpers documented
- [ ] Phase 4 documentation complete
- [ ] Ready for CI/CD integration

---

## 📈 Metrics to Track

### Test Metrics
- Total tests: 90+
- Pass rate: > 98%
- Execution time: < 15 min
- Flakiness: < 1%
- Coverage: > 80% critical flows

### Quality Metrics
- Code review: All tests reviewed
- Documentation: All features documented
- Maintainability: Page objects for all pages
- Reusability: Helpers for common operations

---

## 🔄 CI/CD Integration (Future)

After Phase 4, integrate with CI/CD:
- [ ] GitHub Actions workflow
- [ ] Run on every PR
- [ ] Run nightly full suite
- [ ] Slack notifications
- [ ] Test result dashboard
- [ ] Automatic retry on flaky tests

---

## 📝 Notes

### Test Data Strategy
- Use dynamic test data (timestamps)
- Clean up test data after each test
- Use separate test database
- Seed required reference data

### Test Isolation
- Each test independent
- No shared state between tests
- Tests can run in parallel
- Tests can run in any order

### Performance Considerations
- Use storage state for auth (fast)
- Parallel execution where possible
- Efficient selectors (role, label)
- Minimize network requests in tests

---

**Ready to start Phase 4 implementation!**

**Next:** Create SessionPage.ts and session-therapy.spec.ts

