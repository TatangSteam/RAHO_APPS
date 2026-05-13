# Debug 401 Unauthorized - Session API

**Tanggal:** 12 Mei 2026  
**Error:** GET /api/v1/treatment-sessions/{sessionId} returns 401 Unauthorized  
**User Role:** ADMIN_LAYANAN (Cabang Pusat)

---

## 🐛 Error Details

```
GET http://localhost:4000/api/v1/treatment-sessions/cmp2grjns001whg0al8wg75md 401 (Unauthorized)
```

**Location:** `sessionApi.ts:30` (getSessionDetails method)

---

## 🔍 Possible Causes

### 1. Token Issues
- ❓ Token tidak ada di localStorage/store
- ❓ Token expired
- ❓ Token format salah
- ❓ Token tidak dikirim dalam request header

### 2. Backend Authentication
- ❓ Middleware authenticate gagal validasi token
- ❓ JWT secret mismatch
- ❓ Token blacklisted

### 3. Authorization Issues
- ❓ User role tidak memiliki akses
- ❓ Branch access restriction

---

## 🧪 Debugging Steps

### Step 1: Check Token in Browser

**Open Browser Console:**
```javascript
// Check if token exists
const token = localStorage.getItem('auth-storage');
console.log('Auth Storage:', token);

// Parse and check token
if (token) {
  const parsed = JSON.parse(token);
  console.log('Access Token:', parsed.state.accessToken);
  console.log('Refresh Token:', parsed.state.refreshToken);
  console.log('User:', parsed.state.user);
}
```

**Expected Output:**
```json
{
  "state": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "...",
      "email": "...",
      "role": "ADMIN_LAYANAN",
      "branchId": "..."
    }
  }
}
```

---

### Step 2: Check Request Headers

**Open Network Tab in Browser DevTools:**
1. Go to Network tab
2. Find the failing request: `GET /api/v1/treatment-sessions/...`
3. Check Request Headers
4. Look for `Authorization` header

**Expected Header:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**If Missing:**
- Token tidak ada di store
- Axios interceptor tidak berjalan
- Request dibuat sebelum token di-set

---

### Step 3: Decode JWT Token

**Use jwt.io or console:**
```javascript
// In browser console
const token = "YOUR_ACCESS_TOKEN_HERE";
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Token Payload:', payload);
console.log('Expired At:', new Date(payload.exp * 1000));
console.log('Is Expired:', Date.now() > payload.exp * 1000);
```

**Expected Payload:**
```json
{
  "userId": "cmp2agdp3000g2uvacen1q8yb",
  "role": "ADMIN_LAYANAN",
  "branchId": "cmp2agcmx00002uvanhlqaud6",
  "iat": 1715529600,
  "exp": 1715616000
}
```

---

### Step 4: Check Backend Logs

**Look for authentication logs in API server:**
```
[authenticate] Token verified successfully
User ID: cmp2agdp3000g2uvacen1q8yb
User Role: ADMIN_LAYANAN
Branch ID: cmp2agcmx00002uvanhlqaud6
```

**If you see:**
```
[authenticate] No token provided
[authenticate] Invalid token
[authenticate] Token expired
```

Then the issue is with token validation.

---

### Step 5: Test with Postman/cURL

**Test the endpoint directly:**
```bash
curl -X GET \
  http://localhost:4000/api/v1/treatment-sessions/cmp2grjns001whg0al8wg75md \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "cmp2grjns001whg0al8wg75md",
    "sessionCode": "...",
    ...
  }
}
```

**If 401:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token tidak valid atau telah kadaluarsa"
  }
}
```

---

## 🔧 Common Fixes

### Fix 1: Re-login

**If token expired or invalid:**
1. Logout dari aplikasi
2. Login kembali
3. Token baru akan di-generate
4. Try accessing session again

---

### Fix 2: Clear Browser Storage

**If token corrupted:**
```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
// Then refresh and login again
```

---

### Fix 3: Check Environment Variables

**Verify API URL is correct:**

**File:** `apps/web/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

**Check in browser console:**
```javascript
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
```

---

### Fix 4: Verify JWT Secret Match

**Backend and token must use same secret:**

**File:** `apps/api/.env`
```env
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
```

**If secret changed:**
- All existing tokens become invalid
- Users must re-login

---

## 🎯 Specific to This Error

### Session ID: `cmp2grjns001whg0al8wg75md`

**Check if session exists:**
```sql
SELECT * FROM treatment_sessions 
WHERE id = 'cmp2grjns001whg0al8wg75md';
```

**Check session branch:**
```sql
SELECT 
  ts.id,
  ts.sessionCode,
  ts.branchId,
  b.branchCode,
  b.name as branchName
FROM treatment_sessions ts
JOIN branches b ON ts.branchId = b.id
WHERE ts.id = 'cmp2grjns001whg0al8wg75md';
```

**Check if user has access to this branch:**
- User role: ADMIN_LAYANAN
- User branch: Cabang Pusat (PST)
- Session branch: ?

**If session is from different branch:**
- ADMIN_LAYANAN might not have access
- Need to check `assertBranchAccess` middleware

---

## 🚨 Quick Fix Checklist

- [ ] Check if user is logged in
- [ ] Check if token exists in localStorage
- [ ] Check if Authorization header is sent
- [ ] Check if token is expired
- [ ] Try re-login
- [ ] Check API server is running
- [ ] Check API URL is correct
- [ ] Check JWT secret matches
- [ ] Check user has access to session's branch

---

## 📝 Code to Add for Better Debugging

### Add to `apps/web/src/lib/api.ts`

```typescript
// Add logging to request interceptor
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken } = useAuthStore.getState();
  
  // DEBUG: Log token status
  console.log('[API Request]', {
    url: config.url,
    hasToken: !!accessToken,
    tokenPreview: accessToken ? accessToken.substring(0, 20) + '...' : 'NO TOKEN'
  });
  
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else {
    console.warn('[API Request] No access token available!');
  }
  
  return config;
});
```

### Add to `apps/api/src/middleware/authenticate.ts`

```typescript
// Add more detailed logging
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    // DEBUG: Log authentication attempt
    console.log('[authenticate] Request:', {
      method: req.method,
      path: req.path,
      hasAuthHeader: !!authHeader,
      authHeaderPreview: authHeader ? authHeader.substring(0, 30) + '...' : 'MISSING'
    });

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[authenticate] No token provided or invalid format');
      throw { status: 401, code: 'UNAUTHORIZED', message: 'Token tidak valid' };
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    console.log('[authenticate] Token verified:', {
      userId: decoded.userId,
      role: decoded.role,
      branchId: decoded.branchId
    });

    req.user = decoded;
    next();
  } catch (error: any) {
    console.error('[authenticate] Error:', error);
    // ... rest of error handling
  }
};
```

---

## 🎯 Expected Behavior

**When accessing session detail:**
1. ✅ User is logged in with valid token
2. ✅ Token is sent in Authorization header
3. ✅ Backend validates token successfully
4. ✅ User role (ADMIN_LAYANAN) is authorized
5. ✅ User has access to session's branch
6. ✅ Session data is returned

---

## 📞 Next Steps

1. **Check browser console** for token
2. **Check network tab** for Authorization header
3. **Check API logs** for authentication errors
4. **Try re-login** if token expired
5. **Report findings** for further debugging

---

**Status:** 🔍 **INVESTIGATING**  
**Priority:** 🔴 **HIGH** - Blocks session access
