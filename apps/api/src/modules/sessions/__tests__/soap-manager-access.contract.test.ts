import { readFileSync } from 'fs';
import { resolve } from 'path';

const sessionsRoot = resolve(__dirname, '..');

describe('SOAP manager access contract', () => {
  it('allows super admin and admin manager while preserving audit snapshots', () => {
    const controller = readFileSync(resolve(sessionsRoot, 'sessions.controller.ts'), 'utf8');
    const service = readFileSync(resolve(sessionsRoot, 'services/evaluation.service.ts'), 'utf8');
    expect(controller).toContain('user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_MANAGER');
    expect(service).toContain('Role.SUPER_ADMIN, Role.ADMIN_MANAGER');
    expect(service).toContain('beforeData: evaluation');
    expect(service).toContain('afterData: updated');
    expect(service).toContain("actor.role === Role.ADMIN_CABANG");
  });
});
