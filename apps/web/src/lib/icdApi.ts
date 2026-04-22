import axios from 'axios';

// ICD-11 API Configuration
// Note: For production, you should register at https://icd.who.int/icdapi
// and get your own CLIENT_ID and CLIENT_SECRET
const ICD_API_BASE = 'https://id.who.int/icd';
const ICD_ENTITY_BASE = 'https://id.who.int/icd/entity';

export interface ICDCode {
  code: string;
  title: string;
  definition?: string;
  parent?: string;
}

// Simple ICD-10 codes for common conditions (fallback)
const COMMON_ICD_CODES: ICDCode[] = [
  // Cardiovascular
  { code: 'I10', title: 'Essential (primary) hypertension - Hipertensi esensial' },
  { code: 'I11', title: 'Hypertensive heart disease - Penyakit jantung hipertensi' },
  { code: 'I20', title: 'Angina pectoris - Angina pektoris' },
  { code: 'I21', title: 'Acute myocardial infarction - Infark miokard akut' },
  { code: 'I25', title: 'Chronic ischemic heart disease - Penyakit jantung iskemik kronis' },
  { code: 'I50', title: 'Heart failure - Gagal jantung' },
  
  // Diabetes
  { code: 'E10', title: 'Type 1 diabetes mellitus - Diabetes melitus tipe 1' },
  { code: 'E11', title: 'Type 2 diabetes mellitus - Diabetes melitus tipe 2' },
  { code: 'E14', title: 'Unspecified diabetes mellitus - Diabetes melitus tidak spesifik' },
  
  // Neurological
  { code: 'G40', title: 'Epilepsy - Epilepsi' },
  { code: 'G43', title: 'Migraine - Migrain' },
  { code: 'G44', title: 'Other headache syndromes - Sindrom sakit kepala lainnya' },
  { code: 'G45', title: 'Transient cerebral ischemic attacks - Serangan iskemik serebral transien' },
  { code: 'G47', title: 'Sleep disorders - Gangguan tidur' },
  { code: 'G50', title: 'Disorders of trigeminal nerve - Gangguan saraf trigeminal' },
  { code: 'G51', title: 'Facial nerve disorders - Gangguan saraf wajah' },
  { code: 'G56', title: 'Mononeuropathies of upper limb - Mononeuropati ekstremitas atas' },
  { code: 'G62', title: 'Other polyneuropathies - Polineuropati lainnya' },
  
  // Musculoskeletal
  { code: 'M15', title: 'Polyarthrosis - Poliartrosis' },
  { code: 'M16', title: 'Osteoarthritis of hip - Osteoartritis panggul' },
  { code: 'M17', title: 'Osteoarthritis of knee - Osteoartritis lutut' },
  { code: 'M19', title: 'Other arthrosis - Artrosis lainnya' },
  { code: 'M25', title: 'Other joint disorders - Gangguan sendi lainnya' },
  { code: 'M47', title: 'Spondylosis - Spondilosis' },
  { code: 'M48', title: 'Other spondylopathies - Spondilopati lainnya' },
  { code: 'M50', title: 'Cervical disc disorders - Gangguan diskus serviks' },
  { code: 'M51', title: 'Other intervertebral disc disorders - Gangguan diskus intervertebralis lainnya' },
  { code: 'M54', title: 'Dorsalgia - Dorsalgia (nyeri punggung)' },
  { code: 'M79', title: 'Other soft tissue disorders - Gangguan jaringan lunak lainnya' },
  
  // Respiratory
  { code: 'J00', title: 'Acute nasopharyngitis (common cold) - Nasofaringitis akut' },
  { code: 'J06', title: 'Acute upper respiratory infections - Infeksi saluran napas atas akut' },
  { code: 'J18', title: 'Pneumonia - Pneumonia' },
  { code: 'J20', title: 'Acute bronchitis - Bronkitis akut' },
  { code: 'J40', title: 'Bronchitis - Bronkitis' },
  { code: 'J44', title: 'Chronic obstructive pulmonary disease - PPOK' },
  { code: 'J45', title: 'Asthma - Asma' },
  
  // Digestive
  { code: 'K21', title: 'Gastro-esophageal reflux disease - GERD' },
  { code: 'K25', title: 'Gastric ulcer - Ulkus lambung' },
  { code: 'K29', title: 'Gastritis and duodenitis - Gastritis dan duodenitis' },
  { code: 'K30', title: 'Functional dyspepsia - Dispepsia fungsional' },
  { code: 'K58', title: 'Irritable bowel syndrome - Sindrom iritasi usus' },
  { code: 'K76', title: 'Other diseases of liver - Penyakit hati lainnya' },
  { code: 'K80', title: 'Cholelithiasis - Kolelitiasis (batu empedu)' },
  
  // Genitourinary
  { code: 'N18', title: 'Chronic kidney disease - Penyakit ginjal kronis' },
  { code: 'N19', title: 'Unspecified kidney failure - Gagal ginjal tidak spesifik' },
  { code: 'N39', title: 'Other disorders of urinary system - Gangguan sistem kemih lainnya' },
  
  // Hematological
  { code: 'D50', title: 'Iron deficiency anemia - Anemia defisiensi besi' },
  { code: 'D51', title: 'Vitamin B12 deficiency anemia - Anemia defisiensi vitamin B12' },
  { code: 'D52', title: 'Folate deficiency anemia - Anemia defisiensi folat' },
  { code: 'D64', title: 'Other anemias - Anemia lainnya' },
  { code: 'D68', title: 'Other coagulation defects - Defek koagulasi lainnya' },
  { code: 'D69', title: 'Purpura and other hemorrhagic conditions - Purpura' },
  
  // Endocrine
  { code: 'E03', title: 'Other hypothyroidism - Hipotiroidisme lainnya' },
  { code: 'E04', title: 'Other nontoxic goiter - Goiter nontoksik lainnya' },
  { code: 'E05', title: 'Thyrotoxicosis (hyperthyroidism) - Tirotoksikosis' },
  { code: 'E06', title: 'Thyroiditis - Tiroiditis' },
  { code: 'E66', title: 'Obesity - Obesitas' },
  { code: 'E78', title: 'Disorders of lipoprotein metabolism - Gangguan metabolisme lipoprotein' },
  
  // Mental and behavioral
  { code: 'F32', title: 'Depressive episode - Episode depresi' },
  { code: 'F33', title: 'Recurrent depressive disorder - Gangguan depresi berulang' },
  { code: 'F41', title: 'Other anxiety disorders - Gangguan ansietas lainnya' },
  { code: 'F43', title: 'Reaction to severe stress - Reaksi terhadap stres berat' },
  { code: 'F45', title: 'Somatoform disorders - Gangguan somatoform' },
  { code: 'F48', title: 'Other neurotic disorders - Gangguan neurotik lainnya' },
  { code: 'F51', title: 'Nonorganic sleep disorders - Gangguan tidur nonorganik' },
  
  // Skin
  { code: 'L20', title: 'Atopic dermatitis - Dermatitis atopik' },
  { code: 'L23', title: 'Allergic contact dermatitis - Dermatitis kontak alergi' },
  { code: 'L30', title: 'Other dermatitis - Dermatitis lainnya' },
  { code: 'L40', title: 'Psoriasis - Psoriasis' },
  { code: 'L50', title: 'Urticaria - Urtikaria' },
  
  // Infectious diseases
  { code: 'A09', title: 'Infectious gastroenteritis and colitis - Gastroenteritis infeksius' },
  { code: 'B34', title: 'Viral infection - Infeksi virus' },
  { code: 'B99', title: 'Other infectious diseases - Penyakit infeksi lainnya' },
  
  // Symptoms and signs
  { code: 'R05', title: 'Cough - Batuk' },
  { code: 'R06', title: 'Abnormalities of breathing - Gangguan pernapasan' },
  { code: 'R07', title: 'Pain in throat and chest - Nyeri tenggorokan dan dada' },
  { code: 'R10', title: 'Abdominal and pelvic pain - Nyeri abdomen dan pelvis' },
  { code: 'R11', title: 'Nausea and vomiting - Mual dan muntah' },
  { code: 'R42', title: 'Dizziness and giddiness - Pusing' },
  { code: 'R50', title: 'Fever - Demam' },
  { code: 'R51', title: 'Headache - Sakit kepala' },
  { code: 'R52', title: 'Pain - Nyeri' },
  { code: 'R53', title: 'Malaise and fatigue - Malaise dan kelelahan' },
  
  // Injury and external causes
  { code: 'S06', title: 'Intracranial injury - Cedera intrakranial' },
  { code: 'S13', title: 'Dislocation and sprain of neck - Dislokasi dan keseleo leher' },
  { code: 'S43', title: 'Dislocation and sprain of shoulder - Dislokasi dan keseleo bahu' },
  { code: 'S52', title: 'Fracture of forearm - Fraktur lengan bawah' },
  { code: 'S53', title: 'Dislocation and sprain of elbow - Dislokasi dan keseleo siku' },
  { code: 'S62', title: 'Fracture at wrist and hand - Fraktur pergelangan tangan' },
  { code: 'S63', title: 'Dislocation and sprain of wrist - Dislokasi dan keseleo pergelangan tangan' },
  { code: 'S72', title: 'Fracture of femur - Fraktur femur' },
  { code: 'S82', title: 'Fracture of lower leg - Fraktur tungkai bawah' },
  { code: 'S83', title: 'Dislocation and sprain of knee - Dislokasi dan keseleo lutut' },
  { code: 'S93', title: 'Dislocation and sprain of ankle - Dislokasi dan keseleo pergelangan kaki' },
  { code: 'T14', title: 'Injury of unspecified body region - Cedera tidak spesifik' },
];

export const icdApi = {
  // Search ICD codes
  searchICD: async (query: string): Promise<ICDCode[]> => {
    if (!query || query.length < 2) {
      return COMMON_ICD_CODES.slice(0, 20);
    }

    // Filter common codes based on query
    const filtered = COMMON_ICD_CODES.filter(
      (icd) =>
        icd.code.toLowerCase().includes(query.toLowerCase()) ||
        icd.title.toLowerCase().includes(query.toLowerCase())
    );

    return filtered.slice(0, 50);
  },

  // Get all common ICD codes
  getCommonICDCodes: async (): Promise<ICDCode[]> => {
    return COMMON_ICD_CODES;
  },

  // Get ICD codes by category
  getICDByCategory: async (category: string): Promise<ICDCode[]> => {
    const categoryMap: Record<string, string[]> = {
      HIPERTENSI: ['I10', 'I11', 'I12', 'I13', 'I15'],
      DIABETES: ['E10', 'E11', 'E13', 'E14'],
      NEUROLOGI: ['G40', 'G43', 'G44', 'G45', 'G47', 'G50', 'G51', 'G56', 'G62'],
      KARDIOVASKULAR: ['I10', 'I11', 'I20', 'I21', 'I25', 'I50'],
      ORTOPEDI: ['M15', 'M16', 'M17', 'M19', 'M25', 'M47', 'M48', 'M50', 'M51', 'M54', 'M79'],
      HEMATOLOGI: ['D50', 'D51', 'D52', 'D64', 'D68', 'D69'],
    };

    const codes = categoryMap[category] || [];
    return COMMON_ICD_CODES.filter((icd) => codes.includes(icd.code));
  },
};
