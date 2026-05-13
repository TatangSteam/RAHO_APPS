# Fix: Member Document Upload Not Working

**Date:** 2026-05-13  
**Status:** ✅ RESOLVED  
**Issue:** PSP and profile photo documents were not being uploaded during member registration

---

## Problem Summary

When creating a new member through the registration form, the PSP (Persetujuan Setelah Penjelasan) document and profile photo were not being uploaded to MinIO or saved to the database, even though the form appeared to submit successfully.

---

## Root Causes Identified

### 1. **Multer Middleware Rejecting Files**
- Original multer instance (`upload`) only accepted images
- PSP documents needed to accept images (not PDFs as initially thought)
- Wrong middleware was being used on the route

### 2. **Wrong Service File**
- File upload code was added to `members.service.backup.ts`
- Actual service uses `member-registration.service.ts`

### 3. **Frontend Sending Files as Strings**
- Frontend was sending files as strings in `req.body` instead of File objects in `req.files`
- `psp` and `photo` keys were being iterated over in FormData construction loop

---

## Solutions Implemented

### Backend Changes

#### 1. Updated Multer Configuration (`apps/api/src/middleware/upload.ts`)
- Created `DOCUMENT_MIME_TYPES` array with image formats only:
  ```typescript
  const DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/bmp'] as const;
  ```
- Created `documentFileFilter()` function that accepts only images
- Created `uploadMemberDocuments` multer instance using the new filter
- **Note:** PSP must be an image file, not PDF

#### 2. Updated Routes (`apps/api/src/modules/members/members.routes.ts`)
- Changed from `upload.fields()` to `uploadMemberDocuments.fields()`:
  ```typescript
  router.post(
    '/',
    authenticate,
    authorize(ADMIN_PLUS),
    uploadMemberDocuments.fields([
      { name: 'psp', maxCount: 1 },
      { name: 'photo', maxCount: 1 },
    ]),
    controller.createMember.bind(controller)
  );
  ```

#### 3. Added File Upload Logic (`apps/api/src/modules/members/services/member-registration.service.ts`)
- Imports `uploadFile` from `../../../config/minio` and `DocumentType` from `@prisma/client`
- After member creation, uploads PSP and photo files to MinIO
- Creates database records in `member_documents` table
- Comprehensive logging with emoji markers (📤, 📄, 📸, ✅, ❌)
- Non-blocking error handling (member creation succeeds even if upload fails)

#### 4. Added Logging (`apps/api/src/modules/members/members.controller.ts`)
- Added debug logging to verify file reception:
  ```typescript
  console.log('🔍 [Controller] req.files:', req.files);
  console.log('🔍 [Controller] req.body keys:', Object.keys(req.body));
  ```

### Frontend Changes

#### 5. Fixed FormData Construction (`apps/web/src/lib/membersApi.ts`)
- Added check to skip `psp` and `photo` keys when iterating over `memberData`:
  ```typescript
  Object.entries(memberData).forEach(([key, value]) => {
    if (key === 'psp' || key === 'photo') {
      return; // Skip these - they'll be added as files below
    }
    // ... append other fields
  });
  ```
- Removed manual `Content-Type: multipart/form-data` header (browser sets it automatically with boundary)

#### 6. Updated UI (`apps/web/src/components/members/new/DocumentUploadSection.tsx`)
- Changed PSP file input to accept only images:
  ```typescript
  accept="image/jpeg,image/png,image/webp,image/jpg,image/gif,image/bmp"
  ```
- Updated help text: "Max 5MB • JPG, PNG, WebP (gambar saja)"

---

## Testing & Verification

### Expected API Logs (Success):
```
🔍 [Controller] req.files: { psp: [...], photo: [...] }
📤 [Create Member] Starting file uploads...
  - PSP file: consent.jpg (102400 bytes)
  - Photo file: profile.jpg (51200 bytes)
📄 [Create Member] Uploading PSP document...
  ✅ PSP uploaded to MinIO
  ✅ PSP document saved to database
📸 [Create Member] Uploading profile photo...
  ✅ Photo uploaded to MinIO
  ✅ Photo document saved to database
✅ [Create Member] File uploads completed
```

### Database Verification:
```bash
npx tsx scripts/check-specific-member.ts MBR-PST-0022
```

Should show:
- PSP document with `documentType: 'PERSETUJUAN_SETELAH_PENJELASAN'`
- Profile photo with `documentType: 'FOTO_PROFIL'`

### UI Verification:
1. Go to member detail page
2. Profile photo should be displayed in avatar
3. PSP document should appear in "Dokumen Persetujuan Setelah Penjelasan" section
4. Clicking "Lihat Dokumen" should open the image in a new tab

---

## Important Notes

1. **PSP Format:** PSP documents must be uploaded as **images** (JPG, PNG, WebP, GIF, BMP), not PDF files
2. **File Size Limit:** Maximum 5MB per file
3. **Non-Blocking:** File upload failures do not prevent member creation
4. **MinIO Path Pattern:** `uploads/members/{memberId}/documents/{type}-{timestamp}.{ext}`
5. **Browser Cache:** After code changes, users must hard refresh (Ctrl+Shift+R) to load new JavaScript

---

## Files Modified

### Backend:
- `apps/api/src/middleware/upload.ts` - Added `uploadMemberDocuments` multer instance
- `apps/api/src/modules/members/members.routes.ts` - Use `uploadMemberDocuments` middleware
- `apps/api/src/modules/members/services/member-registration.service.ts` - Added file upload logic
- `apps/api/src/modules/members/members.controller.ts` - Added debug logging

### Frontend:
- `apps/web/src/lib/membersApi.ts` - Fixed FormData construction
- `apps/web/src/components/members/new/DocumentUploadSection.tsx` - Updated file input accept attribute

### Scripts:
- `apps/api/scripts/test-minio-upload.ts` - Created for MinIO testing
- `apps/api/scripts/check-specific-member.ts` - Modified to accept search term parameter

---

## Related Issues

- **Task 1:** Fix Consent Documents Not Showing (RESOLVED)
- **Task 2:** Fix Avatar URL Null Issue (RESOLVED)
- **Task 3:** Fix Document Upload Not Working (RESOLVED)

All three issues were related to missing seed data and file upload implementation.
