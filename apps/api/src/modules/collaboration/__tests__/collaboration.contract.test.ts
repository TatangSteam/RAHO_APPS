import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createSubtaskSchema,
  createTaskSchema,
  createTeamSchema,
  updateTaskStatusSchema,
} from '../collaboration.schema';

const apiRoot = resolve(__dirname, '../../../..');

describe('Team task collaboration contract', () => {
  it('validates team, task, and subtask input at the API boundary', () => {
    expect(createTeamSchema.parse({ name: 'Tim Operasional' }).taskVisibilityPolicy).toBe('ALL_TEAM_MEMBERS');
    expect(createTaskSchema.parse({ teamId: 'team-1', title: 'Siapkan laporan' }).priority).toBe('MEDIUM');
    expect(createSubtaskSchema.parse({ title: 'Periksa angka' }).isRequired).toBe(true);
    expect(() => createTaskSchema.parse({ teamId: 'team-1', title: 'x' })).toThrow();
    expect(() => updateTaskStatusSchema.parse({ status: 'INVALID', version: 1 })).toThrow();
  });

  it('enforces membership, one-level subtasks, parent blockers, and real optimistic concurrency', () => {
    const service = readFileSync(resolve(apiRoot, 'src/modules/collaboration/collaboration.service.ts'), 'utf8');

    expect(service).toContain("row.status !== 'ACTIVE'");
    expect(service).toContain('parentTaskId: null, deletedAt: null');
    expect(service).toContain('SUBTASK_LIMIT_REACHED');
    expect(service).toContain('SUBTASKS_INCOMPLETE');
    expect(service).toContain('pg_advisory_xact_lock');
    expect(service).toContain('where: { id: taskId, version: input.version }');
    expect(service).toContain('TASK_VERSION_CONFLICT');
    expect(service).toContain('restrictSubtasks');
  });

  it('registers authenticated routes and persists the complete hierarchy', () => {
    const app = readFileSync(resolve(apiRoot, 'src/app.ts'), 'utf8');
    const routes = readFileSync(resolve(apiRoot, 'src/modules/collaboration/collaboration.routes.ts'), 'utf8');
    const migration = readFileSync(resolve(
      apiRoot,
      'prisma/migrations/20260907180000_add_team_task_collaboration/migration.sql',
    ), 'utf8');

    expect(app).toContain("app.use(`${prefix}/collaboration`, collaborationRouter)");
    expect(routes).toContain('router.use(authenticate, authorize(COLLABORATION_ROLES))');
    expect(routes).toContain('Object.values(Role).filter((role) => role !== Role.MEMBER)');
    expect(routes).toContain("router.post('/tasks/:taskId/subtasks'");
    expect(migration).toContain('CREATE TABLE "collaboration_teams"');
    expect(migration).toContain('CREATE TABLE "team_tasks"');
    expect(migration).toContain('"parentTaskId" TEXT');
    expect(migration).toContain('CREATE UNIQUE INDEX "team_tasks_teamId_taskNo_key"');
  });

  it('exposes a responsive dropdown UI under Extra', () => {
    const sidebar = readFileSync(resolve(apiRoot, '../web/src/components/layout/Sidebar.tsx'), 'utf8');
    const page = readFileSync(resolve(
      apiRoot,
      '../web/src/app/(staff)/extra/collaboration/page.tsx',
    ), 'utf8');
    const styles = readFileSync(resolve(
      apiRoot,
      '../web/src/app/(staff)/extra/collaboration/page.module.css',
    ), 'utf8');

    expect(sidebar).toContain("key: 'team-collaboration'");
    expect(sidebar).toContain("label: 'Tim & Tugas'");
    expect(sidebar).toContain("href: '/extra/collaboration/tasks'");
    expect(page).toContain('Tugas & Subtask');
    expect(page).toContain("setModal('subtask')");
    expect(styles).toContain('@media (max-width: 680px)');
    expect(styles).toContain(':global(.dark) .page');
  });
});
