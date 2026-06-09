# API Reference: Upload Member Documents

**Endpoint:** `POST /api/v1/members/:memberId/documents`  
**Purpose:** Upload Informed Consent (PSP) or Profile Photo after member registration  
**Access:** ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN

---

## 📋 **REQUEST**

### **Method:** POST

### **URL:** 
```
/api/v1/members/:memberId/documents
```

### **Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| memberId | string | Yes | UUID of the member |

### **Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

### **Body (Form Data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | The document file (image or PDF) |
| documentType | string | Yes | Must be 'PERSETUJUAN_SETELAH_PENJELASAN' or 'FOTO_PROFIL' |

### **File Requirements:**

#### **For PSP (PERSETUJUAN_SETELAH_PENJELASAN):**
- **Formats:** JPG, PNG, WebP, GIF, BMP, PDF
- **Max Size:** 5MB
- **Processed:** Images are compressed, PDFs pass through

#### **For Profile Photo (FOTO_PROFIL):**
- **Formats:** JPG, PNG, WebP, GIF, BMP
- **Max Size:** 5MB
- **Processed:** Images are compressed and optimized

---

## 📤 **EXAMPLE REQUEST**

### **Using Fetch API:**

```javascript
const uploadDocument = async (memberId, file, documentType) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);

  const response = await fetch(`/api/v1/members/${memberId}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  return response.json();
};

// Usage
const file = document.getElementById('fileInput').files[0];
await uploadDocument('member-uuid', file, 'PERSETUJUAN_SETELAH_PENJELASAN');
```

### **Using Axios:**

```javascript
const uploadDocument = async (memberId, file, documentType) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);

  const response = await axios.post(
    `/api/v1/members/${memberId}/documents`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
};
```

### **Using cURL:**

```bash
# Upload PSP
curl -X POST \
  'http://localhost:3001/api/v1/members/123e4567-e89b-12d3-a456-426614174000/documents' \
  -H 'Authorization: Bearer your-token-here' \
  -F 'file=@/path/to/psp.pdf' \
  -F 'documentType=PERSETUJUAN_SETELAH_PENJELASAN'

# Upload Profile Photo
curl -X POST \
  'http://localhost:3001/api/v1/members/123e4567-e89b-12d3-a456-426614174000/documents' \
  -H 'Authorization: Bearer your-token-here' \
  -F 'file=@/path/to/photo.jpg' \
  -F 'documentType=FOTO_PROFIL'
```

---

## ✅ **SUCCESS RESPONSE**

### **Status Code:** 200 OK

### **Response Body:**

```json
{
  "success": true,
  "data": {
    "message": "Document uploaded successfully",
    "fileUrl": "http://localhost:9000/raho-bucket/uploads/members/123e4567-e89b-12d3-a456-426614174000/documents/psp-1686254400000.jpg"
  },
  "error": null
}
```

### **Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Always true on success |
| data.message | string | Success message |
| data.fileUrl | string | Full URL to the uploaded file in MinIO |
| error | null | Always null on success |

---

## ❌ **ERROR RESPONSES**

### **400 Bad Request - File Required**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "FILE_REQUIRED",
    "message": "File is required"
  }
}
```

---

### **400 Bad Request - Document Type Required**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "DOCUMENT_TYPE_REQUIRED",
    "message": "Document type is required"
  }
}
```

---

### **400 Bad Request - Invalid Document Type**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_DOCUMENT_TYPE",
    "message": "Invalid document type"
  }
}
```

**Valid types:**
- `PERSETUJUAN_SETELAH_PENJELASAN`
- `FOTO_PROFIL`

---

### **400 Bad Request - File Too Large**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "Ukuran file maksimal 5MB."
  }
}
```

---

### **400 Bad Request - Invalid File Type**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "FILE_INVALID_TYPE",
    "message": "Hanya file gambar (JPG, PNG, WebP, GIF, BMP) atau PDF yang diizinkan untuk PSP dan foto profil."
  }
}
```

---

### **401 Unauthorized**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**Cause:** Missing or invalid JWT token

---

### **403 Forbidden**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to access this resource"
  }
}
```

**Cause:** User role is not authorized (DOCTOR, NURSE, MEMBER attempting to upload)

---

### **404 Not Found - Member Not Found**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MEMBER_NOT_FOUND",
    "message": "Member tidak ditemukan"
  }
}
```

**Cause:** Invalid memberId or member doesn't exist

---

### **500 Internal Server Error**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to upload member document: <error details>"
  }
}
```

**Possible Causes:**
- MinIO connection failure
- File processing error
- Database error

---

## 🔒 **AUTHORIZATION**

### **Required Roles:**
- `ADMIN_LAYANAN`
- `ADMIN_CABANG`
- `ADMIN_MANAGER`
- `SUPER_ADMIN`

### **Denied Roles:**
- `DOCTOR`
- `NURSE`
- `MEMBER`

---

## 🗄️ **DATABASE CHANGES**

### **New Record (if document doesn't exist):**

```sql
INSERT INTO MemberDocument (
  id,
  memberId,
  documentType,
  fileUrl,
  fileName,
  fileSize,
  mimeType,
  uploadedBy,
  createdAt,
  updatedAt
) VALUES (
  'uuid',
  'member-uuid',
  'PERSETUJUAN_SETELAH_PENJELASAN',
  'http://minio-url/file.jpg',
  'document.jpg',
  102400,
  'image/jpeg',
  'uploader-user-id',
  NOW(),
  NOW()
);
```

---

### **Update Record (if document exists):**

```sql
UPDATE MemberDocument
SET
  fileUrl = 'http://minio-url/new-file.jpg',
  fileName = 'new-document.jpg',
  fileSize = 98304,
  mimeType = 'image/jpeg',
  uploadedBy = 'uploader-user-id',
  updatedAt = NOW()
WHERE
  memberId = 'member-uuid'
  AND documentType = 'PERSETUJUAN_SETELAH_PENJELASAN';
```

**Note:** Only ONE document per type per member (no duplicates)

---

## 📊 **AUDIT LOG**

Every successful upload creates an audit log entry:

```typescript
{
  userId: 'uploader-user-id',
  branchId: null,
  action: 'UPDATE',
  resource: 'MemberDocument',
  resourceId: 'member-uuid',
  meta: { 
    documentType: 'PERSETUJUAN_SETELAH_PENJELASAN' 
  }
}
```

---

## 🎯 **USE CASES**

### **Use Case 1: Upload PSP After Registration**

**Scenario:** Member registered without PSP, admin uploads it later

```javascript
const file = pspFileInput.files[0];
const result = await uploadDocument(
  memberId, 
  file, 
  'PERSETUJUAN_SETELAH_PENJELASAN'
);
console.log('PSP uploaded:', result.data.fileUrl);
```

---

### **Use Case 2: Upload Profile Photo After Registration**

**Scenario:** Member registered without photo, admin uploads it later

```javascript
const file = photoFileInput.files[0];
const result = await uploadDocument(
  memberId, 
  file, 
  'FOTO_PROFIL'
);
console.log('Photo uploaded:', result.data.fileUrl);
```

---

### **Use Case 3: Replace Existing PSP**

**Scenario:** Member has old PSP, admin uploads new one

```javascript
// Old PSP automatically replaced
const file = newPspFileInput.files[0];
const result = await uploadDocument(
  memberId, 
  file, 
  'PERSETUJUAN_SETELAH_PENJELASAN'
);
console.log('PSP replaced:', result.data.fileUrl);
```

**Result:** Old PSP URL replaced with new one, no duplicates created

---

## 🔄 **WORKFLOW**

```
1. User clicks "Upload Dokumen" button
   ↓
2. Modal opens with tabs (PSP / Photo)
   ↓
3. User selects file
   ↓
4. Frontend validates file (size, format)
   ↓
5. FormData created with file + documentType
   ↓
6. POST request sent to API
   ↓
7. Backend validates:
   - Authentication
   - Authorization (role check)
   - File requirements
   - Member exists
   ↓
8. File processed:
   - Images compressed
   - PDF validated
   ↓
9. File uploaded to MinIO
   ↓
10. Database updated:
    - New record OR
    - Update existing record
   ↓
11. Audit log created
   ↓
12. Success response returned
   ↓
13. Frontend shows success message
   ↓
14. Modal closes
   ↓
15. Page refreshes to show new document
```

---

## 📁 **FILE STORAGE**

### **MinIO Path:**

```
uploads/
└── members/
    └── {memberId}/
        └── documents/
            ├── psp-{timestamp}.{ext}      # PSP documents
            └── profile-{timestamp}.{ext}  # Profile photos
```

### **Example:**

```
uploads/members/123e4567-e89b-12d3-a456-426614174000/documents/psp-1686254400000.jpg
uploads/members/123e4567-e89b-12d3-a456-426614174000/documents/profile-1686254500000.webp
```

---

## 🧪 **TESTING**

### **Postman Collection:**

```json
{
  "name": "Upload Member Document",
  "request": {
    "method": "POST",
    "url": "{{baseUrl}}/api/v1/members/:memberId/documents",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{token}}"
      }
    ],
    "body": {
      "mode": "formdata",
      "formdata": [
        {
          "key": "file",
          "type": "file",
          "src": "/path/to/document.pdf"
        },
        {
          "key": "documentType",
          "value": "PERSETUJUAN_SETELAH_PENJELASAN",
          "type": "text"
        }
      ]
    }
  }
}
```

---

## 📚 **REFERENCES**

- **Upload Middleware:** `apps/api/src/middleware/upload.ts`
- **Service Logic:** `apps/api/src/modules/members/members.service.ts`
- **Controller:** `apps/api/src/modules/members/members.controller.ts`
- **Routes:** `apps/api/src/modules/members/members.routes.ts`
- **MinIO Config:** `apps/api/src/config/minio.ts`
- **Image Processor:** `apps/api/src/utils/imageProcessor.ts`

---

**API Reference Created By**: Kiro AI  
**Date**: 9 Juni 2026  
**Version**: 1.0

---
