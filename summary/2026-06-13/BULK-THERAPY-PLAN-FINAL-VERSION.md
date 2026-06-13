# Bulk Therapy Plan Creation - Final Professional Version

**Date**: 13 Juni 2026  
**Status**: ✅ COMPLETE - Professional Tailwind CSS Implementation  
**Version**: 2.0 (Improved UX)

---

## 🎯 Overview

Implementasi ulang modal bulk therapy plan creation dengan design profesional menggunakan Tailwind CSS. Modal ini sudah disempurnakan dengan:

1. **Radio Button untuk IFA Selection** - Mirip dengan form single therapy plan
2. **Auto-set Jumlah ke Sisa Voucher** - Tidak bisa diubah manual
3. **Professional Styling** - Clean, modern, dan konsisten

---

## 🎨 Key Changes dari Versi Sebelumnya

### 1. **IFA Selection dengan Radio Button**

**Sebelumnya**: Numeric input untuk IFA250 dan IFA500 di kolom terpisah dengan auto-clear mutual exclusivity

**Sekarang**: Radio button selection dalam satu kolom "Pilih IFA"

```tsx
// IFA Radio Button UI
<div className="flex flex-col gap-2">
  <label className="flex items-center gap-2 p-2 rounded-lg border">
    <input type="radio" name={`ifa-${plan.rowId}`} />
    <span>IFA 250ml ⭐</span>
  </label>
  <label className="flex items-center gap-2 p-2 rounded-lg border">
    <input type="radio" name={`ifa-${plan.rowId}`} />
    <span>IFA 500ml</span>
  </label>
</div>
```

**Keuntungan**:
- User experience lebih jelas dan intuitif
- Konsisten dengan form single therapy plan
- Visual feedback lebih baik (selected state dengan warna)
- Tidak ada confusion tentang mutual exclusivity

---

### 2. **Auto-set Jumlah Bulk ke Sisa Voucher**

**Sebelumnya**: User bisa memilih jumlah therapy plan dengan numeric input dan checkbox "Use all vouchers"

**Sekarang**: Jumlah therapy plan otomatis diset ke sisa voucher (tidak bisa diubah)

```tsx
// Initialization
const numPlans = packageSummary.therapyPlans.canCreate;

// NO MORE:
// - Numeric input untuk jumlah
// - Checkbox "Use all vouchers"
// - State numPlans, useAllVouchers
```

**Keuntungan**:
- Simplifikasi UI - less is more
- Prevent user error (membuat lebih atau kurang dari yang tersedia)
- Workflow lebih cepat (no decision needed)
- Sesuai use case utama: buat semua therapy plan sekaligus

---

### 3. **Professional Styling Updates**

**Color Scheme**:
- IFA 250ml: Green (`#4ade80`) dengan badge "⭐" (default/recommended)
- IFA 500ml: Amber (`#fbbf24`) untuk alternative
- Selected radio: Highlighted background dengan border warna
- Unselected: Subtle gray

**Visual States**:
```css
/* Selected IFA 250ml */
background: rgba(34,197,94,0.15);
borderColor: #4ade80;

/* Selected IFA 500ml */
background: rgba(251,191,36,0.15);
borderColor: #fbbf24;

/* Unselected */
background: rgba(255,255,255,0.02);
borderColor: rgba(148,163,184,0.3);
```

---

## 📋 Updated Modal Structure

### Header Section
```
┌─────────────────────────────────────────────────┐
│ 🎯 Buat Rencana Terapi (Bulk)         [X]      │
│ Member Name (MemberNo)                          │
└─────────────────────────────────────────────────┘
```

### Package Summary Section
```
┌─────────────────────────────────────────────────┐
│ Paket: 10 Session Package                      │
│ Voucher Tersisa: 7 / 10                        │
│ Rencana Terapi Existing: 3                     │
│ Dapat Dibuat: 7                                │
└─────────────────────────────────────────────────┘
```

### Table Section
```
┌──┬────────────┬──────────────┬─────┬─────┬─────┬──────┐
│No│Keterangan  │  Pilih IFA   │ HHO │ H2  │ NO  │ Aksi │
├──┼────────────┼──────────────┼─────┼─────┼─────┼──────┤
│3 │Terapi ke-3 │ ○ IFA 250ml⭐│     │     │     │ 📋📋 │
│  │            │ ○ IFA 500ml  │     │     │     │      │
├──┼────────────┼──────────────┼─────┼─────┼─────┼──────┤
│4 │Terapi ke-4 │ ○ IFA 250ml⭐│     │     │     │ 📋📋 │
│  │            │ ○ IFA 500ml  │     │     │     │      │
└──┴────────────┴──────────────┴─────┴─────┴─────┴──────┘
```

### Footer
```
┌─────────────────────────────────────────────────┐
│ [Batal]         [➕ Buat 7 Rencana Terapi]      │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Interface Updates

```typescript
interface TherapyPlanRow extends CreateTherapyPlanInput {
  rowId: string;
  therapyNumber: number;
  ifaType: 'ifa250' | 'ifa500'; // NEW: Track IFA selection
}
```

### State Management

**Removed**:
- ❌ `numPlans` state
- ❌ `useAllVouchers` state
- ❌ `handleNumPlansChange()` function
- ❌ `handleUseAllVouchersChange()` function

**Updated**:
- ✅ `updateTherapyPlan()` now handles `ifaType` field
- ✅ `initializeTherapyPlans()` auto-sets to `canCreate` vouchers
- ✅ `copyToNextRow()` and `copyToAllBelow()` copy `ifaType`

### IFA Selection Logic

```typescript
const updateTherapyPlan = (
  rowId: string,
  field: keyof CreateTherapyPlanInput | 'ifaType',
  value: string | number | undefined
) => {
  if (field === 'ifaType') {
    const ifaType = value as 'ifa250' | 'ifa500';
    return {
      ...plan,
      ifaType,
      ifa250: ifaType === 'ifa250' ? 1 : undefined,
      ifa500: ifaType === 'ifa500' ? 1 : undefined,
    };
  }
  // ... other fields
};
```

---

## 📊 Table Column Structure

| Column | Width | Sticky | Type | Description |
|--------|-------|--------|------|-------------|
| No | 60px | Left | Read-only | Therapy sequence number |
| Keterangan | 180px | Left | Text input | Auto-filled "Terapi ke-{n}" |
| Pilih IFA | 200px | - | Radio buttons | IFA 250ml / IFA 500ml selection |
| HHO | 80px | - | Number input | Dose field |
| H2 | 80px | - | Number input | Dose field |
| NO | 80px | - | Number input | Dose field |
| GASO | 80px | - | Number input | Dose field |
| O2 | 80px | - | Number input | Dose field |
| O3 | 80px | - | Number input | Dose field |
| EDTA | 80px | - | Number input | Dose field |
| MB | 80px | - | Number input | Dose field |
| H2S | 80px | - | Number input | Dose field |
| KCL | 80px | - | Number input | Dose field |
| JML NB | 80px | - | Number input | Dose field |
| Aksi | 120px | Right | Buttons | Copy actions |

**Total Columns**: 15 (was 16 with separate IFA250/IFA500)

---

## 🎯 User Flow

### Opening the Modal
1. User clicks "📋 Buat Bulk" di MemberTherapyPlansTab
2. Modal loads package summary
3. Modal auto-creates rows = sisa voucher tersedia
4. Default IFA selection = IFA 250ml untuk semua rows

### Filling Therapy Plans
1. Review package info (vouchers, existing plans)
2. Select IFA type untuk setiap row (250ml atau 500ml)
3. Fill dosage fields (HHO, H2, NO, dll)
4. Optional: Edit keterangan
5. Use copy buttons untuk duplicate dosages

### Copy Functions
- **Copy to Next**: Copies IFA selection + all doses to next row
- **Copy to All Below**: Copies IFA selection + all doses to all rows below

### Validation
- At least one dose field must be filled per row
- Red highlight untuk rows dengan error
- Error summary displayed di bawah table

### Submission
1. Click "Buat {n} Rencana Terapi"
2. Validation runs
3. All plans created in single transaction
4. Success toast + modal closes
5. Therapy plans list refreshes

---

## 🎨 Professional Styling Features

### 1. **Radio Button Visual Feedback**

**Unselected State**:
- Light background: `rgba(255,255,255,0.02)`
- Gray border: `rgba(148,163,184,0.3)`
- Gray text: `#94a3b8`

**Selected IFA 250ml**:
- Green background: `rgba(34,197,94,0.15)`
- Green border: `#4ade80`
- Green text: `#4ade80`
- Badge: ⭐ (recommended)

**Selected IFA 500ml**:
- Amber background: `rgba(251,191,36,0.15)`
- Amber border: `#fbbf24`
- Amber text: `#fbbf24`

### 2. **Dark Mode Support**

All components have proper dark mode variants:
- Backgrounds: `dark:bg-neutral-900`
- Borders: `dark:border-neutral-700`
- Text: `dark:text-white`
- Radio highlights maintain color scheme in dark mode

### 3. **Responsive Design**

- Table scrolls horizontally on narrow viewports
- Sticky columns (No, Keterangan, Aksi)
- Modal max-width: `95vw`
- Modal max-height: `90vh`

---

## ✅ Testing Checklist

### Basic Flow
- [ ] Modal opens with correct voucher count
- [ ] Number of rows = vouchers remaining
- [ ] IFA 250ml selected by default for all rows
- [ ] Can switch between IFA 250ml and IFA 500ml
- [ ] IFA selection copies correctly with copy buttons
- [ ] Dosage fields work correctly
- [ ] Submit creates correct number of plans

### Edge Cases
- [ ] Member with 0 vouchers remaining shows warning
- [ ] Member with 1 voucher shows 1 row
- [ ] Member with 50+ vouchers (max batch)
- [ ] Dark mode renders correctly
- [ ] Responsive design on narrow screens

### Validation
- [ ] Cannot submit with empty dose fields
- [ ] Red highlight shows on invalid rows
- [ ] Error messages display correctly
- [ ] Validation clears when fixed

### Copy Functions
- [ ] Copy to next copies IFA selection
- [ ] Copy to all below copies IFA selection
- [ ] Copy preserves keterangan uniqueness
- [ ] Copy buttons disabled on last row

---

## 📁 Files Modified

### Main Component
- ✅ `apps/web/src/components/members/BulkTherapyPlanModal.tsx`

**Changes**:
1. Removed `numPlans` and `useAllVouchers` state
2. Added `ifaType` to `TherapyPlanRow` interface
3. Updated `updateTherapyPlan()` to handle IFA type
4. Updated `initializeTherapyPlans()` to auto-set count
5. Removed numeric input section from JSX
6. Added radio button IFA selection in table
7. Updated copy functions to include `ifaType`
8. Updated table column structure (removed IFA250/IFA500 numeric columns)

### No Backend Changes Required
Backend API remains the same - already supports ifa250/ifa500 fields.

---

## 🚀 Deployment Ready

✅ **No compilation errors**  
✅ **No TypeScript errors**  
✅ **Professional UI/UX**  
✅ **Dark mode compatible**  
✅ **Responsive design**  
✅ **Consistent with existing patterns**

---

## 📸 Visual Comparison

### Sebelumnya (v1.0)
```
Jumlah Rencana Terapi: [5] (Max: 7)
☑ Gunakan semua voucher (7)

Table:
| No | Ket | IFA250 | IFA500 | HHO | ... |
```

### Sekarang (v2.0)
```
⚠️ Akan membuat 7 rencana terapi (semua voucher tersisa)

Table:
| No | Ket | Pilih IFA            | HHO | ... |
|    |     | ○ IFA 250ml ⭐      |     |     |
|    |     | ○ IFA 500ml         |     |     |
```

---

## 📝 User Benefits

### Simplicity
- ✅ No decision about "how many to create" - always all remaining
- ✅ Clear radio button selection vs numeric inputs
- ✅ Less fields to fill = faster workflow

### Clarity
- ✅ Visual feedback on selected IFA type
- ✅ Badge (⭐) indicates recommended option
- ✅ Color coding (green vs amber)

### Consistency
- ✅ Matches single therapy plan form IFA selection
- ✅ Same radio button pattern across app
- ✅ Professional and modern design

---

## 🎓 Next Steps for User

1. Open member detail page
2. Go to "💊 Therapy Plans" tab
3. Click "📋 Buat Bulk" button
4. Review package summary
5. Select IFA type untuk each row (or use default 250ml)
6. Fill dosage fields
7. Use copy buttons untuk duplicate
8. Click "Buat {n} Rencana Terapi"
9. Done! ✅

---

**Implementation by**: Kiro AI Assistant  
**Approved by**: [Pending Review]  
**Status**: Ready for Testing  
**Priority**: High
