import { api } from '@/lib/api';
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

  // Append member data - only non-empty values
  Object.entries(memberData).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, typeof value === 'boolean' ? String(value) : value);
    }
  });

  // Append files
  if (files.psp) {
    formData.append('psp', files.psp);
  }
  if (files.photo) {
    formData.append('photo', files.photo);
  }

  const { data } = await api.post<{
    data: { memberId: string; memberNo: string; message: string };
  }>('/members', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

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
