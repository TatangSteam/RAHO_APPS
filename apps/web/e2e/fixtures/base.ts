import { test as base, expect, type Page } from '@playwright/test';
import { loginByApi, loginByUi, restoreAuthFromStorageState } from '../helpers/auth';
import type { E2ERole } from './test-users';
import { requireTestUser } from './test-users';

type LoginMode = 'api' | 'ui';

interface RahoFixtures {
  loginAs: (role: E2ERole, options?: { mode?: LoginMode }) => Promise<Page>;
}

export const test = base.extend<RahoFixtures>({
  loginAs: async ({ page, request }, use) => {
    await use(async (role, options = {}) => {
      const user = requireTestUser(role);
      const mode = options.mode || 'api';

      if (mode === 'ui') {
        await loginByUi(page, user);
      } else if (!(await restoreAuthFromStorageState(page, role, user.expectedPath))) {
        await loginByApi(page, request, user);
      }

      return page;
    });
  },
});

export { expect };
