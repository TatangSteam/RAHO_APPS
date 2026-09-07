CREATE TYPE "CollaborationTeamRole" AS ENUM ('OWNER', 'LEADER', 'STAFF');
CREATE TYPE "CollaborationTeamStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "CollaborationMembershipStatus" AS ENUM ('ACTIVE', 'REMOVED', 'LEFT');
CREATE TYPE "CollaborationTaskVisibility" AS ENUM ('ASSIGNEE_ONLY', 'ALL_TEAM_MEMBERS');
CREATE TYPE "CollaborationTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_REVISION', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CollaborationTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "collaboration_teams" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "ownerId" TEXT NOT NULL,
  "primaryLeaderMembershipId" TEXT,
  "taskVisibilityPolicy" "CollaborationTaskVisibility" NOT NULL DEFAULT 'ALL_TEAM_MEMBERS',
  "status" "CollaborationTeamStatus" NOT NULL DEFAULT 'ACTIVE',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_memberships" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "CollaborationTeamRole" NOT NULL DEFAULT 'STAFF',
  "status" "CollaborationMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedBy" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_tasks" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "taskNo" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "parentTaskId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "status" "CollaborationTaskStatus" NOT NULL DEFAULT 'TODO',
  "priority" "CollaborationTaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "dueAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "team_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_assignments" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unassignedAt" TIMESTAMP(3),
  CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_comments" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "editedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_activities" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "taskId" TEXT,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collaboration_teams_primaryLeaderMembershipId_key" ON "collaboration_teams"("primaryLeaderMembershipId");
CREATE UNIQUE INDEX "collaboration_teams_ownerId_name_key" ON "collaboration_teams"("ownerId", "name");
CREATE INDEX "collaboration_teams_ownerId_status_idx" ON "collaboration_teams"("ownerId", "status");
CREATE INDEX "collaboration_teams_status_idx" ON "collaboration_teams"("status");
CREATE UNIQUE INDEX "team_memberships_teamId_userId_key" ON "team_memberships"("teamId", "userId");
CREATE INDEX "team_memberships_userId_status_idx" ON "team_memberships"("userId", "status");
CREATE INDEX "team_memberships_teamId_role_status_idx" ON "team_memberships"("teamId", "role", "status");
CREATE UNIQUE INDEX "team_tasks_teamId_taskNo_key" ON "team_tasks"("teamId", "taskNo");
CREATE INDEX "team_tasks_teamId_parentTaskId_sortOrder_idx" ON "team_tasks"("teamId", "parentTaskId", "sortOrder");
CREATE INDEX "team_tasks_teamId_status_dueAt_idx" ON "team_tasks"("teamId", "status", "dueAt");
CREATE INDEX "team_tasks_createdById_idx" ON "team_tasks"("createdById");
CREATE UNIQUE INDEX "task_assignments_taskId_userId_key" ON "task_assignments"("taskId", "userId");
CREATE INDEX "task_assignments_userId_unassignedAt_idx" ON "task_assignments"("userId", "unassignedAt");
CREATE INDEX "task_comments_taskId_createdAt_idx" ON "task_comments"("taskId", "createdAt");
CREATE INDEX "task_comments_authorId_idx" ON "task_comments"("authorId");
CREATE INDEX "task_activities_teamId_createdAt_idx" ON "task_activities"("teamId", "createdAt");
CREATE INDEX "task_activities_taskId_createdAt_idx" ON "task_activities"("taskId", "createdAt");

ALTER TABLE "collaboration_teams" ADD CONSTRAINT "collaboration_teams_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "collaboration_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_teams" ADD CONSTRAINT "collaboration_teams_primaryLeaderMembershipId_fkey" FOREIGN KEY ("primaryLeaderMembershipId") REFERENCES "team_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "team_tasks" ADD CONSTRAINT "team_tasks_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "collaboration_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_tasks" ADD CONSTRAINT "team_tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "team_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_tasks" ADD CONSTRAINT "team_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_tasks" ADD CONSTRAINT "team_tasks_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "team_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "team_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "collaboration_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "team_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
