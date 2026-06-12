# Status dan Ekspansi Kode ICD di Sistem Diagnosa

**Tanggal**: 9 Juni 2026  
**Issue**: "Kenapa icd di diagnosa masih belum lengkap?"  
**Status**: ✅ **SUDAH TERIMPLEMENTASI** - Perlu ekspansi database ICD

---

## 🔍 INVESTIGASI

### **Sistem Sudah Memiliki**:

1. ✅ **Database Schema** - Tabel Diagnosis dengan 3 field ICD:
   - `icdPrimer` (String, optional)
   - `icdSekunder` (String, optional)  
   - `icdTersier` (String, optional)

2. ✅ **ICDSearchInput Component** (`apps/web/src/components/ui/ICDSearchInput.tsx`):
   - Searchable dropdown dengan autocomplete
   - Filter berdasarkan kode atau deskripsi
   - Support dark/light mode
   - UX bagus dengan preview dan clear button

3. ✅ **ICD API** (`apps/web/src/lib/icdApi.ts`):
   - **100+ kode ICD-10** yang sudah ada
   - Search functionality
   - Kategori: Hipertensi, Diabetes, Neurologi, Kardiovaskular, Ortopedi, Hematologi, Endokrin, Mental, dll

4. ✅ **Frontend Integration**:
   - `MemberDiagnosesTab.tsx` - Buat diagnosa baru (SUDAH pakai ICD)
   - `Step1Diagnosis.tsx` - Session diagnosis (display only, tidak edit ICD)

---

## 📊 KODE ICD YANG SUDAH ADA

### **Cardiovascular (6 codes)**
- I10 - Essential hypertension - Hipertensi esensial
- I11 - Hypertensive heart disease
- I20 - Angina pectoris
- I21 - Acute myocardial infarction
- I25 - Chronic ischemic heart disease
- I50 - Heart failure

### **Diabetes (3 codes)**
- E10 - Type 1 diabetes mellitus
- E11 - Type 2 diabetes mellitus
- E14 - Unspecified diabetes mellitus

### **Neurological (9 codes)**
- G40 - Epilepsy
- G43 - Migraine
- G44 - Other headache syndromes
- G45 - Transient cerebral ischemic attacks
- G47 - Sleep disorders
- G50 - Disorders of trigeminal nerve
- G51 - Facial nerve disorders
- G56 - Mononeuropathies of upper limb
- G62 - Other polyneuropathies

### **Musculoskeletal (10 codes)**
- M15 - Polyarthrosis
- M16 - Osteoarthritis of hip
- M17 - Osteoarthritis of knee
- M19 - Other arthrosis
- M25 - Other joint disorders
- M47 - Spondylosis
- M48 - Other spondylopathies
- M50 - Cervical disc disorders
- M51 - Other intervertebral disc disorders
- M54 - Dorsalgia (nyeri punggung)
- M79 - Other soft tissue disorders

### **Respiratory (7 codes)**
- J00 - Acute nasopharyngitis (common cold)
- J06 - Acute upper respiratory infections
- J18 - Pneumonia
- J20 - Acute bronchitis
- J40 - Bronchitis
- J44 - COPD
- J45 - Asthma

### **Digestive (7 codes)**
- K21 - GERD
- K25 - Gastric ulcer
- K29 - Gastritis and duodenitis
- K30 - Functional dyspepsia
- K58 - Irritable bowel syndrome
- K76 - Other diseases of liver
- K80 - Cholelithiasis

### **Genitourinary (3 codes)**
- N18 - Chronic kidney disease
- N19 - Unspecified kidney failure
- N39 - Other disorders of urinary system

### **Hematological (6 codes)**
- D50 - Iron deficiency anemia
- D51 - Vitamin B12 deficiency anemia
- D52 - Folate deficiency anemia
- D64 - Other anemias
- D68 - Other coagulation defects
- D69 - Purpura

### **Endocrine (6 codes)**
- E03 - Other hypothyroidism
- E04 - Other nontoxic goiter
- E05 - Thyrotoxicosis (hyperthyroidism)
- E06 - Thyroiditis
- E66 - Obesity
- E78 - Disorders of lipoprotein metabolism

### **Mental & Behavioral (7 codes)**
- F32 - Depressive episode
- F33 - Recurrent depressive disorder
- F41 - Other anxiety disorders
- F43 - Reaction to severe stress
- F45 - Somatoform disorders
- F48 - Other neurotic disorders
- F51 - Nonorganic sleep disorders

### **Skin (5 codes)**
- L20 - Atopic dermatitis
- L23 - Allergic contact dermatitis
- L30 - Other dermatitis
- L40 - Psoriasis
- L50 - Urticaria

### **Infectious Diseases (3 codes)**
- A09 - Infectious gastroenteritis
- B34 - Viral infection
- B99 - Other infectious diseases

### **Symptoms & Signs (9 codes)**
- R05 - Cough
- R06 - Abnormalities of breathing
- R07 - Pain in throat and chest
- R10 - Abdominal and pelvic pain
- R11 - Nausea and vomiting
- R42 - Dizziness
- R50 - Fever
- R51 - Headache
- R52 - Pain
- R53 - Malaise and fatigue

### **Injury (13 codes)**
- S06 - Intracranial injury
- S13 - Dislocation and sprain of neck
- S43 - Dislocation and sprain of shoulder
- S52 - Fracture of forearm
- S53 - Dislocation and sprain of elbow
- S62 - Fracture at wrist
- S63 - Dislocation and sprain of wrist
- S72 - Fracture of femur
- S82 - Fracture of lower leg
- S83 - Dislocation and sprain of knee
- S93 - Dislocation and sprain of ankle
- T14 - Injury of unspecified body region

**TOTAL: ~100 kode ICD-10**

---

## ❓ KEMUNGKINAN MASALAH

User mengatakan "ICD di diagnosa masih belum lengkap". Kemungkinan penyebabnya:

### **1. Diagnosa Lama Tidak Punya ICD**
- Diagnosa yang dibuat sebelum fitur ICD ada akan kosong
- **Solusi**: Edit diagnosa lama dan tambahkan ICD code

### **2. Kode ICD yang Dibutuhkan Tidak Ada**
- Database hanya punya ~100 kode umum
- ICD-10 lengkap ada **68,000+ codes**
- **Solusi**: Tambahkan kode yang sering dipakai RAHO

### **3. User Tidak Tahu Cara Pakai**
- Fitur sudah ada tapi mungkin tidak dipakai
- **Solusi**: Training atau panduan

---

## 💡 REKOMENDASI

### **Option 1: Ekspansi Database ICD (RECOMMENDED)**

Tambahkan kode ICD yang sering dipakai di klinik RAHO:

**Kategori Tambahan yang Mungkin Dibutuhkan**:
- **Stroke & Cerebrovascular** (I60-I69)
  - I60 - Subarachnoid hemorrhage
  - I61 - Intracerebral hemorrhage  
  - I63 - Cerebral infarction
  - I64 - Stroke, not specified
  - I67 - Other cerebrovascular diseases
  - I69 - Sequelae of cerebrovascular disease

- **Neuropathy** (G54-G64) - Lebih lengkap
  - G54 - Nerve root and plexus disorders
  - G55 - Nerve root compressions
  - G57 - Mononeuropathies of lower limb
  - G58 - Other mononeuropathies
  - G60 - Hereditary and idiopathic neuropathy
  - G61 - Inflammatory polyneuropathy
  - G63 - Polyneuropathy
  - G64 - Other disorders of peripheral nervous system

- **Spine Disorders** (M40-M54) - Lebih lengkap
  - M40 - Kyphosis and lordosis
  - M41 - Scoliosis
  - M42 - Spinal osteochondrosis
  - M43 - Other deforming dorsopathies
  - M45 - Ankylosing spondylitis
  - M46 - Other inflammatory spondylopathies
  - M53 - Other dorsopathies

- **Cancer/Neoplasms** (C00-D49)
  - C79 - Secondary malignant neoplasm
  - C80 - Malignant neoplasm without specification
  - D37 - Neoplasm of uncertain behavior

- **Autoimmune Diseases** (M30-M36)
  - M30 - Polyarteritis nodosa
  - M31 - Other necrotizing vasculopathies
  - M32 - Systemic lupus erythematosus
  - M33 - Dermatopolymyositis
  - M34 - Systemic sclerosis
  - M35 - Other systemic involvement of connective tissue

**File to Edit**: `apps/web/src/lib/icdApi.ts`

### **Option 2: Import Full ICD-10 Database**

Jika membutuhkan database lengkap:
1. Download ICD-10 dataset (WHO atau CMS)
2. Import ke PostgreSQL table baru (`IcdCodes`)
3. Create backend API endpoint untuk search
4. Update `icdApi.ts` untuk call backend

**Pros**: Database lengkap  
**Cons**: Kompleks, butuh API backend baru

### **Option 3: Gunakan External ICD API**

Integrasi dengan WHO ICD-11 API:
- Real-time search
- Selalu update
- Tidak perlu maintenance database

**Pros**: Selalu up-to-date  
**Cons**: Butuh internet, latency lebih tinggi

---

## 🎯 ACTION PLAN

**IMMEDIATE (Hari ini)**:
1. ✅ **Konfirmasi dengan user**: Kode ICD apa yang kurang?
2. ✅ **Check existing diagnoses**: Berapa banyak yang sudah punya ICD code?

**SHORT-TERM (1-2 hari)**:
1. Tambahkan 50-100 kode ICD tambahan yang sering dipakai
2. Update `apps/web/src/lib/icdApi.ts` dengan kode baru
3. Test search functionality
4. Deploy update

**LONG-TERM (Optional)**:
1. Implementasi full ICD-10 database di backend
2. Create proper API endpoints
3. Migration dari hardcoded list ke database

---

## 📝 CARA PAKAI FITUR ICD (User Guide)

### **Untuk Staff Medis**:

1. **Buat Diagnosa Baru**:
   - Buka halaman Member Detail
   - Klik tab "Diagnosa"
   - Klik "Buat Diagnosa"
   - Isi Dokter Pemeriksa, Diagnosa, Kategori
   - **Klik field "ICD Primer"** - Dropdown akan muncul
   - Ketik untuk search (misal: "diabetes", "I10", "hypertension")
   - Pilih kode yang sesuai
   - Ulangi untuk ICD Sekunder dan Tersier jika perlu
   - Klik "Simpan Diagnosa"

2. **ICD Code di Session**:
   - Saat buat session baru, pilih diagnosa yang sudah ada
   - ICD code akan otomatis ter-copy ke session
   - ICD code ditampilkan di Step 1: Diagnosa

---

## 🐛 TROUBLESHOOTING

### **Masalah**: Tidak bisa cari ICD code
**Solusi**: 
- Pastikan sudah ketik minimal 2 karakter
- Coba search pakai kode (misal: "E11") atau deskripsi (misal: "diabetes")
- Check koneksi internet (jika pakai external API di masa depan)

### **Masalah**: Kode yang dicari tidak ada
**Solusi**:
- Report ke developer untuk ditambahkan
- Sementara bisa input manual (tapi tidak recommended)

### **Masalah**: Diagnosa lama tidak punya ICD
**Solusi**:
- Edit diagnosa dan tambahkan ICD code
- Atau buat diagnosa baru dengan ICD

---

## 📊 STATISTICS (To Check)

**Query untuk check berapa diagnosa yang sudah punya ICD**:

```sql
-- Total diagnoses
SELECT COUNT(*) as total_diagnoses FROM diagnoses;

-- Diagnoses with ICD Primer
SELECT COUNT(*) as with_icd_primer FROM diagnoses WHERE "icdPrimer" IS NOT NULL;

-- Diagnoses with any ICD code
SELECT COUNT(*) as with_any_icd FROM diagnoses 
WHERE "icdPrimer" IS NOT NULL OR "icdSekunder" IS NOT NULL OR "icdTersier" IS NOT NULL;

-- Percentage
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN "icdPrimer" IS NOT NULL THEN 1 END) as with_icd,
  ROUND(COUNT(CASE WHEN "icdPrimer" IS NOT NULL THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as percentage
FROM diagnoses;
```

---

## 🔗 FILES TERKAIT

- **Database Schema**: `apps/api/prisma/schema.prisma` (Diagnosis model line 1005)
- **ICD API**: `apps/web/src/lib/icdApi.ts`
- **ICD Search Component**: `apps/web/src/components/ui/ICDSearchInput.tsx`
- **Diagnosis Form**: `apps/web/src/components/members/MemberDiagnosesTab.tsx`
- **Session Diagnosis**: `apps/web/src/components/sessions/Step1Diagnosis.tsx`

---

## ✅ NEXT STEPS

**PERTANYAAN UNTUK USER**:

1. ❓ **Kode ICD apa yang kurang?** (Kasih contoh diagnosa yang tidak ketemu)
2. ❓ **Apakah staff sudah tahu cara pakai fitur ICD search?**
3. ❓ **Berapa banyak diagnosa yang belum punya ICD code?**
4. ❓ **Apakah perlu training cara pakai sistem ICD?**

**AFTER USER RESPONSE**:
- Jika butuh kode spesifik → Tambahkan ke `icdApi.ts`
- Jika butuh database lengkap → Implementasi backend ICD table
- Jika masalah UX → Buat user guide atau video tutorial

---

**Status**: ⏸️ **WAITING FOR USER INPUT** - Perlu konfirmasi kode ICD apa yang kurang
