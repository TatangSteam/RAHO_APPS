# Testing Guide - Super Admin Dashboard

**Tanggal:** 4 Juni 2026  
**Component:** Super Admin Dashboard  
**Tester:** QA Team / Developer

---

## 🎯 Test Objective

Memverifikasi bahwa dashboard Super Admin berfungsi dengan baik, terkoneksi dengan API, dan menampilkan data statistik sistem dengan benar.

---

## 🔐 Prerequisites

### 1. Environment
- ✅ Development server running
- ✅ Database seeded dengan data testing
- ✅ API server running di port 3001
- ✅ Web server running di port 3000

### 2. Test Account
```
Email: superadmin@raho.com
Password: [dari seed data - lihat apps/api/prisma/seeds/users.seed.ts]
Role: SUPER_ADMIN
```

---

## 📋 Test Scenarios

### Scenario 1: Login & Access Dashboard

#### Steps:
1. Buka browser dan navigate ke `http://localhost:3000/login`
2. Input credentials Super Admin
3. Click tombol "Masuk"
4. Verify redirect ke `/admin/super-admin`

#### Expected Results:
- ✅ Login berhasil
- ✅ Redirect ke Super Admin dashboard
- ✅ Loading state ditampilkan sebentar
- ✅ Dashboard muncul dengan data lengkap

#### Actual Results:
[ ] Pass  
[ ] Fail  
Notes: ___________________________________________

---

### Scenario 2: Verify Dashboard Statistics

#### Steps:
1. Di dashboard Super Admin, periksa "Quick Stats Grid"
2. Verify 6 stat cards ditampilkan:
   - Total Cabang
   - Total Staff
   - Total Member
   - Master Produk
   - Total Pendapatan
   - Total Sesi Terapi

#### Expected Results:
- ✅ Semua 6 cards ditampilkan
- ✅ Angka bukan 0 (jika database seeded)
- ✅ Format currency untuk "Total Pendapatan" (Rp xxx.xxx)
- ✅ Subtitle menampilkan data tambahan (aktif count)

#### Actual Results:
[ ] Pass  
[ ] Fail  
Notes: ___________________________________________

---

### Scenario 3: Check User Role Distribution

#### Steps:
1. Scroll ke section "Manajemen User"
2. Lihat card "Distribusi Role"
3. Verify list roles ditampilkan

#### Expected Results:
- ✅ List roles ditampilkan (SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG, dll)
- ✅ Count untuk setiap role
- ✅ Tidak ada error
- ✅ Fallback message jika data kosong

#### Actual Results:
[ ] Pass  
[ ] Fail  
Notes: ___________________________________________

---

### Scenario 4: Check Recent Activities

#### Steps:
1. Scroll ke section "Aktivitas Terbaru"
2. Verify list activities ditampilkan
3. Check format data

#### Expected Results:
- ✅ Max 10 activities ditampilkan
- ✅ Each activity shows:
  - Action type (LOGIN, LOGOUT, CREATE, UPDATE, DELETE, VERIFY)
  - User name & email
  - Branch name (jika ada)
  - Timestamp (format: dd MMM yyyy, HH:mm)
- ✅ Icons color-coded sesuai action type
- ✅ Scrollable jika lebih dari viewport

#### Actual Results:
[ ] Pass  
[ ] Fail  
Notes: ___________________________________________

---

### Scenario 5: Navigate to Other Sections

#### Steps:
1. Click tab "Admin Managers"
2. Verify AdminManagersTab component loaded
3. Click tab "Master Products"
4. Verify redirect message muncul
5. Click tab "Audit Logs"
6. Verify redirect message muncul

#### Expected Results:
- ✅ Tab navigation berfungsi
- ✅ Active tab highlighted (violet color)
- ✅ Content berubah sesuai tab
- ✅ Redirect buttons berfungsi

#### Actual Results:
[ ] Pass  
[ ] Fail  
Notes: ___________________________________________

---

### Scenario 6: Click Quick Actions

#### Steps:
1. Scroll ke "Aksi Cepat" section
2. Click "Tambah Produk" button
3. Verify redirect ke `/admin/master-products`
4. Navigate back
5. Click "Tambah Cabang" button
6. Verify redirect ke `/branches`
7. Navigate back
8. Click "Refresh Data" button

#### Expected Results:
- ✅ Navigation buttons work
- ✅ Refresh button reloads data
- ✅ Loading indicator saat refresh
- ✅ Data updated setelah refresh

#### Actual Results:
[ ] Pass  
[ ] Fail  
Notes: ___________________________________________

---

### Scenario 7: Test Error Handling

#### Steps:
1. Open browser DevTools
2. Go to Network tab
3. Set network to "Offline"
4. Refresh dashboard page
5. Wait for error state
6. Set network back to "Online"
7. Click "Coba Lagi" button

#### Expected Results:
- ✅ Error state ditampilkan dengan:
  - Error icon (red)
  - Error message
  - "Coba Lagi" button
- ✅ Clicking "Coba Lagi" fetches data kembali
- ✅ Dashboard loads successfully setelah online

#### Actual Results:
[ ] Pass  
[ ] Fail  
Notes: ___________________________________________

---

### Scenario 8: Test Dark Mode

#### Steps:
1. Toggle dark mode dari header
2. Verify dashboard appearance
3. Check all components
4. Toggle back to light mode

#### Expected Results:
- ✅ Dark mode applies correctly
- ✅ All colors inverted properly
- ✅ Text readable
- ✅ Cards have proper contrast
- ✅ Icons visible
- ✅ No layout shifts

#### Actual Results:
[ ] Pass  
[ ] Fail  
Notes: ___________________________________________

---

### Scenario 9: Test Responsive Design

#### Steps:
1. Resize browser window to mobile width (375px)
2. Verify layout
3. Resize to tablet width (768px)
4. Verify layout
5. Resize to desktop width (1440px)
6. Verify layout

#### Expected Results:
- ✅ Mobile: 2 column grid untuk stats
- ✅ Tablet: Proper spacing
- ✅ Desktop: 3 column grid untuk stats
- ✅ No horizontal scroll
- ✅ All buttons accessible
- ✅ Text tidak terpotong

#### Actual Results:
[ ] Pass  
[ ] Fail  
Notes: ___________________________________________

---

### Scenario 10: Check Console Logs

#### Steps:
1. Open browser DevTools Console
2. Refresh dashboard
3. Monitor console logs
4. Check for errors

#### Expected Results:
- ✅ Debug logs present (development mode):
  - "📊 Loading system stats..."
  - "API URL: ..."
  - "Access Token: Present"
  - "Response status: 200"
  - "✅ System stats loaded: ..."
- ✅ No error logs
- ✅ No warning logs
- ✅ API call successful

#### Actual Results:
[ ] Pass  
[ ] Fail  
Notes: ___________________________________________

---

## 🔍 API Testing

### Test API Endpoint Directly

#### Using curl:
```bash
curl -X GET http://localhost:3001/api/v1/admin/system-stats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

#### Expected Response:
```json
{
  "success": true,
  "data": {
    "totalBranches": 5,
    "activeBranches": 4,
    "totalUsers": 25,
    "activeUsers": 23,
    "totalMembers": 100,
    "activeMembers": 85,
    "totalProducts": 50,
    "activeProducts": 45,
    "totalRevenue": 50000000,
    "monthlyRevenue": 5000000,
    "totalSessions": 200,
    "monthlySessions": 25,
    "usersByRole": [
      { "role": "SUPER_ADMIN", "count": 1 },
      { "role": "ADMIN_MANAGER", "count": 2 },
      { "role": "ADMIN_CABANG", "count": 5 },
      { "role": "ADMIN_LAYANAN", "count": 3 },
      { "role": "DOCTOR", "count": 8 },
      { "role": "NURSE", "count": 6 }
    ],
    "recentActivities": [...]
  }
}
```

#### Actual Response:
[ ] Pass  
[ ] Fail  
Notes: ___________________________________________

---

## 🐛 Bug Report Template

Jika menemukan bug, gunakan template berikut:

```markdown
### Bug Title:
[Brief description]

### Severity:
[ ] Critical
[ ] High
[ ] Medium
[ ] Low

### Steps to Reproduce:
1. 
2. 
3. 

### Expected Behavior:
[What should happen]

### Actual Behavior:
[What actually happens]

### Screenshots:
[Attach screenshots if applicable]

### Environment:
- OS: 
- Browser: 
- Screen Size: 
- Date/Time: 

### Console Errors:
```
[Paste console errors here]
```

### Additional Notes:
[Any other relevant information]
```

---

## ✅ Overall Test Results

### Summary:
- Total Scenarios: 10
- Passed: ___/10
- Failed: ___/10
- Blocked: ___/10

### Sign-off:
- Tester Name: ___________________
- Date: ___________________
- Signature: ___________________

### Approval:
- Dev Lead: ___________________
- Date: ___________________

---

## 📝 Notes

1. Test harus dilakukan di environment yang sudah di-seed dengan data testing
2. Jika ada failure, catat di bug report dan inform dev team
3. Screenshot sangat membantu untuk dokumentasi bug
4. Test di multiple browsers jika memungkinkan (Chrome, Firefox, Safari, Edge)

---

**Status:** Ready for Testing  
**Priority:** High  
**Estimated Testing Time:** 30-45 minutes
