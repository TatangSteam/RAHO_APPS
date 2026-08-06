import { assertCaughtError } from '@/lib/caughtError';
import axios from 'axios';

// Clinicaltables.nlm.nih.gov ICD-10-CM API
// FREE API with 70,000+ ICD-10 codes, no authentication required
const CLINICAL_TABLES_API = 'https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search';

export interface ICDCode {
  code: string;
  title: string;
  definition?: string;
  parent?: string;
  namaIndonesia?: string;
  englishName?: string;
}

export interface ICDSearchResult {
  results: ICDCode[];
  total: number;
}

// Cache for API results to improve performance
const searchCache = new Map<string, { data: ICDSearchResult; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const ICD_DATASET_URL = '/data/icd10-who-2019.json';
const DEFAULT_RESULT_LIMIT = 80;

let fullICDDatasetCache: ICDCode[] | null = null;
let fullICDDatasetPromise: Promise<ICDCode[]> | null = null;

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

// More specific ICD-10-CM fallback codes for the diagnosis form.
// This keeps the UI useful when the public ICD API is unavailable and avoids
// saving broad parent codes when a common unspecified/without-complication code exists.
const DETAILED_COMMON_ICD_CODES: ICDCode[] = [
  // Cardiovascular
  { code: 'I10', title: 'Essential (primary) hypertension - Hipertensi esensial' },
  { code: 'I11.9', title: 'Hypertensive heart disease without heart failure - Penyakit jantung hipertensi tanpa gagal jantung', parent: 'I11' },
  { code: 'I12.9', title: 'Hypertensive chronic kidney disease with stage 1 through stage 4 CKD, or unspecified CKD - Penyakit ginjal kronis hipertensi', parent: 'I12' },
  { code: 'I13.10', title: 'Hypertensive heart and chronic kidney disease without heart failure - Penyakit jantung dan ginjal hipertensi tanpa gagal jantung', parent: 'I13' },
  { code: 'I15.9', title: 'Secondary hypertension, unspecified - Hipertensi sekunder tidak spesifik', parent: 'I15' },
  { code: 'I20.9', title: 'Angina pectoris, unspecified - Angina pektoris tidak spesifik', parent: 'I20' },
  { code: 'I21.9', title: 'Acute myocardial infarction, unspecified - Infark miokard akut tidak spesifik', parent: 'I21' },
  { code: 'I25.10', title: 'Atherosclerotic heart disease of native coronary artery without angina pectoris - Penyakit jantung iskemik kronis', parent: 'I25' },
  { code: 'I50.9', title: 'Heart failure, unspecified - Gagal jantung tidak spesifik', parent: 'I50' },
  { code: 'I60.9', title: 'Nontraumatic subarachnoid hemorrhage, unspecified - Perdarahan subaraknoid tidak spesifik', parent: 'I60' },
  { code: 'I61.9', title: 'Nontraumatic intracerebral hemorrhage, unspecified - Perdarahan intraserebral tidak spesifik', parent: 'I61' },
  { code: 'I63.9', title: 'Cerebral infarction, unspecified - Infark serebral/stroke iskemik tidak spesifik', parent: 'I63' },
  { code: 'I64', title: 'Stroke, not specified as hemorrhage or infarction - Stroke tidak spesifik' },

  // Diabetes, metabolic, endocrine
  { code: 'E10.9', title: 'Type 1 diabetes mellitus without complications - Diabetes melitus tipe 1 tanpa komplikasi', parent: 'E10' },
  { code: 'E11.9', title: 'Type 2 diabetes mellitus without complications - Diabetes melitus tipe 2 tanpa komplikasi', parent: 'E11' },
  { code: 'E13.9', title: 'Other specified diabetes mellitus without complications - Diabetes melitus spesifik lain tanpa komplikasi', parent: 'E13' },
  { code: 'E03.9', title: 'Hypothyroidism, unspecified - Hipotiroidisme tidak spesifik', parent: 'E03' },
  { code: 'E04.9', title: 'Nontoxic goiter, unspecified - Goiter nontoksik tidak spesifik', parent: 'E04' },
  { code: 'E05.90', title: 'Thyrotoxicosis, unspecified without thyrotoxic crisis or storm - Tirotoksikosis tidak spesifik', parent: 'E05' },
  { code: 'E06.9', title: 'Thyroiditis, unspecified - Tiroiditis tidak spesifik', parent: 'E06' },
  { code: 'E66.9', title: 'Obesity, unspecified - Obesitas tidak spesifik', parent: 'E66' },
  { code: 'E78.5', title: 'Hyperlipidemia, unspecified - Hiperlipidemia tidak spesifik', parent: 'E78' },
  { code: 'E88.81', title: 'Metabolic syndrome - Sindrom metabolik', parent: 'E88' },

  // Neurological
  { code: 'G30.9', title: "Alzheimer's disease, unspecified - Penyakit Alzheimer tidak spesifik", parent: 'G30' },
  { code: 'G31.9', title: 'Degenerative disease of nervous system, unspecified - Penyakit degeneratif sistem saraf tidak spesifik', parent: 'G31' },
  { code: 'G40.909', title: 'Epilepsy, unspecified, not intractable, without status epilepticus - Epilepsi tidak spesifik', parent: 'G40' },
  { code: 'G43.909', title: 'Migraine, unspecified, not intractable, without status migrainosus - Migrain tidak spesifik', parent: 'G43' },
  { code: 'G44.209', title: 'Tension-type headache, unspecified, not intractable - Sakit kepala tipe tegang tidak spesifik', parent: 'G44' },
  { code: 'G45.9', title: 'Transient cerebral ischemic attack, unspecified - Serangan iskemik transien tidak spesifik', parent: 'G45' },
  { code: 'G47.9', title: 'Sleep disorder, unspecified - Gangguan tidur tidak spesifik', parent: 'G47' },
  { code: 'G50.9', title: 'Disorder of trigeminal nerve, unspecified - Gangguan saraf trigeminal tidak spesifik', parent: 'G50' },
  { code: 'G51.0', title: "Bell's palsy - Bell's palsy/gangguan saraf wajah", parent: 'G51' },
  { code: 'G56.00', title: 'Carpal tunnel syndrome, unspecified upper limb - Sindrom terowongan karpal tidak spesifik', parent: 'G56' },
  { code: 'G62.9', title: 'Polyneuropathy, unspecified - Polineuropati tidak spesifik', parent: 'G62' },

  // Musculoskeletal, degenerative, autoimmune
  { code: 'M05.9', title: 'Rheumatoid arthritis with rheumatoid factor, unspecified - Artritis reumatoid faktor positif tidak spesifik', parent: 'M05' },
  { code: 'M06.9', title: 'Rheumatoid arthritis, unspecified - Artritis reumatoid tidak spesifik', parent: 'M06' },
  { code: 'M15.9', title: 'Polyosteoarthritis, unspecified - Poliosteoartritis tidak spesifik', parent: 'M15' },
  { code: 'M16.9', title: 'Osteoarthritis of hip, unspecified - Osteoartritis panggul tidak spesifik', parent: 'M16' },
  { code: 'M17.9', title: 'Osteoarthritis of knee, unspecified - Osteoartritis lutut tidak spesifik', parent: 'M17' },
  { code: 'M19.90', title: 'Unspecified osteoarthritis, unspecified site - Osteoartritis tidak spesifik', parent: 'M19' },
  { code: 'M25.50', title: 'Pain in unspecified joint - Nyeri sendi tidak spesifik', parent: 'M25' },
  { code: 'M32.9', title: 'Systemic lupus erythematosus, unspecified - Lupus eritematosus sistemik tidak spesifik', parent: 'M32' },
  { code: 'M35.9', title: 'Systemic involvement of connective tissue, unspecified - Penyakit jaringan ikat sistemik tidak spesifik', parent: 'M35' },
  { code: 'M47.9', title: 'Spondylosis, unspecified - Spondilosis tidak spesifik', parent: 'M47' },
  { code: 'M48.00', title: 'Spinal stenosis, site unspecified - Stenosis spinal tidak spesifik', parent: 'M48' },
  { code: 'M50.90', title: 'Cervical disc disorder, unspecified - Gangguan diskus serviks tidak spesifik', parent: 'M50' },
  { code: 'M51.9', title: 'Intervertebral disc disorder, unspecified - Gangguan diskus intervertebralis tidak spesifik', parent: 'M51' },
  { code: 'M54.50', title: 'Low back pain, unspecified - Nyeri punggung bawah tidak spesifik', parent: 'M54' },
  { code: 'M79.10', title: 'Myalgia, unspecified site - Nyeri otot tidak spesifik', parent: 'M79' },

  // Respiratory
  { code: 'J00', title: 'Acute nasopharyngitis (common cold) - Nasofaringitis akut' },
  { code: 'J06.9', title: 'Acute upper respiratory infection, unspecified - ISPA akut tidak spesifik', parent: 'J06' },
  { code: 'J18.9', title: 'Pneumonia, unspecified organism - Pneumonia tidak spesifik', parent: 'J18' },
  { code: 'J20.9', title: 'Acute bronchitis, unspecified - Bronkitis akut tidak spesifik', parent: 'J20' },
  { code: 'J40', title: 'Bronchitis, not specified as acute or chronic - Bronkitis tidak spesifik' },
  { code: 'J44.9', title: 'Chronic obstructive pulmonary disease, unspecified - PPOK tidak spesifik', parent: 'J44' },
  { code: 'J45.909', title: 'Unspecified asthma, uncomplicated - Asma tidak spesifik tanpa komplikasi', parent: 'J45' },

  // Digestive and urinary
  { code: 'K21.9', title: 'Gastro-esophageal reflux disease without esophagitis - GERD tanpa esofagitis', parent: 'K21' },
  { code: 'K25.9', title: 'Gastric ulcer, unspecified as acute or chronic - Ulkus lambung tidak spesifik', parent: 'K25' },
  { code: 'K29.70', title: 'Gastritis, unspecified, without bleeding - Gastritis tidak spesifik tanpa perdarahan', parent: 'K29' },
  { code: 'K30', title: 'Functional dyspepsia - Dispepsia fungsional' },
  { code: 'K50.90', title: "Crohn's disease, unspecified, without complications - Penyakit Crohn tidak spesifik", parent: 'K50' },
  { code: 'K51.90', title: 'Ulcerative colitis, unspecified, without complications - Kolitis ulseratif tidak spesifik', parent: 'K51' },
  { code: 'K58.9', title: 'Irritable bowel syndrome without diarrhea - Sindrom iritasi usus tanpa diare', parent: 'K58' },
  { code: 'K76.9', title: 'Liver disease, unspecified - Penyakit hati tidak spesifik', parent: 'K76' },
  { code: 'K80.20', title: 'Calculus of gallbladder without cholecystitis without obstruction - Batu empedu tanpa kolesistitis/obstruksi', parent: 'K80' },
  { code: 'N18.9', title: 'Chronic kidney disease, unspecified - Penyakit ginjal kronis tidak spesifik', parent: 'N18' },
  { code: 'N19', title: 'Unspecified kidney failure - Gagal ginjal tidak spesifik' },
  { code: 'N39.0', title: 'Urinary tract infection, site not specified - Infeksi saluran kemih tidak spesifik', parent: 'N39' },

  // Hematology
  { code: 'D50.9', title: 'Iron deficiency anemia, unspecified - Anemia defisiensi besi tidak spesifik', parent: 'D50' },
  { code: 'D51.9', title: 'Vitamin B12 deficiency anemia, unspecified - Anemia defisiensi B12 tidak spesifik', parent: 'D51' },
  { code: 'D52.9', title: 'Folate deficiency anemia, unspecified - Anemia defisiensi folat tidak spesifik', parent: 'D52' },
  { code: 'D64.9', title: 'Anemia, unspecified - Anemia tidak spesifik', parent: 'D64' },
  { code: 'D68.9', title: 'Coagulation defect, unspecified - Gangguan koagulasi tidak spesifik', parent: 'D68' },
  { code: 'D69.6', title: 'Thrombocytopenia, unspecified - Trombositopenia tidak spesifik', parent: 'D69' },

  // Oncology
  { code: 'C16.9', title: 'Malignant neoplasm of stomach, unspecified - Kanker lambung tidak spesifik', parent: 'C16' },
  { code: 'C18.9', title: 'Malignant neoplasm of colon, unspecified - Kanker kolon tidak spesifik', parent: 'C18' },
  { code: 'C22.9', title: 'Malignant neoplasm of liver, not specified as primary or secondary - Kanker hati tidak spesifik', parent: 'C22' },
  { code: 'C34.90', title: 'Malignant neoplasm of unspecified part of unspecified bronchus or lung - Kanker paru tidak spesifik', parent: 'C34' },
  { code: 'C50.919', title: 'Malignant neoplasm of unspecified site of unspecified female breast - Kanker payudara tidak spesifik', parent: 'C50' },
  { code: 'C61', title: 'Malignant neoplasm of prostate - Kanker prostat' },

  // Mental and skin
  { code: 'F32.A', title: 'Depression, unspecified - Depresi tidak spesifik', parent: 'F32' },
  { code: 'F33.9', title: 'Major depressive disorder, recurrent, unspecified - Gangguan depresi berulang tidak spesifik', parent: 'F33' },
  { code: 'F41.9', title: 'Anxiety disorder, unspecified - Gangguan ansietas tidak spesifik', parent: 'F41' },
  { code: 'F43.9', title: 'Reaction to severe stress, unspecified - Reaksi stres berat tidak spesifik', parent: 'F43' },
  { code: 'F45.9', title: 'Somatoform disorder, unspecified - Gangguan somatoform tidak spesifik', parent: 'F45' },
  { code: 'F48.9', title: 'Nonpsychotic mental disorder, unspecified - Gangguan neurotik tidak spesifik', parent: 'F48' },
  { code: 'F51.9', title: 'Sleep disorder not due to a substance or known physiological condition, unspecified - Gangguan tidur nonorganik tidak spesifik', parent: 'F51' },
  { code: 'L20.9', title: 'Atopic dermatitis, unspecified - Dermatitis atopik tidak spesifik', parent: 'L20' },
  { code: 'L23.9', title: 'Allergic contact dermatitis, unspecified cause - Dermatitis kontak alergi tidak spesifik', parent: 'L23' },
  { code: 'L30.9', title: 'Dermatitis, unspecified - Dermatitis tidak spesifik', parent: 'L30' },
  { code: 'L40.9', title: 'Psoriasis, unspecified - Psoriasis tidak spesifik', parent: 'L40' },
  { code: 'L50.9', title: 'Urticaria, unspecified - Urtikaria tidak spesifik', parent: 'L50' },

  // Infectious, symptoms, injuries
  { code: 'A09', title: 'Infectious gastroenteritis and colitis, unspecified - Gastroenteritis/kolitis infeksius tidak spesifik' },
  { code: 'B34.9', title: 'Viral infection, unspecified - Infeksi virus tidak spesifik', parent: 'B34' },
  { code: 'B99.9', title: 'Infectious disease, unspecified - Penyakit infeksi tidak spesifik', parent: 'B99' },
  { code: 'R05.9', title: 'Cough, unspecified - Batuk tidak spesifik', parent: 'R05' },
  { code: 'R06.9', title: 'Unspecified abnormalities of breathing - Gangguan pernapasan tidak spesifik', parent: 'R06' },
  { code: 'R07.9', title: 'Chest pain, unspecified - Nyeri dada tidak spesifik', parent: 'R07' },
  { code: 'R10.9', title: 'Unspecified abdominal pain - Nyeri abdomen tidak spesifik', parent: 'R10' },
  { code: 'R11.2', title: 'Nausea with vomiting, unspecified - Mual muntah tidak spesifik', parent: 'R11' },
  { code: 'R42', title: 'Dizziness and giddiness - Pusing' },
  { code: 'R50.9', title: 'Fever, unspecified - Demam tidak spesifik', parent: 'R50' },
  { code: 'R51.9', title: 'Headache, unspecified - Sakit kepala tidak spesifik', parent: 'R51' },
  { code: 'R52', title: 'Pain, unspecified - Nyeri tidak spesifik' },
  { code: 'R53.83', title: 'Other fatigue - Kelelahan', parent: 'R53' },
  { code: 'S06.9X0A', title: 'Unspecified intracranial injury without loss of consciousness, initial encounter - Cedera intrakranial tidak spesifik, kunjungan awal', parent: 'S06' },
  { code: 'S13.4XXA', title: 'Sprain of ligaments of cervical spine, initial encounter - Keseleo leher, kunjungan awal', parent: 'S13' },
  { code: 'S43.409A', title: 'Unspecified sprain of unspecified shoulder joint, initial encounter - Keseleo bahu tidak spesifik, kunjungan awal', parent: 'S43' },
  { code: 'S52.90XA', title: 'Unspecified fracture of unspecified forearm, initial encounter for closed fracture - Fraktur lengan bawah tidak spesifik, kunjungan awal', parent: 'S52' },
  { code: 'S53.409A', title: 'Unspecified sprain of unspecified elbow, initial encounter - Keseleo siku tidak spesifik, kunjungan awal', parent: 'S53' },
  { code: 'S62.90XA', title: 'Unspecified fracture of unspecified wrist and hand, initial encounter for closed fracture - Fraktur pergelangan tangan/tangan tidak spesifik, kunjungan awal', parent: 'S62' },
  { code: 'S72.90XA', title: 'Unspecified fracture of unspecified femur, initial encounter for closed fracture - Fraktur femur tidak spesifik, kunjungan awal', parent: 'S72' },
  { code: 'S82.90XA', title: 'Unspecified fracture of unspecified lower leg, initial encounter for closed fracture - Fraktur tungkai bawah tidak spesifik, kunjungan awal', parent: 'S82' },
  { code: 'S83.90XA', title: 'Sprain of unspecified site of unspecified knee, initial encounter - Keseleo lutut tidak spesifik, kunjungan awal', parent: 'S83' },
  { code: 'S93.409A', title: 'Sprain of unspecified ligament of unspecified ankle, initial encounter - Keseleo pergelangan kaki tidak spesifik, kunjungan awal', parent: 'S93' },
  { code: 'T14.90XA', title: 'Injury, unspecified, initial encounter - Cedera tidak spesifik, kunjungan awal', parent: 'T14' },
];

const ICD_CODE_ALIASES: Record<string, string> = {
  E14: 'E13.9',
};

const DETAILED_PARENT_CODES = new Set([
  ...Object.keys(ICD_CODE_ALIASES),
  ...DETAILED_COMMON_ICD_CODES
    .map((code) => code.parent?.toUpperCase())
    .filter((code): code is string => Boolean(code)),
]);

const LOCAL_ICD_CODES: ICDCode[] = [
  ...DETAILED_COMMON_ICD_CODES,
  ...COMMON_ICD_CODES.filter((code) => !DETAILED_PARENT_CODES.has(code.code.toUpperCase())),
].reduce<ICDCode[]>((acc, code) => {
  const key = code.code.toUpperCase();
  if (!acc.some((item) => item.code.toUpperCase() === key)) {
    acc.push(code);
  }
  return acc;
}, []);

const ICD_CODE_COMPLETIONS = LOCAL_ICD_CODES.reduce<Record<string, ICDCode>>((acc, code) => {
  if (code.parent) {
    acc[code.parent.toUpperCase()] = code;
  }
  return acc;
}, {});

Object.entries(ICD_CODE_ALIASES).forEach(([alias, targetCode]) => {
  const target = LOCAL_ICD_CODES.find((code) => code.code.toUpperCase() === targetCode.toUpperCase());
  if (target) {
    ICD_CODE_COMPLETIONS[alias.toUpperCase()] = target;
  }
});

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

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function mergeUniqueICDCodes(codes: ICDCode[]): ICDCode[] {
  return codes.reduce<ICDCode[]>((acc, item) => {
    const key = item.code.toUpperCase();
    if (!acc.some((existing) => existing.code.toUpperCase() === key)) {
      acc.push(item);
    }
    return acc;
  }, []);
}

function normalizeDatasetItem(item: Partial<ICDCode>): ICDCode | null {
  const code = normalizeCode(item.code || '');
  if (!code) return null;

  const englishName = (item.englishName || item.title || '').trim();
  const namaIndonesia = (item.namaIndonesia || INDONESIAN_TRANSLATIONS[code] || '').trim();
  const baseTitle = item.title || englishName || namaIndonesia || code;

  return {
    ...item,
    code,
    title: addIndonesianTranslation(code, baseTitle),
    englishName: englishName || baseTitle,
    namaIndonesia: namaIndonesia || undefined,
  };
}

async function loadFullICDDataset(): Promise<ICDCode[]> {
  if (fullICDDatasetCache) return fullICDDatasetCache;

  if (typeof window === 'undefined') {
    return LOCAL_ICD_CODES;
  }

  if (!fullICDDatasetPromise) {
    fullICDDatasetPromise = fetch(ICD_DATASET_URL, { cache: 'force-cache' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const rawCodes = Array.isArray(payload) ? payload : payload.codes;

        if (!Array.isArray(rawCodes) || rawCodes.length === 0) {
          throw new Error('Invalid ICD dataset format');
        }

        const datasetCodes = rawCodes
          .map((item: Partial<ICDCode>) => normalizeDatasetItem(item))
          .filter((item: ICDCode | null): item is ICDCode => Boolean(item));

        fullICDDatasetCache = mergeUniqueICDCodes([...datasetCodes, ...LOCAL_ICD_CODES]);
        return fullICDDatasetCache;
      })
      .catch((error) => {
        console.error('Failed to load local ICD dataset:', error);
        fullICDDatasetCache = LOCAL_ICD_CODES;
        return fullICDDatasetCache;
      });
  }

  return fullICDDatasetPromise;
}

function searchCodesInDataset(codes: ICDCode[], query: string, limit = DEFAULT_RESULT_LIMIT): ICDSearchResult {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return {
      results: codes.slice(0, limit),
      total: codes.length,
    };
  }

  const matches = codes
    .map((icd) => {
      const code = icd.code.toLowerCase();
      const parent = icd.parent?.toLowerCase() || '';
      const title = icd.title.toLowerCase();
      const englishName = icd.englishName?.toLowerCase() || '';
      const namaIndonesia = icd.namaIndonesia?.toLowerCase() || '';

      const matched =
        code.includes(normalizedQuery) ||
        parent.includes(normalizedQuery) ||
        title.includes(normalizedQuery) ||
        englishName.includes(normalizedQuery) ||
        namaIndonesia.includes(normalizedQuery);

      if (!matched) return null;

      const rank =
        code === normalizedQuery ? 0 :
        code.startsWith(normalizedQuery) ? 1 :
        parent === normalizedQuery ? 2 :
        title.startsWith(normalizedQuery) || englishName.startsWith(normalizedQuery) || namaIndonesia.startsWith(normalizedQuery) ? 3 :
        4;

      return { icd, rank };
    })
    .filter((item): item is { icd: ICDCode; rank: number } => Boolean(item))
    .sort((a, b) => a.rank - b.rank || a.icd.code.localeCompare(b.icd.code, 'en'))
    .map((item) => item.icd);

  return {
    results: matches.slice(0, limit),
    total: matches.length,
  };
}

async function searchICDProxy(query: string, limit = DEFAULT_RESULT_LIMIT): Promise<ICDSearchResult | null> {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });
    const response = await fetch(`/api/icd/search?${params.toString()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as Partial<ICDSearchResult>;

    if (!Array.isArray(payload.results)) {
      return null;
    }

    const results = normalizeResults(payload.results);

    return {
      results,
      total: typeof payload.total === 'number' ? payload.total : results.length,
    };
  } catch (error) {
      assertCaughtError(error);
    console.error('Failed to fetch ICD from local proxy:', error);
    return null;
  }
}

function completeICDCode(code: string): ICDCode | null {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  const completed = ICD_CODE_COMPLETIONS[normalized];
  if (completed) return completed;

  return LOCAL_ICD_CODES.find((item) => item.code.toUpperCase() === normalized) || null;
}

function normalizeResults(codes: ICDCode[]): ICDCode[] {
  const normalizedCodes = codes.map((item) => {
    const completed = completeICDCode(item.code);
    if (completed && completed.code.toUpperCase() !== item.code.toUpperCase()) {
      return completed;
    }

    return {
      ...item,
      code: normalizeCode(item.code),
      title: addIndonesianTranslation(item.code, item.title),
    };
  });

  return normalizedCodes.reduce<ICDCode[]>((acc, item) => {
    if (!acc.some((existing) => existing.code.toUpperCase() === item.code.toUpperCase())) {
      acc.push(item);
    }
    return acc;
  }, []);
}

export const icdApi = {
  completeICDCode: (code: string): string => {
    const completed = completeICDCode(code);
    return completed?.code || normalizeCode(code);
  },

  getICDByCode: async (code: string): Promise<ICDCode | null> => {
    const normalized = normalizeCode(code);
    if (!normalized) return null;

    const local = completeICDCode(normalized);
    if (local) return local;

    try {
      const dataset = await loadFullICDDataset();
      const datasetMatch = dataset.find(
        (item) =>
          item.code.toUpperCase() === normalized ||
          item.parent?.toUpperCase() === normalized
      );

      if (datasetMatch) return datasetMatch;

      const results = await icdApi.searchICD(normalized);
      return (
        results.find((item) => item.code.toUpperCase() === normalized) ||
        results.find((item) => item.parent?.toUpperCase() === normalized) ||
        null
      );
    } catch (error) {
      assertCaughtError(error);
      console.error('Failed to fetch ICD by code:', error);
      return null;
    }
  },

  searchICDWithTotal: async (query: string, limit = DEFAULT_RESULT_LIMIT): Promise<ICDSearchResult> => {
    const normalizedQuery = query.trim();
    const proxied = await searchICDProxy(normalizedQuery, limit);

    if (proxied) {
      return proxied;
    }

    const dataset = await loadFullICDDataset();
    const localResult = searchCodesInDataset(dataset, normalizedQuery, limit);

    if (localResult.total > 0 || normalizedQuery.length < 2) {
      return localResult;
    }

    const cacheKey = `clinical:${normalizedQuery.toLowerCase()}:${limit}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    try {
      // ClinicalTables remains a fallback for ICD-10-CM codes that are not in the WHO ICD-10 list.
      const response = await axios.get(CLINICAL_TABLES_API, {
        params: {
          sf: 'code,name',
          terms: normalizedQuery,
          maxList: limit,
        },
        timeout: 5000,
      });

      const [totalCount, results] = response.data;

      if (!results || !Array.isArray(results)) {
        throw new Error('Invalid API response format');
      }

      const codes: ICDCode[] = normalizeResults(results.map(([code, title]: [string, string]) => ({
        code,
        title: addIndonesianTranslation(code, title),
        englishName: title,
      })));
      const data = {
        results: codes.slice(0, limit),
        total: typeof totalCount === 'number' ? totalCount : codes.length,
      };

      searchCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      assertCaughtError(error);
      console.error('Failed to fetch from Clinicaltables API:', error);
      return searchCodesInDataset(LOCAL_ICD_CODES, normalizedQuery, limit);
    }
  },

  // Search ICD codes from the local WHO dataset, with ClinicalTables as fallback.
  searchICD: async (query: string): Promise<ICDCode[]> => {
    const { results } = await icdApi.searchICDWithTotal(query);
    return results;
  },

  // Get all ICD codes from the local WHO dataset.
  getCommonICDCodes: async (): Promise<ICDCode[]> => {
    return loadFullICDDataset();
  },

  // Get ICD codes by category using Clinicaltables API
  getICDByCategory: async (category: string): Promise<ICDCode[]> => {
    // Map category to search terms
    const categorySearchTerms: Record<string, string> = {
      STROKE: 'stroke cerebrovascular infarction',
      JANTUNG_KARDIOVASKULAR: 'cardiovascular heart cardiac coronary',
      SINDROM_METABOLIK: 'metabolic syndrome obesity insulin resistance dyslipidemia',
      KANKER: 'cancer malignant neoplasm oncology tumor',
      DEGENERATIF: 'degenerative disease osteoarthritis dementia degeneration',
      AUTO_IMUN: 'autoimmune lupus rheumatoid immune',
      ONKOLOGI: 'cancer malignant neoplasm oncology tumor',
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
      const dataset = await loadFullICDDataset();
      return dataset.slice(0, DEFAULT_RESULT_LIMIT);
    }

    try {
      // Use the main search function
      return await icdApi.searchICD(searchTerm);
    } catch (error) {
      assertCaughtError(error);
      console.error('Failed to fetch ICD by category:', error);
      
      // Fallback to local codes
      const categoryMap: Record<string, string[]> = {
        STROKE: ['I60.9', 'I61.9', 'I63.9', 'I64', 'G45.9'],
        JANTUNG_KARDIOVASKULAR: ['I10', 'I11.9', 'I20.9', 'I21.9', 'I25.10', 'I50.9'],
        SINDROM_METABOLIK: ['E66.9', 'E78.5', 'E88.81', 'I10', 'E11.9'],
        KANKER: ['C50.919', 'C61', 'C18.9', 'C34.90', 'C16.9', 'C22.9'],
        DEGENERATIF: ['M15.9', 'M17.9', 'M19.90', 'G30.9', 'G31.9', 'M47.9'],
        AUTO_IMUN: ['M05.9', 'M06.9', 'M32.9', 'M35.9', 'K50.90', 'K51.90'],
        ONKOLOGI: ['C50.919', 'C61', 'C18.9', 'C34.90', 'C16.9', 'C22.9'],
        HIPERTENSI: ['I10', 'I11.9', 'I12.9', 'I13.10', 'I15.9'],
        DIABETES: ['E10.9', 'E11.9', 'E13.9'],
        NEUROLOGI: ['G40.909', 'G43.909', 'G44.209', 'G45.9', 'G47.9', 'G50.9', 'G51.0', 'G56.00', 'G62.9'],
        KARDIOVASKULAR: ['I10', 'I11.9', 'I20.9', 'I21.9', 'I25.10', 'I50.9'],
        ORTOPEDI: ['M15.9', 'M16.9', 'M17.9', 'M19.90', 'M25.50', 'M47.9', 'M48.00', 'M50.90', 'M51.9', 'M54.50', 'M79.10'],
        HEMATOLOGI: ['D50.9', 'D51.9', 'D52.9', 'D64.9', 'D68.9', 'D69.6'],
      };

      const codes = categoryMap[category] || [];
      return LOCAL_ICD_CODES.filter((icd) => codes.includes(icd.code));
    }
  },

  // Clear cache (useful for testing or when needed)
  clearCache: () => {
    searchCache.clear();
  },
};
