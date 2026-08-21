import fs from 'fs';
import path from 'path';
import { completeSessionSchema } from '../sessions.schema';

describe('session inventory source contract', () => {
  const moduleRoot = path.resolve(__dirname, '..');
  const completionService = fs.readFileSync(path.join(moduleRoot, 'services', 'session-completion.service.ts'), 'utf8');

  it('accepts an explicit branch or team choice and keeps AUTO for old clients', () => {
    expect(completeSessionSchema.parse({}).inventorySource).toBe('AUTO');
    expect(completeSessionSchema.safeParse({ inventorySource: 'BRANCH' }).success).toBe(true);
    expect(completeSessionSchema.safeParse({ inventorySource: 'TEAM' }).success).toBe(true);
    expect(completeSessionSchema.safeParse({ inventorySource: 'UNKNOWN' }).success).toBe(false);
  });

  it('does not silently fall back when the user explicitly chooses team stock', () => {
    expect(completionService).toContain("input.inventorySource === 'BRANCH'");
    expect(completionService).toContain("input.inventorySource === 'TEAM' && !teamInventory");
    expect(completionService).toContain("'SESSION_INVENTORY_TEAM_NOT_FOUND'");
  });
});
