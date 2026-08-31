import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('staff performance role grouping contract', () => {
  it('separates doctors from the combined MSO and Nakes metric', () => {
    const page = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');
    const detail = readFileSync(resolve(__dirname, '[staffId]/page.tsx'), 'utf8');
    const usersApi = readFileSync(resolve(__dirname, '../../../lib/usersApi.ts'), 'utf8');

    expect(page).toContain('data?.summary.uniqueSessions');
    expect(page).toContain('data?.summary.asOperational');
    expect(page).toContain('MSO & Nakes');
    expect(page).not.toContain('staff.performance.asNurse');
    expect(page).not.toContain('staff.performance.asAdminLayanan');
    expect(detail).toContain("'operational'");
    expect(detail).toContain('getDisplayPositions');
    expect(usersApi).toContain('asOperational: number');
  });
});
