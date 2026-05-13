# Testing Activity Detection - Panduan Lengkap

**Tanggal:** 13 Mei 2026  
**Purpose:** Testing activity-based token refresh  
**Status:** Ready for Testing  
**Web Server:** http://localhost:3001

---

## 🎯 Apa yang Akan Ditest?

Activity detection harus mendeteksi berbagai jenis aktivitas user:
- ✅ **Mouse Movement** (gerakkan mouse)
- ✅ **Mouse Click** (klik tombol/link)
- ✅ **Keyboard** (ketik di form)
- ✅ **Scroll** (scroll halaman)
- ✅ **Touch** (untuk mobile)

**PENTING:** Activity detection harus bekerja untuk **SEMUA** event di atas, bukan hanya click!

---

## 🔧 Persiapan Testing

### 1. Pastikan Server Berjalan

**Web Server:**
```
✅ Running on: http://localhost:3001
✅ Status: Ready
```

**API Server:**
```bash
# Jika belum jalan, start di terminal terpisah:
cd apps/api
npm run dev
```

### 2. Gunakan Incognito Mode

**Kenapa?**
- Menghindari cached cookies/localStorage
- Testing dari kondisi fresh
- Hasil lebih akurat

**Cara:**
- Chrome: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`
- Edge: `Ctrl + Shift + N`

### 3. Buka Browser Console

**Cara:**
- Tekan `F12`
- Atau klik kanan → Inspect → Console tab

**Kenapa?**
- Melihat activity logs
- Melihat token refresh logs
- Debug jika ada masalah

---

## 🧪 Test 1: Mouse Movement Detection

**Tujuan:** Verifikasi bahwa gerakkan mouse terdeteksi

### Steps:

1. **Login** ke aplikasi
2. **Buka Console** (F12)
3. **Gerakkan mouse** secara perlahan di halaman
4. **Perhatikan console logs**

### Expected Result:

**Console harus menampilkan:**
```
[Activity] Activity listeners attached
[Activity] User activity detected, last activity updated
[Activity] User activity detected, last activity updated
[Activity] User activity detected, last activity updated
```

**Frekuensi:**
- Max 1x per detik (karena throttling)
- Jika gerakkan mouse terus menerus, log muncul setiap ~1 detik

### ❌ Jika Tidak Muncul:

**Problem:** Event listener tidak attach atau throttle tidak bekerja

**Debug:**
```javascript
// Paste di console untuk check:
console.log('Activity listeners attached?', window.activityListenersAttached);
```

---

## 🧪 Test 2: Click Detection

**Tujuan:** Verifikasi bahwa click terdeteksi

### Steps:

1. **Login** ke aplikasi
2. **Buka Console** (F12)
3. **Klik berbagai tombol/link** di halaman
4. **Perhatikan console logs**

### Expected Result:

**Console harus menampilkan:**
```
[Activity] User activity detected, last activity updated
```

**Setiap kali click:**
- Log muncul (max 1x per detik)
- Activity time ter-update

---

## 🧪 Test 3: Keyboard Detection

**Tujuan:** Verifikasi bahwa keyboard input terdeteksi

### Steps:

1. **Login** ke aplikasi
2. **Buka Console** (F12)
3. **Ketik di search box** atau form input
4. **Perhatikan console logs**

### Expected Result:

**Console harus menampilkan:**
```
[Activity] User activity detected, last activity updated
```

**Setiap kali ketik:**
- Log muncul (max 1x per detik)
- Activity time ter-update

---

## 🧪 Test 4: Scroll Detection

**Tujuan:** Verifikasi bahwa scroll terdeteksi

### Steps:

1. **Login** ke aplikasi
2. **Buka Console** (F12)
3. **Scroll halaman** ke atas/bawah
4. **Perhatikan console logs**

### Expected Result:

**Console harus menampilkan:**
```
[Activity] User activity detected, last activity updated
```

**Setiap kali scroll:**
- Log muncul (max 1x per detik)
- Activity time ter-update

---

## 🧪 Test 5: Token Auto Refresh (User Aktif)

**Tujuan:** Verifikasi token auto refresh ketika user aktif

### Configuration:
```
Access Token: 20 seconds
Refresh Token: 2 minutes
Check Interval: 5 seconds
```

### Steps:

1. **Login** ke aplikasi
2. **Buka Console** (F12)
3. **Gerakkan mouse terus menerus** setiap 3-5 detik
4. **Tunggu 25 detik** (lebih dari 20s token expiry)
5. **Perhatikan console logs**

### Expected Result:

**Timeline:**
```
0s   → Login
      [Activity] Activity listeners attached

3s   → Gerakkan mouse
      [Activity] User activity detected

5s   → Token check
      [Token Check] Token will expire in 15 seconds

8s   → Gerakkan mouse
      [Activity] User activity detected

10s  → Token check
      [Token Check] Token will expire in 10 seconds

13s  → Gerakkan mouse
      [Activity] User activity detected

15s  → Token check
      [Token Check] Token will expire in 5 seconds

18s  → Gerakkan mouse
      [Activity] User activity detected

19s  → Token check detects: user active + token expiring
      [Token Check] User active, attempting token refresh...
      [Token Check] Token refreshed successfully due to user activity

23s  → Gerakkan mouse
      [Activity] User activity detected

25s  → User MASIH LOGIN ✅
      Token sudah di-refresh, tidak logout
```

### ✅ Success Criteria:

- [x] Activity logs muncul setiap gerakkan mouse
- [x] Token check logs muncul setiap 5 detik
- [x] Token auto refresh di ~18-19 detik
- [x] User TIDAK logout
- [x] User tetap bisa akses halaman

### ❌ Jika Logout:

**Problem:** Token tidak ter-refresh atau activity tidak terdeteksi

**Check:**
1. Apakah activity logs muncul?
2. Apakah ada log "User active, attempting token refresh"?
3. Apakah ada error di console?

---

## 🧪 Test 6: Auto Logout (User Idle)

**Tujuan:** Verifikasi auto logout ketika user idle

### Steps:

1. **Login** ke aplikasi
2. **Buka Console** (F12)
3. **JANGAN SENTUH APAPUN** (stay idle)
4. **Tunggu 25 detik**
5. **Perhatikan console logs**

### Expected Result:

**Timeline:**
```
0s   → Login
      [Activity] Activity listeners attached

5s   → Token check
      [Token Check] Token will expire in 15 seconds

10s  → Token check
      [Token Check] Token will expire in 10 seconds

15s  → Token check
      [Token Check] Token will expire in 5 seconds

20s  → Token expired

25s  → Token check detects expired token
      [Token Check] Token expired, logging out...
      [Token Check] Forcing redirect to login...
      [Activity] Activity listeners detached

→ Redirect to /login ✅
→ Message: "Sesi Anda telah berakhir. Silakan login kembali."
```

### ✅ Success Criteria:

- [x] Token check logs muncul setiap 5 detik
- [x] Countdown dari 15s → 10s → 5s
- [x] Auto logout di ~25 detik
- [x] Redirect ke /login
- [x] Error message ditampilkan
- [x] Activity listeners detached

---

## 🧪 Test 7: Active → Idle → Logout

**Tujuan:** Verifikasi transisi dari active ke idle

### Steps:

1. **Login** ke aplikasi
2. **Buka Console** (F12)
3. **Gerakkan mouse** selama 10 detik
4. **STOP** (jangan sentuh apapun)
5. **Tunggu 20 detik lagi**
6. **Perhatikan console logs**

### Expected Result:

**Timeline:**
```
0s   → Login
3s   → Gerakkan mouse (active)
      [Activity] User activity detected

5s   → Token check
      [Token Check] Token will expire in 15 seconds

8s   → Gerakkan mouse (active)
      [Activity] User activity detected

10s  → STOP (idle mulai dari sini)

15s  → Token check
      [Token Check] Token will expire in 5 seconds

20s  → Token expired

25s  → Token check detects expired + user idle
      [Token Check] Token expired, logging out...

→ Logout ✅
```

### ✅ Success Criteria:

- [x] Activity detected saat active
- [x] No activity detected saat idle
- [x] Token TIDAK di-refresh (karena idle)
- [x] Auto logout setelah token expired

---

## 🧪 Test 8: Continuous Activity (2 Minutes)

**Tujuan:** Verifikasi token refresh multiple kali

### Steps:

1. **Login** ke aplikasi
2. **Buka Console** (F12)
3. **Gerakkan mouse terus menerus** setiap 5 detik
4. **Lakukan selama 2 menit**
5. **Perhatikan console logs**

### Expected Result:

**Timeline:**
```
0s    → Login
18s   → Token refresh #1
      [Token Check] Token refreshed successfully

38s   → Token refresh #2
      [Token Check] Token refreshed successfully

58s   → Token refresh #3
      [Token Check] Token refreshed successfully

78s   → Token refresh #4
      [Token Check] Token refreshed successfully

98s   → Token refresh #5
      [Token Check] Token refreshed successfully

118s  → Token refresh #6
      [Token Check] Token refreshed successfully

→ User MASIH LOGIN ✅
→ Token di-refresh 6x dalam 2 menit
```

### ✅ Success Criteria:

- [x] Token di-refresh multiple kali
- [x] User tidak pernah logout
- [x] Seamless experience
- [x] No interruptions

---

## 🔍 Debugging Tools

### 1. Check Activity Listeners

**Paste di console:**
```javascript
// Check if listeners attached
console.log('Listeners attached?', window.activityListenersAttached);
```

### 2. Check Last Activity Time

**Paste di console:**
```javascript
// Check last activity time
const now = Date.now();
const lastActivity = window.lastActivityTime || 0;
const timeSinceActivity = now - lastActivity;

console.log('Last activity:', timeSinceActivity / 1000, 'seconds ago');
```

### 3. Check Token Expiry

**Paste di console:**
```javascript
const authData = localStorage.getItem('auth-storage');
if (authData) {
  const parsed = JSON.parse(authData);
  const token = parsed.state.accessToken;
  const payload = JSON.parse(atob(token.split('.')[1]));
  const timeLeft = Math.floor((payload.exp * 1000 - Date.now()) / 1000);
  console.log('⏱️ Token expires in:', timeLeft, 'seconds');
}
```

### 4. Monitor Activity Real-Time

**Paste di console:**
```javascript
// Monitor activity every second
setInterval(() => {
  const authData = localStorage.getItem('auth-storage');
  if (authData) {
    const parsed = JSON.parse(authData);
    const token = parsed.state.accessToken;
    const payload = JSON.parse(atob(token.split('.')[1]));
    const timeLeft = Math.floor((payload.exp * 1000 - Date.now()) / 1000);
    
    const now = Date.now();
    const lastActivity = window.lastActivityTime || 0;
    const timeSinceActivity = Math.floor((now - lastActivity) / 1000);
    
    console.log(`⏱️ Token: ${timeLeft}s | Activity: ${timeSinceActivity}s ago`);
  }
}, 1000);
```

---

## 📊 Expected Console Logs

### Normal Active User:
```
[Activity] Activity listeners attached
[Activity] User activity detected, last activity updated
[Token Check] Token will expire in 15 seconds
[Activity] User activity detected, last activity updated
[Token Check] Token will expire in 10 seconds
[Activity] User activity detected, last activity updated
[Token Check] Token will expire in 5 seconds
[Token Check] User active, attempting token refresh...
[Token Check] Token refreshed successfully due to user activity
[Activity] User activity detected, last activity updated
```

### Idle User:
```
[Activity] Activity listeners attached
[Activity] User activity detected, last activity updated
[Token Check] Token will expire in 15 seconds
[Token Check] Token will expire in 10 seconds
[Token Check] Token will expire in 5 seconds
[Token Check] Token expired, logging out...
[Token Check] Forcing redirect to login...
[Activity] Activity listeners detached
```

---

## ❌ Common Issues

### Issue 1: Activity Logs Tidak Muncul

**Symptom:**
- Gerakkan mouse tapi tidak ada log `[Activity] User activity detected`

**Possible Causes:**
1. Event listeners tidak attach
2. Throttle function tidak bekerja
3. Console filter aktif

**Solutions:**
1. Check: `console.log('Listeners?', window.activityListenersAttached)`
2. Restart web server
3. Clear console filter
4. Try different browser

---

### Issue 2: Token Tidak Auto Refresh

**Symptom:**
- Activity detected tapi token tidak refresh
- User logout meskipun aktif

**Possible Causes:**
1. Activity time tidak ter-update
2. Refresh token expired
3. API server tidak jalan

**Solutions:**
1. Check last activity time (lihat debugging tools)
2. Check refresh token expiry (2 minutes)
3. Check API server running
4. Check network tab untuk refresh request

---

### Issue 3: Logout Terlalu Cepat

**Symptom:**
- Logout sebelum 20 detik

**Possible Causes:**
1. Token expiry salah di .env
2. System time tidak sync

**Solutions:**
1. Check `apps/api/.env`: `JWT_ACCESS_EXPIRES=20s`
2. Restart API server
3. Check system time

---

### Issue 4: Tidak Redirect ke Login

**Symptom:**
- Logout tapi stuck di dashboard

**Possible Causes:**
1. Cookie tidak cleared
2. Middleware cache

**Solutions:**
1. Use incognito mode
2. Clear all cookies manually
3. Check middleware.ts

---

## ✅ Success Checklist

### Activity Detection:
- [ ] Mouse movement detected
- [ ] Click detected
- [ ] Keyboard detected
- [ ] Scroll detected
- [ ] Logs muncul max 1x per detik (throttled)

### Token Refresh:
- [ ] Token auto refresh saat user aktif
- [ ] Token TIDAK refresh saat user idle
- [ ] Multiple refresh works (continuous activity)
- [ ] Console logs clear dan informatif

### Auto Logout:
- [ ] Logout saat idle + token expired
- [ ] Logout saat refresh token expired
- [ ] Redirect ke /login works
- [ ] Error message ditampilkan
- [ ] Activity listeners detached

### Edge Cases:
- [ ] Multiple tabs logout simultaneously
- [ ] Page refresh preserves behavior
- [ ] Network error handled gracefully
- [ ] No memory leaks

---

## 🎯 Testing Priority

### Priority 1 (CRITICAL):
1. ✅ Test 1: Mouse Movement Detection
2. ✅ Test 5: Token Auto Refresh (User Aktif)
3. ✅ Test 6: Auto Logout (User Idle)

### Priority 2 (IMPORTANT):
4. ✅ Test 2: Click Detection
5. ✅ Test 7: Active → Idle → Logout

### Priority 3 (NICE TO HAVE):
6. ✅ Test 3: Keyboard Detection
7. ✅ Test 4: Scroll Detection
8. ✅ Test 8: Continuous Activity

---

## 📝 Testing Report Template

**Tester:** [Nama]  
**Date:** [Tanggal]  
**Browser:** [Chrome/Firefox/Edge]  
**Web Server:** http://localhost:3001  
**API Server:** http://localhost:4000

### Test Results:

| Test | Status | Notes |
|------|--------|-------|
| Mouse Movement | ✅/❌ | |
| Click Detection | ✅/❌ | |
| Keyboard Detection | ✅/❌ | |
| Scroll Detection | ✅/❌ | |
| Token Auto Refresh | ✅/❌ | |
| Auto Logout (Idle) | ✅/❌ | |
| Active → Idle | ✅/❌ | |
| Continuous Activity | ✅/❌ | |

### Issues Found:
1. [Describe issue]
2. [Describe issue]

### Console Logs:
```
[Paste relevant console logs]
```

### Screenshots:
[Attach screenshots if needed]

---

## 🚀 Next Steps

### If All Tests Pass:
1. ✅ Mark Task 4 as COMPLETE
2. ✅ Update patch notes
3. ✅ Change to production settings
4. ✅ Deploy to staging
5. ✅ Test on staging
6. ✅ Deploy to production

### If Tests Fail:
1. ❌ Document the issue
2. ❌ Check debugging tools
3. ❌ Review code
4. ❌ Fix the issue
5. ❌ Re-test

---

**Status:** 🧪 **READY FOR TESTING**  
**Web Server:** http://localhost:3001  
**Token Expiry:** 20 seconds  
**Check Interval:** 5 seconds

**IMPORTANT:** Gunakan **Incognito Mode** dan **buka Console (F12)** untuk testing!
