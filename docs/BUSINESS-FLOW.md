# Alur Bisnis Utama - Raho ERP Management System

> Dokumentasi lengkap alur bisnis dan workflow dari sistem manajemen klinik RAHO

---

## 📋 Daftar Isi

1. [Overview Sistem](#overview-sistem)
2. [Alur Registrasi Member](#alur-registrasi-member)
3. [Alur Pembelian Paket](#alur-pembelian-paket)
4. [Alur Pembayaran](#alur-pembayaran)
5. [Alur Terapi/Treatment](#alur-terapi-treatment)
6. [Alur Referral & Insentif](#alur-referral--insentif)
7. [Alur Inventory Management](#alur-inventory-management)
8. [Alur Invoice & Billing](#alur-invoice--billing)
9. [Alur Multi-Branch](#alur-multi-branch)
10. [Role & Permission Flow](#role--permission-flow)

---

## 🎯 Overview Sistem

RAHO adalah sistem manajemen klinik untuk terapi infus dengan fokus pada:
- **Manajemen Member/Pasien**
- **Paket Terapi** (Basic + Booster)
- **Sesi Terapi** (8 steps workflow)
- **Inventory & Stock Management**
- **Multi-Branch Operations**
- **Referral & Incentive System**
- **Invoice & Payment Tracking**

---

## 👤 Alur Registrasi Member

### Flow Diagram
```
[Admin Layanan] → [Buat Member Baru] → [Input Data Member] 
    → [Pilih Referral Code (Optional)] → [Submit] 
    → [Member Terdaftar] → [Assign ke Branch]
```

### Step-by-Step

#### 1. **Admin Layanan Login**
- Role: `ADMIN_LAYANAN`
- Access: Branch-specific

#### 2. **Navigasi ke Halaman Member**
- Menu: Members → New Member
- URL: `/members/new`

#### 3. **Input Data Member**
**Data Wajib:**
- Email (unique)
- Password
- Nama Lengkap
- Nomor Telepon
- Tanggal Lahir
- Jenis Kelamin

**Data Optional:**
- NIK
- Alamat
- Pekerjaan
- Status Nikah
- Emergency Contact
- Sumber Info RAHO
- Referral Code

#### 4. **Pilih Referral Code (Optional)**
- Jika ada referral code, pilih dari dropdown
- System akan track untuk incentive calculation
- Referral types: SALES, DOKTER, MEMBER

#### 5. **Submit & Registrasi**
- System generate `memberNo` (e.g., M-SBY-001)
- Create User account (role: MEMBER)
- Create Member profile
- Link ke registration branch
- Create audit log

#### 6. **Multi-Branch Access (Optional)**
- Admin Manager dapat grant akses ke branch lain
- Member bisa treatment di multiple branches

### Business Rules
✅ Email harus unique  
✅ Member No auto-generated per branch  
✅ Default registration branch = admin's branch  
✅ Referral code optional tapi recommended  
✅ Member langsung active setelah registrasi  

---

## 💼 Alur Pembelian Paket

### Flow Diagram
```
[Member Terdaftar] → [Admin Assign Paket] → [Pilih Tipe Paket]
    → [Input Harga & Diskon] → [Upload Bukti Bayar (Optional)]
    → [Status: PENDING_PAYMENT] → [Verifikasi Pembayaran]
    → [Status: ACTIVE] → [Paket Siap Digunakan]
```

### Step-by-Step

#### 1. **Admin Layanan Assign Paket**
- Navigasi: Member Detail → Assign Package
- Modal: AssignPackageModal

#### 2. **Pilih Tipe Paket**

**A. BASIC Package**
- TNB-P7 (7 sesi)
- TNB-P10 (10 sesi)
- TNB-P15 (15 sesi)
- TNB-P20 (20 sesi)

**B. BOOSTER Package**
- NO (Nitric Oxide)
- GT (Gasotransmitter)
- MB (Methylene Blue)
- KCL (Potassium Chloride)
- H2S (Hydrogen Sulfide)
- HK (H2S Konsentrat)
- O3 (Ozone)
- HHO (Legacy)
- NO2 (Legacy)

**C. Service Type**
- PM (Premiere)
- PS (Partnership)
- PTY (Partnership Attiya)
- PDA (Partnership Dr. Abhi)
- PHC (Partnership Homecare)

#### 3. **Bundling (Optional)**
- Bisa assign BASIC + BOOSTER bersamaan
- System generate `purchaseGroupId` yang sama
- Diskon bisa apply ke total bundle

#### 4. **Input Harga & Diskon**

**Harga:**
- Ambil dari `PackagePricing` table
- Atau input manual (custom pricing)

**Diskon:**
- **Diskon Persen** (0-100%)
  - Dihitung dari total harga (packages + add-ons)
- **Diskon Amount** (Rupiah)
  - Fixed amount discount
- **Total Diskon** = Diskon Persen + Diskon Amount
  - Disimpan di field `discountAmount`
  - Display format: "30% + Rp 200.000"

**Final Price:**
```
finalPrice = totalPrice - (percentDiscount + amountDiscount)
```

#### 5. **Add-Ons (Optional)**
- AIR_NANO (berbagai warna & volume)
- KONSULTASI_GIZI
- KONSULTASI_PSIKOLOG
- ROKOK_KENKOU
- LAINNYA

#### 6. **Upload Bukti Pembayaran (Optional)**
- Format: JPG, PNG, PDF
- Max size: 5MB
- Stored in MinIO
- Field: `paymentProofUrl`

#### 7. **Status Paket**

**PENDING_PAYMENT:**
- Paket baru di-assign
- Belum dibayar
- Bisa di-edit atau di-cancel

**ACTIVE:**
- Sudah dibayar & verified
- Bisa digunakan untuk terapi
- Bisa di-refund (dengan syarat)

**EXPIRED:**
- Sudah melewati masa berlaku
- Tidak bisa digunakan

**CANCELLED:**
- Dibatalkan oleh admin
- Dari PENDING_PAYMENT atau ACTIVE

#### 8. **Verifikasi Pembayaran**
- Admin Layanan verify payment
- Update status: PENDING_PAYMENT → ACTIVE
- Set `paidAt` dan `verifiedAt`
- Create audit log

#### 9. **Incentive Calculation (Jika ada Referral)**
- System auto-calculate incentive
- Based on member's incentive settings:
  - First package: `firstIncentiveType` & `firstIncentiveValue`
  - Next packages: `nextIncentiveType` & `nextIncentiveValue`
- Create `ReferralIncentiveRecord`
- Update referral code statistics

### Business Rules
✅ Paket bisa di-bundle (BASIC + BOOSTER)  
✅ Diskon = persen + amount (combined)  
✅ PENDING_PAYMENT bisa di-edit/cancel  
✅ ACTIVE bisa di-refund (dengan approval)  
✅ Incentive auto-calculated saat verify payment  
✅ Payment proof optional tapi recommended  

---

## 💳 Alur Pembayaran

### Flow Diagram
```
[Paket PENDING_PAYMENT] → [Member Transfer] 
    → [Upload Bukti Bayar] → [Admin Verify]
    → [Status: ACTIVE] → [Generate Invoice]
```

### Step-by-Step

#### 1. **Member Melakukan Pembayaran**
- Transfer ke rekening klinik
- Sesuai dengan `finalPrice`

#### 2. **Upload Bukti Pembayaran**

**Cara 1: Saat Assign Paket**
- Upload langsung di modal assign package

**Cara 2: Setelah Assign**
- Member detail page → Package card
- Button "Upload Bukti Bayar"
- Modal: PaymentProofModal

#### 3. **Admin Verifikasi Pembayaran**
- View payment proof
- Check amount & validity
- Click "Verify Payment"
- Confirm verification

#### 4. **System Update**
- Status: PENDING_PAYMENT → ACTIVE
- Set `paidAt` = current timestamp
- Set `verifiedAt` = current timestamp
- Set `verifiedBy` = admin user ID
- Set `activatedAt` = current timestamp
- Calculate incentive (if referral exists)
- Create audit log

#### 5. **Generate Invoice (Optional)**
- Auto-generate invoice number
- Include all packages & add-ons
- Calculate subtotal, discount, tax, total
- Status: PAID
- Send notification (future feature)

### Payment Methods
- CASH
- TRANSFER
- DEBIT
- CREDIT
- QRIS
- OTHER

### Business Rules
✅ Payment proof required untuk verification  
✅ Admin harus verify manual (no auto-verify)  
✅ Setelah ACTIVE, paket bisa digunakan untuk terapi  
✅ Invoice auto-generated setelah payment verified  
✅ Incentive calculated saat verification  

---

## 🏥 Alur Terapi/Treatment

### Flow Diagram
```
[Member dengan Paket ACTIVE] → [Create Encounter] 
    → [Create Treatment Session] → [8 Steps Workflow]
    → [Complete Session] → [Update Package Usage]
```

### Step-by-Step

#### 1. **Create Encounter**
- Admin Layanan create encounter
- Link ke member & basic package
- Assign doctor & nurse
- Status: ONGOING

#### 2. **Create Treatment Session**
- Link ke encounter
- Set `infusKe` (session number)
- Set `pelaksanaan` (ON_SITE / HOME_CARE)
- Set treatment date
- Assign admin, doctor, nurse
- Optional: Link booster package

#### 3. **8 Steps Treatment Workflow**

##### **Step 1: Diagnosis**
- Doctor input diagnosis
- ICD-10 codes (primer, sekunder, tersier)
- Kategori diagnosis
- Keluhan & riwayat
- Pemeriksaan fisik

##### **Step 2: Therapy Plan**
- Doctor create therapy plan
- Input dosage untuk setiap material:
  - IFA, HHO, H2, NO, GASO, O2, O3
  - EDTA, MB, H2S, KCL
  - Jumlah NB (total volume)
- Keterangan tambahan

##### **Step 3: Vital Signs (Before)**
- Nurse record vital signs BEFORE treatment
- Sistol, Diastol, HR
- Saturasi, PI
- Temperature, Weight, Height

##### **Step 4: Infusion Execution**
- Nurse execute infusion
- Follow therapy plan dosage
- Record actual usage (bisa berbeda dari plan)
- Deviation notes (jika ada perbedaan)
- Bottle type (IFA / EDTA)
- Jenis cairan, volume carrier
- Jumlah jarum, tanggal produksi

##### **Step 5: Material Usage**
- Nurse record material usage
- Link ke inventory items
- Quantity used
- Auto-update stock (stock mutation)

##### **Step 6: Session Photo**
- Upload photo dokumentasi
- Before/after photos
- Treatment process photos

##### **Step 7: Vital Signs (After)**
- Nurse record vital signs AFTER treatment
- Same parameters as Step 3
- Compare before vs after

##### **Step 8: Doctor Evaluation**
- Doctor write evaluation
- SOAP format:
  - Subjective
  - Objective
  - Assessment
  - Plan
- General notes
- Next session plan

#### 4. **Complete Session**
- Mark session as completed
- Update package `usedSessions` count
- Check if package expired (usedSessions >= totalSessions)
- Create audit log

#### 5. **Multiple Doctors/Nurses Support**
- Session bisa assign multiple doctors
- Session bisa assign multiple nurses
- Mark primary doctor/nurse
- All assigned staff can access session

### Business Rules
✅ Encounter required untuk treatment session  
✅ 8 steps harus completed secara berurutan  
✅ Vital signs recorded before & after  
✅ Material usage auto-update inventory stock  
✅ Session completed → package usage updated  
✅ Package expired when usedSessions >= totalSessions  

---

## 🎁 Alur Referral & Insentif

### Flow Diagram
```
[Create Referral Code] → [Member Register dengan Referral]
    → [Member Beli Paket] → [Payment Verified]
    → [System Calculate Incentive] → [Create Incentive Record]
```

### Step-by-Step

#### 1. **Create Referral Code**
- Admin create referral code
- Input data:
  - Code (unique)
  - Referrer name
  - Referrer type (SALES, DOKTER, MEMBER)
  - Branch
  - Contact (phone, email)

#### 2. **Member Register dengan Referral**
- Saat registrasi, pilih referral code
- System link member ke referral code
- Field: `member.referralCodeId`

#### 3. **Set Incentive Settings per Member**
- Admin set incentive untuk member:
  
**First Package Incentive:**
- `firstIncentiveType` (PERCENTAGE / FIXED_AMOUNT)
- `firstIncentiveValue` (e.g., 10 atau 100000)

**Next Packages Incentive:**
- `nextIncentiveType` (PERCENTAGE / FIXED_AMOUNT)
- `nextIncentiveValue` (e.g., 5 atau 50000)

#### 4. **Member Beli Paket**
- Member assigned package
- Status: PENDING_PAYMENT

#### 5. **Payment Verified**
- Admin verify payment
- Status: ACTIVE

#### 6. **System Calculate Incentive**

**Check if First Package:**
```typescript
const isFirstPackage = member.memberPackages.filter(
  p => p.status === 'ACTIVE'
).length === 1;
```

**Calculate Incentive Amount:**
```typescript
if (isFirstPackage) {
  if (firstIncentiveType === 'PERCENTAGE') {
    incentiveAmount = packageValue * (firstIncentiveValue / 100);
  } else {
    incentiveAmount = firstIncentiveValue;
  }
} else {
  if (nextIncentiveType === 'PERCENTAGE') {
    incentiveAmount = packageValue * (nextIncentiveValue / 100);
  } else {
    incentiveAmount = nextIncentiveValue;
  }
}
```

#### 7. **Create Incentive Record**
- Create `ReferralIncentiveRecord`
- Store:
  - Referral code ID
  - Member ID
  - Package ID
  - Package info (type, name, value)
  - Is first package
  - Incentive type & value
  - Incentive amount
- Update referral code statistics:
  - `totalReferrals` += 1
  - `totalIncentiveEarned` += incentiveAmount

#### 8. **View Incentive**
- Member detail page shows incentive info
- Display format: "10% (Rp 500.000)" atau "Rp 100.000"
- Referral code detail shows all incentive records

### Incentive Types

**PERCENTAGE:**
- Percentage of package value
- Example: 10% dari Rp 5.000.000 = Rp 500.000

**FIXED_AMOUNT:**
- Fixed rupiah amount
- Example: Rp 100.000 per package

### Business Rules
✅ Incentive calculated saat payment verified  
✅ First package vs next packages beda incentive  
✅ Incentive settings per member (flexible)  
✅ Incentive record immutable (audit trail)  
✅ Referral code statistics auto-updated  

---

## 📦 Alur Inventory Management

### Flow Diagram
```
[Master Product] → [Branch Inventory] → [Material Usage]
    → [Stock Mutation] → [Stock Request] → [Shipment]
```

### Step-by-Step

#### 1. **Master Product Management**
- Super Admin manage master products
- Categories: MEDICINE, DEVICE, CONSUMABLE
- Unit conversion:
  - Base unit (botol, box, pack)
  - Usage unit (ml, tablet, gram)
  - Conversion factor

#### 2. **Branch Inventory**
- Each branch has own inventory
- Link master product ke branch
- Track stock quantity
- Set minimum threshold
- Storage location

#### 3. **Material Usage (During Treatment)**
- Nurse record material usage di Step 5
- Select inventory item
- Input quantity used
- System auto-create stock mutation

#### 4. **Stock Mutation**
- Auto-created saat material usage
- Types:
  - USED (material digunakan)
  - RECEIVED (terima shipment)
  - ADJUSTMENT (manual adjustment)
- Track:
  - Stock before
  - Stock after
  - Quantity
  - Reference (session ID, shipment ID)

#### 5. **Stock Request (Cabang → Pusat)**
- Branch request stock dari pusat
- Create stock request
- Add items dengan quantity
- Status: PENDING
- Admin Pusat review & approve

#### 6. **Shipment**
- Admin Pusat create shipment
- Link ke stock request
- Status flow:
  - PREPARING → SHIPPED → RECEIVED → APPROVED
- Track shipped quantity
- Branch receive & approve

#### 7. **Stock Alerts**
- System check stock vs minimum threshold
- Alert when stock < minThreshold
- Dashboard shows low stock items

### Business Rules
✅ Stock tracked per branch  
✅ Material usage auto-update stock  
✅ Stock request requires approval  
✅ Shipment tracked end-to-end  
✅ Low stock alerts automated  

---

## 🧾 Alur Invoice & Billing

### Flow Diagram
```
[Packages & Add-ons ACTIVE] → [Generate Invoice]
    → [Invoice Items] → [Calculate Total]
    → [Payment] → [Invoice PAID]
```

### Step-by-Step

#### 1. **Generate Invoice**
- Auto-generated saat payment verified
- Atau manual create by admin
- Invoice number: INV-YYYY-NNNN

#### 2. **Invoice Items**
- Include all packages (BASIC + BOOSTER)
- Include all add-ons
- Include non-therapy products
- Each item:
  - Code
  - Description
  - Quantity
  - Price per unit
  - Subtotal
  - Discount
  - Total

#### 3. **Calculate Total**
```
Subtotal = Sum of all items
Discount = Discount percent + Discount amount
Tax = Subtotal * tax percent (default 0%)
Total = Subtotal - Discount + Tax
```

#### 4. **Invoice Status**
- DRAFT (belum final)
- PENDING_PAYMENT (waiting payment)
- PAID (sudah dibayar)
- CANCELLED (dibatalkan)
- OVERDUE (lewat due date)

#### 5. **Payment Recording**
- Record payment details:
  - Amount
  - Payment method
  - Payment reference
  - Payment proof
  - Received by
  - Received at

#### 6. **Invoice PDF**
- Generate PDF invoice
- Include:
  - Branch info
  - Member info
  - Invoice items
  - Payment details
  - QR code (future)

### Business Rules
✅ Invoice auto-generated after payment  
✅ Multiple payment methods supported  
✅ Invoice immutable after PAID  
✅ PDF generated on-demand  

---

## 🏢 Alur Multi-Branch

### Flow Diagram
```
[Branch Pusat] → [Branch Cabang] → [Staff Assignment]
    → [Member Multi-Branch Access] → [Cross-Branch Operations]
```

### Step-by-Step

#### 1. **Branch Hierarchy**
- **PUSAT**: Main branch (inventory source)
- **CABANG**: Sub branches

#### 2. **Staff Assignment**

**Single Branch Staff:**
- Admin Layanan, Doctor, Nurse
- Assigned to one branch
- Access only their branch data

**Multi-Branch Staff:**
- Admin Manager
- Can access multiple branches
- Manage cross-branch operations

#### 3. **Member Multi-Branch Access**
- Member register di satu branch (registration branch)
- Admin Manager grant access ke branch lain
- Member bisa treatment di multiple branches
- Package bisa digunakan di branch mana saja (yang di-grant)

#### 4. **Branch-Specific Data**
- Inventory per branch
- Package pricing per branch
- Staff per branch
- Sessions per branch

#### 5. **Cross-Branch Operations**

**Stock Request:**
- Cabang request stock dari Pusat
- Pusat approve & ship
- Cabang receive & approve

**Member Transfer:**
- Member bisa pindah branch
- History tetap tersimpan
- Access control via BranchMemberAccess

**Reporting:**
- Admin Manager view all branches
- Branch performance comparison
- Consolidated reports

### Business Rules
✅ Pusat = inventory source  
✅ Staff assigned to specific branches  
✅ Member can access multiple branches  
✅ Package pricing per branch  
✅ Cross-branch stock transfer supported  

---

## 🔐 Role & Permission Flow

### User Roles

#### **SUPER_ADMIN**
- Full system access
- Manage all branches
- Manage all users
- System configuration
- Master data management

**Access:**
- ✅ All modules
- ✅ All branches
- ✅ All operations

#### **ADMIN_MANAGER**
- Multi-branch management
- Staff management
- Branch performance
- Cross-branch operations

**Access:**
- ✅ Multiple branches
- ✅ User management
- ✅ Branch management
- ✅ Reports & analytics
- ❌ System configuration

#### **ADMIN_LAYANAN**
- Branch operations
- Member management
- Package assignment
- Payment verification
- Session management

**Access:**
- ✅ Single branch
- ✅ Member CRUD
- ✅ Package management
- ✅ Session management
- ✅ Invoice management
- ❌ Staff management
- ❌ Branch management

#### **DOCTOR**
- Medical operations
- Diagnosis
- Therapy plan
- Evaluation

**Access:**
- ✅ Single branch
- ✅ View members
- ✅ Diagnosis (Step 1)
- ✅ Therapy plan (Step 2)
- ✅ Evaluation (Step 8)
- ❌ Package management
- ❌ Payment operations

#### **NURSE**
- Treatment execution
- Vital signs
- Infusion
- Material usage

**Access:**
- ✅ Single branch
- ✅ View members
- ✅ Vital signs (Step 3, 7)
- ✅ Infusion (Step 4)
- ✅ Material usage (Step 5)
- ✅ Photo upload (Step 6)
- ❌ Diagnosis
- ❌ Package management

#### **MEMBER**
- Patient portal
- View own data
- View packages
- View sessions
- View invoices

**Access:**
- ✅ Own profile
- ✅ Own packages
- ✅ Own sessions
- ✅ Own invoices
- ❌ Other members
- ❌ Staff operations

### Permission Matrix

| Module | SUPER_ADMIN | ADMIN_MANAGER | ADMIN_LAYANAN | DOCTOR | NURSE | MEMBER |
|--------|-------------|---------------|---------------|--------|-------|--------|
| Dashboard | ✅ All | ✅ Multi-branch | ✅ Branch | ✅ Branch | ✅ Branch | ❌ |
| Users | ✅ CRUD | ✅ CRUD | ❌ | ❌ | ❌ | ❌ |
| Branches | ✅ CRUD | ✅ View | ✅ View | ❌ | ❌ | ❌ |
| Members | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ View | ✅ View | ✅ Own |
| Packages | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ View | ✅ View | ✅ Own |
| Sessions | ✅ CRUD | ✅ View | ✅ CRUD | ✅ Medical | ✅ Nursing | ✅ Own |
| Invoices | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ View | ✅ View | ✅ Own |
| Inventory | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ View | ✅ Use | ❌ |
| Referrals | ✅ CRUD | ✅ CRUD | ✅ View | ❌ | ❌ | ❌ |
| Audit Logs | ✅ View | ✅ View | ❌ | ❌ | ❌ | ❌ |

### Authentication Flow

```
[Login] → [Verify Credentials] → [Generate JWT]
    → [Access Token (15min)] + [Refresh Token (7d)]
    → [Store in HTTP-only Cookie] → [Access Protected Routes]
```

### Authorization Flow

```
[Request] → [Authenticate Middleware] → [Verify JWT]
    → [Authorize Middleware] → [Check Role]
    → [Assert Branch Access] → [Check Branch Permission]
    → [Allow/Deny Request]
```

### Business Rules
✅ JWT-based authentication  
✅ Role-based authorization  
✅ Branch-level access control  
✅ Audit logging for all operations  
✅ Session timeout after 15 minutes  
✅ Refresh token valid for 7 days  

---

## 📊 Key Business Metrics

### Member Metrics
- Total members
- Active members
- New members (this month)
- Members per branch

### Package Metrics
- Total packages sold
- Active packages
- Package revenue
- Average package value
- Packages by type (BASIC vs BOOSTER)

### Session Metrics
- Total sessions completed
- Sessions this month
- Average sessions per member
- Session completion rate

### Financial Metrics
- Total revenue
- Revenue this month
- Revenue by branch
- Revenue by package type
- Outstanding payments

### Inventory Metrics
- Total inventory items
- Low stock items
- Stock requests pending
- Material usage rate

### Referral Metrics
- Total referrals
- Active referral codes
- Total incentives earned
- Conversion rate

---

## 🔄 Integration Points

### Internal Integrations
- **Auth ↔ All Modules**: JWT authentication
- **Members ↔ Packages**: Package assignment
- **Packages ↔ Sessions**: Session creation
- **Sessions ↔ Inventory**: Material usage
- **Packages ↔ Invoices**: Invoice generation
- **Members ↔ Referrals**: Incentive calculation

### External Integrations (Future)
- Payment Gateway (Midtrans, Xendit)
- WhatsApp Notification
- Email Service
- SMS Gateway
- Accounting Software

---

## 📱 User Journeys

### Journey 1: New Member Registration & First Treatment

1. Member datang ke klinik
2. Admin Layanan register member baru
3. Admin assign BASIC package (TNB-P10)
4. Member transfer pembayaran
5. Admin upload bukti bayar & verify
6. Admin create encounter
7. Admin create treatment session
8. Doctor input diagnosis & therapy plan
9. Nurse record vital signs (before)
10. Nurse execute infusion
11. Nurse record material usage
12. Nurse upload session photo
13. Nurse record vital signs (after)
14. Doctor write evaluation
15. Session completed
16. Package usage updated (1/10 used)

### Journey 2: Referral & Incentive

1. Sales create referral code
2. Member register dengan referral code
3. Admin set incentive settings (10% first, 5% next)
4. Member beli paket Rp 5.000.000
5. Admin verify payment
6. System calculate incentive: Rp 500.000 (10%)
7. Create incentive record
8. Update referral statistics
9. Member beli paket kedua Rp 3.000.000
10. System calculate incentive: Rp 150.000 (5%)

### Journey 3: Multi-Branch Access

1. Member register di Branch Surabaya
2. Member pindah ke Jakarta
3. Admin Manager grant access ke Branch Jakarta
4. Member treatment di Branch Jakarta
5. Package tetap bisa digunakan
6. History tersimpan di kedua branch

### Journey 4: Stock Request

1. Branch Bandung stock rendah
2. Admin create stock request ke Pusat
3. Admin Pusat review & approve
4. Admin Pusat create shipment
5. Shipment status: PREPARING → SHIPPED
6. Branch Bandung receive shipment
7. Admin Bandung approve shipment
8. Stock updated di Branch Bandung

---

## 🎯 Success Criteria

### Operational Excellence
✅ Member registration < 5 minutes  
✅ Package assignment < 3 minutes  
✅ Payment verification < 2 minutes  
✅ Session completion < 60 minutes  
✅ Stock request approval < 24 hours  

### Data Accuracy
✅ 100% audit trail coverage  
✅ Real-time stock updates  
✅ Accurate incentive calculation  
✅ Correct invoice generation  

### User Satisfaction
✅ Intuitive UI/UX  
✅ Fast response time  
✅ Minimal clicks per operation  
✅ Clear error messages  

---

**Last Updated**: 2026-05-07  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
