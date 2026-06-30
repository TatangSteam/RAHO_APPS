import { test } from '../fixtures/base';
import { E2E_ROLES, getTestUser, missingCredentialMessage } from '../fixtures/test-users';
import { loginByApi, storageStatePath } from '../helpers/auth';

for (const role of E2E_ROLES) {
  test(`create storage state for ${role}`, async ({ page, request }) => {
    const user = getTestUser(role);
    test.skip(!user, missingCredentialMessage(role));

    await loginByApi(page, request, user!);
    await page.context().storageState({ path: storageStatePath(role) });
  });
}
