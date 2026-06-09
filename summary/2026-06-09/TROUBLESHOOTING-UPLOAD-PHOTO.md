# Troubleshooting: Upload Foto Member

**Tanggal**: 9 Juni 2026  
**Issue**: "kenapa foto member hanya mau png"

---

## 🔍 **INVESTIGASI**

### **Yang Sudah Dicek:**

1. ✅ **Middleware Upload** (`apps/api/src/middleware/upload.ts`):
   - DOCUMENT_MIME_TYPES sudah include: JPG, PNG, WebP, GIF, BMP, PDF
   - `uploadMemberDocuments` menggunakan `documentFileFilter`
   - File size limit: 5MB

2. ✅ **Frontend Modal** (`apps/web/src/components/members/UploadDocumentsModal.tsx`):
   - File input accept attribute: `image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp`
   - Added client-side validation
   - Added console logging untuk debugging

3. ✅ **Image Processor** (`apps/api/src/utils/imageProcessor.ts`):
   - Semua image dikonversi ke JPEG (quality 85% untuk profile photo)
   - PNG akan dikonversi ke JPG di backend (NORMAL behavior)

---

## 📊 **SUPPORTED FORMATS**

### **Yang SEHARUSNYA Bisa:**

#### **PSP (Informed Consent):**
- ✅ JPG / JPEG
- ✅ PNG
- ✅ WebP
- ✅ GIF
- ✅ BMP
- ✅ PDF

#### **Foto Profil:**
- ✅ JPG / JPEG
- ✅ PNG
- ✅ WebP
- ✅ GIF
- ✅ BMP
- ❌ PDF (tidak untuk foto)

---

## 🐛 **POSSIBLE ISSUES & SOLUTIONS**

### **Issue 1: Browser MIME Type Detection**

**Problem:** Browser salah detect MIME type file

**Solution:**
```javascript
// Added client-side validation di handleFileChange
const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
if (!validImageTypes.includes(selectedFile.type)) {
  alert('Format file tidak didukung');
  return;
}
```

**Test:** Upload JPG file, check console log:
```javascript
console.log('Selected file:', {
  name: selectedFile.name,  // e.g., "photo.jpg"
  type: selectedFile.type,  // Should be "image/jpeg"
  size: selectedFile.size   // e.g., 245678
});
```

---

### **Issue 2: File Extension vs MIME Type Mismatch**

**Problem:** File extension `.jpg` tapi MIME type `image/png` (atau sebaliknya)

**How to Check:**
1. Upload file
2. Check console log
3. If MIME type tidak match extension → file corrupted atau renamed

**Solution:** Re-save file dengan extension yang benar

---

### **Issue 3: Backend Conversion (Expected Behavior)**

**Problem:** Upload PNG, tapi tersimpan sebagai JPG

**Explanation:** Ini BUKAN bug, ini FITUR!
```typescript
// Image processor converts all images to JPEG
profilePhoto: {
  maxWidth: 800,
  maxHeight: 800,
  quality: 85,
  format: 'jpeg',  // ← All images converted to JPEG
}
```

**Why?**
- JPEG lebih efficient untuk storage
- Better compression ratio
- Smaller file size
- No transparency needed untuk profile photos

**Result:**
- Upload `photo.png` (2MB) → Saved as `profile-123.jpg` (400KB)
- Quality tetap bagus (85%)
- File size jauh lebih kecil

---

### **Issue 4: File Too Large**

**Problem:** File > 5MB ditolak

**Check:**
```javascript
const maxSize = 5 * 1024 * 1024; // 5MB
if (selectedFile.size > maxSize) {
  alert(`Ukuran file terlalu besar: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`);
}
```

**Solution:** Compress image dulu sebelum upload

---

### **Issue 5: Special Characters in Filename**

**Problem:** Filename punya special characters → upload gagal

**Example:** 
- ❌ `foto member #1 (new).jpg`
- ✅ `foto-member-1.jpg`

**Solution:** Rename file, remove special characters

---

## 🧪 **TESTING STEPS**

### **Test 1: Upload JPG**

1. Prepare file: `test-photo.jpg` (< 5MB)
2. Open member detail page
3. Click "Upload Dokumen" → Tab "Foto Profil"
4. Select `test-photo.jpg`
5. Check browser console:
   ```
   Selected file: {
     name: "test-photo.jpg",
     type: "image/jpeg",  ← Should be image/jpeg
     size: 245678
   }
   ```
6. Click "Upload"
7. Check console for upload response
8. Expected: ✅ Upload success

---

### **Test 2: Upload PNG**

1. Prepare file: `test-photo.png` (< 5MB)
2. Upload same way
3. Check console:
   ```
   Selected file: {
     name: "test-photo.png",
     type: "image/png",  ← Should be image/png
     size: 345678
   }
   ```
4. Expected: ✅ Upload success, converted to JPG in backend

---

### **Test 3: Check Backend Processing**

1. Check API server logs:
   ```
   [ImageProcessor] Compressed: 2048.5KB → 456.3KB (77.7% reduction)
   ✅ Photo uploaded to MinIO
   - URL: http://.../.../profile-123456.jpg
   ```
2. File extension di URL adalah `.jpg` (NORMAL)
3. Original PNG converted to JPG

---

### **Test 4: Check Saved File**

1. After upload, check database:
   ```sql
   SELECT * FROM MemberDocument 
   WHERE memberId = 'xxx' AND documentType = 'FOTO_PROFIL';
   ```
2. Check fields:
   - `fileName`: Original name (e.g., "photo.png")
   - `fileUrl`: MinIO URL (ends with .jpg)
   - `mimeType`: "image/jpeg" (converted)
3. This is CORRECT behavior

---

## 🔧 **FIXES APPLIED**

### **1. Enhanced Client Validation**
```typescript
// Validate file type
const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
if (!validImageTypes.includes(selectedFile.type)) {
  alert(`Format file tidak didukung: ${selectedFile.type}`);
  return;
}
```

### **2. Enhanced Error Messages**
```typescript
alert(`Gagal upload file!\n\nError: ${errorMessage}\nCode: ${errorCode}\n\nDetail: ${JSON.stringify(err.response?.data, null, 2)}`);
```

### **3. Console Logging**
```typescript
console.log('Selected file:', { name, type, size });
console.log('Uploading file:', { name, type, size, documentType });
console.log('Upload success:', response.data);
```

### **4. Explicit Accept Attribute**
```typescript
accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp"
```

---

## 📝 **RECOMMENDATIONS**

### **For User:**

1. **Check Browser Console:**
   - Press F12
   - Go to "Console" tab
   - Try upload
   - Check logs

2. **Check File:**
   - File size < 5MB?
   - File extension correct?
   - No special characters in filename?

3. **Try Different File:**
   - Try upload another JPG file
   - Try upload from different source

4. **Check Browser:**
   - Clear cache
   - Try different browser
   - Try incognito mode

### **For Developer:**

1. **Check API Server Logs:**
   ```
   npm run dev
   ```
   Look for upload errors

2. **Check MinIO:**
   - MinIO accessible?
   - Bucket exists?
   - Credentials correct?

3. **Test Backend Direct:**
   ```bash
   curl -X POST http://localhost:3001/api/v1/members/{id}/documents \
     -H "Authorization: Bearer {token}" \
     -F "file=@test.jpg" \
     -F "documentType=FOTO_PROFIL"
   ```

---

## ❓ **KLARIFIKASI NEEDED**

Tolong jelaskan lebih detail:

### **Scenario A: JPG Tidak Bisa Upload?**
- Error message apa yang muncul?
- Check console log
- Copy-paste error message

### **Scenario B: PNG Saja yang Bisa?**
- Upload JPG → Error message?
- Upload PNG → Berhasil?
- Foto PNG tersimpan sebagai JPG? (NORMAL)

### **Scenario C: Foto Tidak Muncul?**
- Upload success tapi foto tidak tampil di avatar?
- Check network tab → foto URL berhasil di-load?
- Check browser console → ada error?

---

**Troubleshooting Guide Created By**: Kiro AI  
**Date**: 9 Juni 2026

---

**NEXT STEPS:**
1. User coba upload lagi
2. Check browser console untuk logs
3. Screenshot error message jika ada
4. Report kembali dengan detail error

