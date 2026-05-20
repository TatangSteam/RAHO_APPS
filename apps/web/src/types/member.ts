export interface Member {
  memberId: string;
  memberNo: string;
  fullName: string;
  phone: string;
  email: string;
  voucherCount: number;
  basicPackageCount: number;
  isActive: boolean;
  isLintas: boolean;
  registrationBranch: string;
  photoUrl?: string;
  createdAt: string;
}

export interface MemberDetail {
  memberId: string;
  memberNo: string;
  user: {
    email: string;
    isActive: boolean;
  };
  profile: {
    fullName: string;
    phone: string;
    avatarUrl?: string;
  };
  registrationBranch: {
    id: string;
    name: string;
    branchCode: string;
  };
  branchAccess: Array<{
    branchId: string;
    branchName: string;
    grantedAt: string;
  }>;
  documents: Array<{
    id: string;
    documentType: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    createdAt: string;
  }>;
  referralCodeId?: string;
  referralCode?: {
    code: string;
    referrerName: string;
    referrerType: string;
  };
  // Incentive settings (per member)
  firstIncentiveType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  firstIncentiveValue?: number;
  nextIncentiveType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  nextIncentiveValue?: number;
  // Member-specific fields
  nik?: string;
  tempatLahir?: string;
  dateOfBirth?: string;
  jenisKelamin?: 'L' | 'P';
  address?: string;
  pekerjaan?: string;
  statusNikah?: string;
  emergencyContact?: string;
  sumberInfoRaho?: string;
  postalCode?: string;
  voucherCount: number;
  isConsentToPhoto: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface MemberLookup {
  memberId: string;
  memberNo: string;
  fullName: string;
  phone: string;
  email: string;
  registrationBranch: string;
  registrationBranchId: string;
  isRegistrationBranch: boolean;
  sudahAdaAkses: boolean;
  isActive: boolean;
}

export interface CreateMemberData {
  // Branch selection (for ADMIN_MANAGER)
  branchId?: string;
  
  // Section A - Data Pribadi
  fullName: string;
  nik?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: 'L' | 'P'; // L = Laki-laki, P = Perempuan
  phone: string;
  email?: string;
  address?: string;
  occupation?: string;
  maritalStatus?: string;
  emergencyContact?: string;
  emergencyContactPhone?: string;
  infoSource?: string;
  postalCode?: string;

  // Section B - Akun Member
  memberEmail: string;
  memberPassword: string;
  referralCode?: string;
  referralCodeId?: string;
  isConsentToPhoto: boolean;

  // Section C - Pengaturan Insentif (Optional)
  firstIncentiveType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  firstIncentiveValue?: number;
  nextIncentiveType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  nextIncentiveValue?: number;

  // Section D - Therapy Plans (Optional)
  therapyPlans?: Array<{
    infusKe: number;
    ifa250?: number; // IFA + NO 2,5ml - Wajib 1 botol per terapi (satuan: Botol)
    ifa500?: number; // IFA 500ml - Alternatif/special case (satuan: Botol)
    hho?: number;
    h2?: number;
    no?: number;
    gaso?: number;
    o2?: number;
    o3?: number;
    edta?: number;
    mb?: number;
    h2s?: number;
    kcl?: number;
    jmlNb?: number;
  }>;
}

export interface MembersResponse {
  members: Member[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MemberPackage {
  id: string;
  packageId: string;
  packageCode: string;
  packageType: 'BASIC' | 'BOOSTER';
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  activatedAt: string | null;
  branchName: string;
  productCode?: string;
  serviceType?: string;
}
