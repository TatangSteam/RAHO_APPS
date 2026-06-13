# 🚀 Quick Start - Debug Bulk Therapy Modal

## ⚡ Fast Track (5 minutes)

### 1. Start Servers (2 terminals)
```bash
# Terminal 1 - API
cd apps/api
npm run dev

# Terminal 2 - Web
cd apps/web
npm run dev
```

### 2. Find Test Member
Run this in your database tool (replace `<MEMBER_ID>`):
```sql
SELECT 
  m.memberNo,
  mp.packageType,
  mp.totalSessions,
  COUNT(tp.id) as existingPlans,
  (mp.totalSessions - COUNT(tp.id)) as shouldCreate
FROM "Member" m
JOIN "MemberPackage" mp ON mp.memberId = m.id AND mp.status = 'ACTIVE'
LEFT JOIN "TherapyPlan" tp ON tp.memberId = m.id
WHERE m.id = '<MEMBER_ID>'
GROUP BY m.memberNo, mp.packageType, mp.totalSessions;
```

Or find any member with available slots:
```sql
SELECT 
  m.id,
  m.memberNo,
  p.fullName,
  mp.totalSessions,
  COUNT(tp.id) as existing,
  (mp.totalSessions - COUNT(tp.id)) as available
FROM "Member" m
JOIN "Profile" p ON p.userId = m.userId
JOIN "MemberPackage" mp ON mp.memberId = m.id AND mp.status = 'ACTIVE'
LEFT JOIN "TherapyPlan" tp ON tp.memberId = m.id
GROUP BY m.id, m.memberNo, p.fullName, mp.totalSessions
HAVING (mp.totalSessions - COUNT(tp.id)) > 0
LIMIT 5;
```

### 3. Test Modal
1. Open member detail page
2. Click **"Terapi Plan"** tab
3. Click **"📋 Buat Bulk"** button

### 4. Check Logs

**Browser (F12 → Console):**
```
📦 Package Summary Response: ...
📊 Can Create: X
📈 Existing: X
```

**API Terminal:**
```
🔍 Package Summary Debug:
  Total Sessions: X
  Existing Therapy Plans: X
  Can Create: X
```

### 5. Share Results
Copy ALL console logs and paste in next message.

---

## 📊 What the Logs Mean

### ✅ Working Correctly
```
Backend: Can Create: 4
Frontend: Can Create: 4
Modal: Shows 4 rows, table populated
```
**Action:** Test creating the plans!

### ❌ All Plans Created
```
Backend: Can Create: 0 (Total: 7, Existing: 7)
Frontend: Can Create: 0
Modal: Warning message, no rows
```
**Action:** This is correct behavior, test with different member

### ⚠️ Data Issue
```
Backend: Can Create: 4
Frontend: Can Create: 0 (or undefined)
```
**Action:** API/Frontend communication issue, share logs

---

## 🔧 Quick Fixes

### No Active Package
```sql
-- Activate a package manually
UPDATE "MemberPackage"
SET status = 'ACTIVE', activatedAt = NOW()
WHERE memberId = '<MEMBER_ID>'
  AND packageCode = '<PACKAGE_CODE>';
```

### Check Package Status
```sql
SELECT * FROM "MemberPackage"
WHERE memberId = '<MEMBER_ID>'
ORDER BY createdAt DESC;
```

### Create Test Member Package
```sql
-- Quick test: Create a 7-session package
INSERT INTO "MemberPackage" (
  id, packageCode, memberId, branchId,
  packageType, totalSessions, finalPrice,
  status, assignedBy, activatedAt
) VALUES (
  gen_random_uuid(),
  'PKG-TEST-' || floor(random() * 1000000),
  '<MEMBER_ID>',
  '<BRANCH_ID>',
  'BASIC_P7_HC',
  7,
  5000000,
  'ACTIVE',
  '<YOUR_USER_ID>',
  NOW()
);
```

---

## 📋 Report Template

```
MEMBER INFO:
- ID: <member-id>
- Member No: <member-no>
- Package: <package-type>

BACKEND LOGS:
<paste all backend console output>

FRONTEND LOGS:
<paste all browser console output>

MODAL SHOWS:
- Can Create: X
- Rows displayed: X
- Error/Warning: <any message>

SCREENSHOT:
<optional: attach screenshot>
```

---

## 🎯 Expected Behavior

### Scenario 1: Fresh Package (7 sessions, 0 plans)
- Backend: Can Create: 7
- Modal: Shows 7 rows (Terapi ke-1 to ke-7)

### Scenario 2: Partial (7 sessions, 3 plans)
- Backend: Can Create: 4
- Modal: Shows 4 rows (Terapi ke-4 to ke-7)

### Scenario 3: Complete (7 sessions, 7 plans)
- Backend: Can Create: 0
- Modal: Warning message, no table

---

## 📁 Files Reference

**Debug Logs Added:**
- `apps/api/src/modules/members/services/member-therapy-plan-bulk.service.ts:77-86`
- `apps/web/src/components/members/BulkTherapyPlanModal.tsx:68-75`

**Full Docs:**
- `summary/2026-06-13/BULK-THERAPY-TESTING-GUIDE.md` - Complete testing guide
- `summary/2026-06-13/BULK-THERAPY-DEBUG-CANCREATE-ZERO.md` - Debug analysis
- `summary/2026-06-13/CONTEXT-TRANSFER-COMPLETE-SUMMARY.md` - Full summary

**SQL Script:**
- `apps/api/scripts/check-member-therapy-status.sql`

---

## ⏱️ Time Estimate
- Setup: 2 min
- Find member: 1 min
- Test modal: 1 min
- Share logs: 1 min
**Total: ~5 minutes**

---

## 🆘 Common Issues

**Port Already in Use:**
```bash
# Kill process on port 5000 (API)
npx kill-port 5000

# Kill process on port 3000 (Web)
npx kill-port 3000
```

**Database Connection Error:**
Check `.env` file in `apps/api/`

**Build Errors:**
```bash
npm run build  # Should show 0 errors
```

---

**Ready? Start servers and test! Share logs when done. 🚀**
