# 🔄 Restart Backend & Test Bulk Therapy Feature

## ⚠️ IMPORTANT: You Must Restart the Server!

The `tsx watch` command doesn't always hot-reload changes properly. You need to manually restart.

## Step 1: Stop Backend Server

In the terminal running your API (the one showing logs):

```bash
# Press Ctrl+C to stop the server
```

You should see the server stop.

## Step 2: Restart Backend Server

```bash
cd apps/api
npm run dev
```

## Step 3: Verify Fixed Version is Running

When the server starts, you should see:

```
✅ Database connected
🚀 RAHO API running on port 4000
```

## Step 4: Test the Feature

### Option A: Test with Member Who Has Active Package

1. Go to web app: http://localhost:3000
2. Login as ADMIN_CABANG or higher
3. Go to Members page
4. Find a member with an ACTIVE package (e.g., Fitri Handayani if she has active package)
5. Click member name to open detail page
6. Go to "Terapi Plan" tab
7. Click "➕ Bulk Create Therapy Plans" button
8. Modal should open successfully

### Option B: Test with Member Without Active Package (test23)

1. Go to member "test23" (MBR-PST-0009)
2. Go to "Paket & Add On" tab
3. Click "➕ Assign Paket"
4. Select package (e.g., BASIC_P7_HC - 7 sessions)
5. Upload payment proof
6. Verify package (if you're ADMIN_MANAGER+)
7. Wait for status = ACTIVE
8. Then go to "Terapi Plan" tab
9. Click "➕ Bulk Create Therapy Plans"
10. Modal should open with 7 rows (for 7 sessions)

## Step 5: Check Logs

When you open the bulk modal, look at the backend terminal. You should see:

```
📊 Therapy Plans Count:
  All therapy plans: X
  Unused (treatmentSessionId = null): Y
  Used (treatmentSessionId != null): Z

🔍 Package Summary Debug (FIXED VERSION):    <-- LOOK FOR THIS!
  Member ID: ...
  Total Sessions: A
  Used Sessions: B
  Sessions Remaining: C
  Unused Therapy Plans Count: Y
  Can Create: D
  Formula: Math.max(0, C - Y) = D
```

### ✅ If You See "(FIXED VERSION)" → Code Updated Successfully!

### ❌ If You Don't See "(FIXED VERSION)" → Server Not Restarted

Go back to Step 1 and restart again.

## Expected Behavior

### Scenario: Member with 7-session package, 3 used, 1 unused plan

**Expected Logs:**
```
📊 Therapy Plans Count:
  All therapy plans: 4
  Unused (treatmentSessionId = null): 1
  Used (treatmentSessionId != null): 3

🔍 Package Summary Debug (FIXED VERSION):
  Total Sessions: 7
  Used Sessions: 3
  Sessions Remaining: 4
  Unused Therapy Plans Count: 1
  Can Create: 3
  Formula: Math.max(0, 4 - 1) = 3
```

**Expected Modal:**
- Shows package summary card (7 total, 3 used, 4 remaining)
- Shows 3 auto-generated rows
- Each row has IFA radio buttons and dose inputs

### Scenario: Member with 1-session package, 1 used

**Expected Logs:**
```
📊 Therapy Plans Count:
  All therapy plans: 1
  Unused (treatmentSessionId = null): 0
  Used (treatmentSessionId != null): 1

🔍 Package Summary Debug (FIXED VERSION):
  Total Sessions: 1
  Used Sessions: 1
  Sessions Remaining: 0
  Unused Therapy Plans Count: 0
  Can Create: 0
  Formula: Math.max(0, 0 - 0) = 0
```

**Expected Modal:**
- Shows package summary
- Shows message: "Tidak ada voucher tersisa" atau similar
- Cannot create any plans

### Scenario: Member without active package

**Expected:**
- 404 Error
- Message: "Member tidak memiliki paket aktif"
- Solution: Assign package first

## Troubleshooting

### Problem: Still seeing old logs

**Solution:**
1. Make sure you pressed Ctrl+C
2. Check no other API server is running on port 4000
3. Run `npm run build` first, then `npm run dev`

### Problem: Port 4000 already in use

**Solution:**
```bash
# On Windows, find and kill process on port 4000
netstat -ano | findstr :4000
taskkill /PID <PID_NUMBER> /F
```

### Problem: Frontend not connecting

**Solution:**
- Make sure backend is running on http://localhost:4000
- Check frontend API_URL in .env
- Restart frontend too if needed

## Quick Commands Reference

```bash
# Stop server: Ctrl+C

# Restart API:
cd apps/api
npm run dev

# Restart Frontend (if needed):
cd apps/web
npm run dev

# Build API (if hot reload fails):
cd apps/api
npm run build
npm run dev
```

## Summary

1. ✅ Code has been fixed
2. ✅ Build successful (0 errors)
3. ⏳ **YOU NEED TO**: Restart the backend server
4. ⏳ **YOU NEED TO**: Test with a member who has active package
5. ✅ Look for "(FIXED VERSION)" in logs to confirm

## Questions?

If you see issues after restarting, check:
1. Are you seeing "(FIXED VERSION)" in logs?
2. Does the member have an ACTIVE package?
3. What do the therapy plan counts show?
4. What's the calculation formula in the logs?

Share the logs and I can help debug further!
