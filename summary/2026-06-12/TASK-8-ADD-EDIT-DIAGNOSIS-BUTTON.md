# Task 8: Add Edit Button for Diagnosis

**Status**: ✅ COMPLETED (Button Added - Full Edit Functionality Pending)

**Date**: June 12, 2026

---

## User Question
"dimana tombol edit?"

**Answer**: Sebelumnya TIDAK ADA tombol edit. Hanya ada tombol "Buat Diagnosa" untuk create baru.

---

## Problem Analysis

**Current State** (Before):
- ✅ Ada tombol "Buat Diagnosa" (orange) di pojok kanan atas untuk create diagnosis baru
- ❌ TIDAK ADA tombol Edit untuk diagnosis yang sudah dibuat
- User tidak bisa mengedit diagnosis yang sudah ada

**User Need**:
- Perlu tombol untuk mengedit diagnosis yang sudah dibuat
- Tombol harus muncul di setiap diagnosis card

---

## Solution Implemented

### 1. Added Edit Button to Diagnosis Cards
**File**: `apps/web/src/components/members/MemberDiagnosesTab.tsx`

**Changes**:
1. **Imported Edit icon** from lucide-react:
   ```typescript
   import { Edit } from 'lucide-react';
   ```

2. **Added Edit button** di pojok kanan atas setiap diagnosis card:
   ```typescript
   <div className="flex items-center gap-2">
     {diagnosis.kategoriDiagnosa && (
       <span className="...">
         {diagnosis.kategoriDiagnosa}
       </span>
     )}
     {canEdit && (
       <button
         onClick={() => {
           // TODO: Implement edit functionality
           alert('Fitur edit diagnosis akan segera ditambahkan');
         }}
         className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200..."
         title="Edit Diagnosa"
       >
         <Edit size={14} />
       </button>
     )}
   </div>
   ```

---

## UI Behavior

### Tombol Edit Muncul Ketika:
- ✅ User adalah **DOCTOR, ADMIN_MANAGER, atau SUPER_ADMIN** (sesuai permission `canEdit`)
- ✅ Ada diagnosis yang sudah dibuat
- ✅ Di pojok kanan atas setiap diagnosis card
- ✅ Warna biru dengan icon pensil

### Tombol Edit TIDAK Muncul Ketika:
- ❌ User adalah ADMIN_LAYANAN, ADMIN_CABANG, atau NURSE
- ❌ Role tersebut hanya bisa view diagnosis (read-only)

---

## Visual Location

```
┌─────────────────────────────────────────────────────────┐
│ Diagnosis Card                                          │
├─────────────────────────────────────────────────────────┤
│ DX-SRY-20626-000001        [HIPERTENSI] [🖊️ EDIT]      │
│ 6/12/2026, 10:00 AM                                     │
│                                                         │
│ Dokter Pemeriksa                                        │
│ 👨‍⚕️ dr. Citra Wijaya, SpPD                             │
│                                                         │
│ Diagnosa                                                │
│ test                                                    │
│                                                         │
│ Kode ICD                                                │
│ [Primer: I10] [Sekunder: M15] [Tersier: I10]          │
│                                                         │
│ ... (other fields)                                      │
└─────────────────────────────────────────────────────────┘
```

---

## Current Functionality

### What Works Now:
✅ Tombol Edit muncul di setiap diagnosis card  
✅ Tombol hanya visible untuk role yang berhak (DOCTOR, ADMIN_MANAGER, SUPER_ADMIN)  
✅ Hover effect (biru menjadi lebih gelap)  
✅ Tooltip "Edit Diagnosa"  
✅ Icon pensil (Edit) dari lucide-react  

### What's Pending:
⏳ **Full edit functionality** - Saat ini tombol menampilkan alert placeholder  
⏳ Edit modal belum dibuat  
⏳ Backend endpoint untuk update diagnosis (jika belum ada)  

---

## Next Steps to Complete Edit Functionality

1. **Create Edit Modal** - Similar to create modal but pre-filled with existing data
2. **Add State Management** - Track which diagnosis is being edited
3. **Backend API** - Ensure PUT/PATCH endpoint exists for updating diagnosis
4. **Implement Update Logic** - Connect frontend form to backend API
5. **Add Success/Error Handling** - Show toast notifications

---

## Technical Details

### Button Styling:
```typescript
className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 
dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 
transition-colors"
```

- **Light mode**: Blue background with darker blue text
- **Dark mode**: Semi-transparent blue with brighter blue text
- **Hover**: Slightly darker shade
- **Transition**: Smooth color change

### Icon Size:
- `<Edit size={14} />` - Small 14px icon to fit button size

---

## Permission Matrix (Unchanged)

| Role | Can View | Can Create | **Can Edit** |
|------|----------|------------|--------------|
| DOCTOR | ✅ | ✅ | ✅ **Button visible** |
| ADMIN_MANAGER | ✅ | ✅ | ✅ **Button visible** |
| SUPER_ADMIN | ✅ | ✅ | ✅ **Button visible** |
| ADMIN_LAYANAN | ✅ | ❌ | ❌ Button hidden |
| ADMIN_CABANG | ✅ | ❌ | ❌ Button hidden |
| NURSE | ✅ | ❌ | ❌ Button hidden |

---

## Files Modified

1. `apps/web/src/components/members/MemberDiagnosesTab.tsx`
   - Added `Edit` icon import
   - Added edit button to diagnosis card with permission check
   - Positioned button next to category badge

---

## Summary

✅ **Problem Solved**: Tombol Edit sekarang ADA dan muncul di setiap diagnosis card  
✅ **Permission Applied**: Hanya muncul untuk DOCTOR, ADMIN_MANAGER, SUPER_ADMIN  
✅ **Build Successful**: Frontend compiles without errors  
⏳ **Pending**: Full edit functionality (modal + API integration)  

**User can now SEE the edit button** - Full editing functionality akan ditambahkan di task berikutnya jika diperlukan.
