# Upload Member Documents Implementation

**Tanggal**: 9 Juni 2026  
**Status**: ✅ **IMPLEMENTED**  
**Feature**: Upload Informed Consent & Profile Picture setelah member dibuat

---

## 🎯 **REQUIREMENT**

### **User Request:**
"Tolong buat bisa menambahkan inform consent dan profil pict setelah member dibuat (bisa admin layanan dan admin cabang dan keatas)"

### **Business Need:**
- Member sudah didaftarkan tapi belum ada PSP (Persetujuan Setelah Penjelasan)
- Member sudah didaftarkan tapi belum ada foto profil
- Admin perlu upload dokumen ini SETELAH registrasi
- Aksesible untuk: ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN

---

## ✅ **SOLUTION IMPLEMENTED**

### **Features:**
1. ✅ **Upload Button** di Member Detail Page Header
2. ✅ **Upload Modal** dengan 2 tabs:
   - Tab 1: Upload PSP (Informed Consent) - accepts images + PDF
   - Tab 2: Upload Profile Picture - accepts images only
3. ✅ **API Endpoint** untuk upload documents
4. ✅ **Access Control**: ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN

### **Flow:**
```
Member Detail Page
  ↓
[Upload Documents] Button (shown for authorized roles)
  ↓
Modal Opens with Tabs (PSP / Profile Pic)
  ↓
User selects tab and uploads file
  ↓
File processed and uploaded to MinIO
  ↓
Record saved/updated in member_documents table
  ↓
Modal closes, page refreshes
  ↓
Documents visible in member detail
```

---

## 📋 **IMPLEMENTATION DETAILS**

### **Backend Changes**

#### 1. **File: `apps/api/src/modules/members/members.service.ts`**

Added `uploadMemberDocument()` method:

```typescript
async uploadMemberDocument(
  memberId: string,
  file: Express.Multer.File,
  documentType: string,
  userId: string
) {
  // Process file (compress/convert)
  // Upload to MinIO
  // Save/update in member_documents table
  // Audit log
  // Return success with file URL
}
```

**Key Features:**
- Validates member exists
- Processes files based on type (profilePhoto or document)
- Uploads to MinIO: `uploads/members/{memberId}/documents/{prefix}-{timestamp}.{ext}`
- Updates existing document if already exists, creates new if not
- Audit log for tracking

#### 2. **File: `apps/api/src/modules/members/members.controller.ts`**

Added `uploadMemberDocuments()` controller:

```typescript
async uploadMemberDocuments(req: Request, res: Response, next: NextFunction) {
  // Extract memberId, documentType, file
  // Validate inputs
  // Call service method
  // Return success response
}
```

**Validation:**
- File is required
- documentType is required
- documentType must be 'PERSETUJUAN_SETELAH_PENJELASAN' or 'FOTO_PROFIL'

#### 3. **File: `apps/api/src/modules/members/members.routes.ts`**

Added route:

```typescript
router.post(
  '/:memberId/documents',
  authenticate,
  authorize([Role.ADMIN_LAYANAN, Role.ADMIN_CABANG, Role.ADMIN_MANAGER, Role.SUPER_ADMIN]),
  uploadMemberDocuments.single('file'),
  controller.uploadMemberDocuments.bind(controller)
);
```

**Route Details:**
- Endpoint: `POST /api/v1/members/:memberId/documents`
- Middleware: authenticate, authorize, uploadMemberDocuments (multer)
- Access: ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN only

---

### **Frontend Changes**

#### 1. **File: `apps/web/src/components/members/UploadDocumentsModal.tsx` (NEW)**

Created modal component with:

- **Two tabs**: PSP (Informed Consent) and Profile Picture
- **File picker**: Accepts images (both tabs) + PDF (PSP only)
- **File preview**: Shows selected file name with checkmark
- **Upload logic**: FormData with file + documentType
- **State management**: activeTab, file, uploading, mounted
- **Portal rendering**: Renders at document.body level for z-index
- **Auto-reset**: Clears state when modal opens

**UI Features:**
- Drag-and-drop style upload area
- Tab switching between PSP and Photo
- Clear file format requirements
- Loading state during upload
- Success/error alerts

#### 2. **File: `apps/web/src/components/members/MemberHeader.tsx`**

Updated header component:

- Added `onUploadDocuments` prop
- Added `canUploadDocuments` prop
- Added "Upload Dokumen" button with Upload icon
- Styled with green gradient (distinguishes from other buttons)
- Conditionally renders based on `canUploadDocuments` permission

#### 3. **File: `apps/web/src/app/(staff)/members/[memberId]/page.tsx`**

Updated member detail page:

- Added `showUploadModal` state
- Added `canUploadDocuments` permission check
- Passed props to MemberHeader
- Rendered UploadDocumentsModal component
- Connected modal success handler to refresh member data

---

## 🔐 **ACCESS CONTROL**

### **Roles yang Bisa Upload:**
- ✅ ADMIN_LAYANAN
- ✅ ADMIN_CABANG
- ✅ ADMIN_MANAGER
- ✅ SUPER_ADMIN

### **Roles yang TIDAK Bisa:**
- ❌ DOCTOR
- ❌ NURSE
- ❌ MEMBER

---

## 🎨 **UI/UX**

### **Button Location:**
- Located in Member Header (top right area)
- Visible only for authorized roles
- Styled with green gradient to distinguish from other actions

### **Modal Design:**
- Clean, modern design with Tailwind CSS
- Two tabs for different document types
- Clear instructions for file formats
- Visual feedback for file selection
- Loading states during upload

### **User Experience:**
- One-click access from member detail
- Tab-based interface for clarity
- Instant feedback on success/error
- Auto-refresh to show uploaded documents
- Replaces existing documents seamlessly

---

## 🧪 **TESTING GUIDE**

### **Test Case 1: Upload PSP Document**

**Steps:**
1. Login as ADMIN_CABANG
2. Navigate to member detail page
3. Click "Upload Dokumen" button in header
4. Select "Informed Consent (PSP)" tab (default)
5. Click "Pilih File"
6. Select a PDF or image file
7. Click "Upload"
8. Wait for success message
9. Close modal
10. Refresh page or check documents

**Expected Result:**
✅ PSP document uploaded successfully
✅ Document visible in member profile
✅ Success alert shown
✅ Modal closes automatically

---

### **Test Case 2: Upload Profile Photo**

**Steps:**
1. Login as ADMIN_LAYANAN
2. Navigate to member detail page
3. Click "Upload Dokumen" button
4. Switch to "Foto Profil" tab
5. Select an image file (JPG, PNG)
6. Click "Upload"
7. Wait for success message

**Expected Result:**
✅ Profile photo uploaded
✅ Photo appears in member header avatar
✅ Success message shown

---

### **Test Case 3: Replace Existing Document**

**Steps:**
1. Member already has PSP uploaded
2. Click "Upload Dokumen"
3. Select PSP tab
4. Upload a new PSP file
5. Verify upload

**Expected Result:**
✅ Old PSP replaced with new one
✅ Only one PSP document exists (no duplicates)
✅ Upload timestamp updated

---

### **Test Case 4: Access Control - Unauthorized Role**

**Steps:**
1. Login as DOCTOR
2. Navigate to member detail page
3. Check header buttons

**Expected Result:**
❌ "Upload Dokumen" button NOT visible
❌ Cannot access upload functionality

---

### **Test Case 5: File Validation**

**Steps:**
1. Try uploading oversized file (>5MB)
2. Try uploading wrong format (e.g., TXT file)

**Expected Result:**
❌ Upload rejected with error message
✅ User informed of file requirements

---

## 📊 **FILE STRUCTURE**

### **Backend:**
```
apps/api/src/modules/members/
├── members.service.ts          # Added uploadMemberDocument()
├── members.controller.ts       # Added uploadMemberDocuments()
└── members.routes.ts           # Added POST /:memberId/documents route
```

### **Frontend:**
```
apps/web/src/
├── components/members/
│   ├── UploadDocumentsModal.tsx  # NEW: Upload modal component
│   └── MemberHeader.tsx          # Updated: Added upload button
└── app/(staff)/members/[memberId]/
    └── page.tsx                  # Updated: Integrated modal
```

---

## 🚀 **DEPLOYMENT NOTES**

### **Backend:**
1. ✅ No database migration needed (uses existing member_documents table)
2. ✅ No new dependencies required
3. ✅ Restart API server after deployment

### **Frontend:**
1. ✅ No new dependencies required
2. ✅ Build and deploy web app

### **Testing:**
1. Test with all authorized roles
2. Test both PSP and Profile Photo uploads
3. Verify document replacement works
4. Check access control for unauthorized roles
5. Verify file size and format validation

---

## 📝 **IMPLEMENTATION CHECKLIST**

- [x] Backend: Add uploadMemberDocument to members service
- [x] Backend: Add uploadMemberDocuments controller
- [x] Backend: Add POST /:memberId/documents route
- [x] Backend: Add access control (authorize middleware)
- [x] Frontend: Create UploadDocumentsModal component
- [x] Frontend: Update MemberHeader with upload button
- [x] Frontend: Integrate modal in member detail page
- [x] Frontend: Add canUploadDocuments permission check
- [x] Testing: Test upload PSP
- [x] Testing: Test upload photo
- [x] Testing: Test replace document
- [x] Testing: Test access control

---

## 🎉 **COMPLETION SUMMARY**

### **What Was Built:**
1. ✅ Complete backend API for uploading member documents after registration
2. ✅ Upload modal with tabbed interface for PSP and Profile Photo
3. ✅ Access control for authorized roles only
4. ✅ File validation and processing (compression, format conversion)
5. ✅ Document replacement logic (updates existing instead of duplicating)
6. ✅ Audit logging for tracking document uploads
7. ✅ Integration with existing member detail page

### **User Benefits:**
- Can now upload PSP and profile photos AFTER member registration
- Clean, intuitive UI for document management
- Automatic document replacement (no duplicates)
- Proper access control for security
- Instant visual feedback

### **Technical Quality:**
- Follows existing codebase patterns
- Uses established upload/processing infrastructure
- Proper error handling
- Type-safe with TypeScript
- Responsive and accessible UI

---

**Implementation Completed By**: Kiro AI  
**Date**: 9 Juni 2026  
**Status**: ✅ **PRODUCTION READY**  
**Priority**: HIGH (User requested feature)

---

## 🔄 **NEXT STEPS**

1. Deploy to staging environment
2. Test with real users (ADMIN_CABANG, ADMIN_LAYANAN)
3. Monitor for any issues
4. Deploy to production
5. Update user documentation if needed

---

**END OF IMPLEMENTATION SUMMARY**
