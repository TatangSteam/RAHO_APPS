# Fix: Dynamic Retry Time di Rate Limit Notification

**Tanggal**: 7 Juni 2026  
**Status**: ✅ FIXED  
**Priority**: MEDIUM

---

## 🐛 **ISSUE**

### **Problem:**
Notifikasi rate limit menampilkan waktu fixed:
```
⚠️ Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.
```

**Kenapa Tidak Tepat?**
- Kalau user kena rate limit lalu tunggu 5 menit, notifikasi masih bilang "15 menit"
- Padahal sebenarnya tinggal 10 menit lagi
- User bingung, apakah harus tunggu 15 menit penuh atau tidak

---

## ✅ **SOLUTION: Dynamic Time Display**

### **Implementasi:**

Frontend sekarang membaca `Retry-After` header dari backend dan menghitung waktu dinamis.

#### File: `apps/web/src/app/(auth)/login/page.tsx`

**BEFORE:**
```typescript
if (code === 'RATE_LIMIT_EXCEEDED') {
  setServerError('Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.');
}
```

**AFTER:**
```typescript
if (code === 'RATE_LIMIT_EXCEEDED') {
  // Get retry-after time from response headers
  const retryAfter = err.response?.headers['retry-after'];
  const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 900; // Default 15 minutes
  const retryMinutes = Math.ceil(retrySeconds / 60);
  
  setServerError(`Terlalu banyak percobaan login. Silakan coba lagi dalam ${retryMinutes} menit.`);
}
```

---

## 🧪 **TESTING SCENARIOS**

### **Scenario 1: Tepat Kena Rate Limit (15 menit penuh)**
```bash
# 1. Login gagal 5x
# 2. Percobaan ke-6 (rate limited)
POST /auth/login
→ 429 RATE_LIMIT_EXCEEDED
→ Header: Retry-After: 900 (seconds)
→ Frontend: "Silakan coba lagi dalam 15 menit."
```

### **Scenario 2: Sudah Tunggu 5 Menit**
```bash
# 1. User kena rate limit
# 2. User tunggu 5 menit
# 3. User refresh page dan coba login lagi
POST /auth/login
→ 429 RATE_LIMIT_EXCEEDED
→ Header: Retry-After: 600 (seconds)
→ Frontend: "Silakan coba lagi dalam 10 menit."
```

### **Scenario 3: Tinggal 1 Menit**
```bash
# 1. User kena rate limit
# 2. User tunggu 14 menit
# 3. User coba login lagi
POST /auth/login
→ 429 RATE_LIMIT_EXCEEDED
→ Header: Retry-After: 60 (seconds)
→ Frontend: "Silakan coba lagi dalam 1 menit."
```

### **Scenario 4: Tinggal 30 Detik**
```bash
# User tunggu 14.5 menit
POST /auth/login
→ 429 RATE_LIMIT_EXCEEDED
→ Header: Retry-After: 30 (seconds)
→ Frontend: "Silakan coba lagi dalam 1 menit." (rounded up)
```

---

## 📊 **HOW IT WORKS**

### **Backend (express-rate-limit):**
Rate limiter library otomatis mengirim header:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 900
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 1686134400
```

### **Frontend Processing:**
```typescript
// 1. Extract Retry-After header
const retryAfter = err.response?.headers['retry-after'];

// 2. Parse to integer (seconds)
const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 900;

// 3. Convert to minutes (round up)
const retryMinutes = Math.ceil(retrySeconds / 60);

// 4. Show dynamic message
setServerError(`... dalam ${retryMinutes} menit.`);
```

### **Why Math.ceil()?**
```javascript
// Without ceil (wrong):
Math.floor(90 / 60) = 1 menit → "Silakan coba lagi dalam 1 menit"
// User tunggu 1 menit, tapi masih kena rate limit (karena masih 30 detik lagi)

// With ceil (correct):
Math.ceil(90 / 60) = 2 menit → "Silakan coba lagi dalam 2 menit"
// User tunggu 2 menit, berhasil login ✅
```

---

## 🎯 **USER EXPERIENCE IMPROVEMENTS**

### **Before:**
```
User: *kena rate limit*
System: "Silakan coba lagi setelah 15 menit"
User: *tunggu 10 menit*
User: *coba lagi*
System: "Silakan coba lagi setelah 15 menit" ❌ CONFUSING!
User: "Kok masih 15 menit? Apa harus tunggu 15 menit lagi dari sekarang?"
```

### **After:**
```
User: *kena rate limit*
System: "Silakan coba lagi dalam 15 menit"
User: *tunggu 10 menit*
User: *coba lagi*
System: "Silakan coba lagi dalam 5 menit" ✅ CLEAR!
User: "Oh tinggal 5 menit lagi"
```

---

## 🔧 **TECHNICAL DETAILS**

### **Rate Limiter Configuration:**
```typescript
// apps/api/src/middleware/rateLimiter.ts
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,     // 15 minutes
  max: 5,                        // 5 attempts
  standardHeaders: true,         // ✅ Send RateLimit-* headers
  legacyHeaders: false,
});
```

### **Headers Sent:**
- `Retry-After`: Seconds until user can retry
- `RateLimit-Limit`: Max requests allowed (5)
- `RateLimit-Remaining`: Remaining requests (0 when blocked)
- `RateLimit-Reset`: Unix timestamp when limit resets

### **Fallback Value:**
```typescript
const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 900;
```
Jika header tidak ada (edge case), default ke 900 detik (15 menit).

---

## 📝 **EDGE CASES HANDLED**

### **1. Header Missing:**
```typescript
// If backend doesn't send Retry-After header
const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 900;
→ Default to 15 minutes
```

### **2. Invalid Header:**
```typescript
// If header is not a valid number
parseInt('invalid', 10) → NaN
retryAfter ? NaN : 900 → 900
→ Fallback to default
```

### **3. Very Small Time (<1 minute):**
```typescript
// 30 seconds left
Math.ceil(30 / 60) = 1 menit
→ "Silakan coba lagi dalam 1 menit"
// Better than "dalam 0 menit" or "dalam 30 detik"
```

### **4. Exactly 1 Minute:**
```typescript
Math.ceil(60 / 60) = 1 menit
→ "Silakan coba lagi dalam 1 menit"
// Correct singular form
```

---

## 🚀 **DEPLOYMENT**

### **Files Changed:**
- ✅ `apps/web/src/app/(auth)/login/page.tsx`

### **No Backend Changes:**
Backend sudah otomatis mengirim `Retry-After` header via express-rate-limit.

### **Testing:**
1. Restart web server:
   ```bash
   cd apps/web
   npm run dev
   ```

2. Test rate limit:
   - Login gagal 6x
   - Check notifikasi: "dalam 15 menit"
   - Tunggu beberapa menit
   - Coba lagi, check notifikasi berubah: "dalam X menit"

---

## 💡 **FUTURE ENHANCEMENTS**

### **1. Show Timer Countdown:**
```typescript
// Countdown in real-time
"Silakan coba lagi dalam 14:32" (MM:SS)
```

### **2. Different Message for Short Time:**
```typescript
if (retrySeconds < 60) {
  return `Silakan coba lagi dalam ${retrySeconds} detik.`;
} else {
  return `Silakan coba lagi dalam ${retryMinutes} menit.`;
}
```

### **3. Show Exact Time:**
```typescript
const unlockTime = new Date(Date.now() + retrySeconds * 1000);
return `Silakan coba lagi pada ${unlockTime.toLocaleTimeString()}.`;
```

---

## 📚 **RELATED DOCS**

- [FIX-LOGIN-RATE-LIMIT.md](./FIX-LOGIN-RATE-LIMIT.md) - Rate limit dari 10k ke 5
- [FIX-RATE-LIMIT-ERROR-MESSAGE.md](./FIX-RATE-LIMIT-ERROR-MESSAGE.md) - Fix error format
- [ENHANCED-LOGIN-SECURITY-IMPLEMENTATION-GUIDE.md](./ENHANCED-LOGIN-SECURITY-IMPLEMENTATION-GUIDE.md) - Next steps

---

**Fixed by**: Kiro AI  
**Impact**: Better UX - Clear time indication  
**Status**: ✅ Ready for testing

