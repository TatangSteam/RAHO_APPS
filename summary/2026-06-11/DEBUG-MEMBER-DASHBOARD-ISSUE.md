# Debug: Member Dashboard - Voucher & Paket Tidak Terload

**Tanggal:** 11 Juni 2026  
**Issue:** Di dashboard member, voucher paket dan paket terbeli tidak terload

## 🔍 Langkah Debugging

### 1. Cek Browser Console
Buka halaman dashboard member dan buka DevTools (F12):
- Tab **Console** - cek error JavaScript
- Tab **Network** - cek response API `/api/dashboard/member`

### 2. Cek API Response
Di Network tab, klik request ke `/api/dashboard/member` dan lihat:
- **Status Code**: Harus 200
- **Response Body**: Cek apakah data lengkap

### 3. Cek Terminal API
Lihat terminal tempat API berjalan, cek apakah ada error log:
```
GET /api/dashboard/member
```

### 4. Cek Database
Pastikan data member ada dan valid:
```sql
-- Cek member dengan paket aktif
SELECT m.id, m.memberNo, m.voucherCount, COUNT(mp.id) as active_packages
FROM members m
LEFT JOIN member_packages mp ON mp.memberId = m.id AND mp.status = 'ACTIVE'
WHERE m.id = 'YOUR_MEMBER_ID'
GROUP BY m.id;
```

## 🐛 Kemungkinan Penyebab

### 1. **Data Tidak Ada**
- Member belum memiliki paket aktif
- Query tidak menemukan data

### 2. **Error di Backend**
- TypeScript error saat compile
- Database query error
- Missing relation

### 3. **Error di Frontend**
- API call gagal
- Data tidak di-parse dengan benar
- Type mismatch

### 4. **Cache Issue**
- Browser cache old data
- API cache tidak clear

## 🔧 Solusi Cepat

### Restart API Server
```powershell
cd apps/api
npm run dev
```

### Clear Browser Cache
1. Tekan Ctrl+Shift+Delete
2. Clear cache dan reload (Ctrl+F5)

### Check Logs dengan Detail
Tambahkan console.log di backend:

**File:** `apps/api/src/modules/dashboard/role-dashboard.service.ts`

Di method `getMemberDashboardEnhanced`, tambahkan:
```typescript
console.log('📊 Member found:', {
  id: member.id,
  voucherCount: member.voucherCount,
  packagesCount: member.memberPackages.length
});
```

### Check Logs di Frontend
**File:** `apps/web/src/app/(member)/me/dashboard/page.tsx`

Di `fetchDashboard`, tambahkan:
```typescript
const result = await dashboardApi.getMemberDashboard();
console.log('📦 Dashboard data received:', result);
setData(result);
```

## 🧪 Test API Manually

Gunakan curl atau Postman:
```bash
curl -X GET http://localhost:5000/api/dashboard/member \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "greeting": "Selamat pagi, John!",
    "stats": {
      "voucherSisa": 5,
      "paketAktif": 2,
      "totalSesi": 10,
      "sesiSelesai": 8
    },
    "activePackages": [
      {
        "id": "...",
        "packageCode": "PKG-...",
        "packageType": "BASIC",
        "totalSessions": 7,
        "usedSessions": 3,
        "remainingSessions": 4,
        "progress": 43,
        "status": "ACTIVE",
        "expiredAt": "2026-12-31T00:00:00.000Z",
        "branchName": "RAHO Premier - Pusat"
      }
    ],
    "lastSession": { ... },
    "recentInvoices": [ ... ],
    "branchContact": { ... }
  }
}
```

## 🎯 Lokasi Kode Terkait

### Backend
- **Service**: `apps/api/src/modules/dashboard/role-dashboard.service.ts` (line 843-999)
  - Method: `getMemberDashboardEnhanced()`
- **Controller**: `apps/api/src/modules/dashboard/dashboard.controller.ts`
- **Routes**: `apps/api/src/modules/dashboard/dashboard.routes.ts`

### Frontend
- **Page**: `apps/web/src/app/(member)/me/dashboard/page.tsx`
- **API Client**: `apps/web/src/lib/dashboardApi.ts`
- **Type Definitions**: `apps/web/src/lib/dashboardApi.ts` (interface `MemberDashboardEnhanced`)

## 📝 Checklist Debug

- [ ] Cek browser console untuk error
- [ ] Cek network tab untuk API response
- [ ] Cek terminal API untuk error log
- [ ] Test API dengan curl/Postman
- [ ] Verify database data exists
- [ ] Clear browser cache
- [ ] Restart API server
- [ ] Check authentication token valid

## 💡 Tips

1. **Jika paketAktif = 0**: 
   - Member belum diberi paket atau semua paket expired/cancelled
   - Solusi: Assign paket dari halaman member detail

2. **Jika voucherSisa = 0**:
   - Normal jika member belum diberi voucher
   - Voucher diberikan manual oleh admin

3. **Jika data tidak muncul sama sekali**:
   - Kemungkinan besar error di backend
   - Cek terminal API untuk stack trace

## 🚀 Quick Fix Command

Jika masalah persists, coba rebuild:
```powershell
# Stop API
# Ctrl+C di terminal API

# Rebuild API
cd apps/api
npm run build

# Start API
npm run dev
```

## 📞 Need More Help?

Jika masalah masih berlanjut, mohon berikan:
1. Screenshot browser console (tab Console)
2. Screenshot network tab (request ke /api/dashboard/member)
3. Log dari terminal API
4. Member ID yang bermasalah
