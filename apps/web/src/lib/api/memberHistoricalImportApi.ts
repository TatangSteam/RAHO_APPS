import { api } from '../api';

export interface HistoricalImportCounts {
  members: number;
  packages: number;
  diagnoses: number;
  therapyPlans: number;
  sessions: number;
  completedSessions: number;
  vitals: number;
  infusions: number;
  materials: number;
  evaluations: number;
}

export interface HistoricalImportDuplicateGroup {
  key: string;
  rows: number[];
  memberCodes: string[];
  names: string[];
}

export interface HistoricalImportStaffPreview {
  name: string;
  matched: boolean;
  matchedUserId: string | null;
  matchedName: string | null;
  action: 'MATCH_EXISTING' | 'CREATE_PLACEHOLDER';
}

export interface HistoricalImportDryRunResult {
  fileName: string;
  branch: {
    id: string;
    branchCode: string;
    name: string;
  };
  sheetNames: string[];
  counts: HistoricalImportCounts;
  workbookBranchNames: string[];
  duplicates: {
    byNik: HistoricalImportDuplicateGroup[];
    byNameBirthNik: HistoricalImportDuplicateGroup[];
    byNameBirth: HistoricalImportDuplicateGroup[];
  };
  memberMatching: {
    existing: Array<{
      rowNumber: number;
      memberCode: string;
      importedName: string;
      matchedBy: 'NIK' | 'NAME_BIRTHDATE';
      existingMemberId: string;
      existingMemberNo: string;
      existingName: string;
    }>;
    willCreateMembers: number;
    willReuseMembers: number;
  };
  staffPreview: {
    doctors: HistoricalImportStaffPreview[];
    nurses: HistoricalImportStaffPreview[];
    adminLayanan: HistoricalImportStaffPreview[];
  };
  warnings: string[];
  errors: Array<{ field: string; message: string }>;
  canImport: boolean;
}

export interface HistoricalImportExecuteResult {
  branch: {
    id: string;
    branchCode: string;
    name: string;
  };
  counts: HistoricalImportCounts;
  imported: {
    createdMembers: number;
    reusedMembers: number;
    createdPackages: number;
    reusedPackages: number;
    createdDiagnoses: number;
    createdTherapyPlans: number;
    createdSessions: number;
    skippedSessions: number;
    createdVitals: number;
    createdInfusions: number;
    createdEvaluations: number;
    createdEmrNotes: number;
    skippedMaterials: number;
    createdPlaceholderStaff: number;
  };
  warnings: string[];
}

function buildFormData(file: File, branchId: string, options?: {
  markSessionsCompleted?: boolean;
  createPlaceholderStaff?: boolean;
  skipMaterialUsage?: boolean;
}) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('branchId', branchId);

  if (options) {
    formData.append('markSessionsCompleted', String(options.markSessionsCompleted ?? true));
    formData.append('createPlaceholderStaff', String(options.createPlaceholderStaff ?? true));
    formData.append('skipMaterialUsage', String(options.skipMaterialUsage ?? true));
  }

  return formData;
}

export const memberHistoricalImportApi = {
  dryRun: async (file: File, branchId: string) => {
    const response = await api.post<{ success: boolean; data: HistoricalImportDryRunResult }>(
      '/admin/member-import/dry-run',
      buildFormData(file, branchId),
      { timeout: 120_000 },
    );
    return response.data.data;
  },

  execute: async (file: File, branchId: string, options?: {
    markSessionsCompleted?: boolean;
    createPlaceholderStaff?: boolean;
    skipMaterialUsage?: boolean;
  }) => {
    const response = await api.post<{ success: boolean; data: HistoricalImportExecuteResult }>(
      '/admin/member-import/execute',
      buildFormData(file, branchId, options),
      { timeout: 180_000 },
    );
    return response.data.data;
  },
};
