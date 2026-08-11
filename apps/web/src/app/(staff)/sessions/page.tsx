'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { sessionApi } from '@/lib/sessionApi';
import { confirm, showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { branchesApi } from '@/lib/api/branchesApi';
import { api } from '@/lib/api';
import type { SessionDetail } from '@/types/session';
import styles from './page.module.css';
import { devError } from '@/lib/logger';
import { PageLoading } from '@/components/ui/LoadingSpinner';

// Types for filter options
interface Branch {
  id: string;
  name: string;
  branchCode: string;
}

interface Staff {
  id: string;
  fullName: string;
  role: string;
}

interface DiagnosisCategoryOption {
  id: string;
  name: string;
}

type MultiFilterKey = 'branchIds' | 'diagnosisCategories' | 'doctorIds' | 'nurseIds';

interface SessionFilters {
  status: 'all' | 'completed' | 'incomplete';
  branchIds: string[];
  diagnosisCategories: string[];
  doctorIds: string[];
  nurseIds: string[];
  dateFrom: string;
  dateTo: string;
  pelaksanaan: 'all' | 'ON_SITE' | 'HOME_CARE';
}

interface StaffOptionResponse {
  id?: string;
  userId?: string;
  fullName?: string;
  email?: string;
  staffCode?: string;
  role?: string;
  profile?: {
    fullName?: string;
  };
}

const normalizeStaffOption = (staff: StaffOptionResponse): Staff | null => {
  const id = staff.userId || staff.id;

  if (!id) return null;

  return {
    id,
    fullName: staff.fullName || staff.profile?.fullName || staff.email || staff.staffCode || 'Tanpa Nama',
    role: staff.role || '',
  };
};

const getSelectedFilterLabel = (
  selectedIds: string[],
  options: Array<{ id: string; fullName?: string; name?: string }>,
  emptyLabel: string,
) => {
  if (selectedIds.length === 0) return emptyLabel;
  if (selectedIds.length === 1) {
    const selected = options.find((option) => option.id === selectedIds[0]);
    return selected?.fullName || selected?.name || '1 dipilih';
  }

  return `${selectedIds.length} dipilih`;
};

const DIAGNOSIS_CATEGORY_OPTIONS = [
  { id: 'HIPERTENSI', name: 'Hipertensi' },
  { id: 'NEUROLOGI', name: 'Neurologi' },
  { id: 'DIABETES', name: 'Diabetes' },
  { id: 'KARDIOVASKULAR', name: 'Kardiovaskular' },
  { id: 'ORTOPEDI', name: 'Ortopedi' },
  { id: 'IMUNOLOGI', name: 'Imunologi' },
  { id: 'HEMATOLOGI', name: 'Hematologi' },
  { id: 'STROKE', name: 'Stroke' },
  { id: 'JANTUNG_KARDIOVASKULAR', name: 'Jantung & Kardiovaskular' },
  { id: 'SINDROM_METABOLIK', name: 'Sindrom Metabolik' },
  { id: 'KANKER', name: 'Kanker' },
  { id: 'DEGENERATIF', name: 'Degeneratif' },
  { id: 'AUTO_IMUN', name: 'Auto Imun' },
  { id: 'ONKOLOGI', name: 'Onkologi' },
  { id: 'LAINNYA', name: 'Lainnya' },
];

const matchesSearchQuery = (value: string, query: string) => {
  if (!query.trim()) return true;
  return value.toLocaleLowerCase('id-ID').includes(query.trim().toLocaleLowerCase('id-ID'));
};

const handleSearchInputClick = (event: React.MouseEvent<HTMLInputElement>) => {
  event.stopPropagation();
};

const handleSearchInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
  event.stopPropagation();
};

const TABLE_COLUMNS_STORAGE_VERSION = 2;

const DEFAULT_TABLE_FIELDS: Record<string, boolean> = {
  memberName: true,
  infusKe: true,
  status: true,
  treatmentDate: true,
  treatmentTime: true,
  pelaksanaan: true,
  sessionCode: false,
  memberNo: false,
  doctorName: true,
  doctorEvaluationStatus: true,
  nurseName: true,
  branchName: false,
  branchCode: false,
  boosterType: false,
  adminLayanan: true,
  allDoctors: false,
  allNurses: false,
  sistolBefore: true,
  diastolBefore: true,
  hrBefore: true,
  saturasiBefore: true,
  piBefore: false,
  sistolAfter: true,
  diastolAfter: true,
  hrAfter: true,
  saturasiAfter: true,
  piAfter: false,
  planIfa: false,
  planHho: false,
  planHhoKonsentrat: false,
  planH2: false,
  planNo: false,
  planGaso: false,
  planO2: false,
  planO3: false,
  planEdta: false,
  planMb: false,
  planH2s: false,
  planKcl: false,
  planJmlNb: false,
  planKeterangan: false,
  aktualIfa: false,
  aktualHho: false,
  aktualHhoKonsentrat: false,
  aktualH2: false,
  aktualNo: false,
  aktualGaso: false,
  aktualO2: false,
  aktualO3: false,
  aktualEdta: false,
  aktualMb: false,
  aktualH2s: false,
  aktualKcl: false,
  aktualJmlNb: false,
  bottleType: false,
  jenisCairan: false,
  volumeCarrier: false,
  jumlahJarum: false,
  deviationNotes: false,
  materialsSummary: false,
  keluhan: false,
  rekomendasi: false,
  subjective: false,
  objective: false,
  assessment: false,
  plan: false,
  generalNotes: false,
};

const COMPACT_TABLE_FIELDS = new Set(['memberName', 'infusKe', 'status', 'treatmentDate', 'treatmentTime']);

const getTableColumnsStorageKey = (userId: string) => `raho:sessions:table-columns:v${TABLE_COLUMNS_STORAGE_VERSION}:${userId}`;

const mergeTableFieldsWithDefault = (savedFields: unknown) => {
  const merged = { ...DEFAULT_TABLE_FIELDS };

  if (savedFields && typeof savedFields === 'object') {
    Object.keys(merged).forEach((key) => {
      const savedValue = (savedFields as Record<string, unknown>)[key];
      if (typeof savedValue === 'boolean') {
        merged[key] = savedValue;
      }
    });
  }

  return Object.values(merged).some(Boolean) ? merged : { ...DEFAULT_TABLE_FIELDS };
};

export default function SessionsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [showTableColumns, setShowTableColumns] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Staff[]>([]);
  const [nurses, setNurses] = useState<Staff[]>([]);
  
  const [filters, setFilters] = useState<SessionFilters>({
    status: 'all' as 'all' | 'completed' | 'incomplete',
    branchIds: [] as string[],
    diagnosisCategories: [] as string[],
    doctorIds: [] as string[],
    nurseIds: [] as string[],
    dateFrom: '',
    dateTo: '',
    pelaksanaan: 'all' as 'all' | 'ON_SITE' | 'HOME_CARE',
  });

  // Collapsible state for filter sections
  const [branchFilterExpanded, setBranchFilterExpanded] = useState(false);
  const [diagnosisFilterExpanded, setDiagnosisFilterExpanded] = useState(false);
  const [doctorFilterExpanded, setDoctorFilterExpanded] = useState(false);
  const [nurseFilterExpanded, setNurseFilterExpanded] = useState(false);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const [diagnosisSearchQuery, setDiagnosisSearchQuery] = useState('');
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  const [nurseSearchQuery, setNurseSearchQuery] = useState('');

  // Export modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  
  // Detailed field selection like Odoo
  const [exportFields, setExportFields] = useState({
    // Basic Info
    sessionCode: true,
    treatmentDate: true,
    treatmentTime: true,
    status: true,
    pelaksanaan: true,
    infusKe: true,
    branchName: true,
    branchCode: false,
    boosterType: false,
    
    // Member Info
    memberNo: true,
    memberName: true,
    memberPhone: false,
    memberEmail: false,
    packageCode: false,
    
    // Staff Info
    adminLayanan: true,
    doctorName: true,
    doctorCode: false,
    nurseName: true,
    nurseCode: false,
    allDoctors: false,
    allNurses: false,
    
    // Vital Signs Before
    sistolBefore: false,
    diastolBefore: false,
    hrBefore: false,
    saturasiBefore: false,
    piBefore: false,
    
    // Vital Signs After
    sistolAfter: false,
    diastolAfter: false,
    hrAfter: false,
    saturasiAfter: false,
    piAfter: false,
    
    // Therapy Plan
    planIfa: false,
    planHho: false,
    planHhoKonsentrat: false,
    planH2: false,
    planNo: false,
    planGaso: false,
    planO2: false,
    planO3: false,
    planEdta: false,
    planMb: false,
    planH2s: false,
    planKcl: false,
    planJmlNb: false,
    planKeterangan: false,
    
    // Infusion Actual
    aktualIfa: false,
    aktualHho: false,
    aktualHhoKonsentrat: false,
    aktualH2: false,
    aktualNo: false,
    aktualGaso: false,
    aktualO2: false,
    aktualO3: false,
    aktualEdta: false,
    aktualMb: false,
    aktualH2s: false,
    aktualKcl: false,
    aktualJmlNb: false,
    bottleType: false,
    jenisCairan: false,
    volumeCarrier: false,
    jumlahJarum: false,
    deviationNotes: false,
    
    // Materials
    materialsSummary: false,
    
    // Evaluation (SOAP)
    keluhan: false,
    rekomendasi: false,
    subjective: false,
    objective: false,
    assessment: false,
    plan: false,
    generalNotes: false,
  });

  const [tableFields, setTableFields] = useState<Record<string, boolean>>({ ...DEFAULT_TABLE_FIELDS });
  const canDeleteSessions = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';

  // Field categories for UI grouping
  const fieldCategories = [
    {
      id: 'basic',
      label: 'Info Dasar',
      icon: '📋',
      fields: [
        { key: 'sessionCode', label: 'Kode Sesi' },
        { key: 'treatmentDate', label: 'Tanggal Terapi' },
        { key: 'treatmentTime', label: 'Waktu Terapi' },
        { key: 'status', label: 'Status' },
        { key: 'pelaksanaan', label: 'Tipe Pelaksanaan' },
        { key: 'infusKe', label: 'Infus Ke' },
        { key: 'branchName', label: 'Nama Cabang' },
        { key: 'branchCode', label: 'Kode Cabang' },
        { key: 'boosterType', label: 'Tipe Booster' },
      ],
    },
    {
      id: 'member',
      label: 'Info Member',
      icon: '👤',
      fields: [
        { key: 'memberNo', label: 'No. Member' },
        { key: 'memberName', label: 'Nama Member' },
        { key: 'memberPhone', label: 'Telepon Member' },
        { key: 'memberEmail', label: 'Username Member' },
        { key: 'packageCode', label: 'Kode Paket' },
      ],
    },
    {
      id: 'staff',
      label: 'Info Staff',
      icon: '👨‍⚕️',
      fields: [
        { key: 'adminLayanan', label: 'Admin Layanan' },
        { key: 'doctorName', label: 'Nama Dokter Utama' },
        { key: 'doctorEvaluationStatus', label: 'Status Evaluasi Dokter' },
        { key: 'doctorCode', label: 'Kode Dokter' },
        { key: 'nurseName', label: 'Nama Nakes' },
        { key: 'nurseCode', label: 'Kode Nakes' },
        { key: 'allDoctors', label: 'Semua Dokter' },
        { key: 'allNurses', label: 'Semua Nakes' },
      ],
    },
    {
      id: 'vitalBefore',
      label: 'Vital Sebelum',
      icon: '❤️',
      fields: [
        { key: 'sistolBefore', label: 'Sistol' },
        { key: 'diastolBefore', label: 'Diastol' },
        { key: 'hrBefore', label: 'Heart Rate' },
        { key: 'saturasiBefore', label: 'Saturasi O2' },
        { key: 'piBefore', label: 'PI' },
      ],
    },
    {
      id: 'vitalAfter',
      label: 'Vital Sesudah',
      icon: '💚',
      fields: [
        { key: 'sistolAfter', label: 'Sistol' },
        { key: 'diastolAfter', label: 'Diastol' },
        { key: 'hrAfter', label: 'Heart Rate' },
        { key: 'saturasiAfter', label: 'Saturasi O2' },
        { key: 'piAfter', label: 'PI' },
      ],
    },
    {
      id: 'therapyPlan',
      label: 'Rencana Terapi',
      icon: '📝',
      fields: [
        { key: 'planIfa', label: 'IFA' },
        { key: 'planHho', label: 'HHO' },
        { key: 'planHhoKonsentrat', label: 'HHO Kons.' },
        { key: 'planH2', label: 'H2' },
        { key: 'planNo', label: 'NO' },
        { key: 'planGaso', label: 'GASO' },
        { key: 'planO2', label: 'O2' },
        { key: 'planO3', label: 'O3' },
        { key: 'planEdta', label: 'EDTA' },
        { key: 'planMb', label: 'MB' },
        { key: 'planH2s', label: 'H2S' },
        { key: 'planKcl', label: 'KCL' },
        { key: 'planJmlNb', label: 'JML NB' },
        { key: 'planKeterangan', label: 'Keterangan' },
      ],
    },
    {
      id: 'infusion',
      label: 'Infus Aktual',
      icon: '💉',
      fields: [
        { key: 'aktualIfa', label: 'IFA' },
        { key: 'aktualHho', label: 'HHO' },
        { key: 'aktualHhoKonsentrat', label: 'HHO Kons.' },
        { key: 'aktualH2', label: 'H2' },
        { key: 'aktualNo', label: 'NO' },
        { key: 'aktualGaso', label: 'GASO' },
        { key: 'aktualO2', label: 'O2' },
        { key: 'aktualO3', label: 'O3' },
        { key: 'aktualEdta', label: 'EDTA' },
        { key: 'aktualMb', label: 'MB' },
        { key: 'aktualH2s', label: 'H2S' },
        { key: 'aktualKcl', label: 'KCL' },
        { key: 'aktualJmlNb', label: 'JML NB' },
        { key: 'bottleType', label: 'Jenis Botol' },
        { key: 'jenisCairan', label: 'Jenis Cairan' },
        { key: 'volumeCarrier', label: 'Volume Carrier' },
        { key: 'jumlahJarum', label: 'Jumlah Jarum' },
        { key: 'deviationNotes', label: 'Catatan Deviasi' },
      ],
    },
    {
      id: 'materials',
      label: 'Material',
      icon: '📦',
      fields: [
        { key: 'materialsSummary', label: 'Ringkasan Material' },
      ],
    },
    {
      id: 'evaluation',
      label: 'Evaluasi Dokter',
      icon: '📄',
      fields: [
        { key: 'keluhan', label: 'Keluhan' },
        { key: 'rekomendasi', label: 'Rekomendasi' },
        { key: 'subjective', label: 'Subjective' },
        { key: 'objective', label: 'Objective' },
        { key: 'assessment', label: 'Assessment' },
        { key: 'plan', label: 'Plan' },
        { key: 'generalNotes', label: 'Catatan Umum' },
      ],
    },
  ];

  // Expanded categories state
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['basic', 'member']);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleAllInCategory = (categoryId: string, checked: boolean) => {
    const category = fieldCategories.find(c => c.id === categoryId);
    if (category) {
      const updates: Partial<typeof exportFields> = {};
      category.fields.forEach(field => {
        updates[field.key as keyof typeof exportFields] = checked;
      });
      setExportFields(prev => ({ ...prev, ...updates }));
    }
  };

  const isCategoryFullySelected = (categoryId: string) => {
    const category = fieldCategories.find(c => c.id === categoryId);
    if (!category) return false;
    return category.fields.every(field => exportFields[field.key as keyof typeof exportFields]);
  };

  const isCategoryPartiallySelected = (categoryId: string) => {
    const category = fieldCategories.find(c => c.id === categoryId);
    if (!category) return false;
    const selectedCount = category.fields.filter(field => exportFields[field.key as keyof typeof exportFields]).length;
    return selectedCount > 0 && selectedCount < category.fields.length;
  };

  const selectAllFields = () => {
    const allTrue = Object.fromEntries(
      Object.keys(exportFields).map((key) => [key, true])
    ) as typeof exportFields;
    setExportFields(allTrue);
  };

  const deselectAllFields = () => {
    const allFalse = Object.fromEntries(
      Object.keys(exportFields).map((key) => [key, false])
    ) as typeof exportFields;
    setExportFields(allFalse);
  };

  const getSelectedFieldCount = () => {
    return Object.values(exportFields).filter(v => v).length;
  };

  const tableFieldLabelByKey = fieldCategories.reduce<Record<string, string>>((acc, category) => {
    category.fields.forEach((field) => {
      acc[field.key] = field.label;
    });
    return acc;
  }, {});

  const tableFieldCategoryByKey = fieldCategories.reduce<Record<string, { id: string; label: string }>>((acc, category) => {
    category.fields.forEach((field) => {
      acc[field.key] = { id: category.id, label: category.label };
    });
    return acc;
  }, {});

  const visibleTableFieldKeys = Object.entries(tableFields)
    .filter(([, visible]) => visible)
    .map(([key]) => key);

  const groupedTableHeaders = visibleTableFieldKeys.reduce<Array<{ id: string; label: string; colSpan: number }>>((groups, key) => {
    const category = tableFieldCategoryByKey[key] || { id: 'other', label: 'Lainnya' };
    const previousGroup = groups[groups.length - 1];

    if (previousGroup?.id === category.id) {
      previousGroup.colSpan += 1;
      return groups;
    }

    groups.push({
      id: category.id,
      label: category.label,
      colSpan: 1,
    });

    return groups;
  }, []);

  const metricFieldKeys = new Set([
    'sistolBefore',
    'diastolBefore',
    'hrBefore',
    'saturasiBefore',
    'piBefore',
    'sistolAfter',
    'diastolAfter',
    'hrAfter',
    'saturasiAfter',
    'piAfter',
    'planIfa',
    'planHho',
    'planHhoKonsentrat',
    'planH2',
    'planNo',
    'planGaso',
    'planO2',
    'planO3',
    'planEdta',
    'planMb',
    'planH2s',
    'planKcl',
    'planJmlNb',
    'aktualIfa',
    'aktualHho',
    'aktualHhoKonsentrat',
    'aktualH2',
    'aktualNo',
    'aktualGaso',
    'aktualO2',
    'aktualO3',
    'aktualEdta',
    'aktualMb',
    'aktualH2s',
    'aktualKcl',
    'aktualJmlNb',
    'bottleType',
    'jenisCairan',
    'volumeCarrier',
    'jumlahJarum',
  ]);

  const longTextFieldKeys = new Set([
    'planKeterangan',
    'deviationNotes',
    'materialsSummary',
    'keluhan',
    'rekomendasi',
    'subjective',
    'objective',
    'assessment',
    'plan',
    'generalNotes',
  ]);

  const getTableCellClass = (key: string, index: number) => {
    const classes = [styles.dynamicCell];

    if (index === 0) classes.push(styles.firstDataCell);
    if (key === 'sessionCode') classes.push(styles.sessionCodeCell);
    if (key === 'status') classes.push(styles.statusCell);
    if (key === 'memberName') classes.push(styles.memberDataCell);
    if (key === 'memberNo') classes.push(styles.memberNoCell);
    if (key === 'treatmentDate') classes.push(styles.dateCell);
    if (key === 'treatmentTime') classes.push(styles.timeCell);
    if (key === 'pelaksanaan') classes.push(styles.typeCell);
    if (key === 'infusKe') classes.push(styles.sessionNumberCell);
    if (['adminLayanan', 'doctorName', 'nurseName', 'allDoctors', 'allNurses'].includes(key)) {
      classes.push(styles.staffCell);
    }
    if (key === 'doctorEvaluationStatus') classes.push(styles.statusCell);
    if (['branchName', 'branchCode', 'boosterType'].includes(key)) {
      classes.push(styles.branchCell);
    }
    if (metricFieldKeys.has(key)) classes.push(styles.metricCell);
    if (longTextFieldKeys.has(key)) classes.push(styles.longTextCell);

    return classes.filter(Boolean).join(' ');
  };

  const getSelectedTableFieldCount = () => Object.values(tableFields).filter(Boolean).length;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!user?.userId) {
      setTableFields({ ...DEFAULT_TABLE_FIELDS });
      return;
    }

    const storageKey = getTableColumnsStorageKey(user.userId);
    const savedPreference = localStorage.getItem(storageKey);

    if (!savedPreference) {
      setTableFields({ ...DEFAULT_TABLE_FIELDS });
      return;
    }

    try {
      const parsed = JSON.parse(savedPreference) as { fields?: Record<string, boolean> };
      setTableFields(mergeTableFieldsWithDefault(parsed.fields));
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to load saved session table columns:', error);
      localStorage.removeItem(storageKey);
      setTableFields({ ...DEFAULT_TABLE_FIELDS });
    }
  }, [user?.userId]);

  const saveTableColumnsDefault = () => {
    if (typeof window === 'undefined') return;

    if (!user?.userId) {
      showToast.error('Akun belum terbaca. Silakan login ulang.');
      return;
    }

    if (!Object.values(tableFields).some(Boolean)) {
      showToast.error('Pilih minimal satu kolom untuk disimpan.');
      return;
    }

    localStorage.setItem(
      getTableColumnsStorageKey(user.userId),
      JSON.stringify({
        version: TABLE_COLUMNS_STORAGE_VERSION,
        fields: tableFields,
        savedAt: new Date().toISOString(),
      }),
    );

    showToast.success('Default kolom sesi terapi disimpan untuk akun ini.');
  };

  const resetTableColumnsDefault = () => {
    if (typeof window !== 'undefined' && user?.userId) {
      localStorage.removeItem(getTableColumnsStorageKey(user.userId));
    }

    setTableFields({ ...DEFAULT_TABLE_FIELDS });
    showToast.success('Default kolom sesi terapi dikembalikan.');
  };

  const toggleTableCategory = (categoryId: string, checked: boolean) => {
    const category = fieldCategories.find(c => c.id === categoryId);
    if (!category) return;

    const updates: Record<string, boolean> = {};
    category.fields.forEach((field) => {
      if (field.key in tableFields) {
        updates[field.key] = checked;
      }
    });
    setTableFields(prev => ({ ...prev, ...updates }));
  };

  const getVitalValue = (sessionDetail: SessionDetail, pencatatan: string, waktuCatat: 'SEBELUM' | 'SESUDAH') => {
    const vital = sessionDetail.vitalSigns?.find((item) => (
      item.pencatatan === pencatatan && item.waktuCatat === waktuCatat
    ));
    return vital ? `${vital.value}${vital.unit ? ` ${vital.unit}` : ''}` : '-';
  };

  const formatDose = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number(value) === 0) return '-';
    return String(value);
  };

  const renderStaffList = (
    staff: Array<{ isPrimary?: boolean; fullName: string; staffCode?: string | null }>,
    fallback?: string,
    showEvaluationWarning = false,
  ) => {
    const staffList = staff.filter((item) => item.fullName?.trim());

    if (staffList.length === 0) {
      return (
        <div className={styles.staffStack}>
          <span className={styles.staffName}>{fallback || '-'}</span>
          {showEvaluationWarning && <span className={styles.doctorWarningBadge}>Evaluasi belum diisi</span>}
        </div>
      );
    }

    return (
      <div className={styles.staffStack}>
        <div className={styles.staffList}>
          {staffList.map((item, index) => (
            <span
              key={`${item.fullName}-${item.staffCode || index}`}
              className={`${styles.staffPill} ${item.isPrimary ? styles.primaryStaffPill : ''}`}
              title={item.staffCode || undefined}
            >
              {item.fullName}
              {item.isPrimary && <span className={styles.primaryStaffMark}>Utama</span>}
            </span>
          ))}
        </div>
        {showEvaluationWarning && <span className={styles.doctorWarningBadge}>Evaluasi belum diisi</span>}
      </div>
    );
  };

  const getTableFieldValue = (sessionDetail: SessionDetail, key: string) => {
    const session = sessionDetail.session;
    const planData = sessionDetail.therapyPlan;
    const infusion = sessionDetail.infusion;

    const valueMap: Record<string, () => ReactNode> = {
      sessionCode: () => (
        <div className={styles.sessionCodeStack}>
          <span className={styles.sessionCode}>{session.sessionCode}</span>
          {session.boosterPackage?.boosterType && (
            <span className={styles.boosterTag}>{session.boosterPackage.boosterType}</span>
          )}
        </div>
      ),
      status: () => (
        <span className={`${styles.statusBadge} ${session.isCompleted ? styles.statusCompleted : styles.statusIncomplete}`}>
          {session.isCompleted ? 'Selesai' : 'Belum Selesai'}
        </span>
      ),
      memberName: () => (
        <div className={styles.memberCell}>
          <div className={styles.memberName}>{session.member.fullName}</div>
          <div className={styles.memberNo}>{session.member.memberNo}</div>
        </div>
      ),
      memberNo: () => session.member.memberNo,
      treatmentDate: () => <span className={styles.dateValue}>{formatDate(session.treatmentDate)}</span>,
      treatmentTime: () => <span className={styles.timeValue}>{formatTime(session.treatmentDate)}</span>,
      pelaksanaan: () => (
        <span className={`${styles.typeBadge} ${session.pelaksanaan === 'ON_SITE' ? styles.typeOnSite : styles.typeHomeCare}`}>
          {session.pelaksanaan === 'ON_SITE' ? 'On-Site' : 'Home Care'}
        </span>
      ),
      infusKe: () => (
        <div>
          <div className={styles.sessionGlobal}>#{session.infusKe}</div>
          {session.branchInfusKe && session.branchInfusKe !== session.infusKe && (
            <div className={styles.sessionBranch}>Cabang #{session.branchInfusKe}</div>
          )}
        </div>
      ),
      branchName: () => <span className={styles.secondaryText}>{session.branchName || '-'}</span>,
      branchCode: () => <span className={styles.monoText}>{session.branchCode || '-'}</span>,
      boosterType: () => session.boosterPackage?.boosterType ? <span className={styles.boosterTag}>{session.boosterPackage.boosterType}</span> : '-',
      adminLayanan: () => <span className={styles.staffName}>{session.adminLayanan?.fullName || '-'}</span>,
      doctorName: () => (
        <div className={styles.staffStack}>
          <span className={styles.staffName}>{session.doctor?.fullName || '-'}</span>
          {!session.doctorEvaluationCompleted && (
            <span className={styles.doctorWarningBadge}>Evaluasi belum diisi</span>
          )}
        </div>
      ),
      doctorEvaluationStatus: () => (
        <span className={`${styles.statusBadge} ${session.doctorEvaluationCompleted ? styles.statusCompleted : styles.statusWarning}`}>
          {session.doctorEvaluationCompleted ? 'Sudah diisi' : 'Belum diisi'}
        </span>
      ),
      nurseName: () => renderStaffList(
        session.sessionNurses?.map((item) => ({
          isPrimary: item.isPrimary,
          fullName: item.nurse.fullName,
          staffCode: item.nurse.staffCode,
        })) || [],
        session.nurse?.fullName,
      ),
      allDoctors: () => renderStaffList(
        session.sessionDoctors?.map((item) => ({
          isPrimary: item.isPrimary,
          fullName: item.doctor.fullName,
          staffCode: item.doctor.staffCode,
        })) || [],
        session.doctor?.fullName,
        !session.doctorEvaluationCompleted,
      ),
      allNurses: () => renderStaffList(
        session.sessionNurses?.map((item) => ({
          isPrimary: item.isPrimary,
          fullName: item.nurse.fullName,
          staffCode: item.nurse.staffCode,
        })) || [],
        session.nurse?.fullName,
      ),
      sistolBefore: () => getVitalValue(sessionDetail, 'SISTOL', 'SEBELUM'),
      diastolBefore: () => getVitalValue(sessionDetail, 'DIASTOL', 'SEBELUM'),
      hrBefore: () => getVitalValue(sessionDetail, 'HR', 'SEBELUM'),
      saturasiBefore: () => getVitalValue(sessionDetail, 'SATURASI', 'SEBELUM'),
      piBefore: () => getVitalValue(sessionDetail, 'PI', 'SEBELUM'),
      sistolAfter: () => getVitalValue(sessionDetail, 'SISTOL', 'SESUDAH'),
      diastolAfter: () => getVitalValue(sessionDetail, 'DIASTOL', 'SESUDAH'),
      hrAfter: () => getVitalValue(sessionDetail, 'HR', 'SESUDAH'),
      saturasiAfter: () => getVitalValue(sessionDetail, 'SATURASI', 'SESUDAH'),
      piAfter: () => getVitalValue(sessionDetail, 'PI', 'SESUDAH'),
      planIfa: () => [planData?.ifa250 ? `${planData.ifa250} IFA250` : '', planData?.ifa500 ? `${planData.ifa500} IFA500` : ''].filter(Boolean).join(' / ') || '-',
      planHho: () => formatDose(planData?.hho),
      planHhoKonsentrat: () => formatDose(planData?.hhoKonsentrat),
      planH2: () => formatDose(planData?.h2),
      planNo: () => formatDose(planData?.no),
      planGaso: () => formatDose(planData?.gaso),
      planO2: () => formatDose(planData?.o2),
      planO3: () => formatDose(planData?.o3),
      planEdta: () => formatDose(planData?.edta),
      planMb: () => formatDose(planData?.mb),
      planH2s: () => formatDose(planData?.h2s),
      planKcl: () => formatDose(planData?.kcl),
      planJmlNb: () => formatDose(planData?.jmlNb),
      planKeterangan: () => planData?.keterangan || '-',
      aktualIfa: () => [infusion?.ifa250 ? `${infusion.ifa250} IFA250` : '', infusion?.ifa500 ? `${infusion.ifa500} IFA500` : ''].filter(Boolean).join(' / ') || '-',
      aktualHho: () => formatDose(infusion?.hho),
      aktualHhoKonsentrat: () => formatDose(infusion?.hhoKonsentrat),
      aktualH2: () => formatDose(infusion?.h2),
      aktualNo: () => formatDose(infusion?.no),
      aktualGaso: () => formatDose(infusion?.gaso),
      aktualO2: () => formatDose(infusion?.o2),
      aktualO3: () => formatDose(infusion?.o3),
      aktualEdta: () => formatDose(infusion?.edta),
      aktualMb: () => formatDose(infusion?.mb),
      aktualH2s: () => formatDose(infusion?.h2s),
      aktualKcl: () => formatDose(infusion?.kcl),
      aktualJmlNb: () => formatDose(infusion?.jmlNb),
      bottleType: () => infusion?.bottleType || '-',
      jenisCairan: () => infusion?.jenisCairan || '-',
      volumeCarrier: () => formatDose(infusion?.volumeCarrier),
      jumlahJarum: () => formatDose(infusion?.jumlahJarum),
      deviationNotes: () => infusion?.deviationNotes || '-',
      materialsSummary: () => sessionDetail.materials?.length
        ? sessionDetail.materials.map((item) => `${item.inventoryItem?.masterProduct?.name || 'Material'}: ${item.quantity} ${item.unit || ''}`).join('; ')
        : '-',
      keluhan: () => sessionDetail.evaluation?.keluhan || '-',
      rekomendasi: () => sessionDetail.evaluation?.rekomendasi || '-',
      subjective: () => sessionDetail.evaluation?.subjective || '-',
      objective: () => sessionDetail.evaluation?.objective || '-',
      assessment: () => sessionDetail.evaluation?.assessment || '-',
      plan: () => sessionDetail.evaluation?.plan || '-',
      generalNotes: () => sessionDetail.evaluation?.generalNotes || '-',
    };

    return valueMap[key]?.() ?? '-';
  };

  // Check if user can see all branches
  const canSeeAllBranches = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';

  // Load filter options
  useEffect(() => {
    // Skip if user is not loaded yet
    if (!user) return;
    
    const loadFilterOptions = async () => {
      try {
        // Load branches only for SUPER_ADMIN and ADMIN_MANAGER
        if (canSeeAllBranches) {
          const branchesRes = await branchesApi.listBranches();
          setBranches(branchesRes.data?.data || []);
        }

        // Load staff (doctors and nurses) using role-specific endpoint
        // This endpoint is accessible by all staff roles
        const [doctorsRes, nursesRes] = await Promise.all([
          api.get('/users/staff/DOCTOR'),
          api.get('/users/staff/NURSE'),
        ]);
        
        const doctorsList: StaffOptionResponse[] = Array.isArray(doctorsRes.data?.data) ? doctorsRes.data.data : [];
        const nursesList: StaffOptionResponse[] = Array.isArray(nursesRes.data?.data) ? nursesRes.data.data : [];
        
        setDoctors(doctorsList.map(normalizeStaffOption).filter((staff): staff is Staff => Boolean(staff)));
        setNurses(nursesList.map(normalizeStaffOption).filter((staff): staff is Staff => Boolean(staff)));
      } catch (error) {
      assertCaughtError(error);
        devError('Error loading filter options:', error);
      }
    };

    loadFilterOptions();
  }, [user, canSeeAllBranches]);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const params: NonNullable<Parameters<typeof sessionApi.getAllSessions>[0]> = { page, limit };
      
      // Apply filters
      if (filters.branchIds && filters.branchIds.length > 0) {
        params.branchIds = filters.branchIds.join(',');
      }
      if (filters.diagnosisCategories && filters.diagnosisCategories.length > 0) {
        params.diagnosisCategories = filters.diagnosisCategories.join(',');
      }
      if (filters.doctorIds.length > 0) {
        params.doctorIds = filters.doctorIds.join(',');
      }
      if (filters.nurseIds.length > 0) {
        params.nurseIds = filters.nurseIds.join(',');
      }
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.pelaksanaan !== 'all') params.pelaksanaan = filters.pelaksanaan;

      const response = await sessionApi.getAllSessions(params);
      setSessions(response || []);
      
      // Estimate total pages
      if (response && response.length < limit) {
        setTotalPages(page);
      } else if (response && response.length === limit) {
        setTotalPages(page + 1);
      }
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading sessions:', error);
      showToast.error('Gagal memuat data sesi terapi');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filter changes
  };

  const handleMultiFilterChange = (key: MultiFilterKey, value: string, checked: boolean) => {
    setFilters(prev => {
      const currentValues = prev[key];
      const nextValues = checked
        ? Array.from(new Set([...currentValues, value]))
        : currentValues.filter((item) => item !== value);

      return {
        ...prev,
        [key]: nextValues,
      };
    });
    setPage(1);
  };

  const clearMultiFilter = (key: MultiFilterKey) => {
    setFilters(prev => ({ ...prev, [key]: [] }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      branchIds: [],
      diagnosisCategories: [],
      doctorIds: [],
      nurseIds: [],
      dateFrom: '',
      dateTo: '',
      pelaksanaan: 'all',
    });
    setPage(1);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      
      const blob = await sessionApi.exportSessions({
        format: exportFormat,
        fields: exportFields,
        filters: {
          branchIds: filters.branchIds.length > 0 ? filters.branchIds : undefined,
          doctorIds: filters.doctorIds.length > 0 ? filters.doctorIds : undefined,
          nurseIds: filters.nurseIds.length > 0 ? filters.nurseIds : undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          status: filters.status !== 'all' ? filters.status : undefined,
          pelaksanaan: filters.pelaksanaan !== 'all' ? filters.pelaksanaan : undefined,
        },
      });

      // Download file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sesi-terapi-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast.success('Export berhasil!');
      setShowExportModal(false);
    } catch (error) {
      assertCaughtError(error);
      devError('Export error:', error);
      showToast.error('Gagal mengexport data');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSessionClick = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  const handleDeleteSession = async (sessionDetail: SessionDetail) => {
    const confirmed = await confirm.show({
      title: 'Hapus Sesi Terapi',
      message: `Hapus sesi ${sessionDetail.session.sessionCode} milik ${sessionDetail.session.member.fullName}? Voucher Basic, voucher Booster (jika digunakan), dan seluruh stok sesi akan dikembalikan.`,
      variant: 'danger',
      confirmText: 'Hapus Sesi',
      cancelText: 'Batal',
    });

    if (!confirmed) return;

    try {
      const result = await sessionApi.deleteSession(sessionDetail.session.sessionId);
      const voucherLabel = result.restoredVouchers.booster > 0
        ? 'voucher Basic dan Booster'
        : 'voucher Basic';
      showToast.success(`Sesi berhasil dihapus. ${voucherLabel} serta stok telah dikembalikan.`);
      await loadSessions();
    } catch (error) {
      assertCaughtError(error);
      devError('Error deleting session:', error);
      showToast.error(
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        'Gagal menghapus sesi terapi'
      );
    }
  };

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'status' || key === 'pelaksanaan') return value !== 'all';
    if (Array.isArray(value)) return value.length > 0;
    return value !== '';
  }).length;

  const filteredBranches = branches.filter((branch) => (
    matchesSearchQuery(`${branch.name} ${branch.branchCode}`, branchSearchQuery)
  ));
  const filteredDiagnosisCategories = DIAGNOSIS_CATEGORY_OPTIONS.filter((category: DiagnosisCategoryOption) => (
    matchesSearchQuery(category.name, diagnosisSearchQuery)
  ));
  const filteredDoctors = doctors.filter((doctor) => matchesSearchQuery(doctor.fullName, doctorSearchQuery));
  const filteredNurses = nurses.filter((nurse) => matchesSearchQuery(nurse.fullName, nurseSearchQuery));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Sesi Terapi</h1>
          <p className={styles.subtitle}>Daftar semua sesi terapi</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`btn btn-secondary ${styles.filterBtn} ${showTableColumns ? styles.hasFilters : ''}`}
            onClick={() => setShowTableColumns(!showTableColumns)}
          >
            Kolom ({getSelectedTableFieldCount()})
          </button>
          <button
            className={`btn btn-secondary ${styles.filterBtn} ${activeFilterCount > 0 ? styles.hasFilters : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            🔍 Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowExportModal(true)}
          >
            📥 Export
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className={styles.filterPanel}>
          <div className={styles.filterGrid}>
            {/* Status Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Status</label>
              <select
                className={styles.filterSelect}
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="completed">Selesai</option>
                <option value="incomplete">Belum Selesai</option>
              </select>
            </div>

            {/* Branch Filter - Collapsible for SUPER_ADMIN and ADMIN_MANAGER */}
            {canSeeAllBranches && (
              <div className={`${styles.filterGroup} ${styles.multiFilterGroup} ${styles.wideFilterGroup}`}>
                <label className={styles.filterLabel}>Cabang</label>
                <button
                  type="button"
                  className={styles.multiFilterHeader}
                  onClick={() => setBranchFilterExpanded(!branchFilterExpanded)}
                >
                  {branchFilterExpanded ? (
                    <input
                      type="text"
                      className={styles.multiFilterInlineSearch}
                      placeholder="Cari cabang..."
                      value={branchSearchQuery}
                      onChange={(e) => setBranchSearchQuery(e.target.value)}
                      onClick={handleSearchInputClick}
                      onKeyDown={handleSearchInputKeyDown}
                    />
                  ) : (
                    <span className={styles.multiFilterTitle}>
                      📍 Cabang ({filters.branchIds.length > 0 ? `${filters.branchIds.length} dipilih` : 'Semua'})
                    </span>
                  )}
                  <span className={`${styles.filterHeaderChevron} ${branchFilterExpanded ? styles.expanded : ''}`}>
                    ▶
                  </span>
                </button>
                {branchFilterExpanded && (
                  <div className={styles.multiFilterOptions}>
                    {filteredBranches.map((branch) => (
                      <label
                        key={branch.id}
                        className={`${styles.multiFilterOption} ${filters.branchIds.includes(branch.id) ? styles.selected : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={filters.branchIds.includes(branch.id)}
                          onChange={(e) => handleMultiFilterChange('branchIds', branch.id, e.target.checked)}
                        />
                        <span>{branch.name}</span>
                      </label>
                    ))}
                    {branches.length === 0 && (
                      <div className={styles.multiFilterEmpty}>Cabang tidak tersedia</div>
                    )}
                    {branches.length > 0 && filteredBranches.length === 0 && (
                      <div className={styles.multiFilterEmpty}>Cabang tidak ditemukan</div>
                    )}
                    {filters.branchIds.length > 0 && (
                      <button
                        type="button"
                        className={styles.multiFilterClear}
                        onClick={() => clearMultiFilter('branchIds')}
                      >
                        Bersihkan Cabang
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Diagnosis Category Filter - Collapsible */}
            <div className={`${styles.filterGroup} ${styles.multiFilterGroup} ${styles.wideFilterGroup}`}>
              <label className={styles.filterLabel}>Kategori Diagnosa</label>
              <button
                type="button"
                className={styles.multiFilterHeader}
                onClick={() => setDiagnosisFilterExpanded(!diagnosisFilterExpanded)}
              >
                {diagnosisFilterExpanded ? (
                  <input
                    type="text"
                    className={styles.multiFilterInlineSearch}
                    placeholder="Cari kategori diagnosa..."
                    value={diagnosisSearchQuery}
                    onChange={(e) => setDiagnosisSearchQuery(e.target.value)}
                    onClick={handleSearchInputClick}
                    onKeyDown={handleSearchInputKeyDown}
                  />
                ) : (
                  <span className={styles.multiFilterTitle}>
                    🏥 Kategori Diagnosa ({filters.diagnosisCategories.length > 0 ? `${filters.diagnosisCategories.length} dipilih` : 'Semua'})
                  </span>
                )}
                <span className={`${styles.filterHeaderChevron} ${diagnosisFilterExpanded ? styles.expanded : ''}`}>
                  ▶
                </span>
              </button>
              {diagnosisFilterExpanded && (
                <div className={styles.multiFilterOptions}>
                  {filteredDiagnosisCategories.map((category) => (
                    <label
                      key={category.id}
                      className={`${styles.multiFilterOption} ${filters.diagnosisCategories.includes(category.id) ? styles.selected : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={filters.diagnosisCategories.includes(category.id)}
                        onChange={(e) => handleMultiFilterChange('diagnosisCategories', category.id, e.target.checked)}
                      />
                      <span>{category.name}</span>
                    </label>
                  ))}
                  {filteredDiagnosisCategories.length === 0 && (
                    <div className={styles.multiFilterEmpty}>Kategori diagnosa tidak ditemukan</div>
                  )}
                  {filters.diagnosisCategories.length > 0 && (
                    <button
                      type="button"
                      className={styles.multiFilterClear}
                      onClick={() => clearMultiFilter('diagnosisCategories')}
                    >
                      Bersihkan Kategori
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Doctor Filter */}
            <div className={`${styles.filterGroup} ${styles.multiFilterGroup}`}>
              <label className={styles.filterLabel}>Dokter</label>
              <button
                type="button"
                className={styles.multiFilterHeader}
                onClick={() => setDoctorFilterExpanded(!doctorFilterExpanded)}
              >
                {doctorFilterExpanded ? (
                  <input
                    type="text"
                    className={styles.multiFilterInlineSearch}
                    placeholder="Cari dokter..."
                    value={doctorSearchQuery}
                    onChange={(e) => setDoctorSearchQuery(e.target.value)}
                    onClick={handleSearchInputClick}
                    onKeyDown={handleSearchInputKeyDown}
                  />
                ) : (
                  <span className={styles.multiFilterTitle}>
                    {getSelectedFilterLabel(filters.doctorIds, doctors, 'Semua Dokter')}
                  </span>
                )}
                <span className={`${styles.filterHeaderChevron} ${doctorFilterExpanded ? styles.expanded : ''}`}>
                  â–¶
                </span>
              </button>
              {doctorFilterExpanded && (
                <div className={styles.multiFilterOptions}>
                  {doctors.length === 0 ? (
                    <div className={styles.multiFilterEmpty}>Dokter tidak tersedia</div>
                  ) : (
                    filteredDoctors.map((doctor) => {
                      const checked = filters.doctorIds.includes(doctor.id);

                      return (
                        <label
                          key={doctor.id}
                          className={`${styles.multiFilterOption} ${checked ? styles.selected : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => handleMultiFilterChange('doctorIds', doctor.id, e.target.checked)}
                          />
                          <span>{doctor.fullName}</span>
                        </label>
                      );
                    })
                  )}
                  {doctors.length > 0 && filteredDoctors.length === 0 && (
                    <div className={styles.multiFilterEmpty}>Dokter tidak ditemukan</div>
                  )}
                  {filters.doctorIds.length > 0 && (
                    <button
                      type="button"
                      className={styles.multiFilterClear}
                      onClick={() => clearMultiFilter('doctorIds')}
                    >
                      Bersihkan Dokter
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Nurse Filter */}
            <div className={`${styles.filterGroup} ${styles.multiFilterGroup}`}>
              <label className={styles.filterLabel}>Nakes</label>
              <button
                type="button"
                className={styles.multiFilterHeader}
                onClick={() => setNurseFilterExpanded(!nurseFilterExpanded)}
              >
                {nurseFilterExpanded ? (
                  <input
                    type="text"
                    className={styles.multiFilterInlineSearch}
                    placeholder="Cari nakes..."
                    value={nurseSearchQuery}
                    onChange={(e) => setNurseSearchQuery(e.target.value)}
                    onClick={handleSearchInputClick}
                    onKeyDown={handleSearchInputKeyDown}
                  />
                ) : (
                  <span className={styles.multiFilterTitle}>
                    {getSelectedFilterLabel(filters.nurseIds, nurses, 'Semua Nakes')}
                  </span>
                )}
                <span className={`${styles.filterHeaderChevron} ${nurseFilterExpanded ? styles.expanded : ''}`}>
                  â–¶
                </span>
              </button>
              {nurseFilterExpanded && (
                <div className={styles.multiFilterOptions}>
                  {nurses.length === 0 ? (
                    <div className={styles.multiFilterEmpty}>Nakes tidak tersedia</div>
                  ) : (
                    filteredNurses.map((nurse) => {
                      const checked = filters.nurseIds.includes(nurse.id);

                      return (
                        <label
                          key={nurse.id}
                          className={`${styles.multiFilterOption} ${checked ? styles.selected : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => handleMultiFilterChange('nurseIds', nurse.id, e.target.checked)}
                          />
                          <span>{nurse.fullName}</span>
                        </label>
                      );
                    })
                  )}
                  {nurses.length > 0 && filteredNurses.length === 0 && (
                    <div className={styles.multiFilterEmpty}>Nakes tidak ditemukan</div>
                  )}
                  {filters.nurseIds.length > 0 && (
                    <button
                      type="button"
                      className={styles.multiFilterClear}
                      onClick={() => clearMultiFilter('nurseIds')}
                    >
                      Bersihkan Nakes
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Date From */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Dari Tanggal</label>
              <input
                type="date"
                className={styles.filterInput}
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Sampai Tanggal</label>
              <input
                type="date"
                className={styles.filterInput}
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>

            {/* Pelaksanaan Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Tipe Pelaksanaan</label>
              <select
                className={styles.filterSelect}
                value={filters.pelaksanaan}
                onChange={(e) => handleFilterChange('pelaksanaan', e.target.value)}
              >
                <option value="all">Semua Tipe</option>
                <option value="ON_SITE">On-Site</option>
                <option value="HOME_CARE">Home Care</option>
              </select>
            </div>
          </div>

          <div className={styles.filterActions}>
            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Reset Filter
            </button>
          </div>
        </div>
      )}

      {/* Column Selection Panel */}
      {showTableColumns && (
        <div className={styles.columnPanel}>
          <div className={styles.columnPanelHeader}>
            <div>
              <h3>Kolom Tabel</h3>
              <p>Pilih data sesi dan data kesehatan yang ingin ditampilkan dalam satu baris.</p>
            </div>
            <div className={styles.columnActions}>
              <button
                type="button"
                className={styles.selectAllBtn}
                onClick={() => {
                  const updates: Record<string, boolean> = {};
                  Object.keys(tableFields).forEach((key) => {
                    updates[key] = true;
                  });
                  setTableFields(updates);
                }}
              >
                Pilih Semua
              </button>
              <button
                type="button"
                className={styles.deselectAllBtn}
                onClick={() => {
                  const updates: Record<string, boolean> = {};
                  Object.keys(tableFields).forEach((key) => {
                    updates[key] = COMPACT_TABLE_FIELDS.has(key);
                  });
                  setTableFields(updates);
                }}
              >
                Ringkas
              </button>
              <button
                type="button"
                className={styles.saveDefaultBtn}
                onClick={saveTableColumnsDefault}
              >
                Simpan Default
              </button>
              <button
                type="button"
                className={styles.resetDefaultBtn}
                onClick={resetTableColumnsDefault}
              >
                Reset Default
              </button>
            </div>
          </div>

          <div className={styles.columnCategoryGrid}>
            {fieldCategories
              .filter((category) => category.fields.some((field) => field.key in tableFields))
              .map((category) => {
                const availableFields = category.fields.filter((field) => field.key in tableFields);
                const selectedCount = availableFields.filter((field) => tableFields[field.key]).length;

                return (
                  <div key={category.id} className={styles.columnCategory}>
                    <label className={styles.columnCategoryTitle}>
                      <input
                        type="checkbox"
                        checked={selectedCount === availableFields.length}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = selectedCount > 0 && selectedCount < availableFields.length;
                          }
                        }}
                        onChange={(e) => toggleTableCategory(category.id, e.target.checked)}
                      />
                      <span>{category.label}</span>
                      <small>{selectedCount}/{availableFields.length}</small>
                    </label>
                    <div className={styles.columnFieldList}>
                      {availableFields.map((field) => (
                        <label key={field.key} className={styles.columnFieldItem}>
                          <input
                            type="checkbox"
                            checked={tableFields[field.key]}
                            onChange={(e) => setTableFields(prev => ({
                              ...prev,
                              [field.key]: e.target.checked,
                            }))}
                          />
                          <span>{field.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Quick Status Tabs */}
      <div className={styles.filterTabs}>
        <button
          className={`${styles.filterTab} ${filters.status === 'all' ? styles.active : ''}`}
          onClick={() => handleFilterChange('status', 'all')}
        >
          Semua ({sessions.length})
        </button>
        <button
          className={`${styles.filterTab} ${filters.status === 'incomplete' ? styles.active : ''}`}
          onClick={() => handleFilterChange('status', 'incomplete')}
        >
          Belum Selesai
        </button>
        <button
          className={`${styles.filterTab} ${filters.status === 'completed' ? styles.active : ''}`}
          onClick={() => handleFilterChange('status', 'completed')}
        >
          Selesai
        </button>
      </div>

      {/* Sessions Table */}
      {loading ? (
        <PageLoading text="Memuat data sesi terapi" />
      ) : sessions.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>💉</div>
          <p className={styles.emptyText}>Tidak ada sesi terapi</p>
          <p className={styles.emptySubtext}>
            {activeFilterCount > 0 
              ? 'Coba ubah filter untuk melihat data lainnya'
              : 'Sesi terapi akan muncul di sini setelah dibuat'}
          </p>
          {activeFilterCount > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={clearFilters} style={{ marginTop: 16 }}>
              Reset Filter
            </button>
          )}
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.sessionsTable}>
            <thead>
              <tr className={styles.groupHeaderRow}>
                {groupedTableHeaders.map((group, index) => (
                  <th
                    key={`${group.id}-${index}`}
                    className={styles.groupHeaderCell}
                    colSpan={group.colSpan}
                    scope="colgroup"
                  >
                    {group.label}
                  </th>
                ))}
                {canDeleteSessions && (
                  <th className={styles.groupHeaderCell} scope="colgroup">
                    Aksi
                  </th>
                )}
              </tr>
              <tr>
                {visibleTableFieldKeys.map((key) => (
                  <th key={key} scope="col">{tableFieldLabelByKey[key] || key}</th>
                ))}
                {canDeleteSessions && <th scope="col">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {sessions.map((sessionDetail) => (
                <tr
                  key={sessionDetail.session.sessionId}
                  className={`${styles.tableRow} ${sessionDetail.session.isCompleted ? styles.completed : styles.incomplete}`}
                  onClick={() => handleSessionClick(sessionDetail.session.sessionId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSessionClick(sessionDetail.session.sessionId);
                    }
                  }}
                >
                  {visibleTableFieldKeys.map((key, index) => (
                    <td
                      key={key}
                      className={getTableCellClass(key, index)}
                      data-label={tableFieldLabelByKey[key] || key}
                    >
                      {getTableFieldValue(sessionDetail, key)}
                    </td>
                  ))}
                  {canDeleteSessions && !sessionDetail.session.isCompleted && (
                    <td className={styles.actionCell} data-label="Aksi">
                      <button
                        type="button"
                        className={styles.deleteSessionBtn}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteSession(sessionDetail);
                        }}
                      >
                        Hapus
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={`btn btn-secondary ${styles.pageBtn}`}
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Sebelumnya
          </button>
          <span className={styles.pageInfo}>
            Halaman {page} dari {totalPages}
          </span>
          <button
            className={`btn btn-secondary ${styles.pageBtn}`}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Selanjutnya →
          </button>
        </div>
      )}

      {/* Export Modal - Odoo Style */}
      {showExportModal && (
        <div className={styles.modalOverlay} onClick={() => setShowExportModal(false)}>
          <div className={styles.exportModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>📥 Export Data Sesi Terapi</h2>
              <button className={styles.closeBtn} onClick={() => setShowExportModal(false)}>×</button>
            </div>
            
            <div className={styles.exportModalBody}>
              {/* Left Panel - Field Selection */}
              <div className={styles.fieldSelectionPanel}>
                <div className={styles.fieldSelectionHeader}>
                  <h3>Pilih Field untuk Export</h3>
                  <div className={styles.fieldSelectionActions}>
                    <button 
                      className={styles.selectAllBtn}
                      onClick={selectAllFields}
                    >
                      Pilih Semua
                    </button>
                    <button 
                      className={styles.deselectAllBtn}
                      onClick={deselectAllFields}
                    >
                      Hapus Semua
                    </button>
                  </div>
                </div>
                
                <div className={styles.fieldCategories}>
                  {fieldCategories.map((category) => (
                    <div key={category.id} className={styles.fieldCategory}>
                      <div 
                        className={styles.categoryHeader}
                        onClick={() => toggleCategory(category.id)}
                      >
                        <div className={styles.categoryLeft}>
                          <input
                            type="checkbox"
                            checked={isCategoryFullySelected(category.id)}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate = isCategoryPartiallySelected(category.id);
                              }
                            }}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleAllInCategory(category.id, e.target.checked);
                            }}
                            className={styles.categoryCheckbox}
                          />
                          <span className={styles.categoryIcon}>{category.icon}</span>
                          <span className={styles.categoryLabel}>{category.label}</span>
                          <span className={styles.categoryCount}>
                            ({category.fields.filter(f => exportFields[f.key as keyof typeof exportFields]).length}/{category.fields.length})
                          </span>
                        </div>
                        <span className={`${styles.expandIcon} ${expandedCategories.includes(category.id) ? styles.expanded : ''}`}>
                          ▶
                        </span>
                      </div>
                      
                      {expandedCategories.includes(category.id) && (
                        <div className={styles.categoryFields}>
                          {category.fields.map((field) => (
                            <label key={field.key} className={styles.fieldItem}>
                              <input
                                type="checkbox"
                                checked={exportFields[field.key as keyof typeof exportFields]}
                                onChange={(e) => setExportFields(prev => ({ 
                                  ...prev, 
                                  [field.key]: e.target.checked 
                                }))}
                              />
                              <span>{field.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Panel - Export Options */}
              <div className={styles.exportOptionsPanel}>
                <div className={styles.exportOption}>
                  <h4>Format File</h4>
                  <div className={styles.formatButtons}>
                    <button
                      className={`${styles.formatBtn} ${exportFormat === 'xlsx' ? styles.active : ''}`}
                      onClick={() => setExportFormat('xlsx')}
                    >
                      <span className={styles.formatBtnIcon}>📊</span>
                      <span className={styles.formatBtnLabel}>Excel</span>
                      <span className={styles.formatBtnExt}>.xlsx</span>
                    </button>
                    <button
                      className={`${styles.formatBtn} ${exportFormat === 'csv' ? styles.active : ''}`}
                      onClick={() => setExportFormat('csv')}
                    >
                      <span className={styles.formatBtnIcon}>📄</span>
                      <span className={styles.formatBtnLabel}>CSV</span>
                      <span className={styles.formatBtnExt}>.csv</span>
                    </button>
                  </div>
                </div>

                <div className={styles.exportOption}>
                  <h4>Ringkasan Export</h4>
                  <div className={styles.exportSummary}>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Field dipilih</span>
                      <span className={styles.summaryValue}>{getSelectedFieldCount()} kolom</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Format</span>
                      <span className={styles.summaryValue}>{exportFormat.toUpperCase()}</span>
                    </div>
                    {activeFilterCount > 0 && (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Filter aktif</span>
                        <span className={styles.summaryValue}>{activeFilterCount} filter</span>
                      </div>
                    )}
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <div className={styles.exportOption}>
                    <h4>Filter Aktif</h4>
                    <div className={styles.activeFilters}>
                      {filters.status !== 'all' && (
                        <span className={styles.filterTag}>
                          Status: {filters.status === 'completed' ? 'Selesai' : 'Belum Selesai'}
                        </span>
                      )}
                      {filters.branchIds.length > 0 && (
                        <span className={styles.filterTag}>
                          Cabang: {filters.branchIds.map(id => branches.find(b => b.id === id)?.name || id).join(', ')}
                        </span>
                      )}
                      {filters.doctorIds.length > 0 && (
                        <span className={styles.filterTag}>
                          Dokter: {filters.doctorIds.map(id => doctors.find(d => d.id === id)?.fullName || id).join(', ')}
                        </span>
                      )}
                      {filters.nurseIds.length > 0 && (
                        <span className={styles.filterTag}>
                          Nakes: {filters.nurseIds.map(id => nurses.find(n => n.id === id)?.fullName || id).join(', ')}
                        </span>
                      )}
                      {filters.dateFrom && (
                        <span className={styles.filterTag}>
                          Dari: {filters.dateFrom}
                        </span>
                      )}
                      {filters.dateTo && (
                        <span className={styles.filterTag}>
                          Sampai: {filters.dateTo}
                        </span>
                      )}
                      {filters.pelaksanaan !== 'all' && (
                        <span className={styles.filterTag}>
                          Tipe: {filters.pelaksanaan === 'ON_SITE' ? 'On-Site' : 'Home Care'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className={styles.exportActions}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowExportModal(false)}
                  >
                    Batal
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleExport}
                    disabled={exporting || getSelectedFieldCount() === 0}
                  >
                    {exporting ? (
                      <>
                        <span className={styles.exportSpinner}></span>
                        Mengexport...
                      </>
                    ) : (
                      <>📥 Export {getSelectedFieldCount()} Kolom</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
