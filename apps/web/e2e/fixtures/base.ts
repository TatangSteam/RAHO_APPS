import { test as base, expect } from '@playwright/test';
import { loginByApi, loginByUi } from '../helpers/auth';
import type { E2ERole, E2EUser } from './test-users';
import { requireTestUser } from './test-users';

type LoginMode = 'api' | 'ui';

interface RahoFixtures {
  loginAs: (role: E2ERole, options?: { mode?: LoginMode }) => Promise<E2EUser>;
}

export const test = base.extend<RahoFixtures>({
  loginAs: async ({ page, request }, use) => {
    await use(async (role, options = {}) => {
      const user = requireTestUser(role);
      const mode = options.mode || 'api';

      if (mode === 'ui') {
        await loginByUi(page, user);
      } else {
        await loginByApi(page, request, user);
      }

      return user;
    });
  },
});

export { expect };
