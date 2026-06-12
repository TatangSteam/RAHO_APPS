# Testing Guide: ICD-10 API Integration

**Tanggal**: 9 Juni 2026  
**Status**: Ready for Testing  

---

## 🧪 CARA TEST

### **Test 1: Basic Functionality**

1. **Buka aplikasi** dan login sebagai staff medis
2. **Buat diagnosa baru**:
   - Pilih member mana saja
   - Klik tab "Diagnosa"
   - Klik "Buat Diagnosa"
3. **Test ICD Search**:
   - Klik field "ICD Primer"
   - Ketik: `diabetes`
   - **Expected**: Muncul 20-50 hasil dengan berbagai kode E10, E11, dll

---

### **Test 2: Detailed Search**

Coba berbagai search terms:

| Search Term | Expected Results |
|-------------|------------------|
| `diabetes` | E10, E11, E10.9, E11.9, E11.65, dll (50+ results) |
| `E11` | E11, E11.0, E11.1, E11.2, ... E11.9 (all subcodes) |
| `stroke` | I63, I64, I63.0, I63.9, dll |
| `hypertension` | I10, I11, I12, I13, I15, dll |
| `G56` | G56, G56.0, G56.1, G56.2, G56.3, G56.4 |
| `neuropathy` | G60, G61, G62 series (20+ results) |
| `arthritis` | M05, M06, M15, M16, M17, M19 series |
| `asthma` | J45, J45.0, J45.1, J45.2, dll |
| `pneumonia` | J18, J18.0, J18.1, J18.9, dll |
| `anemia` | D50, D51, D52, D53, D64 series |

---

### **Test 3: Bilingual Display**

Search kode-kode ini dan pastikan ada terjemahan Indonesia:

- `E11` → Should show "... - **Diabetes melitus tipe 2**"
- `I10` → Should show "... - **Hipertensi esensial**"
- `G62` → Should show "... - **Polineuropati lainnya**"
- `M17` → Should show "... - **Osteoartritis lutut**"
- `J45` → Should show "... - **Asma**"

---

### **Test 4: Performance (Caching)**

1. **First Search**:
   - Ketik: `hypertension`
   - Buka **Browser DevTools** (F12)
   - Buka tab **Network**
   - **Expected**: Lihat API call ke `clinicaltables.nlm.nih.gov` (~300-500ms)

2. **Second Search (Same Query)**:
   - Hapus query, ketik lagi: `hypertension`
   - Check **Network tab**
   - **Expected**: TIDAK ada API call (instant, from cache)

3. **Different Search**:
   - Ketik: `diabetes`
   - Check **Network tab**
   - **Expected**: Ada API call baru (not cached yet)

---

### **Test 5: Error Handling (Optional)**

**Simulate Offline**:
1. Buka DevTools → Network tab
2. Set to **Offline** mode
3. Search: `diabetes`
4. **Expected**: Masih dapat hasil (100 kode local sebagai fallback)
5. Set back to **Online**
6. Search: `diabetes`
7. **Expected**: Dapat lebih banyak hasil (70K codes)

---

### **Test 6: Complete Workflow**

Buat diagnosa lengkap dengan ICD:

1. **Buka Member Detail** → Tab Diagnosa → Buat Diagnosa
2. **Pilih Dokter Pemeriksa**
3. **Isi Diagnosa**: "Diabetes Mellitus Tipe 2 dengan Neuropati"
4. **Pilih Kategori**: Diabetes
5. **ICD Primer**: Search `E11` → Pilih `E11` atau `E11.9`
6. **ICD Sekunder**: Search `G62` → Pilih `G62.9`
7. **Isi form lainnya** (Keluhan, Riwayat, dll)
8. **Simpan**
9. **Expected**: Diagnosa tersimpan dengan ICD codes

---

### **Test 7: View ICD in Session**

1. **Buat Session Baru** untuk member yang sudah punya diagnosa
2. **Step 1: Diagnosa** → Pilih diagnosa yang tadi dibuat
3. **Expected**: ICD codes tampil di preview:
   - "ICD Codes: Primer: E11, Sekunder: G62.9"

---

## 📊 EXPECTED RESULTS SUMMARY

### **✅ Success Criteria**

1. **Search berfungsi** → 20-50 hasil per query
2. **Bilingual display** → Kode umum ada terjemahan Indonesia
3. **Caching works** → Second search instant (no API call)
4. **Fallback works** → Offline tetap dapat hasil (100 codes)
5. **Backward compatible** → Diagnosa lama tetap bisa dibuka
6. **Performance** → First search <500ms, cached search <10ms

### **❌ Failure Signs**

1. Search tidak dapat hasil sama sekali
2. Loading sangat lama (>5 detik)
3. Error message di console terus menerus
4. UI freeze atau crash
5. Tidak bisa simpan diagnosa dengan ICD

---

## 🐛 COMMON ISSUES & FIXES

### **Issue: "Network Error" di console**
**Fix**: 
- Check koneksi internet
- API mungkin down (fallback akan aktif otomatis)
- Refresh browser

### **Issue: Search lambat (>2 detik)**
**Fix**:
- Ini normal untuk first search
- Subsequent searches akan instant (cached)

### **Issue: Tidak ada terjemahan Indonesia**
**Fix**:
- Hanya 40+ kode umum yang punya terjemahan
- Kode lain tetap bisa dipakai (bahasa Inggris)

### **Issue: Hasil search terlalu sedikit (<10)**
**Fix**:
- Coba query lebih spesifik (misal: `E11` bukan `E`)
- Coba kata kunci berbeda (misal: `diabetes` bukan `diabetic`)

---

## 📝 TEST REPORT TEMPLATE

```
# ICD-10 API Testing Report

**Tanggal**: _______
**Tester**: _______
**Environment**: Staging / Production

## Test Results

### Test 1: Basic Search
- [ ] PASS  [ ] FAIL
- Notes: _______________________

### Test 2: Detailed Search
- [ ] PASS  [ ] FAIL
- Sample queries tested: _______
- Notes: _______________________

### Test 3: Bilingual Display
- [ ] PASS  [ ] FAIL
- Codes with Indonesian translation: _______
- Notes: _______________________

### Test 4: Performance
- [ ] PASS  [ ] FAIL
- First search time: ____ms
- Cached search time: ____ms
- Notes: _______________________

### Test 5: Error Handling
- [ ] PASS  [ ] FAIL
- Offline fallback works: [ ] YES [ ] NO
- Notes: _______________________

### Test 6: Complete Workflow
- [ ] PASS  [ ] FAIL
- Diagnosa saved successfully: [ ] YES [ ] NO
- ICD codes saved correctly: [ ] YES [ ] NO
- Notes: _______________________

## Overall Assessment

- [ ] READY FOR PRODUCTION
- [ ] NEEDS FIXES
- [ ] NEEDS MORE TESTING

## Issues Found

1. _______________________
2. _______________________
3. _______________________

## Recommendations

_______________________
_______________________

**Signed**: _______
**Date**: _______
```

---

## 🚀 DEPLOYMENT STEPS (After Testing)

1. ✅ **Staging Testing** → Complete all tests above
2. ✅ **UAT with Medical Staff** → Get feedback
3. ✅ **Fix any issues** found
4. ✅ **Production Deployment** → Deploy ke production
5. ✅ **Monitor** → Check logs for 24-48 hours
6. ✅ **Collect Feedback** → Ask users about experience

---

## 📞 SUPPORT

**If you encounter issues during testing:**

1. **Check Browser Console** (F12 → Console tab)
2. **Screenshot the error**
3. **Note the steps** to reproduce
4. **Report** with details:
   - Browser & version
   - Search query yang bermasalah
   - Error message (if any)
   - Expected vs actual behavior

---

**Happy Testing!** 🎉
