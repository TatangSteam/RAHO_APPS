import { api } from '@/lib/api';

export type TeamRole = 'OWNER' | 'LEADER' | 'STAFF';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'SUBMITTED' | 'NEEDS_REVISION' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type CollaborationUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  staffCode?: string | null;
  avatarUrl?: string | null;
};

export type Membership = {
  id: string;
  role: TeamRole;
  status: string;
  userId: string;
  user: CollaborationUser;
};

export type Team = {
  id: string;
  name: string;
  description?: string | null;
  myRole: TeamRole;
  taskVisibilityPolicy: 'ASSIGNEE_ONLY' | 'ALL_TEAM_MEMBERS';
  primaryLeaderMembershipId?: string | null;
  primaryLeader?: CollaborationUser | null;
  memberships: Membership[];
};

export type TaskComment = {
  id: string;
  content: string;
  createdAt: string;
  author: CollaborationUser;
};

export type CollaborationTask = {
  id: string;
  teamId: string;
  taskNo: number;
  title: string;
  description?: string | null;
  parentTaskId?: string | null;
  isRequired: boolean;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string | null;
  version: number;
  createdAt: string;
  assignees: CollaborationUser[];
  createdBy: CollaborationUser;
  reviewedBy?: CollaborationUser | null;
  subtasks: CollaborationTask[];
  comments: TaskComment[];
  commentCount?: number;
  progress: { completed: number; total: number; percent: number };
};

export type CollaborationBootstrap = {
  teams: Team[];
  selectedTeamId: string | null;
  tasks: CollaborationTask[];
  users: CollaborationUser[];
  activities: Array<{
    id: string;
    action: string;
    createdAt: string;
    actor: CollaborationUser;
    task?: { id: string; taskNo: number; title: string } | null;
  }>;
  stats: { total: number; todo: number; inProgress: number; submitted: number; completed: number; overdue: number };
};

type TaskPayload = {
  title: string;
  description?: string;
  priority: TaskPriority;
  dueAt?: string | null;
  assigneeIds: string[];
  isRequired?: boolean;
};

const data = <T>(response: { data: { data: T } }) => response.data.data;

export const collaborationApi = {
  bootstrap: async (params?: { teamId?: string; status?: string; search?: string }) =>
    data<CollaborationBootstrap>(await api.get('/collaboration/bootstrap', { params })),
  createTeam: async (payload: { name: string; description?: string; taskVisibilityPolicy: Team['taskVisibilityPolicy'] }) =>
    data<Team>(await api.post('/collaboration/teams', payload)),
  updateTeam: async (teamId: string, payload: Partial<Pick<Team, 'name' | 'description' | 'taskVisibilityPolicy'>>) =>
    data<Team>(await api.patch(`/collaboration/teams/${teamId}`, payload)),
  addMember: async (teamId: string, payload: { userId: string; role: 'LEADER' | 'STAFF' }) =>
    data<Membership>(await api.post(`/collaboration/teams/${teamId}/members`, payload)),
  updateMember: async (teamId: string, membershipId: string, payload: { role?: 'LEADER' | 'STAFF'; status?: 'ACTIVE' | 'REMOVED' }) =>
    data<Membership>(await api.patch(`/collaboration/teams/${teamId}/members/${membershipId}`, payload)),
  setPrimaryLeader: async (teamId: string, membershipId: string) =>
    data<Team>(await api.patch(`/collaboration/teams/${teamId}/primary-leader`, { membershipId })),
  createTask: async (payload: TaskPayload & { teamId: string }) =>
    data<CollaborationTask>(await api.post('/collaboration/tasks', payload)),
  createSubtask: async (taskId: string, payload: TaskPayload) =>
    data<CollaborationTask>(await api.post(`/collaboration/tasks/${taskId}/subtasks`, payload)),
  getTask: async (taskId: string) =>
    data<CollaborationTask>(await api.get(`/collaboration/tasks/${taskId}`)),
  updateTaskStatus: async (taskId: string, payload: { status: TaskStatus; version: number; reason?: string }) =>
    data<CollaborationTask>(await api.patch(`/collaboration/tasks/${taskId}/status`, payload)),
  createComment: async (taskId: string, content: string) =>
    data<TaskComment>(await api.post(`/collaboration/tasks/${taskId}/comments`, { content })),
};
