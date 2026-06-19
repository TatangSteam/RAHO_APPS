export interface BranchDetail {
  id: string;
  branchCode: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  type: 'PUSAT' | 'PREMIER' | 'PARTNERSHIP';
  operatingHours?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stats: {
    activeUsers: number;
    totalMembers: number;
    activePackages: number;
  };
}

export interface User {
  id: string;
  email: string;
  role: string;
  staffCode: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  therapyCount?: number;
  therapyCountAsDoctor?: number;
  therapyCountAsNurse?: number;
  therapyCountAsAdminLayanan?: number;
  profile: {
    fullName: string;
    phone?: string;
  };
}

export interface BranchMember {
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
