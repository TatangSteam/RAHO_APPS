# Upload Member Documents After Registration

**Tanggal**: 8 Juni 2026  
**Status**: 📋 IMPLEMENTATION GUIDE  
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

## ✅ **SOLUTION OVERVIEW**

### **Feature:**
1. **Upload Button** di Member Detail Page
2. **Upload Modal** dengan 2 tabs:
   - Tab 1: Upload PSP (Informed Consent)
   - Tab 2: Upload Profile Picture
3. **API Endpoint** untuk upload documents
4. **Access Control**: ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN

### **Flow:**
```
Member Detail Page
  ↓
[Upload Documents] Button
  ↓
Modal Opens with Tabs
  ↓
User selects tab (PSP or Profile Pic)
  ↓
User uploads file
  ↓
File uploaded to MinIO
  ↓
Record saved to member_documents table
  ↓
Modal closes, page refreshes
  ↓
Documents visible in member detail
```

---

## 📋 **IMPLEMENTATION STEPS**

### **STEP 1: Backend - Upload Documents API**

#### File: `apps/api/src/modules/members/members.controller.ts`

Add controller method:

```typescript
/**
 * Upload member documents (PSP or Profile Photo)
 * POST /api/v1/members/:memberId/documents
 */
async uploadMemberDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId } = req.params;
    const { documentType } = req.body;
    const userId = req.user!.userId;
    const file = req.file;

    if (!file) {
      return sendError(res, 400, 'FILE_REQUIRED', 'File is required');
    }

    if (!documentType) {
      return sendError(res, 400, 'DOCUMENT_TYPE_REQUIRED', 'Document type is required');
    }

    // Validate document type
    const validTypes = ['PERSETUJUAN_SETELAH_PENJELASAN', 'FOTO_PROFIL'];
    if (!validTypes.includes(documentType)) {
      return sendError(res, 400, 'INVALID_DOCUMENT_TYPE', 'Invalid document type');
    }

    // Check member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      return sendError(res, 404, 'MEMBER_NOT_FOUND', 'Member not found');
    }

    const result = await this.membersService.uploadMemberDocument(
      memberId,
      file,
      documentType,
      userId
    );

    return sendSuccess(res, result);
  } catch (err: any) {
    next(err);
  }
}
```

---

#### File: `apps/api/src/modules/members/members.service.ts`

Add service method:

```typescript
/**
 * Upload member document
 */
async uploadMemberDocument(
  memberId: string,
  file: Express.Multer.File,
  documentType: string,
  userId: string
) {
  const { uploadFile } = await import('../../../config/minio');
  const { processFile } = await import('../../../utils/imageProcessor');
  const { DocumentType } = await import('@prisma/client');

  try {
    // Process file based on type
    const processType = documentType === 'FOTO_PROFIL' ? 'profilePhoto' : 'document';
    const processed = await processFile(file.buffer, file.mimetype, processType);
    
    const fileExt = processed.mimeType === 'image/jpeg' ? 'jpg' : 
                    processed.mimeType === 'image/webp' ? 'webp' :
                    processed.mimeType === 'application/pdf' ? 'pdf' :
                    file.mimetype.split('/')[1];
    
    const prefix = documentType === 'FOTO_PROFIL' ? 'profile' : 'psp';
    const fileKey = `uploads/members/${memberId}/documents/${prefix}-${Date.now()}.${fileExt}`;
    
    const uploadResult = await uploadFile(processed.buffer, fileKey, processed.mimeType);

    // Check if document already exists (for replacement)
    const existingDoc = await prisma.memberDocument.findFirst({
      where: {
        memberId,
        documentType: documentType as any,
      },
    });

    if (existingDoc) {
      // Update existing document
      await prisma.memberDocument.update({
        where: { id: existingDoc.id },
        data: {
          fileUrl: uploadResult.url,
          fileName: file.originalname,
          fileSize: processed.buffer.length,
          mimeType: processed.mimeType,
          uploadedBy: userId,
        },
      });
    } else {
      // Create new document
      await prisma.memberDocument.create({
        data: {
          memberId,
          documentType: documentType as any,
          fileUrl: uploadResult.url,
          fileName: file.originalname,
          fileSize: processed.buffer.length,
          mimeType: processed.mimeType,
          uploadedBy: userId,
        },
      });
    }

    // Audit log
    await logAudit({
      userId,
      branchId: req.user?.branchId,
      action: 'UPDATE',
      resource: 'MemberDocument',
      resourceId: memberId,
      meta: { documentType },
    });

    return {
      message: 'Document uploaded successfully',
      fileUrl: uploadResult.url,
    };
  } catch (error) {
    console.error('Failed to upload member document:', error);
    throw error;
  }
}
```

---

#### File: `apps/api/src/modules/members/members.routes.ts`

Add route:

```typescript
import { upload } from '../../middleware/upload';

// Upload member documents (PSP or Profile Photo)
// Accessible by ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN
router.post(
  '/:memberId/documents',
  authenticate,
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  upload.single('file'),
  controller.uploadMemberDocuments.bind(controller)
);
```

---

### **STEP 2: Frontend - Upload Documents Modal**

#### File: `apps/web/src/components/members/UploadDocumentsModal.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, Image, Check } from 'lucide-react';
import { api } from '@/lib/api';

interface UploadDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  onSuccess: () => void;
}

export default function UploadDocumentsModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  onSuccess,
}: UploadDocumentsModalProps) {
  const [activeTab, setActiveTab] = useState<'psp' | 'photo'>('psp');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mounted, setMounted] = useState(false);

  useState(() => {
    setMounted(true);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', 
        activeTab === 'psp' ? 'PERSETUJUAN_SETELAH_PENJELASAN' : 'FOTO_PROFIL'
      );

      await api.post(`/members/${memberId}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      alert(`${activeTab === 'psp' ? 'PSP' : 'Foto Profil'} berhasil diupload!`);
      setFile(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Upload error:', err);
      alert(err.response?.data?.message || 'Gagal upload file');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Upload Dokumen Member
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {memberName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('psp')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                activeTab === 'psp'
                  ? 'text-amber-600 border-b-2 border-amber-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="h-5 w-5 inline-block mr-2" />
              Informed Consent (PSP)
            </button>
            <button
              onClick={() => setActiveTab('photo')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                activeTab === 'photo'
                  ? 'text-amber-600 border-b-2 border-amber-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Image className="h-5 w-5 inline-block mr-2" />
              Foto Profil
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              
              <input
                type="file"
                accept={activeTab === 'psp' ? 'image/*,application/pdf' : 'image/*'}
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              
              <label
                htmlFor="file-upload"
                className="inline-block px-4 py-2 bg-amber-500 text-white rounded-lg cursor-pointer hover:bg-amber-600 transition-colors"
              >
                Pilih File
              </label>
              
              <p className="text-sm text-gray-500 mt-4">
                {activeTab === 'psp' 
                  ? 'Format: JPG, PNG, PDF (Maks 10MB)'
                  : 'Format: JPG, PNG (Maks 5MB)'}
              </p>
              
              {file && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <Check className="h-5 w-5 inline-block text-green-600 mr-2" />
                  <span className="text-sm text-green-700">{file.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={uploading}
            >
              Batal
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
```

---

### **STEP 3: Frontend - Add Upload Button to Member Detail**

#### File: `apps/web/src/app/(staff)/members/[memberId]/page.tsx`

Add button and modal:

```typescript
import UploadDocumentsModal from '@/components/members/UploadDocumentsModal';

export default function MemberDetailPage() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // ... existing code ...

  return (
    <div>
      {/* Add Upload Button */}
      {(user?.role === 'ADMIN_LAYANAN' || 
        user?.role === 'ADMIN_CABANG' || 
        user?.role === 'ADMIN_MANAGER' || 
        user?.role === 'SUPER_ADMIN') && (
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
        >
          📤 Upload Dokumen
        </button>
      )}

      {/* Upload Modal */}
      <UploadDocumentsModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        memberId={memberId}
        memberName={member?.fullName || ''}
        onSuccess={() => {
          // Refresh member data
          loadMember();
        }}
      />
    </div>
  );
}
```

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

## 📊 **UI/UX MOCKUP**

### **Member Detail Page:**
```
┌─────────────────────────────────────────────────────────┐
│ 📋 Member Detail - John Doe (MBR-SBY-0001)            │
│                                                         │
│ [Edit Member] [📤 Upload Dokumen] [Delete]           │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Profile                                             ││
│ │ - Nama: John Doe                                    ││
│ │ - Email: john@example.com                           ││
│ │ - Phone: 08123456789                                ││
│ │                                                      ││
│ │ Documents:                                           ││
│ │ ✅ PSP: Uploaded 5 Jun 2026                         ││
│ │ ✅ Photo: Uploaded 5 Jun 2026                       ││
│ └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### **Upload Modal:**
```
┌─────────────────────────────────────────────────────────┐
│ 📤 Upload Dokumen Member                                │
│ John Doe                                           [X]  │
├─────────────────────────────────────────────────────────┤
│ [📄 Informed Consent (PSP)] | [📷 Foto Profil]         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────┐  │
│ │                     📤                           │  │
│ │                                                   │  │
│ │              [Pilih File]                         │  │
│ │                                                   │  │
│ │   Format: JPG, PNG, PDF (Maks 10MB)             │  │
│ │                                                   │  │
│ │   ✅ document.pdf                                 │  │
│ └─────────────────────────────────────────────────┘  │
│                                                         │
│                              [Batal] [Upload]          │
└─────────────────────────────────────────────────────────┘
```

---

## 🧪 **TESTING GUIDE**

### **Test Case 1: Upload PSP**
```
1. Login sebagai ADMIN_CABANG
2. Go to member detail page
3. Click "📤 Upload Dokumen"
4. Select "Informed Consent (PSP)" tab
5. Click "Pilih File"
6. Select PDF file
7. Click "Upload"
8. Expected: ✅ PSP uploaded, success message shown
```

### **Test Case 2: Upload Profile Photo**
```
1. Login sebagai ADMIN_LAYANAN
2. Go to member detail page
3. Click "📤 Upload Dokumen"
4. Select "Foto Profil" tab
5. Click "Pilih File"
6. Select JPG file
7. Click "Upload"
8. Expected: ✅ Photo uploaded, visible in member detail
```

### **Test Case 3: Replace Existing Document**
```
1. Member already has PSP
2. Upload new PSP
3. Expected: ✅ Old PSP replaced with new one
```

### **Test Case 4: Access Control**
```
1. Login as DOCTOR
2. Go to member detail page
3. Expected: ❌ "Upload Dokumen" button NOT visible
```

---

## 📝 **IMPLEMENTATION CHECKLIST**

- [ ] Backend: Add uploadMemberDocument to members service
- [ ] Backend: Add uploadMemberDocuments controller
- [ ] Backend: Add POST /:memberId/documents route
- [ ] Frontend: Create UploadDocumentsModal component
- [ ] Frontend: Add button to member detail page
- [ ] Frontend: Add API method to membersApi
- [ ] Test upload PSP
- [ ] Test upload photo
- [ ] Test replace document
- [ ] Test access control

---

## 🚀 **ESTIMATED EFFORT**

- Backend API: 2 hours
- Frontend Modal: 3 hours
- Integration & Testing: 2 hours
- **Total: 7 hours**

---

**Guide Created By**: Kiro AI  
**Date**: 8 Juni 2026  
**Status**: Ready for Implementation  
**Priority**: HIGH (User requested)
