# Requirements Traceability Matrix - RAHO ERP Management System

Last updated: 6 Juli 2026

RTM ini menghubungkan requirement backlog dengan business rule, use case, API/API group, dan test case. Tujuannya agar coverage requirement dapat ditelusuri dari kebutuhan bisnis sampai validasi QA.

Referensi dokumen:
- Requirement: `REQUIREMENT_BACKLOG_TABLE.md`
- Business rule: `BUSINESS_RULES.md`
- Use case: `USE_CASES.md`
- API mapping: `API_MAPPING.md`
- Test case: `TEST_CASES.md`

| Req ID | Requirement / Feature | Business Rule | Use Case | API / Interface | Test Case | Priority | Coverage Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | Login | BR-001, BR-002, BR-003, BR-004 | UC-001 | `POST /api/v1/auth/login` | TC-001, TC-002, TC-003, TC-004, TC-005 | P0 | Covered |
| REQ-002 | Logout | BR-004, BR-005 | UC-002 | `POST /api/v1/auth/logout` | TC-006 | P0 | Covered |
| REQ-003 | Role-Based Access Control | BR-007, BR-008, BR-009, BR-181 | UC-009, UC-010 | All protected role-based routes | TC-009, TC-010, TC-147 | P0 | Covered |
| REQ-004 | Branch Access Control | BR-010, BR-011, BR-012, BR-013, BR-014, BR-172 | UC-013, UC-014 | Branch-scoped APIs; `X-Branch-Id` context | TC-011, TC-012, TC-148 | P0 | Covered |
| REQ-005 | Password Reset | BR-021 | UC-005 | Password reset endpoint / admin reset endpoint | TC-017 | P1 | Partial |
| REQ-006 | Forced Password Change | BR-020, BR-021 | UC-005 | User/password APIs | TC-018 | P1 | Partial |
| REQ-007 | Staff CRUD | BR-015, BR-016, BR-017, BR-018, BR-019 | UC-006, UC-007 | `/api/v1/users`, `/api/v1/admin/users` | TC-013, TC-014, TC-015, TC-016 | P0 | Covered |
| REQ-008 | Staff Branch Assignment | BR-010, BR-014, BR-017 | UC-008 | `/api/v1/users/:userId/branches` | TC-011, TC-012 | P0 | Covered |
| REQ-009 | Admin Manager Management | BR-013, BR-018, BR-029 | UC-009 | `/api/v1/admin/managers`, `/api/v1/admin/managers/:managerId/branches` | TC-024, TC-025 | P0 | Covered |
| REQ-010 | Staff Performance | BR-147, BR-148, BR-149 | UC-010 | Staff performance pages/APIs | TC-126, TC-127 | P1 | Partial |
| REQ-011 | Branch CRUD | BR-026, BR-027, BR-028 | UC-011, UC-012 | `/api/v1/branches`, `/api/v1/admin/branches` | TC-021, TC-022, TC-023 | P0 | Covered |
| REQ-012 | Branch Detail | BR-010, BR-029 | UC-011, UC-012 | `/api/v1/branches/:branchId`, branch detail routes | TC-026 | P1 | Covered |
| REQ-013 | Branch Switcher | BR-011, BR-014 | UC-013 | Frontend branch context; branch list APIs | TC-012 | P0 | Covered |
| REQ-014 | Member Multi-Branch Access | BR-010, BR-032, BR-033 | UC-014 | `POST /api/v1/members/grant-access` | TC-039, TC-040 | P1 | Covered |
| REQ-015 | Member Registration | BR-030, BR-031, BR-032, BR-034, BR-039, BR-040 | UC-015 | `POST /api/v1/members` | TC-027, TC-028, TC-029, TC-030 | P0 | Covered |
| REQ-016 | Member List | BR-033, BR-171, BR-200 | UC-016, UC-017 | `GET /api/v1/members`, `POST /api/v1/members/export` | TC-031, TC-032 | P0 | Covered |
| REQ-017 | Member Detail | BR-033, BR-041, BR-197 | UC-016 | `GET /api/v1/members/:memberId` | TC-033 | P0 | Covered |
| REQ-018 | Member Update | BR-035, BR-153, BR-198 | UC-018 | `PATCH /api/v1/members/:memberId` | TC-034 | P0 | Covered |
| REQ-019 | Member Status | BR-036, BR-037, BR-038 | UC-020 | Member update/status APIs | TC-020, TC-067 | P1 | Partial |
| REQ-020 | Lab Result | BR-039, BR-040, BR-158, BR-161 | UC-021 | `/api/v1/members/:memberId/lab-results` | TC-043, TC-044, TC-045 | P1 | Covered |
| REQ-021 | Member Dashboard | BR-041, BR-042 | UC-022 | `/api/v1/me/dashboard` | TC-046 | P1 | Covered |
| REQ-022 | My Sessions | BR-041, BR-044, BR-197 | UC-023 | `/api/v1/me/sessions`, `/api/v1/me/sessions/:sessionId` | TC-047, TC-048 | P1 | Covered |
| REQ-023 | My Packages | BR-041, BR-046, BR-048 | UC-024 | `/api/v1/me/vouchers` | TC-049 | P1 | Covered |
| REQ-024 | My Invoices | BR-041, BR-043, BR-076 | UC-025, UC-026 | `/api/v1/me/invoices` | TC-050, TC-166 | P1 | Covered |
| REQ-025 | Package Assignment | BR-045, BR-046, BR-060, BR-061 | UC-027 | `POST /api/v1/members/:memberId/packages` | TC-051, TC-052 | P0 | Covered |
| REQ-026 | Branch Pricing | BR-061, BR-062, BR-063 | UC-034 | `/api/v1/admin/package-pricing`, `/api/v1/package-pricings` | TC-064, TC-065 | P0 | Covered |
| REQ-027 | Discount | BR-064, BR-065 | UC-027 | Package assignment/pricing APIs | TC-053, TC-054 | P0 | Covered |
| REQ-028 | Payment Proof Upload | BR-066, BR-070, BR-158, BR-161 | UC-028 | Package payment proof APIs | TC-055 | P0 | Covered |
| REQ-029 | Payment Verification | BR-067, BR-068, BR-144 | UC-029, UC-030 | Package verify/reject APIs | TC-056, TC-057, TC-058 | P0 | Covered |
| REQ-030 | Package Edit | BR-052, BR-053 | UC-031 | Package edit APIs | TC-059, TC-060 | P1 | Covered |
| REQ-031 | Package Cancel | BR-050, BR-054 | UC-032 | Package cancel APIs | TC-061 | P1 | Covered |
| REQ-032 | Package Refund | BR-051, BR-055, BR-056, BR-057 | UC-033 | Package refund APIs | TC-062, TC-063 | P1 | Covered |
| REQ-033 | Create Session | BR-079, BR-080, BR-081, BR-082, BR-083 | UC-035 | `POST /api/v1/treatment-sessions` | TC-066, TC-067, TC-068 | P0 | Covered |
| REQ-034 | Diagnosis Step | BR-090, BR-091, BR-092, BR-093 | UC-036, UC-097, UC-098 | Session diagnosis APIs; `/api/v1/diagnosis/categories` | TC-070, TC-071 | P0 | Covered |
| REQ-035 | Therapy Plan Step | BR-094, BR-095, BR-096, BR-097, BR-099 | UC-037 | Session therapy plan APIs | TC-072 | P0 | Covered |
| REQ-036 | Vital Sign Before | BR-100, BR-101, BR-102 | UC-038 | Session vital signs APIs | TC-073, TC-074 | P0 | Covered |
| REQ-037 | Infusion Execution | BR-103, BR-104, BR-105 | UC-039 | Session infusion APIs | TC-075, TC-076 | P0 | Covered |
| REQ-038 | Material Usage | BR-106, BR-107, BR-108, BR-109, BR-110 | UC-040 | Session material usage APIs | TC-077, TC-078 | P0 | Covered |
| REQ-039 | Session Photos | BR-111, BR-112, BR-113 | UC-041 | Session photo upload APIs | TC-079 | P1 | Covered |
| REQ-040 | Vital Sign After | BR-100, BR-101, BR-102 | UC-042 | Session vital signs APIs | TC-080 | P0 | Covered |
| REQ-041 | Doctor Evaluation | BR-091, BR-198 | UC-043 | Session evaluation APIs | TC-081 | P0 | Covered |
| REQ-042 | Complete Session | BR-085, BR-086, BR-087, BR-088, BR-089 | UC-044, UC-045 | Session complete APIs | TC-082, TC-083, TC-084, TC-085 | P0 | Covered |
| REQ-043 | Therapy Plan Set | BR-094, BR-095, BR-097 | UC-046 | `/api/v1/members/:memberId/therapy-plans` | TC-086, TC-088 | P1 | Covered |
| REQ-044 | Bulk Therapy Plan | BR-098 | UC-047 | `POST /api/v1/members/:memberId/therapy-plans/bulk` | TC-086, TC-087 | P1 | Covered |
| REQ-045 | Plan Versioning | BR-096, BR-097 | UC-048 | Therapy plan edit/history APIs | TC-088, TC-089 | P1 | Covered |
| REQ-046 | Master Product | BR-114, BR-115, BR-140 | UC-049 | `/api/v1/admin/master-products`, inventory master APIs | TC-090, TC-091 | P0 | Covered |
| REQ-047 | Branch Inventory | BR-116, BR-121, BR-122 | UC-050, UC-051 | `/api/v1/inventory` | TC-092, TC-096 | P0 | Covered |
| REQ-048 | Stock Mutation | BR-117, BR-118, BR-119 | UC-053 | `/api/v1/inventory/stock-mutations` | TC-094, TC-097 | P0 | Covered |
| REQ-049 | Stock Request | BR-123, BR-124, BR-125, BR-126 | UC-054 | `/api/v1/inventory/stock-requests` | TC-098, TC-099 | P0 | Covered |
| REQ-050 | Stock Request Approval | BR-127, BR-128, BR-129 | UC-055 | Stock request review/approval APIs | TC-100, TC-101 | P0 | Covered |
| REQ-051 | Shipment | BR-130, BR-131, BR-132, BR-133, BR-134, BR-135 | UC-056, UC-057, UC-058, UC-059 | `/api/v1/inventory/shipments` | TC-102, TC-103, TC-104, TC-105, TC-106, TC-107 | P0 | Covered |
| REQ-052 | Stock Opname | BR-120, BR-177 | UC-052 | Inventory adjustment APIs | TC-094, TC-095 | P1 | Partial |
| REQ-053 | Invoice Generation | BR-071, BR-072, BR-073, BR-077 | UC-062 | `/api/v1/invoices` | TC-110 | P0 | Covered |
| REQ-054 | Record Payment | BR-069, BR-073 | UC-063 | Invoice payment APIs | TC-111, TC-112, TC-113 | P1 | Covered |
| REQ-055 | Invoice Cancellation | BR-074, BR-075 | UC-064 | Invoice cancel APIs | TC-114, TC-115 | P1 | Covered |
| REQ-056 | Invoice PDF | BR-078, BR-158 | UC-065 | Invoice print/download APIs | TC-116 | P1 | Covered |
| REQ-057 | Non-Therapy Product | BR-138, BR-139, BR-140 | UC-066, UC-067 | `/api/v1/non-therapy`, `/api/v1/admin/non-therapy-products` | TC-118, TC-119, TC-120 | P1 | Covered |
| REQ-058 | Referral Code | BR-141, BR-142, BR-143 | UC-068, UC-069 | `/api/v1/referrals` | TC-121, TC-122 | P1 | Covered |
| REQ-059 | Incentive Calculation | BR-144, BR-145 | UC-070 | Referral/package verification services | TC-123, TC-124, TC-165 | P1 | Covered |
| REQ-060 | Incentive Export | BR-146, BR-200 | UC-071 | Referral export APIs | TC-125 | P1 | Covered |
| REQ-061 | Role Dashboard | BR-147, BR-148, BR-149 | UC-072, UC-073, UC-074, UC-075, UC-076 | `/api/v1/dashboard`, `/api/v1/admin/system-*` | TC-126, TC-127, TC-128, TC-129 | P1 | Covered |
| REQ-062 | Report Export | BR-150, BR-151, BR-200 | UC-077 | Report/export APIs | TC-130, TC-131 | P1 | Covered |
| REQ-063 | Scheduled Report | BR-152 | UC-078 | Scheduled report UI/API | TC-131 | P2 | Partial |
| REQ-064 | Audit Logging | BR-153, BR-154, BR-155 | UC-079 | Audit service; mutation APIs | TC-132, TC-134 | P0 | Covered |
| REQ-065 | Audit Log Viewer | BR-156 | UC-079 | `/api/v1/audit-logs`, `/api/v1/admin/system/audit-logs` | TC-133 | P0 | Covered |
| REQ-066 | Audit Export | BR-157, BR-180 | UC-080 | Audit export API | TC-134 | P1 | Partial |
| REQ-067 | Start/Stop Impersonation | BR-022, BR-023, BR-024, BR-025 | UC-081, UC-082 | `/api/v1/admin/impersonate/:userId`, `/api/v1/admin/stop-impersonation` | TC-135, TC-136, TC-137 | P0 | Covered |
| REQ-068 | Send Notification | BR-163, BR-164, BR-165 | UC-083 | `POST /api/v1/members/:memberId/notifications` | TC-138 | P1 | Covered |
| REQ-069 | Notification Center | BR-163, BR-165, BR-166 | UC-084 | Notification UI/API | TC-139 | P2 | Partial |
| REQ-070 | WhatsApp Notification | BR-165, BR-166 | UC-083 | External notification integration | TC-138 | P2 | Partial |
| REQ-071 | Chat | BR-167, BR-168 | UC-085 | Chat UI/API | TC-140 | P3 | Partial |
| REQ-072 | Protected File Access | BR-158, BR-161 | UC-086 | `GET /api/v1/files/*` | TC-141, TC-142, TC-143 | P0 | Covered |
| REQ-073 | Upload Validation | BR-159, BR-160, BR-179 | UC-019, UC-021, UC-026, UC-041 | Upload endpoints | TC-020, TC-038, TC-055, TC-079, TC-158 | P0 | Covered |
| REQ-074 | File Cleanup | BR-162 | UC-087 | Cleanup job/script | TC-143 | P2 | Partial |
| REQ-075 | Responsive Layout | BR-185, BR-186 | UI pages | Frontend responsive UI | TC-153, TC-154 | P1 | Covered |
| REQ-076 | Standard Loading/Error State | BR-185, BR-186 | UI pages | Frontend UI states | TC-149, TC-150, TC-151 | P1 | Covered |
| REQ-077 | Accessibility Baseline | BR-182, BR-183, BR-184 | UI pages | Frontend accessibility | TC-155 | P2 | Partial |
| REQ-078 | Modular Services | BR-169, BR-174, BR-175 | Developer flow | Backend modules | TC-089, TC-163 | P0 | Partial |
| REQ-079 | API Validation | BR-169, BR-170, BR-173 | API mutation flow | All mutation APIs | TC-145 | P0 | Covered |
| REQ-080 | Transaction Boundary | BR-174, BR-175, BR-176, BR-177 | Package/session/inventory flows | Payment, package, session, inventory APIs | TC-077, TC-082, TC-084, TC-163, TC-164 | P0 | Covered |
| REQ-081 | Database Indexing | BR-171 | Large list/report flows | List/report APIs | TC-160, TC-161, TC-162 | P1 | Covered |
| REQ-082 | Observability | BR-170, BR-194 | Ops monitoring | Logs, health, metrics | TC-167 | P1 | Partial |
| REQ-083 | Unit Test | BR-187 | Developer flow | Test runner | Unit test suite | P0 | Partial |
| REQ-084 | E2E Test | BR-187, BR-188, BR-189 | UC-088 | Playwright E2E | TC-163, TC-164, TC-165, TC-166 | P0 | Covered |
| REQ-085 | CI Pipeline | BR-187 | UC-089 | CI workflow | Build/type-check/test checks | P1 | Partial |
| REQ-086 | Regression Checklist | BR-187, BR-189 | UC-088 | Regression smoke pack | Regression Smoke Pack in `TEST_CASES.md` | P1 | Covered |
| REQ-087 | Docker Deployment | BR-190, BR-193, BR-194 | UC-090 | Docker compose / deployment scripts | TC-167 | P0 | Partial |
| REQ-088 | Production Migration | BR-191, BR-192 | UC-090 | Migration commands | TC-169 | P0 | Covered |
| REQ-089 | Backup & Restore | BR-195, BR-196 | UC-091, UC-092 | Backup/restore procedure | TC-170 | P0 | Covered |
| REQ-090 | Secret Management | BR-190, BR-194 | UC-090 | Environment/secret config | TC-168 | P0 | Partial |

## Coverage Summary

| Area | Total Requirement | Covered | Partial | Gap |
| --- | ---: | ---: | ---: | ---: |
| Functional Core | 67 | 61 | 6 | 0 |
| UX / Frontend Quality | 3 | 2 | 1 | 0 |
| Technical / QA / Ops | 20 | 11 | 9 | 0 |
| Total | 90 | 74 | 16 | 0 |

## Notes

- `Covered` berarti requirement sudah memiliki minimal business rule/use case/test case dan interface/API atau UI yang relevan.
- `Partial` berarti sudah ada traceability dasar, tetapi masih perlu detail implementasi tambahan, endpoint final, automated test, atau prosedur operasional.
- Tidak ada `Gap` pada level dokumentasi awal, tetapi beberapa item P1/P2/P3 masih perlu diperdalam saat implementasi atau hardening sprint.

