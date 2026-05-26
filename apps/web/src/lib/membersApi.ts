import { api } from '@/lib/api';
import { createAuthenticatedObjectUrl } from '@/lib/fileApi';
import { devLog } from '@/lib/logger';
import type {
  Member,
  MemberDetail,
  MemberLookup,
  CreateMemberData,
  MembersResponse,
} from '@/types/member';

// ── Get Members List ───────────────────────────────────────────
export async function getMembersApi(params?: {
  search?: string;
  status?: string;
  branchCode?: string;
  page?: number;
  limit?: number;
}): Promise<MembersResponse> {
  const { data } = await api.get<{ data: MembersResponse }>('/members', { params });
  return data.data;
}

// ── Lookup Member ──────────────────────────────────────────────
export async function lookupMemberApi(memberNo: string): Promise<MemberLookup> {
  const { data } = await api.get<{ data: MemberLookup }>('/members/lookup', {
    params: { memberNo },
  });
  return data.data;
}

// ── Grant Access ───────────────────────────────────────────────
export async function grantAccessApi(memberNo: string): Promise<{ message: string }> {
  const { data } = await api.post<{ data: { message: string } }>('/members/grant-access', {
    memberNo,
  });
  return data.data;
}

// ── Create Member ──────────────────────────────────────────────
export async function createMemberApi(
  memberData: CreateMemberData,
  files: { psp?: File; photo?: File }
): Promise<{ memberId: string; memberNo: string; message: string }> {
  const formData = new FormData();

  devLog('🔍 [membersApi] createMemberApi called with:', memberData);

  // Append member data - only non-empty values
  // IMPORTANT: Exclude 'psp' and 'photo' as they should be File objects, not strings
  Object.entries(memberData).forEach(([key, value]) => {
    if (key === 'psp' || key === 'photo') {
      return; // Skip these - they'll be added as files below
    }
    // Skip undefined, null, and empty string values
    if (value === undefined || value === null || value === '') {
      devLog(`🔍 [membersApi] Skipping ${key}: ${value}`);
      return;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      // For nested objects like therapyPlans, stringify them
      formData.append(key, JSON.stringify(value));
      devLog(`🔍 [membersApi] Appending ${key} (object):`, JSON.stringify(value));
    } else if (Array.isArray(value)) {
      // For arrays like therapyPlans, stringify them
      formData.append(key, JSON.stringify(value));
      devLog(`🔍 [membersApi] Appending ${key} (array):`, JSON.stringify(value));
    } else {
      const stringValue = typeof value === 'boolean' ? String(value) : String(value);
      formData.append(key, stringValue);
      devLog(`🔍 [membersApi] Appending ${key}:`, stringValue);
    }
  });

  // Append files - IMPORTANT: Only append if they are actual File objects
  if (files.psp && files.psp instanceof File) {
    formData.append('psp', files.psp, files.psp.name);
  }
  if (files.photo && files.photo instanceof File) {
    formData.append('photo', files.photo, files.photo.name);
  }

  const { data } = await api.post<{
    data: { memberId: string; memberNo: string; message: string };
  }>('/members', formData);

  return data.data;
}

// ── Get Member Detail ──────────────────────────────────────────
export async function getMemberDetailApi(memberId: string): Promise<MemberDetail> {
  const { data } = await api.get<{ data: MemberDetail }>(`/members/${memberId}`);
  return data.data;
}

// ── Update Member ──────────────────────────────────────────────
export async function updateMemberApi(
  memberId: string,
  updateData: Partial<CreateMemberData>
): Promise<{ message: string }> {
  const { data } = await api.patch<{ data: { message: string } }>(
    `/members/${memberId}`,
    updateData
  );
  return data.data;
}

// ── Delete Member ──────────────────────────────────────────────
export async function deleteMemberApi(memberId: string): Promise<{ message: string }> {
  const { data } = await api.delete<{ data: { message: string } }>(`/members/${memberId}`);
  return data.data;
}

// ── Send Notification ──────────────────────────────────────────
export async function sendNotificationApi(
  memberId: string,
  notification: { title: string; message: string }
): Promise<{ message: string }> {
  const { data } = await api.post<{ data: { message: string } }>(
    `/members/${memberId}/notifications`,
    notification
  );
  return data.data;
}

// ── Get Consent Documents ──────────────────────────────────────
export async function getConsentDocumentsApi(memberId: string) {
  const response = await api.get(`/members/${memberId}/documents/consent`);
  return response.data.data;
}

// ── Get Referral Incentives ──────────────────────────────────────
export async function getReferralIncentivesApi(memberId: string): Promise<{
  totalIncentive: number;
  records: Array<{
    id: string;
    packageCode: string;
    packageType: string;
    packageName: string;
    packageValue: number;
    isFirstPackage: boolean;
    incentiveType: string;
    incentiveValue: number;
    incentiveAmount: number;
    notes: string | null;
    purchaseDate: string;
    createdAt: string;
  }>;
}> {
  const response = await api.get(`/members/${memberId}/referral-incentives`);
  return response.data.data;
}

export { createAuthenticatedObjectUrl };
