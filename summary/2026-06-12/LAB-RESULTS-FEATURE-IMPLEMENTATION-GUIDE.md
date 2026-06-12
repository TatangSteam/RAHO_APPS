# Lab Results Upload Feature - Implementation Guide

**Date**: June 12, 2026  
**Feature**: Tab baru "Hasil Lab" di member detail untuk upload PDF dan gambar hasil laboratorium

---

## 🎯 Overview

Fitur ini menambahkan:
1. Tab baru "Hasil Lab" di halaman member detail
2. Upload file hasil lab (PDF, JPG, PNG)
3. Keterangan untuk setiap file
4. List file yang sudah diupload
5. Download/view file
6. Delete file (dengan permission)

---

## 📊 Database Schema Changes

### 1. Tambah Tabel `LabResult`

```prisma
model LabResult {
  id          String   @id @default(cuid())
  memberId    String
  member      Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  
  fileName    String   // Original filename
  fileUrl     String   // MinIO URL
  fileType    String   // MIME type: application/pdf, image/jpeg, image/png
  fileSize    Int      // File size in bytes
  
  description String?  @db.Text // Keterangan hasil lab
  labDate     DateTime? // Tanggal hasil lab (optional)
  
  uploadedBy  String   // User ID yang upload
  uploadedByUser User  @relation(fields: [uploadedBy], references: [id])
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([memberId])
  @@index([uploadedBy])
  @@map("lab_results")
}
```

### 2. Update Model `Member`

```prisma
model Member {
  // ... existing fields ...
  labResults  LabResult[]
}
```

### 3. Update Model `User`

```prisma
model User {
  // ... existing fields ...
  uploadedLabResults LabResult[]
}
```

---

## 🔧 Migration Steps (TANPA RESET DATABASE)

### Step 1: Buat Migration File

```bash
cd apps/api
npx prisma migrate dev --name add_lab_results_table --create-only
```

Ini akan membuat file migration baru di `apps/api/prisma/migrations/` dengan nama seperti:
```
20260612_add_lab_results_table/migration.sql
```

### Step 2: Edit Migration File (jika perlu)

File migration yang dihasilkan akan seperti ini:

```sql
-- CreateTable
CREATE TABLE "lab_results" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "description" TEXT,
    "labDate" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lab_results_memberId_idx" ON "lab_results"("memberId");

-- CreateIndex
CREATE INDEX "lab_results_uploadedBy_idx" ON "lab_results"("uploadedBy");

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

### Step 3: Apply Migration

```bash
npx prisma migrate deploy
```

Atau untuk development:

```bash
npx prisma migrate dev
```

### Step 4: Generate Prisma Client

```bash
npx prisma generate
```

### Step 5: Verify Migration

```bash
npx prisma studio
```

Buka Prisma Studio dan cek apakah tabel `lab_results` sudah ada.

---

## 🎨 Frontend Implementation

### 1. Create Lab Results Tab Component

**File**: `apps/web/src/components/members/MemberLabResultsTab.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { FileText, Upload, Download, Trash2, Calendar, User, Loader2, AlertCircle } from 'lucide-react';
import { labResultsApi } from '@/lib/labResultsApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

interface LabResult {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  description: string | null;
  labDate: string | null;
  uploadedBy: string;
  uploadedByUser: {
    profile: {
      fullName: string;
    };
  };
  createdAt: string;
}

interface MemberLabResultsTabProps {
  memberId: string;
}

export default function MemberLabResultsTab({ memberId }: MemberLabResultsTabProps) {
  const { user } = useAuthStore();
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [labDate, setLabDate] = useState('');

  // Check if current user can upload/delete lab results
  const canUpload = user?.role && ['DOCTOR', 'ADMIN_MANAGER', 'ADMIN_LAYANAN', 'SUPER_ADMIN'].includes(user.role);
  const canDelete = user?.role && ['ADMIN_MANAGER', 'SUPER_ADMIN'].includes(user.role);

  useEffect(() => {
    loadLabResults();
  }, [memberId]);

  const loadLabResults = async () => {
    try {
      setLoading(true);
      const data = await labResultsApi.getMemberLabResults(memberId);
      setLabResults(data);
    } catch (error) {
      console.error('Failed to load lab results:', error);
      showToast.error('Gagal memuat hasil lab');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(selectedFile.type)) {
      showToast.error('Format file harus PDF, JPG, atau PNG');
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      showToast.error('Ukuran file maksimal 10MB');
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      showToast.error('Pilih file terlebih dahulu');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', description);
      if (labDate) {
        formData.append('labDate', labDate);
      }

      await labResultsApi.uploadLabResult(memberId, formData);
      showToast.success('Hasil lab berhasil diupload');
      setShowUploadModal(false);
      resetForm();
      loadLabResults();
    } catch (error: any) {
      console.error('Upload failed:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (labResultId: string) => {
    if (!confirm('Yakin ingin menghapus hasil lab ini?')) return;

    try {
      await labResultsApi.deleteLabResult(memberId, labResultId);
      showToast.success('Hasil lab berhasil dihapus');
      loadLabResults();
    } catch (error: any) {
      console.error('Delete failed:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menghapus file');
    }
  };

  const resetForm = () => {
    setFile(null);
    setDescription('');
    setLabDate('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === 'application/pdf') return '📄';
    if (fileType.startsWith('image/')) return '🖼️';
    return '📁';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-3" />
        <p className="text-neutral-500 dark:text-neutral-400">Memuat hasil lab...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-500" />
          Hasil Lab
        </h3>
        {canUpload && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30 transition-all"
          >
            <Upload className="h-4 w-4" />
            Upload Hasil Lab
          </button>
        )}
      </div>

      {labResults.length === 0 ? (
        <div className="text-center py-12 px-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-500/20 mx-auto mb-4">
            <FileText className="h-8 w-8 text-amber-500" />
          </div>
          <p className="text-base font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Belum ada hasil lab
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Upload file hasil laboratorium member di sini
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {labResults.map((result) => (
            <div
              key={result.id}
              className="p-4 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-2xl">{getFileIcon(result.fileType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-neutral-900 dark:text-white truncate">
                      {result.fileName}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatFileSize(result.fileSize)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <a
                    href={result.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 transition-colors"
                    title="Download/View"
                  >
                    <Download size={14} />
                  </a>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(result.id)}
                      className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {result.description && (
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                  {result.description}
                </p>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                {result.labDate && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(result.labDate).toLocaleDateString('id-ID')}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User size={12} />
                  {result.uploadedByUser.profile.fullName}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">
              Upload Hasil Lab
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  File (PDF, JPG, PNG - Max 10MB)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg"
                />
                {file && (
                  <p className="text-sm text-green-600 mt-1">
                    ✓ {file.name} ({formatFileSize(file.size)})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Tanggal Lab (Opsional)
                </label>
                <input
                  type="date"
                  value={labDate}
                  onChange={(e) => setLabDate(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Keterangan
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg resize-none"
                  rows={3}
                  placeholder="Contoh: Hasil lab darah lengkap, kolesterol tinggi"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetForm();
                }}
                disabled={uploading}
                className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !file}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 2. Create API Client

**File**: `apps/web/src/lib/labResultsApi.ts`

```typescript
import { api } from './api';

export const labResultsApi = {
  getMemberLabResults: async (memberId: string) => {
    const { data } = await api.get(`/members/${memberId}/lab-results`);
    return data.data;
  },

  uploadLabResult: async (memberId: string, formData: FormData) => {
    const { data } = await api.post(`/members/${memberId}/lab-results`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data.data;
  },

  deleteLabResult: async (memberId: string, labResultId: string) => {
    const { data } = await api.delete(`/members/${memberId}/lab-results/${labResultId}`);
    return data.data;
  },
};
```

### 3. Update Member Detail Page

**File**: `apps/web/src/app/(staff)/members/[memberId]/page.tsx`

Tambahkan import:
```typescript
import MemberLabResultsTab from '@/components/members/MemberLabResultsTab';
```

Tambahkan tab baru di activeTab state:
```typescript
const [activeTab, setActiveTab] = useState<'profil' | 'paket' | 'sesi' | 'diagnosa' | 'therapy-plan' | 'lab-results'>('profil');
```

Tambahkan tab button:
```typescript
<button
  onClick={() => setActiveTab('lab-results')}
  className={`tab-button ${activeTab === 'lab-results' ? 'active' : ''}`}
>
  <FileText className="h-4 w-4" />
  Hasil Lab
</button>
```

Tambahkan tab content:
```typescript
{activeTab === 'lab-results' && <MemberLabResultsTab memberId={memberId} />}
```

---

## 🔌 Backend Implementation

### 1. Create Lab Results Controller

**File**: `apps/api/src/modules/members/services/member-lab-results.service.ts`

```typescript
import { prisma } from '../../../lib/prisma';
import { uploadFileToMinio, deleteFileFromMinio } from '../../../config/minio';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction } from '@prisma/client';

export class MemberLabResultsService {
  async getMemberLabResults(memberId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    const labResults = await prisma.labResult.findMany({
      where: { memberId },
      include: {
        uploadedByUser: {
          select: {
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return labResults;
  }

  async uploadLabResult(memberId: string, file: Express.Multer.File, data: any, userId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Upload file to MinIO
    const fileUrl = await uploadFileToMinio(file, 'lab-results');

    // Create lab result record
    const labResult = await prisma.labResult.create({
      data: {
        memberId,
        fileName: file.originalname,
        fileUrl,
        fileType: file.mimetype,
        fileSize: file.size,
        description: data.description || null,
        labDate: data.labDate ? new Date(data.labDate) : null,
        uploadedBy: userId,
      },
      include: {
        uploadedByUser: {
          select: {
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    // Log audit
    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'LabResult',
      resourceId: labResult.id,
      meta: { memberId, fileName: file.originalname },
    });

    return labResult;
  }

  async deleteLabResult(memberId: string, labResultId: string, userId: string) {
    const labResult = await prisma.labResult.findFirst({
      where: {
        id: labResultId,
        memberId,
      },
    });

    if (!labResult) {
      throw { status: 404, code: 'LAB_RESULT_NOT_FOUND', message: 'Hasil lab tidak ditemukan' };
    }

    // Delete file from MinIO
    try {
      await deleteFileFromMinio(labResult.fileUrl);
    } catch (error) {
      console.error('Failed to delete file from MinIO:', error);
      // Continue with database deletion even if MinIO deletion fails
    }

    // Delete lab result record
    await prisma.labResult.delete({
      where: { id: labResultId },
    });

    // Log audit
    await logAudit({
      userId,
      action: AuditAction.DELETE,
      resource: 'LabResult',
      resourceId: labResultId,
      meta: { memberId, fileName: labResult.fileName },
    });

    return { message: 'Hasil lab berhasil dihapus' };
  }
}
```

### 2. Add Routes to Members Controller

**File**: `apps/api/src/modules/members/members.controller.ts`

```typescript
import { MemberLabResultsService } from './services/member-lab-results.service';

const labResultsService = new MemberLabResultsService();

// Add these methods to MembersController class:

async getMemberLabResults(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId } = req.params;
    const result = await labResultsService.getMemberLabResults(memberId);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

async uploadLabResult(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId } = req.params;
    const { userId } = req.user!;
    const file = req.file;

    if (!file) {
      throw { status: 400, code: 'FILE_REQUIRED', message: 'File wajib diupload' };
    }

    const result = await labResultsService.uploadLabResult(
      memberId,
      file,
      req.body,
      userId
    );

    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

async deleteLabResult(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId, labResultId } = req.params;
    const { userId } = req.user!;

    const result = await labResultsService.deleteLabResult(memberId, labResultId, userId);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
```

### 3. Add Routes

**File**: `apps/api/src/modules/members/members.routes.ts`

```typescript
import { upload } from '../../middleware/upload';

// Add these routes:
router.get('/:memberId/lab-results', membersController.getMemberLabResults.bind(membersController));
router.post('/:memberId/lab-results', upload.single('file'), membersController.uploadLabResult.bind(membersController));
router.delete('/:memberId/lab-results/:labResultId', membersController.deleteLabResult.bind(membersController));
```

---

## ✅ Testing Checklist

- [ ] Migration berhasil tanpa error
- [ ] Tabel `lab_results` terbentuk di database
- [ ] Tab "Hasil Lab" muncul di member detail
- [ ] Upload PDF berhasil
- [ ] Upload JPG/PNG berhasil
- [ ] File size validation bekerja (max 10MB)
- [ ] File type validation bekerja (hanya PDF, JPG, PNG)
- [ ] Keterangan tersimpan dengan benar
- [ ] Tanggal lab tersimpan dengan benar
- [ ] File bisa didownload/view
- [ ] File bisa dihapus (dengan permission)
- [ ] Permission check bekerja dengan benar
- [ ] Audit log tercatat

---

## 🔐 Permissions

- **Upload**: DOCTOR, ADMIN_MANAGER, ADMIN_LAYANAN, SUPER_ADMIN
- **View**: Semua role
- **Delete**: ADMIN_MANAGER, SUPER_ADMIN

---

## 📝 Notes

1. File disimpan di MinIO bucket `lab-results`
2. File maksimal 10MB
3. Format yang diizinkan: PDF, JPG, PNG
4. Setiap upload tercatat di audit log
5. Delete file akan menghapus dari MinIO dan database
6. Soft delete tidak digunakan untuk menghemat storage

---

Setelah membaca panduan ini, lanjutkan dengan implementasi step-by-step!
