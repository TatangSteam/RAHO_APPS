# Update: Dynamic Button Text - Upload/Ganti Dokumen

**Tanggal**: 9 Juni 2026  
**Status**: ✅ **IMPLEMENTED**  
**Feature**: Button text berubah otomatis dari "Upload Dokumen" ke "Ganti Dokumen"

---

## 🎯 **REQUIREMENT**

### **User Request:**
"kalo sudah di upload tolong ubah tombol dari upload dokumen menjadi ganti dokumen"

### **Business Logic:**
- Jika member **belum punya** dokumen (PSP atau Foto) → Button: **"Upload Dokumen"**
- Jika member **sudah punya** dokumen (PSP atau Foto) → Button: **"Ganti Dokumen"**
- Modal title juga menyesuaikan: "Upload Dokumen Member" atau "Ganti Dokumen Member"

---

## ✅ **SOLUTION IMPLEMENTED**

### **1. MemberHeader Component**

**File:** `apps/web/src/components/members/MemberHeader.tsx`

**Changes:**
- Added `hasDocuments` prop (boolean)
- Button text: `{hasDocuments ? 'Ganti Dokumen' : 'Upload Dokumen'}`

```typescript
interface MemberHeaderProps {
  // ... existing props
  hasDocuments?: boolean;
}

// Button text
{hasDocuments ? 'Ganti Dokumen' : 'Upload Dokumen'}
```

---

### **2. UploadDocumentsModal Component**

**File:** `apps/web/src/components/members/UploadDocumentsModal.tsx`

**Changes:**
- Added `hasDocuments` prop (boolean)
- Modal title: `{hasDocuments ? 'Ganti Dokumen Member' : 'Upload Dokumen Member'}`

```typescript
interface UploadDocumentsModalProps {
  // ... existing props
  hasDocuments?: boolean;
}

// Modal title
{hasDocuments ? 'Ganti Dokumen Member' : 'Upload Dokumen Member'}
```

---

### **3. Member Detail Page**

**File:** `apps/web/src/app/(staff)/members/[memberId]/page.tsx`

**Changes:**
- Calculate `hasDocuments` based on member data
- Pass `hasDocuments` to both MemberHeader and UploadDocumentsModal

```typescript
// Check if member has any documents (PSP or Profile Photo)
const hasDocuments = member ? (
  member.documents?.some(doc => 
    doc.documentType === 'PERSETUJUAN_SETELAH_PENJELASAN' || 
    doc.documentType === 'FOTO_PROFIL'
  ) || false
) : false;

// Pass to components
<MemberHeader hasDocuments={hasDocuments} />
<UploadDocumentsModal hasDocuments={hasDocuments} />
```

---

## 🎨 **USER EXPERIENCE**

### **Scenario 1: Member Belum Punya Dokumen**

**Button di Header:**
```
[Upload Dokumen]
```

**Modal Title:**
```
Upload Dokumen Member
```

**User Flow:**
1. Admin klik "Upload Dokumen"
2. Modal terbuka dengan title "Upload Dokumen Member"
3. Admin upload PSP atau Foto
4. Setelah sukses, button berubah jadi "Ganti Dokumen"

---

### **Scenario 2: Member Sudah Punya Dokumen**

**Button di Header:**
```
[Ganti Dokumen]
```

**Modal Title:**
```
Ganti Dokumen Member
```

**User Flow:**
1. Admin klik "Ganti Dokumen"
2. Modal terbuka dengan title "Ganti Dokumen Member"
3. Admin upload dokumen baru
4. Dokumen lama otomatis ter-replace

---

## 🔍 **LOGIC DETECTION**

### **hasDocuments Calculation:**

```typescript
const hasDocuments = member.documents?.some(doc => 
  doc.documentType === 'PERSETUJUAN_SETELAH_PENJELASAN' || 
  doc.documentType === 'FOTO_PROFIL'
) || false;
```

**Returns `true` if:**
- Member punya minimal 1 dokumen PSP **ATAU**
- Member punya minimal 1 dokumen Foto Profil

**Returns `false` if:**
- Member tidak punya dokumen sama sekali
- Array documents kosong atau undefined

---

## 📊 **FILES CHANGED**

```
apps/web/src/
├── components/members/
│   ├── MemberHeader.tsx              # Added hasDocuments prop
│   └── UploadDocumentsModal.tsx      # Added hasDocuments prop, dynamic title
└── app/(staff)/members/[memberId]/
    └── page.tsx                      # Calculate hasDocuments, pass to components
```

---

## 🧪 **TESTING SCENARIOS**

### **Test 1: Member Tanpa Dokumen**

**Steps:**
1. Buka member yang baru dibuat (belum ada PSP/Foto)
2. Check button text di header

**Expected:**
- ✅ Button text: "Upload Dokumen"
- ✅ Klik button → Modal title: "Upload Dokumen Member"

---

### **Test 2: Member Dengan PSP Saja**

**Steps:**
1. Member sudah upload PSP, belum ada Foto
2. Check button text

**Expected:**
- ✅ Button text: "Ganti Dokumen"
- ✅ Modal title: "Ganti Dokumen Member"

---

### **Test 3: Member Dengan Foto Saja**

**Steps:**
1. Member sudah upload Foto, belum ada PSP
2. Check button text

**Expected:**
- ✅ Button text: "Ganti Dokumen"
- ✅ Modal title: "Ganti Dokumen Member"

---

### **Test 4: Member Dengan PSP & Foto**

**Steps:**
1. Member sudah upload PSP dan Foto
2. Check button text

**Expected:**
- ✅ Button text: "Ganti Dokumen"
- ✅ Modal title: "Ganti Dokumen Member"

---

### **Test 5: Upload Pertama → Button Berubah**

**Steps:**
1. Member belum ada dokumen (button: "Upload Dokumen")
2. Upload PSP
3. Success → page refresh
4. Check button text

**Expected:**
- ✅ Button berubah jadi "Ganti Dokumen"
- ✅ Klik lagi → Modal title berubah jadi "Ganti Dokumen Member"

---

## 🎉 **BENEFITS**

1. **Clarity**: User langsung tau apakah ini upload pertama atau ganti dokumen
2. **Better UX**: Text yang lebih deskriptif sesuai kondisi
3. **Consistent**: Modal title juga menyesuaikan
4. **Smart**: Otomatis detect berdasarkan data member
5. **No Breaking Changes**: Backward compatible, default value = false

---

## 📝 **IMPLEMENTATION NOTES**

- **Type Safety**: All props typed with TypeScript
- **Default Values**: `hasDocuments` default = `false` (safe fallback)
- **Reactive**: Button text auto-update setelah upload success (karena page refresh)
- **Performance**: Minimal computation (simple `some()` check)
- **Theme Aware**: Button dan modal tetap mengikuti dark/light theme

---

## 🚀 **DEPLOYMENT**

### **No Breaking Changes:**
- Existing code tetap berfungsi
- Props optional dengan default values
- No database changes
- No API changes

### **Deploy Steps:**
1. Build frontend
2. Deploy
3. Test dengan member yang sudah punya dokumen dan yang belum

---

**Implementation Completed By**: Kiro AI  
**Date**: 9 Juni 2026  
**Status**: ✅ **PRODUCTION READY**

---
