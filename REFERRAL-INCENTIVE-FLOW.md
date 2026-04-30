# 📊 Referral Incentive System - Complete Flow

## ✅ **Option B: Template with Override**

Kode referral menyimpan rate insentif sebagai **DEFAULT/TEMPLATE**, tapi bisa di-override saat member beli package.

## 🔄 **Complete Flow:**

### 1. **Create Referral Code** (Admin)
```
Form Fields:
├── Nama Referrer *
├── Tipe * (SALES/DOKTER/MEMBER)
├── Cabang *
├── Phone
├── Email
├── Insentif Paket Pertama *
│   ├── Tipe Insentif (PERCENTAGE/FIXED_AMOUNT)
│   └── Nilai Insentif
└── Insentif Paket Lanjutan (2+) *
    ├── Tipe Insentif (PERCENTAGE/FIXED_AMOUNT)
    └── Nilai Insentif

Result:
✅ Kode referral tersimpan dengan TEMPLATE insentif
✅ Template ini akan digunakan sebagai DEFAULT
```

**Example:**
```
REF-001: Ahmad Wijaya (SALES)
- First Package: 10% (TEMPLATE)
- Next Package: 5% (TEMPLATE)
```

### 2. **Register Member** (Admin Layanan)
```
Form Fields:
├── ... (member data)
└── Kode Referral (dropdown) *

Result:
✅ Member terhubung dengan kode referral
✅ Template insentif siap digunakan
```

### 3. **Assign Package to Member** (Admin Layanan)

**Current Flow:**
```
1. Select Package (NB7PM, NB15PM, etc.)
2. Set Discount (optional)
3. Set Payment Method
4. Submit
```

**NEW Flow (with Incentive Override):**
```
1. Select Package (NB7PM, NB15PM, etc.)
2. Set Discount (optional)
3. Set Payment Method
4. ✨ INCENTIVE SECTION (NEW) ✨
   ├── Show referral code info
   ├── Show default incentive from template
   ├── Allow override:
   │   ├── Tipe Insentif (PERCENTAGE/FIXED_AMOUNT)
   │   ├── Nilai Insentif
   │   └── Catatan (reason for override)
   └── Preview calculated incentive amount
5. Submit
```

**Example UI:**
```
┌─────────────────────────────────────────┐
│ 💰 Insentif Referral                    │
├─────────────────────────────────────────┤
│ Kode Referral: REF-001 (Ahmad Wijaya)   │
│ Paket: Pertama                          │
│                                         │
│ Default Insentif: 10%                   │
│ Harga Paket: Rp 12,500,000             │
│ Insentif Dihitung: Rp 1,250,000        │
│                                         │
│ ☐ Override Insentif                     │
│   ├── Tipe: [Persentase ▼]             │
│   ├── Nilai: [10]                       │
│   └── Catatan: [Optional reason]        │
└─────────────────────────────────────────┘
```

### 4. **Calculate & Record Incentive** (Auto)
```
Backend Process:
1. Get referral code template
2. Check if override provided
3. Use override OR template
4. Calculate incentive amount
5. Save to ReferralIncentiveRecord
6. Update totalIncentiveEarned

Result:
✅ Incentive record created with ACTUAL rate used
✅ Total incentive updated
```

**Example Record:**
```json
{
  "referralCodeId": "ref-001",
  "memberId": "member-123",
  "memberPackageId": "pkg-456",
  "packageType": "BASIC",
  "packageValue": 12500000,
  "isFirstPackage": true,
  "incentiveType": "PERCENTAGE",
  "incentiveValue": 10,  // Could be overridden
  "incentiveAmount": 1250000,
  "notes": "Default rate used" // or "Override: special promotion"
}
```

## 📊 **Use Cases:**

### Use Case 1: Use Default Template
```
1. Create REF-001: 10% / 5%
2. Member registers with REF-001
3. Member buys NB7PM (Rp 12,500,000)
4. Admin assigns package WITHOUT override
5. System uses template: 10%
6. Incentive: Rp 1,250,000 ✅
```

### Use Case 2: Override for Special Case
```
1. Create REF-001: 10% / 5%
2. Member registers with REF-001
3. Member buys NB7PM (Rp 12,500,000)
4. Admin assigns package WITH override: 15%
5. System uses override: 15%
6. Incentive: Rp 1,875,000 ✅
7. Notes: "Special promotion - bulk purchase"
```

### Use Case 3: Change from Percentage to Fixed
```
1. Create REF-001: 10% / 5%
2. Member registers with REF-001
3. Member buys NB7PM (Rp 12,500,000)
4. Admin assigns package WITH override: Rp 2,000,000 (FIXED)
5. System uses override: Rp 2,000,000
6. Incentive: Rp 2,000,000 ✅
7. Notes: "Special agreement with sales"
```

## 🎯 **Benefits:**

✅ **Flexibility**: Template untuk consistency, override untuk special cases
✅ **Audit Trail**: Semua perubahan tercatat dengan notes
✅ **Easy Management**: Update template tanpa affect existing records
✅ **Transparency**: Jelas mana yang default, mana yang override

## 🔧 **Implementation Status:**

### ✅ **Already Implemented:**
- [x] Referral code with incentive template
- [x] Member registration with referral selection
- [x] Auto-calculate incentive on package assignment
- [x] Incentive records tracking
- [x] Export reports (Excel, PDF, Summary)

### 🚧 **Need to Implement:**
- [ ] Incentive override UI in AssignPackageModal
- [ ] Show default incentive from template
- [ ] Allow manual override with notes
- [ ] Preview calculated incentive amount
- [ ] Save override info to incentive record

## 📝 **Next Steps:**

1. **Update AssignPackageModal**
   - Add IncentiveSection component
   - Show referral code info
   - Show default template
   - Add override checkbox
   - Add override fields (type, value, notes)
   - Add preview calculation

2. **Update Backend API**
   - Accept override parameters in package assignment
   - Use override if provided, else use template
   - Save override info to notes field

3. **Update Incentive Calculation Service**
   - Check for override parameters
   - Use override OR template
   - Add notes about which was used

## 🎨 **UI Mockup:**

```
┌────────────────────────────────────────────────────┐
│ Assign Package to Member                          │
├────────────────────────────────────────────────────┤
│                                                    │
│ [Package Selection Section]                       │
│ Package: NB7PM - Rp 12,500,000                    │
│                                                    │
│ [Discount Section]                                 │
│ Discount: 0%                                       │
│                                                    │
│ ┌──────────────────────────────────────────────┐ │
│ │ 💰 Insentif Referral                         │ │
│ ├──────────────────────────────────────────────┤ │
│ │ Kode: REF-001 - Ahmad Wijaya (SALES)        │ │
│ │ Paket: Pertama                               │ │
│ │                                              │ │
│ │ Template Insentif: 10%                       │ │
│ │ Harga Paket: Rp 12,500,000                  │ │
│ │ Insentif Dihitung: Rp 1,250,000             │ │
│ │                                              │ │
│ │ ☐ Override Insentif                          │ │
│ │                                              │ │
│ │ [Hidden when unchecked]                      │ │
│ │ Tipe: [Persentase (%) ▼]                    │ │
│ │ Nilai: [10]                                  │ │
│ │ Catatan: [Reason for override]              │ │
│ │                                              │ │
│ │ Preview: Rp 1,250,000                       │ │
│ └──────────────────────────────────────────────┘ │
│                                                    │
│ [Payment Method Section]                           │
│ Method: CASH                                       │
│                                                    │
│ [Batal] [Assign Package]                          │
└────────────────────────────────────────────────────┘
```

## 🎉 **Summary:**

**Current System**: ✅ Correct!
- Kode referral menyimpan template insentif
- Form create/edit referral HARUS ada field insentif
- Template digunakan sebagai default

**Enhancement Needed**: 🚧
- Add UI untuk override insentif saat assign package
- Allow admin to change rate for special cases
- Track override dengan notes untuk audit

**This is the RIGHT approach!** Template + Override = Maximum Flexibility 💪
