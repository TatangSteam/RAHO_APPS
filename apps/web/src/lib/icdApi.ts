import axios from 'axios';

// Clinicaltables.nlm.nih.gov ICD-10-CM API
// FREE API with 70,000+ ICD-10 codes, no authentication required
const CLINICAL_TABLES_API = 'https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search';

export interface ICDCode {
  code: string;
  title: string;
  definition?: string;
  parent?: string;
}

// Cache for API results to improve performance
const searchCache = new Map<string, { data: ICDCode[]; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

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

// Indonesian translations for common ICD codes
const INDONESIAN_TRANSLATIONS: Record<string, string> = {
  // Cardiovascular
  'I10': 'Hipertensi esensial',
  'I11': 'Penyakit jantung hipertensi',
  'I20': 'Angina pektoris',
  'I21': 'Infark miokard akut',
  'I25': 'Penyakit jantung iskemik kronis',
  'I50': 'Gagal jantung',
  'I63': 'Infark serebral (Stroke iskemik)',
  'I64': 'Stroke, tidak spesifik',
  
  // Diabetes
  'E10': 'Diabetes melitus tipe 1',
  'E11': 'Diabetes melitus tipe 2',
  'E14': 'Diabetes melitus tidak spesifik',
  
  // Neurological
  'G40': 'Epilepsi',
  'G43': 'Migrain',
  'G44': 'Sindrom sakit kepala lainnya',
  'G45': 'Serangan iskemik serebral transien',
  'G47': 'Gangguan tidur',
  'G50': 'Gangguan saraf trigeminal',
  'G51': 'Gangguan saraf wajah (Bell\'s palsy)',
  'G56': 'Mononeuropati ekstremitas atas',
  'G62': 'Polineuropati lainnya',
  
  // Musculoskeletal
  'M15': 'Poliartrosis',
  'M16': 'Osteoartritis panggul',
  'M17': 'Osteoartritis lutut',
  'M19': 'Artrosis lainnya',
  'M25': 'Gangguan sendi lainnya',
  'M47': 'Spondilosis',
  'M50': 'Gangguan diskus serviks',
  'M51': 'Gangguan diskus intervertebralis lainnya',
  'M54': 'Dorsalgia (nyeri punggung)',
  'M79': 'Gangguan jaringan lunak lainnya',
  
  // Respiratory
  'J18': 'Pneumonia',
  'J44': 'PPOK (Penyakit Paru Obstruktif Kronis)',
  'J45': 'Asma',
  
  // Digestive
  'K21': 'GERD (Gastroesophageal Reflux Disease)',
  'K29': 'Gastritis dan duodenitis',
  'K30': 'Dispepsia fungsional',
  
  // Genitourinary
  'N18': 'Penyakit ginjal kronis',
  'N19': 'Gagal ginjal tidak spesifik',
  
  // Hematological
  'D50': 'Anemia defisiensi besi',
  'D64': 'Anemia lainnya',
  
  // Symptoms
  'R51': 'Sakit kepala',
  'R52': 'Nyeri',
  'R53': 'Malaise dan kelelahan',
};

// Add Indonesian translation to title if available
function addIndonesianTranslation(code: string, title: string): string {
  const translation = INDONESIAN_TRANSLATIONS[code];
  if (translation && !title.toLowerCase().includes(translation.toLowerCase())) {
    return `${title} - ${translation}`;
  }
  return title;
}

export const icdApi = {
  // Search ICD codes using Clinicaltables API (70,000+ codes)
  searchICD: async (query: string): Promise<ICDCode[]> => {
    // If query is empty or too short, return common codes
    if (!query || query.length < 2) {
      return COMMON_ICD_CODES.slice(0, 20);
    }

    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Call Clinicaltables API
      // API returns: [total_count, [[code1, name1], [code2, name2], ...], ...]
      const response = await axios.get(CLINICAL_TABLES_API, {
        params: {
          sf: 'code,name', // Search fields
          terms: query,
          maxList: 50, // Limit results
        },
        timeout: 5000, // 5 second timeout
      });

      // Parse response
      const [totalCount, results] = response.data;
      
      if (!results || !Array.isArray(results)) {
        throw new Error('Invalid API response format');
      }

      // Transform to ICDCode format
      const codes: ICDCode[] = results.map(([code, title]: [string, string]) => ({
        code,
        title: addIndonesianTranslation(code, title),
      }));

      // Cache the results
      searchCache.set(cacheKey, { data: codes, timestamp: Date.now() });

      return codes;
    } catch (error) {
      console.error('Failed to fetch from Clinicaltables API:', error);
      
      // Fallback to local common codes
      const filtered = COMMON_ICD_CODES.filter(
        (icd) =>
          icd.code.toLowerCase().includes(query.toLowerCase()) ||
          icd.title.toLowerCase().includes(query.toLowerCase())
      );

      return filtered.slice(0, 50);
    }
  },

  // Get all common ICD codes (from local database)
  getCommonICDCodes: async (): Promise<ICDCode[]> => {
    return COMMON_ICD_CODES;
  },

  // Get ICD codes by category using Clinicaltables API
  getICDByCategory: async (category: string): Promise<ICDCode[]> => {
    // Map category to search terms
    const categorySearchTerms: Record<string, string> = {
      HIPERTENSI: 'hypertension',
      DIABETES: 'diabetes',
      NEUROLOGI: 'neurological nerve brain',
      KARDIOVASKULAR: 'cardiovascular heart cardiac',
      ORTOPEDI: 'musculoskeletal arthritis joint bone',
      HEMATOLOGI: 'anemia blood hematological',
      IMUNOLOGI: 'immune immunological',
      LAINNYA: '',
    };

    const searchTerm = categorySearchTerms[category] || '';
    
    if (!searchTerm) {
      return COMMON_ICD_CODES.slice(0, 20);
    }

    try {
      // Use the main search function
      return await icdApi.searchICD(searchTerm);
    } catch (error) {
      console.error('Failed to fetch ICD by category:', error);
      
      // Fallback to local codes
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
    }
  },

  // Clear cache (useful for testing or when needed)
  clearCache: () => {
    searchCache.clear();
  },
};
