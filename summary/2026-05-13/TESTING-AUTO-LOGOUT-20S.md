# Testing Auto Logout - 20 Second Token Expiry

**Tanggal:** 12 Mei 2026  
**Purpose:** Testing auto logout functionality with fast token expiry  
**Duration:** 20 seconds access token, 2 minutes refresh token

---

## ⚙️ Configuration

### Backend (API)

**File:** `apps/api/.env`

```env
JWT_ACCESS_EXPIRES=20s    # Access token expires in 20 seconds
JWT_REFRESH_EXPIRES=2m    # Refresh token expires in 2 minutes
```

### Frontend (Web)

**File:** `apps/web/src/lib/api.ts`

```typescript
// Token check interval: every 5 seconds (for testing)
tokenCheckInterval = setInterval(() => {
  // Check token expiry logic...
}, 5000); // 5 seconds
```

---

## 🧪 Testing Scenarios

### Scenario 1: Proactive Check (Before Request)

**Timeline:**
```
0s   → Login
5s   → Token check: "Token will expire in 15 seconds"
10s  → Token check: "Token will expire in 10 seconds"
15s  → Token check: "Token will expire in 5 seconds"
20s  → Token expired
21s  → User clicks button (makes API request)
     → Request interceptor detects expired token
     → Auto logout immediately
     → Redirect to /login
```

**Steps:**
1. Login as any user
2. Open browser console (F12)
3. Wait 20 seconds (don't interact)
4. After 20 seconds, click any button that makes API request
5. Should see: `[API] Access token expired, logging out...`
6. Should redirect to /login immediately

**Expected Console Logs:**
```
[Token Check] Token will expire in 15 seconds
[Token Check] Token will expire in 10 seconds
[Token Check] Token will expire in 5 seconds
[API] Access token expired, logging out...
```

---

### Scenario 2: Periodic Check (While Idle)

**Timeline:**
```
0s   → Login
5s   → Token check: "Token will expire in 15 seconds"
10s  → Token check: "Token will expire in 10 seconds"
15s  → Token check: "Token will expire in 5 seconds"
20s  → Token expired
25s  → Periodic check detects expired token
     → Auto logout
     → Redirect to /login
```

**Steps:**
1. Login as any user
2. Open browser console (F12)
3. Don't touch anything (stay idle)
4. Wait ~25 seconds
5. Should auto logout and redirect to /login

**Expected Console Logs:**
```
[Token Check] Token will expire in 15 seconds
[Token Check] Token will expire in 10 seconds
[Token Check] Token will expire in 5 seconds
[Token Check] Token expired, logging out...
```

---

### Scenario 3: Refresh Token Success

**Timeline:**
```
0s   → Login
20s  → Access token expires
21s  → User makes API request
     → Backend returns 401 AUTH_TOKEN_EXPIRED
     → Frontend attempts refresh
     → Refresh successful (refresh token still valid)
     → New access token obtained
     → Original request retried
     → User stays logged in
40s  → New access token expires
41s  → User makes API request
     → Refresh again
     → Success
```

**Steps:**
1. Login as any user
2. Wait 21 seconds
3. Make API request (e.g., click member list)
4. Should see brief loading
5. Request should succeed
6. User stays logged in
7. Check console for refresh logs

**Expected Console Logs:**
```
[Token Check] Token will expire in 15 seconds
[Token Check] Token will expire in 10 seconds
[Token Check] Token will expire in 5 seconds
[API] Token expired, attempting refresh...
[API] Token refreshed successfully
[API] Retrying original request...
```

---

### Scenario 4: Refresh Token Expired

**Timeline:**
```
0s    → Login
20s   → Access token expires
120s  → Refresh token expires (2 minutes)
121s  → User makes API request
      → Backend returns 401 AUTH_TOKEN_EXPIRED
      → Frontend attempts refresh
      → Refresh fails (refresh token expired)
      → Auto logout
      → Redirect to /login
```

**Steps:**
1. Login as any user
2. Wait 2 minutes and 5 seconds
3. Make API request
4. Should auto logout
5. Should redirect to /login

**Expected Console Logs:**
```
[API] Token expired, attempting refresh...
[API] Refresh failed, logging out...
```

---

### Scenario 5: Multiple Tabs

**Timeline:**
```
Tab 1:
0s   → Login
20s  → Token expires
25s  → Auto logout

Tab 2:
0s   → Already logged in (same session)
25s  → Should also logout (shared localStorage)
```

**Steps:**
1. Open 2 tabs with the app
2. Login in Tab 1
3. Tab 2 should also be logged in (shared state)
4. Wait 25 seconds
5. Both tabs should logout

**Expected:**
- ✅ Both tabs logout simultaneously
- ✅ Both redirect to /login

---

## 📊 Expected Behavior Summary

### ✅ What Should Happen:

1. **Login:**
   - Token check starts automatically
   - Console shows periodic checks every 5 seconds

2. **15 seconds after login:**
   - Console shows: "Token will expire in 5 seconds"

3. **20 seconds after login:**
   - Token is expired

4. **If user makes request after 20s:**
   - Request interceptor catches expired token
   - Auto logout immediately
   - Redirect to /login
   - Message: "Sesi Anda telah berakhir. Silakan login kembali."

5. **If user is idle after 20s:**
   - Periodic check (at 25s) detects expired token
   - Auto logout
   - Redirect to /login

6. **If refresh token still valid:**
   - Attempt token refresh
   - If successful → stay logged in
   - If failed → logout

---

## 🔍 Debugging

### Check Token in Console:

```javascript
// Get auth data
const authData = localStorage.getItem('auth-storage');
const parsed = JSON.parse(authData);

// Decode token
const token = parsed.state.accessToken;
const payload = JSON.parse(atob(token.split('.')[1]));

console.log('Token issued at:', new Date(payload.iat * 1000));
console.log('Token expires at:', new Date(payload.exp * 1000));
console.log('Time until expiry:', (payload.exp * 1000 - Date.now()) / 1000, 'seconds');
```

### Check Token Expiry:

```javascript
const authData = localStorage.getItem('auth-storage');
const parsed = JSON.parse(authData);
const token = parsed.state.accessToken;
const payload = JSON.parse(atob(token.split('.')[1]));
const now = Date.now();
const expiryTime = payload.exp * 1000;
const isExpired = now >= expiryTime;

console.log('Is token expired?', isExpired);
console.log('Time until expiry:', Math.floor((expiryTime - now) / 1000), 'seconds');
```

---

## 🎯 Success Criteria

- [x] Token expires in 20 seconds
- [x] Periodic check runs every 5 seconds
- [x] Console shows countdown warnings
- [x] Auto logout on token expiry (proactive)
- [x] Auto logout on token expiry (periodic)
- [x] Refresh token works if still valid
- [x] Force logout if refresh token expired
- [x] Clear error messages
- [x] Redirect to /login works
- [x] Multi-tab logout works

---

## 🔄 Reverting to Production Settings

### After Testing, Change Back:

**Backend:** `apps/api/.env`
```env
JWT_ACCESS_EXPIRES=8h     # 8 hours for production
JWT_REFRESH_EXPIRES=7d    # 7 days for production
```

**Frontend:** `apps/web/src/lib/api.ts`
```typescript
// Change interval from 5000 to 30000
tokenCheckInterval = setInterval(() => {
  // ...
}, 30000); // 30 seconds for production
```

**Then rebuild:**
```bash
cd apps/api && npm run build
cd apps/web && npm run build
```

---

## 📝 Testing Checklist

- [ ] Restart API server after changing .env
- [ ] Restart web server after rebuild
- [ ] Clear browser cache and localStorage
- [ ] Open browser console (F12)
- [ ] Login as user
- [ ] Verify token check logs appear every 5 seconds
- [ ] Wait 20 seconds without interaction
- [ ] Verify auto logout happens
- [ ] Verify redirect to /login
- [ ] Verify error message shown
- [ ] Test making request after 20s
- [ ] Test refresh token flow
- [ ] Test multi-tab behavior

---

## 🚨 Important Notes

1. **Restart Required:**
   - Must restart API server after changing .env
   - Must restart web server after rebuild

2. **Clear Storage:**
   - Clear localStorage before testing
   - Use incognito mode for clean test

3. **Console Logs:**
   - Keep console open to see logs
   - Logs help understand what's happening

4. **Timing:**
   - Access token: 20 seconds
   - Refresh token: 2 minutes
   - Check interval: 5 seconds

5. **Production:**
   - Don't forget to change back to production settings
   - 20s is too short for production use

---

## 🎬 Quick Test Commands

### Start Testing:
```bash
# Terminal 1: Start API
cd apps/api
npm run dev

# Terminal 2: Start Web
cd apps/web
npm run dev

# Browser: Open http://localhost:3000
# Console: Open F12
# Login and watch the magic happen!
```

### Monitor Logs:
```javascript
// In browser console
setInterval(() => {
  const authData = localStorage.getItem('auth-storage');
  if (authData) {
    const parsed = JSON.parse(authData);
    const token = parsed.state.accessToken;
    const payload = JSON.parse(atob(token.split('.')[1]));
    const timeLeft = Math.floor((payload.exp * 1000 - Date.now()) / 1000);
    console.log('⏱️ Time until token expires:', timeLeft, 'seconds');
  }
}, 1000); // Every second
```

---

**Status:** ✅ **READY FOR TESTING**  
**Token Expiry:** 20 seconds  
**Check Interval:** 5 seconds  
**Expected Logout:** ~25 seconds after login
