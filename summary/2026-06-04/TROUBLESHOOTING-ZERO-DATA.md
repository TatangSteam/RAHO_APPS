# Troubleshooting: Dashboard Showing Zero Data

**Issue:** Dashboard Super Admin menampilkan 0 untuk semua statistik  
**Status:** In Progress  
**Date:** 4 Juni 2026

---

## ✅ Steps Already Completed

1. ✅ Fixed model name: `therapySession` → `treatmentSession`
2. ✅ Fixed groupBy count access
3. ✅ Verified database has data (43 users, 28 members, etc.)
4. ✅ File `system-stats.service.ts` updated correctly

---

## 🔧 Solution: Restart API Server

### The Problem

TypeScript files perlu di-compile ke JavaScript. Perubahan pada `.ts` files tidak langsung efektif sampai:
1. TypeScript di-compile ulang
2. Node.js restart dan load file yang baru

### Steps to Fix

#### Option 1: Manual Restart (Recommended)

1. **Stop API Server**
   ```
   - Go to terminal yang menjalankan API server
   - Press Ctrl+C untuk stop
   ```

2. **Restart API Server**
   ```bash
   cd apps/api
   npm run dev
   ```

3. **Wait for compilation**
   ```
   Tunggu sampai muncul:
   ✓ Compiled successfully
   🚀 Server running on port 3001
   ```

4. **Refresh Dashboard**
   ```
   - Go to browser
   - Refresh halaman dashboard (Ctrl+R atau F5)
   - Data should appear now!
   ```

#### Option 2: Check if nodemon is working

If using `nodemon`, check if auto-restart works:

```bash
# In API terminal, check if you see:
[nodemon] restarting due to changes...
[nodemon] starting `ts-node src/server.ts`
```

If NOT seeing this, nodemon might not be watching correctly. Do manual restart.

---

## 🧪 Test API Directly

### Test 1: Check Data in Database

```bash
cd apps/api
node check-data.js
```

**Expected Output:**
```
📊 Database Counts:
- Users: 43
- Members: 28
- Branches: 4
- Master Products: 67
- Treatment Sessions: 2
- Invoices: 35

✅ Database has data!
```

### Test 2: Test System Stats Service

```bash
cd apps/api
npm run build  # Compile TypeScript first
node test-system-stats.js
```

**Expected Output:**
```json
{
  "totalBranches": 4,
  "activeBranches": 4,
  "totalUsers": 43,
  "activeUsers": 41,
  "totalMembers": 28,
  "activeMembers": 26,
  "totalProducts": 67,
  "activeProducts": 65,
  "totalRevenue": 50000000,
  "monthlyRevenue": 5000000,
  "totalSessions": 2,
  "monthlySessions": 1,
  "usersByRole": [...],
  "recentActivities": [...]
}
```

### Test 3: Test API Endpoint with curl

```bash
# Get your auth token from browser DevTools > Application > Local Storage
# Look for "auth-storage" key

curl -X GET http://localhost:3001/api/v1/admin/system-stats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalBranches": 4,
    "totalUsers": 43,
    ...
  }
}
```

---

## 🐛 If Still Showing Zero

### Check 1: API Server Console

Look for errors in API server terminal:

```
❌ Error in getSystemStats: ...
```

If you see error, note the error message and line number.

### Check 2: Browser DevTools Console

1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Refresh dashboard
4. Look for:
   ```
   📊 Loading system stats...
   API URL: http://localhost:3001/api/v1
   Access Token: Present
   Response status: 200
   ✅ System stats loaded: ...
   ```

### Check 3: Network Tab

1. Open DevTools > Network tab
2. Refresh dashboard
3. Find request to `/system-stats`
4. Click on it
5. Check Response tab
6. See if data is actually returned

### Common Issues

#### Issue 1: Server not restarted
**Solution:** Stop and start server manually

#### Issue 2: Wrong port
**Solution:** Check `.env` file - API should be on port 3001

#### Issue 3: Cache issue
**Solution:** 
```bash
# Clear node_modules cache
cd apps/api
rm -rf node_modules/.cache
npm run dev
```

#### Issue 4: TypeScript not compiled
**Solution:**
```bash
cd apps/api
npm run build
npm run dev
```

#### Issue 5: Wrong model name persists
**Solution:** Check the actual compiled JS file:
```bash
# Look at dist folder
cat dist/modules/admin/services/system-stats.service.js | grep -i "session"
```

---

## 📝 Verification Checklist

After restart, verify:

- [ ] API server running without errors
- [ ] Browser console shows successful API call
- [ ] Network tab shows 200 response with data
- [ ] Dashboard displays numbers (not 0)
- [ ] Console logs show correct stats loaded

---

## 🆘 Still Not Working?

If after all steps data still showing 0:

1. **Copy full API server console output** (last 50 lines)
2. **Copy browser console output** (all logs)
3. **Screenshot of Network tab** for `/system-stats` request
4. **Share with dev team** for deeper investigation

Possible advanced issues:
- Prisma client cache issue
- Database connection problem
- Authorization/permission issue
- Frontend state management issue

---

## 📞 Quick Commands Reference

```bash
# Check database
cd apps/api
node check-data.js

# Restart API
Ctrl+C (in API terminal)
npm run dev

# Test endpoint
curl http://localhost:3001/api/v1/admin/system-stats \
  -H "Authorization: Bearer TOKEN"

# Clear cache and rebuild
rm -rf node_modules/.cache dist
npm run build
npm run dev

# View logs
# (check API terminal for errors)
```

---

**Next Action:** Please restart API server and check if data appears!
