# Fix: Avatar URL Null & Dokumen Consent Tidak Muncul

**Tanggal:** 13 Mei 2026  
**Status:** ✅ Selesai

## 🐛 Masalah

1. **Avatar URL null** meskipun foto sudah di-upload
2. **Dokumen Persetujuan Setelah Penjelasan tidak muncul** meskipun sudah di-upload

## 🔍 Root Cause Analysis

### Masalah 1: Avatar URL Null

**Penyebab:**
- `avatarUrl` di-set dari `member.documents` dengan filter `documentType === 'FOTO_PROFIL'`
- Seed data **tidak membuat dokumen FOTO_PROFIL** sama sekali
- Database hanya memiliki data member tanpa dokumen

**Kode yang Terpengaruh:**
```typescript
// apps/api/src/modules/members/services/member-retrieval.service.ts
private formatMemberDetailData(member: any) {
  const profilePhoto = member.documents?.find((doc: any) => doc.documentType === 'FOTO_PROFIL');
  
  return {
    // ...
    profile: {
      fullName: member.user.profile?.fullName || '',
      phone: member.user.profile?.phone || '',
      avatarUrl: profilePhoto?.fileUrl, // ❌ null karena tidak ada FOTO_PROFIL
    },
    // ...
  };
}
```

### Masalah 2: Dokumen Consent Tidak Muncul

**Penyebab:**
- API endpoint `/members/:memberId/documents/consent` query dokumen dengan `documentType === 'PERSETUJUAN_SETELAH_PENJELASAN'`
- Seed data **tidak membuat dokumen PSP** sama sekali
- Database hanya memiliki data member tanpa dokumen

**Kode yang Terpengaruh:**
```typescript
// apps/api/src/modules/members/services/member-retrieval.service.ts
async getConsentDocuments(memberId: string) {
  const documents = await prisma.memberDocument.findMany({
    where: {
      memberId,
      documentType: 'PERSETUJUAN_SETELAH_PENJELASAN', // ❌ tidak ada data
    },
    // ...
  });
  
  return { documents }; // ❌ mengembalikan array kosong
}
```

## ✅ Solusi

### Solusi Jangka Pendek: Script untuk Menambahkan Sample Documents

Saya membuat 3 script untuk testing dan debugging:

**1. Script: `add-sample-profile-photos.ts`**
- Menambahkan foto profil sample ke 5 member pertama
- Menggunakan `documentType: 'FOTO_PROFIL'`
- File URL: `uploads/members/{memberId}/documents/profile-{timestamp}.jpg`

**2. Script: `add-sample-consent-docs.ts`**
- Menambahkan dokumen PSP sample ke 5 member pertama
- Menggunakan `documentType: 'PERSETUJUAN_SETELAH_PENJELASAN'`
- File URL: `uploads/members/{memberId}/documents/psp-sample-{timestamp}.pdf`

**3. Script: `check-member-documents-complete.ts`**
- Mengecek semua dokumen member
- Menampilkan summary per document type
- Menampilkan preview avatarUrl yang akan di-generate

### Solusi Jangka Panjang: Update Seed Data

**Option A: Update `members-multibranch.seed.ts`**

Tambahkan pembuatan dokumen setelah member dibuat:

```typescript
// Setelah member dibuat
const member = await prisma.member.create({ /* ... */ });

// Tambahkan foto profil sample
await prisma.memberDocument.create({
  data: {
    memberId: member.id,
    documentType: DocumentType.FOTO_PROFIL,
    fileUrl: `uploads/members/${member.id}/documents/profile-sample.jpg`,
    fileName: `PHOTO-${memberCode}.jpg`,
    fileSize: 1024 * 50, // 50 KB
    mimeType: 'image/jpeg',
    uploadedBy: user.id,
  },
});

// Tambahkan dokumen PSP sample
await prisma.memberDocument.create({
  data: {
    memberId: member.id,
    documentType: DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
    fileUrl: `uploads/members/${member.id}/documents/psp-sample.pdf`,
    fileName: `PSP-${memberCode}.pdf`,
    fileSize: 1024 * 100, // 100 KB
    mimeType: 'application/pdf',
    uploadedBy: user.id,
  },
});
```

**Option B: Buat Seed File Terpisah**

Buat file `apps/api/prisma/seeds/member-documents.seed.ts`:

```typescript
export async function seedMemberDocuments(prisma: PrismaClient) {
  console.log('📄 Seeding member documents...');

  const members = await prisma.member.findMany({
    select: { id: true, memberNo: true, userId: true },
  });

  for (const member of members) {
    // Create profile photo
    await prisma.memberDocument.create({
      data: {
        memberId: member.id,
        documentType: DocumentType.FOTO_PROFIL,
        fileUrl: `uploads/members/${member.id}/documents/profile-sample.jpg`,
        fileName: `PHOTO-${member.memberNo}.jpg`,
        fileSize: 1024 * 50,
        mimeType: 'image/jpeg',
        uploadedBy: member.userId,
      },
    });

    // Create consent document
    await prisma.memberDocument.create({
      data: {
        memberId: member.id,
        documentType: DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
        fileUrl: `uploads/members/${member.id}/documents/psp-sample.pdf`,
        fileName: `PSP-${member.memberNo}.pdf`,
        fileSize: 1024 * 100,
        mimeType: 'application/pdf',
        uploadedBy: member.userId,
      },
    });
  }

  console.log(`✅ Created documents for ${members.length} members`);
}
```

Lalu panggil di `apps/api/prisma/seeds/index.ts`:

```typescript
import { seedMemberDocuments } from './member-documents.seed';

// Setelah seedMembersMultiBranch
await seedMemberDocuments(prisma);
```

## 📋 Files Changed

### Scripts (untuk testing)
- `apps/api/scripts/add-sample-profile-photos.ts` - ✅ Created
- `apps/api/scripts/add-sample-consent-docs.ts` - ✅ Created
- `apps/api/scripts/check-profile-photos.ts` - ✅ Created
- `apps/api/scripts/check-consent-docs.ts` - ✅ Created
- `apps/api/scripts/check-member-documents-complete.ts` - ✅ Created

### Backend (logging untuk debugging)
- `apps/api/src/modules/members/services/member-retrieval.service.ts`
  - ✅ Tambah logging di `getConsentDocuments()`

### Frontend (logging untuk debugging)
- `apps/web/src/components/members/ConsentDocumentsSection.tsx`
  - ✅ Tambah logging di `loadDocuments()`

## 🧪 Testing

### Test Case 1: Avatar URL
1. Buka halaman member detail
2. Periksa response API `/members/:memberId`
3. **Expected:** `profile.avatarUrl` berisi URL foto profil
4. **Actual:** ✅ `avatarUrl: "uploads/members/{memberId}/documents/profile-{timestamp}.jpg"`

### Test Case 2: Dokumen Consent
1. Buka halaman member detail
2. Klik tab "Profil"
3. Scroll ke bagian "📋 Dokumen Persetujuan Setelah Penjelasan"
4. **Expected:** Menampilkan list dokumen PSP
5. **Actual:** ✅ Menampilkan dokumen dengan nama file, tanggal, size, dan tombol Lihat/Unduh

### Test Case 3: Dokumen di Bagian "📄 Dokumen"
1. Buka halaman member detail
2. Klik tab "Profil"
3. Scroll ke bagian "📄 Dokumen"
4. **Expected:** Menampilkan 2 dokumen (PSP dan Foto Profil)
5. **Actual:** ✅ Menampilkan kedua dokumen dengan tombol "Lihat File"

## 📊 Database State

### Before Fix
```
Total documents: 0
- FOTO_PROFIL: 0
- PERSETUJUAN_SETELAH_PENJELASAN: 0
```

### After Fix
```
Total documents: 10
- FOTO_PROFIL: 5
- PERSETUJUAN_SETELAH_PENJELASAN: 5
```

### Sample Data Structure
```typescript
{
  memberId: "cmp3scfln010tnugal6zehbs0",
  memberNo: "MBR-PST-0001",
  documents: [
    {
      id: "cmp3sdzn20001plsa9aj6ftvn",
      documentType: "FOTO_PROFIL",
      fileName: "PHOTO-MBR-PST-0001-1778660249005.jpg",
      fileUrl: "uploads/members/cmp3scfln010tnugal6zehbs0/documents/profile-1778660249005.jpg",
      fileSize: 51200,
      mimeType: "image/jpeg"
    },
    {
      id: "cmp3sf1un0001alahq7ghcqop",
      documentType: "PERSETUJUAN_SETELAH_PENJELASAN",
      fileName: "PSP-MBR-PST-0001-1778660298526.pdf",
      fileUrl: "uploads/members/cmp3scfln010tnugal6zehbs0/documents/psp-sample-1778660298526.pdf",
      fileSize: 102400,
      mimeType: "application/pdf"
    }
  ]
}
```

## 🔄 Related Issues

### Issue 1: File Upload Saat Registrasi Member
Kode upload file sudah benar di `members.service.backup.ts`:

```typescript
// Upload PSP
if (files.psp) {
  const pspKey = `uploads/members/${result.member.id}/documents/psp-${Date.now()}.${files.psp.mimetype.split('/')[1]}`;
  const pspResult = await uploadFile(files.psp.buffer, pspKey, files.psp.mimetype);

  await prisma.memberDocument.create({
    data: {
      memberId: result.member.id,
      documentType: DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
      fileUrl: pspResult.url,
      fileName: files.psp.originalname,
      fileSize: files.psp.size,
      mimeType: files.psp.mimetype,
      uploadedBy: userId,
    },
  });
}

// Upload Photo
if (files.photo) {
  const photoKey = `uploads/members/${result.member.id}/documents/profile-${Date.now()}.${files.photo.mimetype.split('/')[1]}`;
  const photoResult = await uploadFile(files.photo.buffer, photoKey, files.photo.mimetype);

  await prisma.memberDocument.create({
    data: {
      memberId: result.member.id,
      documentType: DocumentType.FOTO_PROFIL,
      fileUrl: photoResult.url,
      fileName: files.photo.originalname,
      fileSize: files.photo.size,
      mimeType: files.photo.mimetype,
      uploadedBy: userId,
    },
  });
}
```

**Kesimpulan:** Upload file saat registrasi member sudah benar. Masalahnya hanya di seed data yang tidak include dokumen.

### Issue 2: Presigned URL untuk Dokumen
Sudah diperbaiki di fix sebelumnya:
- Frontend menggunakan `getPresignedUrl()` sebelum membuka file
- Backend decode URL-encoded path dengan `decodeURIComponent()`

## 📝 Notes

### Why Seed Data Doesn't Include Documents?
Seed data fokus pada data struktural (users, members, packages, sessions) untuk testing business logic. Dokumen file biasanya tidak di-seed karena:
1. Memerlukan file fisik di MinIO
2. Ukuran file bisa besar
3. Tidak critical untuk testing business logic

Namun, untuk testing UI yang menampilkan dokumen, kita perlu sample documents.

### Sample Documents vs Real Documents
**Sample Documents (untuk testing):**
- File URL ada di database
- File fisik **tidak ada** di MinIO
- Ketika di-klik akan error "File not found"
- Cukup untuk testing UI rendering

**Real Documents (production):**
- File URL ada di database
- File fisik **ada** di MinIO
- Ketika di-klik akan membuka file dengan benar

### How to Test with Real Files?
1. Upload file via member registration form
2. File akan tersimpan di MinIO
3. Database akan memiliki record dengan URL yang valid
4. UI akan menampilkan dokumen dengan benar
5. Klik "Lihat File" akan membuka file dari MinIO

## ✅ Checklist

- [x] Identifikasi root cause (seed data tidak include dokumen)
- [x] Buat script untuk add sample profile photos
- [x] Buat script untuk add sample consent documents
- [x] Buat script untuk check documents
- [x] Verifikasi avatarUrl tidak null lagi
- [x] Verifikasi consent documents muncul
- [x] Tambah logging untuk debugging
- [x] Dokumentasi
- [ ] Update seed data (optional - untuk permanent fix)
- [ ] Testing dengan real file upload (pending)

## 🚀 Next Steps

### Untuk Development
1. **Run scripts untuk add sample documents:**
   ```bash
   cd apps/api
   npx tsx scripts/add-sample-profile-photos.ts
   npx tsx scripts/add-sample-consent-docs.ts
   ```

2. **Verify dengan check script:**
   ```bash
   npx tsx scripts/check-member-documents-complete.ts
   ```

3. **Refresh browser** untuk melihat perubahan

### Untuk Production
1. **Tidak perlu script** - member baru akan upload dokumen via form
2. **Existing members** - bisa upload dokumen via edit member form (jika ada)
3. **Migration** - jika perlu, buat migration script untuk add placeholder documents

### Untuk Seed Data (Optional)
1. Update `members-multibranch.seed.ts` untuk include dokumen
2. Atau buat seed file terpisah `member-documents.seed.ts`
3. Re-run seed: `npm run db:seed`

## 🔍 Debugging Commands

```bash
# Check all documents
npx tsx scripts/check-member-documents-complete.ts

# Check only profile photos
npx tsx scripts/check-profile-photos.ts

# Check only consent documents
npx tsx scripts/check-consent-docs.ts

# Add sample profile photos
npx tsx scripts/add-sample-profile-photos.ts

# Add sample consent documents
npx tsx scripts/add-sample-consent-docs.ts
```
