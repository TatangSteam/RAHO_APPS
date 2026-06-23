# TEST SCENARIO - ROLE SIMULATION FLOW

**Dokumen**: Skenario Testing dengan Simulasi Semua Role  
**Tanggal**: 23 Juni 2026  
**Tujuan**: Mensimulasikan penggunaan sistem oleh semua role dengan berbagai kondisi dan edge cases

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Test Data Preparation](#test-data-preparation)
3. [Role 1: SUPER_ADMIN](#role-1-super_admin)
4. [Role 2: ADMIN_MANAGER](#role-2-admin_manager)
5. [Role 3: ADMIN_CABANG](#role-3-admin_cabang)
6. [Role 4: ADMIN_LAYANAN](#role-4-admin_layanan)
7. [Role 5: DOCTOR](#role-5-doctor)
8. [Role 6: NURSE](#role-6-nurse)
9. [Role 7: MEMBER](#role-7-member)
10. [Integration Tests](#integration-tests)
11. [Edge Cases & Error Scenarios](#edge-cases--error-scenarios)

---

## OVERVIEW

### Test Environment
- **API URL**: `http://localhost:5000/api/v1`
- **Web URL**: `http://localhost:3000`
- **Database**: PostgreSQL dengan seed data minimal

### Test Users
Gunakan akun dari `seed-minimal.ts`:

| Role | Email | Password | Branch |
|------|-------|----------|--------|
| SUPER_ADMIN | admin@rahopremier.id | admin123 | Head Office |
| ADMIN_MANAGER | manager@rahopremier.id | manager123 | - |
| ADMIN_CABANG | admin.jakarta@rahopremier.id | admin123 | Jakarta |
| ADMIN_LAYANAN | layanan.jakarta@rahopremier.id | layanan123 | Jakarta |
| DOCTOR | dr.sarah@rahopremier.id | doctor123 | Jakarta |
| NURSE | nurse.andi@rahopremier.id | nurse123 | Jakarta |
| MEMBER | member@example.com | member123 | Jakarta |

---

## TEST DATA PREPARATION

### Prerequisites
```bash
# 1. Reset database
npm run db:reset

# 2. Run seed
cd apps/api
npm run seed:minimal

# 3. Start servers
npm run dev:api    # Terminal 1
npm run dev:web    # Terminal 2
```

### Verify Seed Data
✅ 5 Branches created (Head Office, Jakarta, Surabaya, Bandung, External)  
✅ 7 Users created (1 per role)  
✅ 1 Test member with active package  
✅ Package pricings auto-created  
✅ Inventory items auto-added  

---

## ROLE 1: SUPER_ADMIN

**User**: admin@rahopremier.id  
**Akses**: Semua fitur, semua cabang, dapat impersonate

### Test Scenario 1.1: Login & Dashboard
```
1. Login sebagai Super Admin
   ✅ Berhasil login
   ✅ Redirect ke /dashboard
   ✅ Melihat overview semua cabang
   ✅ Statistik: Total members, packages, sessions

2. Cek sidebar menu
   ✅ Dashboard
   ✅ Member Management
   ✅ Sessions
   ✅ Therapy Plans
   ✅ Inventory (Full Access)
   ✅ Admin Panel
   ✅ Branches
```

### Test Scenario 1.2: Branch Management
```
1. Buka menu "Branches"
   ✅ Lihat 5 cabang aktif
   ✅ Filter by type (HEAD_OFFICE, PREMIER, PARTNERSHIP)
   ✅ Search by name/code

2. Create New Branch
   Navigation: Branches → Create Branch
   Data:
   - Name: RAHO Premier Medan
   - Type: PREMIER
   - Province: Sumatera Utara
   - City: Medan
   - Address: Jl. Gatot Subroto No. 123
   - Phone: 061-12345678
   - Operating Hours: 08:00-17:00 Senin-Jumat
   
   Expected Result:
   ✅ Branch created with code 1275XX (Medan regency code)
   ✅ Auto-create 44 package pricings
   ✅ Auto-add products to inventory
   ✅ Success message displayed

3. Edit Branch
   - Update phone number
   - Change operating hours
   ✅ Changes saved successfully

4. View Branch Detail
   ✅ See branch stats (0 staff, 0 members)
   ✅ View empty sessions list
   ✅ View managers list (empty)

5. Try to Delete Branch (with data)
   - Select Jakarta branch
   - Click delete
   ✅ Error: "Cabang tidak dapat dihapus karena memiliki data historis"
   ✅ Shows: 1 member, 1 paket member, etc.

6. Delete Empty Branch
   - Select newly created Medan branch (no data)
   - Click delete
   ✅ Confirmation modal appears
   ✅ Successfully deleted
```

### Test Scenario 1.3: User Management
```
1. View All Users
   Navigation: Admin → Users
   ✅ See all 7 users
   ✅ Filter by role
   ✅ Filter by branch
   ✅ Search by email/name

2. Create ADMIN_MANAGER
   Click: Create Admin Manager
   Data:
   - Email: manager2@rahopremier.id
   - Password: manager456
   - Full Name: Manager Dua
   - Phone: 081234567890
   - Branches: [Jakarta, Surabaya]
   
   Expected Result:
   ✅ Admin Manager created
   ✅ Staff code: AM-XXXX
   ✅ Assigned to 2 branches
   ✅ Can view in managers list

3. Create Branch Staff
   Click: Create User
   Data:
   - Role: DOCTOR
   - Email: dr.budi@rahopremier.id
   - Password: doctor456
   - Full Name: Dr. Budi Santoso
   - Phone: 081234567891
   - Branch: Surabaya
   
   Expected Result:
   ✅ Doctor created
   ✅ Staff code: DOC-XXXX
   ✅ Auto-assigned to Surabaya via StaffBranch
   ✅ Can login immediately

4. Update User
   - Change email
   - Reset password
   - Change branch
   ✅ All changes saved

5. Deactivate User (Soft Delete)
   - Select inactive staff
   - Click deactivate
   ✅ Confirmation modal
   ✅ User isActive = false
   ✅ Cannot login anymore
   ✅ Email can be reused (test the fix!)

6. Reactivate User
   - Filter: Show Inactive
   - Select deactivated user
   - Click reactivate
   ✅ User isActive = true
   ✅ Can login again
```

### Test Scenario 1.4: Package Pricing Management
```
1. View Package Pricing
   Navigation: Admin → Package Pricing
   ✅ See all branches
   ✅ Filter by branch
   ✅ See therapy packages (BASIC type)
   ✅ See booster packages

2. Bulk Update Pricing (Jakarta)
   - Select Jakarta branch
   - Update therapy package prices:
     * TNB 1X: 2,000,000 → 2,100,000
     * TNB 7X: 12,500,000 → 13,000,000
   ✅ Confirmation modal
   ✅ Prices updated
   ✅ Audit log created

3. View Branch-Specific Pricing
   - Compare Jakarta vs Surabaya pricing
   ✅ Different prices per branch

4. Deactivate Package
   - Select unused package
   - Click deactivate
   ✅ Package hidden from member purchase
```

### Test Scenario 1.5: Impersonation
```
1. Impersonate ADMIN_CABANG
   Navigation: Admin → Users → Select admin.jakarta
   Click: Impersonate
   
   Expected Result:
   ✅ Impersonation token issued
   ✅ Badge: "Impersonating as Admin Jakarta"
   ✅ Sidebar: Only Jakarta data visible
   ✅ Cannot access Super Admin features
   ✅ Can perform Admin Cabang actions

2. Test Actions While Impersonating
   - Create new member
   - View members (only Jakarta)
   - Cannot view other branches
   ✅ All restrictions applied correctly

3. Stop Impersonation
   Click: Stop Impersonating
   ✅ Back to Super Admin view
   ✅ Badge removed
   ✅ Full access restored
```

### Test Scenario 1.6: System Stats & Reports
```
1. View Dashboard Stats
   ✅ Total branches: 5
   ✅ Total members: X
   ✅ Active packages: X
   ✅ Total sessions: X
   ✅ Recent activities

2. View Audit Logs
   Navigation: Admin → Audit Logs
   ✅ Filter by action (CREATE, UPDATE, DELETE)
   ✅ Filter by user
   ✅ Filter by resource
   ✅ Filter by date range
   ✅ View detailed changes

3. Export Reports
   ✅ Member list export (CSV)
   ✅ Package sales report
   ✅ Session statistics
```

---

## ROLE 2: ADMIN_MANAGER

**User**: manager@rahopremier.id  
**Akses**: Kelola staff, pricing, inventory di assigned branches

### Test Scenario 2.1: Login & Access Control
```
1. Login sebagai Admin Manager
   ✅ Berhasil login
   ✅ Redirect ke /dashboard

2. Verify Limited Access
   Sidebar Check:
   ✅ Dashboard (assigned branches only)
   ✅ Members (assigned branches)
   ✅ Sessions (assigned branches)
   ✅ Inventory Management
   ✅ Admin Panel (limited)
   ❌ Branch Management (no create/delete)
   ❌ System Settings
   ❌ Cannot impersonate
```

### Test Scenario 2.2: Branch Assignment
```
Note: Admin Manager melihat branch berdasarkan ManagerBranch table

1. View Assigned Branches
   Navigation: Branches
   Expected: Only see branches in ManagerBranch
   ✅ See assigned branches only
   ✅ Cannot see unassigned branches

2. Filter Data by Branch
   - Switch between assigned branches
   ✅ Members filtered correctly
   ✅ Sessions filtered correctly
   ✅ Inventory filtered correctly
```

### Test Scenario 2.3: Staff Management (Assigned Branches)
```
1. View Staff in Assigned Branches
   ✅ See staff from assigned branches only
   ✅ Filter by role, branch works correctly

2. Create & Manage Staff
   ✅ Can create staff in assigned branches
   ✅ Can update credentials (email/password)
   ✅ Cannot access unassigned branches

3. Inventory Management
   ✅ Approve stock requests from assigned branches
   ✅ Manage shipments between assigned branches
```

---

## ROLE 3: ADMIN_CABANG

**User**: admin.jakarta@rahopremier.id  
**Akses**: Full control untuk 1 cabang, dapat mengelola member, staff cabang, inventory, sessions

### Test Scenario 3.1: Member Registration & Package
```
1. Register New Member
   - Full profile dengan KTP/documents
   - Purchase package (TNB 7X)
   ✅ Member created dengan memberNo
   ✅ Package active, sessions available

2. Member Medical Records
   - Add diagnoses (ICD-10)
   - Add medical history
   - View/edit anamnesis
   ✅ All medical data saved

3. Create Therapy Plan
   - Multiple sets dengan dosage
   - Submit for approval
   ✅ Therapy plan created dengan status DRAFT
```

### Test Scenario 3.2: Session Management  
```
1. Create Session (as Admin Cabang dapat act as any role)
   - Select member dengan package aktif
   - Assign doctor, nurse
   - Record vitals, infusion, photo
   - Complete session
   ✅ Session created dan member quota berkurang

2. View Branch Sessions
   ✅ Filter by date, status, member
   ✅ Export session reports
```

---

## ROLE 4: ADMIN_LAYANAN

**User**: layanan.jakarta@rahopremier.id  
**Akses**: Fokus pada member service, sessions, inventory usage

### Test Scenario 4.1: Member Service
```
1. Member Check-in
   - Search member by memberNo
   - Verify active package
   - Create encounter
   ✅ Ready for session

2. Session Coordination
   - Assign doctor/nurse (if not assigned)
   - Monitor session progress
   ✅ Session workflow smooth
```

---

## ROLE 5: DOCTOR

**User**: dr.sarah@rahopremier.id  
**Akses**: Medical records, therapy plans, sessions (as doctor)

### Test Scenario 5.1: Therapy Plan Management
```
1. View Therapy Plans untuk Approval
   ✅ See pending therapy plans
   ✅ Review dosage, medication
   ✅ Approve or request revision

2. Create/Edit Therapy Plans
   ✅ Create new therapy plan with sets
   ✅ Edit dosage for existing plans
```

### Test Scenario 5.2: Session (Doctor Role)
```
1. Conduct Session
   - Record diagnosis
   - Set medication/infusion
   - Add notes
   ✅ Session documented properly
```

---

## ROLE 6: NURSE  

**User**: nurse.andi@rahopremier.id  
**Akses**: Execute sessions, record vitals, infusion

### Test Scenario 6.1: Session Execution
```
1. Record Vitals (Before/After)
   ✅ Vital signs saved

2. Execute Infusion Process
   ✅ Record infusion details
   ✅ Material usage tracked

3. Upload Photos
   ✅ Supporting photos uploaded
```

---

## ROLE 7: MEMBER

**User**: member@example.com  
**Akses**: View own data only

### Test Scenario 7.1: Member Portal
```
1. Login & Dashboard
   ✅ View profile
   ✅ View active packages
   ✅ View session history

2. View Medical Records
   ✅ See diagnoses
   ✅ See therapy plans
   ✅ View session details
```

---

## INTEGRATION TESTS

### End-to-End Flow: Member Journey
```
1. ADMIN_CABANG: Register member + purchase package
2. ADMIN_LAYANAN: Create encounter
3. DOCTOR: Create therapy plan → Submit
4. DOCTOR: Approve therapy plan
5. ADMIN_LAYANAN: Create session, assign staff
6. NURSE: Record vitals (before)
7. DOCTOR: Record diagnosis, set infusion
8. NURSE: Execute infusion, record vitals (after), upload photos
9. ADMIN_LAYANAN: Complete session
10. MEMBER: Login and view session history

✅ All data flows correctly
✅ Package quota decremented
✅ Audit logs complete
```

### Inventory Flow
```
1. ADMIN_CABANG: Request stock from HO
2. SUPER_ADMIN: Approve request → Create shipment
3. ADMIN_CABANG: Receive shipment
4. NURSE: Use materials in session
5. ADMIN_CABANG: Monitor stock levels

✅ Stock tracked correctly
✅ Low stock alerts work
```

---

## EDGE CASES & ERROR SCENARIOS

### Authentication & Authorization
```
❌ Login with wrong password
❌ Access unauthorized endpoint
❌ Impersonate without permission
✅ All blocked correctly with proper errors
```

### Data Validation
```
❌ Create member with invalid email
❌ Create package with 0 sessions
❌ Assign non-existent branch
❌ Submit session without required fields
✅ All validation errors shown properly
```

### Business Logic
```
❌ Create session without active package
❌ Use more sessions than available quota
❌ Delete branch with historical data
❌ Reuse email from active user
✅ All business rules enforced

✅ Reuse email from inactive user (WORKS after fix!)
```

### Concurrent Operations
```
Test: 2 nurses try to complete same session
✅ Only first succeeds, second gets error
```

---

## SUMMARY CHECKLIST

### All Roles Tested
- ✅ SUPER_ADMIN - Full system access
- ✅ ADMIN_MANAGER - Multi-branch management
- ✅ ADMIN_CABANG - Single branch full control
- ✅ ADMIN_LAYANAN - Member service focus
- ✅ DOCTOR - Medical focus
- ✅ NURSE - Session execution
- ✅ MEMBER - Self-service portal

### All Features Tested
- ✅ Authentication & Authorization
- ✅ Branch Management
- ✅ User Management
- ✅ Member Registration
- ✅ Package Management
- ✅ Therapy Plan Workflow
- ✅ Session Workflow (8 steps)
- ✅ Inventory Management
- ✅ Medical Records
- ✅ Audit Logging
- ✅ Impersonation
- ✅ Multi-branch Assignment

### All Conditions Tested
- ✅ Happy path scenarios
- ✅ Error scenarios
- ✅ Edge cases
- ✅ Permission boundaries
- ✅ Data validation
- ✅ Business rules
- ✅ Concurrent operations

---

**Document Status**: ✅ COMPLETE  
**Last Updated**: 23 Juni 2026  
**Tested By**: Development Team  
**Next Review**: Setelah major updates
