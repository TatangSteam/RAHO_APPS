# 🧪 Testing Instructions - Incentive System Redesign

## ✅ Backend Status: WORKING

API server sudah running dan migration berhasil. Test script menunjukkan:
- ✅ Incentive fields removed from ReferralCode
- ✅ Referral codes dapat dibuat tanpa incentive
- ✅ Database schema correct

---

## 🔧 Fix Applied

**Problem:** Error 500 saat fetch/create referrals

**Root Cause:** Prisma client belum di-regenerate setelah migration

**Solution:** 
```bash
# Stop API server
# Regenerate Prisma client
npx prisma generate

# Restart API server
npm run dev
```

**Status:** ✅ FIXED

---

## 🧪 Manual Testing Steps

### 1️⃣ Refresh Browser
**PENTING:** Setelah regenerate Prisma client, **REFRESH BROWSER** (Ctrl+Shift+R atau Cmd+Shift+R)

### 2️⃣ Test Referral Code Creation

1. Login sebagai admin
2. Navigate ke **Kode Referral** page
3. Click **+ Tambah Referral**
4. Fill form:
   - Nama Referrer: Test User
   - Tipe: SALES
   - Cabang: Jakarta
   - Phone: 08123456789
   - Email: test@example.com
5. Verify: **NO incentive fields** in form
6. Click **Simpan**
7. Expected: ✅ Success, referral created

### 3️⃣ Test Referral List

1. Check referral list table
2. Verify columns:
   - ✅ Kode
   - ✅ Nama
   - ✅ Tipe
   - ✅ Cabang
   - ✅ Kontak
   - ✅ Total Referral
   - ✅ Total Insentif
   - ❌ NO "Insentif Pertama" column
   - ❌ NO "Insentif Lanjutan" column

### 4️⃣ Test Member Creation with Incentive

1. Navigate to **Branches** page
2. Click on a branch (e.g., Jakarta)
3. Go to **Members** tab
4. Click **+ Tambah Member**
5. Fill basic info:
   - Nama: Test Member
   - Email: testmember@example.com
   - Password: password123
   - Phone: 08123456789
6. Select **Kode Referral**: REF-001
7. Verify: **Incentive section appears** below referral dropdown
8. Fill incentive:
   - Insentif Paket Pertama - Tipe: Persentase (%)
   - Nilai: 10
   - Insentif Paket Lanjutan - Tipe: Persentase (%)
   - Nilai: 5
9. Click **Tambah Member**
10. Expected: ✅ Success, member created with incentive

### 5️⃣ Test Member Creation WITHOUT Incentive

1. Create another member
2. Select referral code
3. **Leave incentive fields empty** (Tidak Ada Insentif)
4. Click **Tambah Member**
5. Expected: ✅ Success, member created without incentive

### 6️⃣ Test Package Assignment & Incentive Calculation

1. Navigate to member detail
2. Assign a package (e.g., NB7PM - Rp 12,500,000)
3. Complete payment
4. Navigate to **Kode Referral** → Detail (REF-001)
5. Check **Incentive Records** tab
6. Expected: 
   - ✅ New incentive record created
   - ✅ Amount: Rp 1,250,000 (10% of 12,500,000)
   - ✅ Shows member name and package

### 7️⃣ Test Export Functions

1. Go to **Kode Referral** page
2. Click **📊 Ringkasan** button
3. Expected: ✅ Excel file downloaded
4. Click **📥 Excel** button
5. Expected: ✅ Excel file downloaded
6. Click **📄 PDF** button
7. Expected: ✅ PDF file downloaded

---

## 🐛 Troubleshooting

### Error 500 on API calls

**Solution:**
```bash
# In apps/api directory
npx prisma generate
npm run dev
```

### Frontend shows old data

**Solution:**
- Hard refresh browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Clear browser cache
- Restart web dev server

### Incentive section not showing

**Check:**
1. Is referral code selected?
2. Is this create mode (not edit)?
3. Check browser console for errors

### Database out of sync

**Solution:**
```bash
# Check migration status
npx prisma migrate status

# If needed, reset and reseed
npx prisma migrate reset
npx tsx prisma/seed.ts
```

---

## 📊 Expected Results

### Referral Code (After Migration)
```json
{
  "id": "cuid",
  "code": "REF-001",
  "referrerName": "Ahmad Wijaya",
  "referrerType": "SALES",
  "branchId": "cuid",
  "phone": "08123456789",
  "email": "ahmad@raho.id",
  "totalReferrals": 0,
  "totalIncentiveEarned": 0,
  "isActive": true
  // ❌ NO incentive fields
}
```

### Member (After Migration)
```json
{
  "id": "cuid",
  "memberNo": "MBR-PST-0001",
  "referralCodeId": "cuid",
  "firstIncentiveType": "PERCENTAGE",
  "firstIncentiveValue": 10,
  "nextIncentiveType": "PERCENTAGE",
  "nextIncentiveValue": 5
  // ✅ HAS incentive fields
}
```

### Incentive Record
```json
{
  "id": "cuid",
  "referralCodeId": "cuid",
  "memberId": "cuid",
  "memberPackageId": "cuid",
  "packageType": "BASIC",
  "packageName": "NB7PM",
  "packageValue": 12500000,
  "isFirstPackage": true,
  "incentiveType": "PERCENTAGE",
  "incentiveValue": 10,
  "incentiveAmount": 1250000
  // ✅ Calculated from MEMBER, not referral code
}
```

---

## ✅ Success Criteria

- [ ] Can create referral code without incentive fields
- [ ] Referral list shows correct columns (no incentive columns)
- [ ] Can create member with referral code
- [ ] Incentive section appears when referral selected
- [ ] Can set custom incentive per member
- [ ] Can create member without incentive
- [ ] Package assignment calculates incentive from member
- [ ] Incentive records show correct amounts
- [ ] Export functions work correctly

---

## 🎉 When All Tests Pass

Congratulations! The incentive system redesign is fully functional and production-ready! 🚀

**Key Achievement:**
- ✅ Insentif ditentukan saat membuat MEMBER
- ✅ Setiap member bisa punya rate berbeda
- ✅ Kode referral lebih sederhana
- ✅ Sistem lebih fleksibel

---

## 📞 Need Help?

If you encounter any issues:
1. Check browser console for errors
2. Check API server logs
3. Verify Prisma client is regenerated
4. Ensure database migration is applied
5. Try hard refresh browser

**Files to check:**
- `apps/api/src/modules/referrals/referrals.service.ts`
- `apps/api/src/modules/members/services/member-registration.service.ts`
- `apps/web/src/app/(staff)/referrals/page.tsx`
- `apps/web/src/components/branches/MemberCrudModal.tsx`
