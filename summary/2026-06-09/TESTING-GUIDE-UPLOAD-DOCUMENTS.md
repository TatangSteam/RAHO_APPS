# Testing Guide: Upload Member Documents Feature

**Tanggal**: 9 Juni 2026  
**Feature**: Upload Informed Consent & Profile Picture setelah member dibuat

---

## 🚀 **CARA TESTING**

### **Persiapan:**
1. Restart API server (karena ada perubahan backend)
2. Build frontend atau jalankan dev server
3. Login sebagai salah satu role yang authorized

---

## ✅ **TEST 1: Upload PSP Document**

### **Login:** ADMIN_CABANG atau ADMIN_LAYANAN

### **Steps:**
1. Buka halaman Members
2. Klik salah satu member yang sudah ada
3. Di halaman detail member, lihat header (bagian atas)
4. Klik button **"Upload Dokumen"** (warna hijau, icon upload)
5. Modal akan terbuka dengan 2 tab
6. Tab pertama "Informed Consent (PSP)" sudah terpilih (default)
7. Klik **"Pilih File"**
8. Pilih file PSP:
   - Bisa PDF
   - Bisa JPG/PNG
   - Maksimal 5MB
9. Setelah dipilih, akan muncul nama file dengan checkmark hijau
10. Klik **"Upload"**
11. Button berubah jadi "Uploading..."
12. Setelah selesai, akan muncul alert sukses
13. Modal otomatis tertutup
14. Refresh page atau lihat di tab "Profil" → dokumen PSP sudah muncul

### **Expected Result:**
- ✅ Button "Upload Dokumen" terlihat di header (hanya untuk admin)
- ✅ Modal terbuka dengan benar
- ✅ File bisa dipilih
- ✅ Upload berhasil
- ✅ Success message muncul
- ✅ Modal tertutup otomatis
- ✅ PSP document tersimpan di database

---

## ✅ **TEST 2: Upload Profile Photo**

### **Login:** ADMIN_LAYANAN

### **Steps:**
1. Buka member detail page
2. Klik **"Upload Dokumen"**
3. Klik tab **"Foto Profil"** (tab kedua)
4. Klik **"Pilih File"**
5. Pilih foto member:
   - Format: JPG, PNG
   - Maksimal 5MB
6. File name muncul dengan checkmark
7. Klik **"Upload"**
8. Tunggu proses upload
9. Success alert muncul
10. Modal tertutup
11. Refresh page
12. **IMPORTANT**: Foto seharusnya muncul di avatar member (circle di header)

### **Expected Result:**
- ✅ Photo upload berhasil
- ✅ Avatar member di header berubah menampilkan foto yang diupload
- ✅ Tidak ada error

---

## ✅ **TEST 3: Replace Existing Document**

### **Scenario:** Member sudah punya PSP, tapi mau diganti dengan yang baru

### **Steps:**
1. Pastikan member sudah punya PSP
2. Klik **"Upload Dokumen"**
3. Upload PSP baru
4. Check di database atau refresh page
5. Verifikasi hanya ada 1 PSP (tidak duplicate)

### **Expected Result:**
- ✅ PSP lama ter-replace dengan yang baru
- ✅ Tidak ada duplicate (hanya 1 PSP per member)
- ✅ Timestamp diupdate

---

## ✅ **TEST 4: Access Control**

### **Test 4.1: Doctor Role (TIDAK BOLEH)**

### **Steps:**
1. Login sebagai DOCTOR
2. Buka member detail page
3. Lihat header

### **Expected Result:**
- ❌ Button "Upload Dokumen" **TIDAK TERLIHAT**
- ✅ Access control working correctly

---

### **Test 4.2: Nurse Role (TIDAK BOLEH)**

### **Steps:**
1. Login sebagai NURSE
2. Buka member detail page

### **Expected Result:**
- ❌ Button "Upload Dokumen" **TIDAK TERLIHAT**

---

### **Test 4.3: Admin Manager (BOLEH)**

### **Steps:**
1. Login sebagai ADMIN_MANAGER
2. Buka member detail page

### **Expected Result:**
- ✅ Button "Upload Dokumen" **TERLIHAT**
- ✅ Bisa upload dokumen

---

### **Test 4.4: Super Admin (BOLEH)**

### **Steps:**
1. Login sebagai SUPER_ADMIN
2. Buka member detail page

### **Expected Result:**
- ✅ Button "Upload Dokumen" **TERLIHAT**
- ✅ Bisa upload dokumen

---

## ✅ **TEST 5: File Validation**

### **Test 5.1: File Terlalu Besar**

### **Steps:**
1. Pilih file > 5MB
2. Try upload

### **Expected Result:**
- ❌ Upload ditolak
- ✅ Error message: "Ukuran file maksimal 5MB"

---

### **Test 5.2: Format Salah (PSP)**

### **Steps:**
1. Tab PSP
2. Try upload file TXT, DOCX, atau format lain yang tidak supported

### **Expected Result:**
- ❌ Upload ditolak
- ✅ Error message tentang format file

---

### **Test 5.3: Format Salah (Photo)**

### **Steps:**
1. Tab Photo
2. Try upload PDF (photo hanya terima image)

### **Expected Result:**
- ❌ Upload ditolak
- ✅ Error message tentang format file

---

## 🎨 **UI/UX CHECKS**

### **Visual Checks:**
- [ ] Button "Upload Dokumen" styled dengan warna hijau
- [ ] Button punya icon Upload
- [ ] Modal muncul dengan backdrop blur
- [ ] Tabs bisa diklik dan switch dengan smooth
- [ ] File picker area jelas (dashed border)
- [ ] Selected file ditampilkan dengan checkmark hijau
- [ ] Loading state terlihat saat upload
- [ ] Success alert muncul
- [ ] Modal tertutup otomatis setelah sukses

### **Responsiveness:**
- [ ] Modal responsive di mobile
- [ ] Button tidak overflow di layar kecil
- [ ] Tabs tetap bisa diklik di mobile

---

## 🐛 **POTENTIAL ISSUES TO CHECK**

### **Issue 1: API Server Not Restarted**
**Symptom:** Error 404 atau route not found  
**Solution:** Restart API server

### **Issue 2: File Too Large**
**Symptom:** Upload rejected  
**Solution:** Compress file atau pilih file lebih kecil (<5MB)

### **Issue 3: Wrong MIME Type**
**Symptom:** Upload rejected with "invalid file type"  
**Solution:** Pastikan format file sesuai (PSP: JPG/PNG/PDF, Photo: JPG/PNG)

### **Issue 4: Member Not Found**
**Symptom:** Error "Member tidak ditemukan"  
**Solution:** Pastikan member ID valid dan member exist di database

### **Issue 5: Unauthorized Access**
**Symptom:** Button tidak muncul atau error 403  
**Solution:** Login dengan role yang authorized (ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN)

---

## 📊 **DATABASE VERIFICATION**

### **Check Uploaded Documents:**

```sql
-- Check member documents
SELECT 
  md.id,
  md.memberId,
  m.memberNo,
  md.documentType,
  md.fileName,
  md.fileSize,
  md.mimeType,
  md.createdAt,
  md.uploadedBy,
  u.email as uploader_email
FROM MemberDocument md
JOIN Member m ON m.id = md.memberId
LEFT JOIN User u ON u.id = md.uploadedBy
ORDER BY md.createdAt DESC
LIMIT 10;
```

### **Check for Duplicates:**

```sql
-- Ensure no duplicate documents per type per member
SELECT 
  memberId,
  documentType,
  COUNT(*) as count
FROM MemberDocument
GROUP BY memberId, documentType
HAVING COUNT(*) > 1;
```

**Expected:** No results (no duplicates)

---

## 📝 **TESTING CHECKLIST**

### **Functional Tests:**
- [ ] Upload PSP (PDF)
- [ ] Upload PSP (Image)
- [ ] Upload Profile Photo
- [ ] Replace existing PSP
- [ ] Replace existing Photo
- [ ] Access control for ADMIN_LAYANAN
- [ ] Access control for ADMIN_CABANG
- [ ] Access control for ADMIN_MANAGER
- [ ] Access control for SUPER_ADMIN
- [ ] Access denied for DOCTOR
- [ ] Access denied for NURSE
- [ ] File size validation (>5MB rejected)
- [ ] File format validation

### **UI/UX Tests:**
- [ ] Button visible for authorized roles
- [ ] Button styled correctly (green with upload icon)
- [ ] Modal opens on button click
- [ ] Tabs switch correctly
- [ ] File picker works
- [ ] Selected file displayed with checkmark
- [ ] Loading state during upload
- [ ] Success message shown
- [ ] Modal closes automatically
- [ ] Page refreshes/updates after upload

### **Integration Tests:**
- [ ] Upload PSP → visible in member profile
- [ ] Upload Photo → visible in header avatar
- [ ] Audit log created for uploads
- [ ] MinIO file storage works
- [ ] Database records created/updated correctly

---

## 🎉 **SUCCESS CRITERIA**

Feature dianggap **BERHASIL** jika:

1. ✅ Admin bisa upload PSP setelah member dibuat
2. ✅ Admin bisa upload Profile Photo setelah member dibuat
3. ✅ Upload button hanya visible untuk authorized roles
4. ✅ Modal bekerja dengan benar (tabs, file picker, upload)
5. ✅ File validation bekerja (size, format)
6. ✅ Documents tersimpan di MinIO dan database
7. ✅ Replace existing documents tanpa duplicate
8. ✅ Profile photo muncul di avatar member
9. ✅ Audit log tercatat
10. ✅ No errors di console

---

**Testing Guide Created By**: Kiro AI  
**Date**: 9 Juni 2026  
**Status**: Ready for Testing

---

**HAPPY TESTING!** 🚀
