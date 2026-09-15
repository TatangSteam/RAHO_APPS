import { expect, test } from '@playwright/test';

const actor = { id: 'user-1', fullName: 'Admin Uji', email: 'admin@raho.id', role: 'SUPER_ADMIN' };
const membership = { id: 'membership-1', userId: actor.id, role: 'OWNER', status: 'ACTIVE', user: actor };
const team = {
  id: 'team-1', name: 'Tim Operasional', description: 'Pekerjaan harian', myRole: 'OWNER',
  taskVisibilityPolicy: 'ALL_TEAM_MEMBERS', primaryLeaderMembershipId: membership.id,
  primaryLeader: actor, memberships: [membership],
};

test('owner can create, edit, comment, and soft-delete a task through the UI', async ({ page }) => {
  const token = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  await page.context().addCookies([{ name: 'raho-auth-token', value: Buffer.from(JSON.stringify({ role: 'SUPER_ADMIN', userId: actor.id })).toString('base64'), domain: 'localhost', path: '/' }]);
  await page.addInitScript((accessToken) => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: {
      user: { userId: 'user-1', email: 'admin@raho.id', role: 'SUPER_ADMIN', fullName: 'Admin Uji', branches: [] },
      accessToken, refreshToken: 'mock-refresh', isAuthenticated: true, assignedBranches: [],
    }, version: 0 }));
  }, token);

  let task: Record<string, unknown> | null = null;
  let comments: Array<Record<string, unknown>> = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    let response: unknown = [];

    if (path.endsWith('/collaboration/bootstrap')) {
      const tasks = task ? [{ ...task, comments }] : [];
      response = { teams: [team], selectedTeamId: team.id, tasks, users: [actor], activities: [],
        stats: { total: tasks.length, todo: tasks.length, inProgress: 0, submitted: 0, completed: 0, overdue: 0 } };
    } else if (path.endsWith('/collaboration/tasks') && method === 'POST') {
      const input = request.postDataJSON();
      task = { ...input, id: 'task-1', teamId: team.id, taskNo: 1, status: 'TODO', version: 1,
        createdAt: new Date().toISOString(), createdBy: actor, assignees: [actor], subtasks: [], comments: [],
        progress: { completed: 0, total: 0, percent: 0 } };
      response = task;
    } else if (path.endsWith('/collaboration/tasks/task-1') && method === 'GET') {
      response = { ...task, comments };
    } else if (path.endsWith('/collaboration/tasks/task-1') && method === 'PATCH') {
      task = { ...task, ...request.postDataJSON(), version: Number(task?.version || 1) + 1, comments };
      response = task;
    } else if (path.endsWith('/collaboration/tasks/task-1') && method === 'DELETE') {
      task = null;
      response = { id: 'task-1', deleted: true };
    } else if (path.endsWith('/collaboration/tasks/task-1/comments') && method === 'POST') {
      const entry = { id: 'comment-1', content: request.postDataJSON().content, createdAt: new Date().toISOString(), author: actor };
      comments = [entry];
      response = entry;
    } else if (path.endsWith('/collaboration/tasks/task-1/comments/comment-1') && method === 'PATCH') {
      comments = [{ ...comments[0], content: request.postDataJSON().content, editedAt: new Date().toISOString() }];
      response = comments[0];
    } else if (path.endsWith('/collaboration/tasks/task-1/comments/comment-1') && method === 'DELETE') {
      comments = [];
      response = { id: 'comment-1', deleted: true };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: response }) });
  });

  await page.goto('/extra/collaboration/tasks');
  await expect(page.getByRole('heading', { name: 'Tugas & Subtask' })).toBeVisible();
  await page.getByRole('button', { name: 'Tugas Baru' }).click();
  await page.getByPlaceholder('Apa yang harus diselesaikan?').fill('Laporan harian');
  await page.getByRole('button', { name: 'Buat Tugas' }).click();
  await expect(page.getByRole('heading', { name: 'Laporan harian' })).toBeVisible();

  await page.getByRole('button', { name: /#1 Laporan harian/ }).click();
  await page.getByRole('button', { name: 'Edit tugas' }).click();
  await page.getByPlaceholder('Apa yang harus diselesaikan?').fill('Laporan harian final');
  await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
  await expect(page.getByRole('heading', { name: 'Laporan harian final' })).toBeVisible();

  await page.getByRole('button', { name: /#1 Laporan harian final/ }).click();
  await page.getByPlaceholder('Tulis komentar atau update...').fill('Progres awal');
  await page.locator('form').filter({ has: page.getByPlaceholder('Tulis komentar atau update...') }).locator('button').click();
  await expect(page.getByText('Progres awal', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('textarea').last().fill('Progres diperbarui');
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(page.getByText('Progres diperbarui', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Hapus', exact: true }).click();
  await page.getByRole('button', { name: 'Konfirmasi' }).click();
  await expect(page.getByText('Belum ada komentar.')).toBeVisible();
  await page.getByRole('button', { name: 'Hapus tugas' }).click();
  await page.getByRole('button', { name: 'Konfirmasi' }).click();
  await expect(page.getByText('Tidak ada tugas yang cocok dengan filter.')).toBeVisible();
});
