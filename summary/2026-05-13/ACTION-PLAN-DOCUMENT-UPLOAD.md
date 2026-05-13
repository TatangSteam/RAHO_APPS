# Action Plan: Dokumen Upload Tidak Berfungsi

**Tanggal:** 13 Mei 2026  
**Member:** MBR-PST-0009 (sadasda / dae@dae.cd)  
**Status:** 🔴 Masih Bermasalah

## 📊 Current Situation

### Member Info
- **Member No:** MBR-PST-0009
- **Name:** sadasda
- **Email:** dae@dae.cd
- **Created:** 13 Mei 2026, 15:26 WIB
- **Documents:** 0 (❌ No documents)

### Fix Status
- ✅ Code fix applied (15:23 WIB)
- ✅ `uploadMemberDocuments` multer instance created
- ✅ PDF support added to MIME types
- ✅ Route updated to use new multer instance
- ❓ **API server restart status: UNKNOWN**

## 🔍 Possible Causes

### 1. API Server Belum Di-Restart ⚠️ **MOST LIKELY**
**Symptom:** Member dibuat setelah fix (15:26), tapi tidak ada dokumen

**Why:** Node.js tidak auto-reload code changes. Perubahan di:
- `apps/api/src/middleware/upload.ts`
- `apps/api/src/modules/members/members.routes.ts`
- `apps/api/src/modules/members/members.service.backup.ts`

Tidak akan ter-apply sampai server di-restart.

**Solution:**
```bash
# Stop API server (Ctrl+C)
cd apps/api
npm run dev
```

### 2. File Tidak Di-Upload dari Frontend
**Symptom:** User tidak memilih file saat registrasi

**Why:** 
- Form field untuk upload file mungkin tidak visible
- User skip upload file
- File input tidak berfungsi

**Check:**
1. Buka form registrasi member
2. Periksa apakah ada field untuk upload:
   - Dokumen PSP (PDF)
   - Foto Profil (JPG/PNG)
3. Coba upload file dan submit

### 3. Frontend Tidak Mengirim File dengan Benar
**Symptom:** File dipilih tapi tidak dikirim ke API

**Why:**
- FormData tidak di-construct dengan benar
- Field name tidak match (`psp` dan `photo`)
- Content-Type header salah

**Check Frontend Code:**
```typescript
// apps/web/src/app/(staff)/members/new/page.tsx
const formData = new FormData();
formData.append('psp', pspFile);      // ✅ Must be 'psp'
formData.append('photo', photoFile);  // ✅ Must be 'photo'
// ... other fields
```

### 4. Multer Error Tidak Terlihat
**Symptom:** File di-reject tapi error tidak ditampilkan

**Why:**
- Error handling di frontend tidak menampilkan error detail
- Multer error di-swallow

**Check API Logs:**
Look for errors like:
- `FILE_INVALID_TYPE`
- `FILE_TOO_LARGE`
- `UPLOAD_ERROR`

## ✅ Action Plan

### Step 1: Restart API Server (CRITICAL)
```bash
# Terminal 1: Stop current API server
Ctrl+C

# Start API server with fresh code
cd apps/api
npm run dev

# Wait for: "Server running on port 4000"
```

### Step 2: Test Member Registration
```bash
# 1. Open browser: http://localhost:3000
# 2. Login as Admin Layanan
# 3. Go to: Members → Tambah Member Baru
# 4. Fill form with test data
# 5. Upload files:
#    - PSP: Select a PDF file
#    - Photo: Select a JPG/PNG file
# 6. Submit form
# 7. Check if member is created with documents
```

### Step 3: Verify in Database
```bash
cd apps/api
npx tsx scripts/check-specific-member.ts

# Expected output:
# 👤 MBR-PST-0010 - Test User
#    Documents: 2
#      - PERSETUJUAN_SETELAH_PENJELASAN: document.pdf
#      - FOTO_PROFIL: photo.jpg
```

### Step 4: Check API Logs
Look for these log lines:
```
📤 [Create Member] Starting file uploads...
  - PSP file: document.pdf (102400 bytes)
  - Photo file: photo.jpg (51200 bytes)
📄 [Create Member] Uploading PSP document...
  ✅ PSP uploaded to MinIO
  ✅ PSP document saved to database
📸 [Create Member] Uploading profile photo...
  ✅ Photo uploaded to MinIO
  ✅ Photo document saved to database
✅ [Create Member] File uploads completed
```

If you see:
```
📤 [Create Member] Starting file uploads...
  - PSP file: not provided
  - Photo file: not provided
```

Then files are not being sent from frontend.

### Step 5: If Still Not Working - Check Frontend

**Check 1: Form has file inputs**
```typescript
// Should have:
<input type="file" name="psp" accept=".pdf" />
<input type="file" name="photo" accept="image/*" />
```

**Check 2: FormData construction**
```typescript
const formData = new FormData();
if (pspFile) formData.append('psp', pspFile);
if (photoFile) formData.append('photo', photoFile);
```

**Check 3: API call**
```typescript
// Should NOT set Content-Type header (let browser set it)
await api.post('/members', formData);
// NOT: { headers: { 'Content-Type': 'multipart/form-data' } }
```

## 🧪 Quick Test Script

Create a test member with curl to verify API works:

```bash
# Create test files
echo "Test PDF content" > test-psp.pdf
echo "Test image content" > test-photo.jpg

# Test API endpoint
curl -X POST http://localhost:4000/api/v1/members \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "fullName=Test User" \
  -F "memberEmail=test@example.com" \
  -F "phone=08123456789" \
  -F "memberPassword=password123" \
  -F "isConsentToPhoto=true" \
  -F "psp=@test-psp.pdf" \
  -F "photo=@test-photo.jpg"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "memberId": "xxx",
    "memberNo": "MBR-PST-0010",
    "message": "Member berhasil didaftarkan"
  }
}
```

Then check database:
```bash
npx tsx scripts/check-specific-member.ts
```

## 📋 Checklist

- [ ] **CRITICAL:** Restart API server
- [ ] Test member registration via UI
- [ ] Verify documents in database
- [ ] Check API logs for upload messages
- [ ] If still failing, check frontend code
- [ ] If still failing, test with curl
- [ ] Document findings

## 🎯 Expected Outcome

After restarting API server and testing:

**Success Criteria:**
1. ✅ Member created with 2 documents
2. ✅ PSP document (PDF) saved to database
3. ✅ Profile photo (JPG/PNG) saved to database
4. ✅ Files uploaded to MinIO
5. ✅ Documents visible in member detail page
6. ✅ API logs show successful upload

**If Still Failing:**
1. Check frontend form implementation
2. Check browser console for errors
3. Check network tab for request payload
4. Verify FormData contains files
5. Test with curl to isolate frontend vs backend issue

## 📞 Next Steps

1. **Restart API server NOW**
2. Test member registration
3. Report back with:
   - Did documents upload? (Yes/No)
   - What do API logs show?
   - Any errors in browser console?
   - Screenshot of network request payload

## 🔧 Debugging Commands

```bash
# Check if API server is running
curl http://localhost:4000/api/v1/health

# Check recent members
cd apps/api
npx tsx scripts/check-specific-member.ts

# Check all documents
npx tsx scripts/check-member-documents-complete.ts

# Test MinIO upload
npx tsx scripts/test-minio-upload.ts

# View API logs
# (Check terminal where API server is running)
```
