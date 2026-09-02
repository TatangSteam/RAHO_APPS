import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('legacy session inventory bypass contract', () => {
  const moduleRoot = resolve(__dirname, '..');
  const apiRoot = resolve(moduleRoot, '../../..');
  const creation = readFileSync(resolve(moduleRoot, 'services/session-creation.service.ts'), 'utf8');
  const completion = readFileSync(resolve(moduleRoot, 'services/session-completion.service.ts'), 'utf8');
  const infusion = readFileSync(resolve(moduleRoot, 'services/infusion.service.ts'), 'utf8');
  const retrieval = readFileSync(resolve(moduleRoot, 'services/session-retrieval.service.ts'), 'utf8');
  const schema = readFileSync(resolve(apiRoot, 'prisma/schema.prisma'), 'utf8');

  it('persists and audits the explicit inventory policy', () => {
    expect(schema).toContain('skipInventoryConsumption   Boolean');
    expect(creation).toContain('LEGACY_SESSION_NO_STOCK');
    expect(creation).toContain('skipInventoryConsumption: data.skipInventoryConsumption');
  });

  it('does not draft or post inventory for an opted-in legacy session', () => {
    expect(creation).toContain('if (!data.skipInventoryConsumption)');
    expect(completion).toContain('if (!isLegacySession && !skipsInventory)');
    expect(completion).toContain("inventorySource: skipsInventory\n          ? 'NONE'");
    expect(completion).toContain('if (!skipsInventory) {\n        await createInventorySyncEventInTransaction');
    expect(infusion).toContain('if (session.skipInventoryConsumption) {\n        return infusion;');
  });

  it('marks the material step complete without fabricating a material row', () => {
    expect(retrieval).toContain('session.skipInventoryConsumption || session.materials.length > 0');
  });
});
