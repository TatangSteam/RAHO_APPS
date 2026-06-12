# Fix: Tombol Edit Diagnosis Tidak Muncul

**Date**: June 12, 2026  
**Issue**: Tombol edit tidak muncul di diagnosis card meskipun kode sudah ada

---

## Root Cause Analysis

1. **Kode sudah benar**: Tombol edit sudah ada di `MemberDiagnosesTab.tsx` baris 645-653
2. **Permission sudah benar**: `canEditDiagnosis` sudah didefinisikan di `members/[memberId]/page.tsx` baris 138
3. **Import sudah lengkap**: `Edit` icon sudah diimport dari lucide-react
4. **Build berhasil**: Frontend build tanpa error

## Kemungkinan Penyebab

### 1. Browser Cache
- Browser belum reload perubahan kode terbaru
- **Solusi**: Hard refresh browser (Ctrl+Shift+R atau Cmd+Shift+R)

### 2. Development Server Belum Restart
- Jika menggunakan `npm run dev`, server mungkin perlu restart
- **Solusi**: Stop dev server dan jalankan ulang `npm run dev`

### 3. Build Output Belum Ter-deploy
- Jika menggunakan production build, perlu rebuild dan restart
- **Solusi**: Jalankan `npm run build` dan restart server

---

## Checklist Debugging

Silakan cek hal-hal berikut:

### 1. Verifikasi User Role
```javascript
// Di browser console, cek role user:
console.log('User:', JSON.parse(localStorage.getItem('auth-storage'))?.state?.user);
```

Role yang bisa edit diagnosis:
- ✅ DOCTOR
- ✅ ADMIN_MANAGER  
- ✅ SUPER_ADMIN
- ❌ ADMIN_LAYANAN (read-only)
- ❌ ADMIN_CABANG (read-only)
- ❌ NURSE (read-only)

### 2. Cek Console Browser
Buka Developer Tools (F12) → Console tab, cek apakah ada error:
- Error JavaScript
- Failed to load component
- Permission denied

### 3. Cek Network Tab
Buka Developer Tools (F12) → Network tab:
- Cek apakah file JavaScript ter-load dengan benar
- Cek apakah ada 404 error pada file component

### 4. Verifikasi canEdit Prop
Di browser console, ketik:
```javascript
// Seharusnya return true untuk DOCTOR/ADMIN_MANAGER/SUPER_ADMIN
const canEditDiagnosis = ['DOCTOR', 'ADMIN_MANAGER', 'SUPER_ADMIN'].includes(
  JSON.parse(localStorage.getItem('auth-storage'))?.state?.user?.role
);
console.log('canEditDiagnosis:', canEditDiagnosis);
```

---

## Cara Testing Langkah-demi-Langkah

1. **Stop Development Server** (jika sedang running)
   ```bash
   # Tekan Ctrl+C di terminal yang menjalankan npm run dev
   ```

2. **Clear Browser Cache**
   - Chrome: Ctrl+Shift+Delete → Clear browsing data → Cached images and files
   - Atau gunakan Incognito/Private mode

3. **Rebuild Frontend**
   ```bash
   cd apps/web
   npm run build
   ```

4. **Restart Development Server**
   ```bash
   npm run dev
   ```

5. **Hard Refresh Browser**
   - Windows: Ctrl+Shift+R
   - Mac: Cmd+Shift+R

6. **Login dengan Role yang Benar**
   - Login sebagai DOCTOR, ADMIN_MANAGER, atau SUPER_ADMIN

7. **Buka Halaman Member Detail**
   - Navigate ke: `/members/[memberId]`
   - Klik tab "Diagnosa"

8. **Cek Tombol Edit Muncul**
   - Seharusnya ada tombol biru dengan icon pensil di sebelah kanan diagnosis card
   - Tombol ada di samping badge kategori diagnosis

---

## Kode yang Sudah Diimplementasi

### 1. Import Edit Icon
```typescript
// MemberDiagnosesTab.tsx line 5
import { X, Plus, Trash2, Stethoscope, User, FileText, Info, AlertTriangle, Loader2, ChevronDown, Check, Edit } from 'lucide-react';
```

### 2. Permission Definition
```typescript
// members/[memberId]/page.tsx line 138
const canEditDiagnosis = ['DOCTOR', 'ADMIN_MANAGER', 'SUPER_ADMIN'].includes(user?.role || '');
```

### 3. Edit Button Component
```typescript
// MemberDiagnosesTab.tsx line 645-653
{canEdit && (
  <button
    onClick={() => handleEditDiagnosis(diagnosis)}
    className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 transition-colors"
    title="Edit Diagnosa"
  >
    <Edit size={14} />
  </button>
)}
```

### 4. Props Passing
```typescript
// members/[memberId]/page.tsx line 652
<MemberDiagnosesTab 
  memberId={memberId} 
  memberBranchId={member.registrationBranch?.id} 
  canEdit={canEditDiagnosis} 
/>
```

---

## Visual Reference

Tombol edit seharusnya muncul seperti ini:

```
┌──────────────────────────────────────────────────────────┐
│ DX-SBY-2086-00001           [HIPERTENSI] [✏️ Edit]       │
│ 13/06/2026 18:26:05                                       │
│                                                            │
│ Dokter Pemeriksa: dr. Citra Wijaya, SpPD                 │
│ Diagnosa: test                                            │
└──────────────────────────────────────────────────────────┘
```

Icon pensil (✏️) = Edit button

---

## Jika Masih Tidak Muncul

Jika setelah mengikuti semua langkah di atas tombol masih tidak muncul:

1. **Screenshot halaman diagnosis** dan kirimkan
2. **Buka browser console** (F12) dan screenshot jika ada error
3. **Cek role user** dengan command di browser console:
   ```javascript
   JSON.parse(localStorage.getItem('auth-storage'))?.state?.user
   ```
4. **Screenshot hasil query di atas** dan kirimkan

---

## File yang Terlibat

1. `apps/web/src/components/members/MemberDiagnosesTab.tsx` - Component dengan tombol edit
2. `apps/web/src/app/(staff)/members/[memberId]/page.tsx` - Parent page yang pass permission
3. `apps/web/src/lib/diagnosisApi.ts` - API client untuk update diagnosis
4. `apps/api/src/modules/members/members.controller.ts` - Backend controller
5. `apps/api/src/modules/members/services/member-medical-records.service.ts` - Backend service

---

**Build Status**: ✅ SUCCESS  
**Code Status**: ✅ IMPLEMENTED  
**Next Action**: Clear cache & hard refresh browser
