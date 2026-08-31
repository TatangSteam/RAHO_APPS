import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('SOAP role access contract', () => {
  it('allows assigned clinical and operational staff to edit while keeping audit wording visible', () => {
    const component = readFileSync(resolve(__dirname, 'Step9Evaluation.tsx'), 'utf8');
    expect(component).toContain("['DOCTOR', 'NURSE', 'ADMIN_LAYANAN', 'SUPER_ADMIN', 'ADMIN_MANAGER']");
    expect(component).toContain('perubahan tercatat di audit');
    expect(component).not.toContain("const canEdit = user?.role === 'DOCTOR'");
  });
});

describe('WhatsApp report readiness contract', () => {
  it('shows the report after operational data without requiring doctor evaluation', () => {
    const page = readFileSync(resolve(__dirname, '../../app/(staff)/sessions/[sessionId]/page.tsx'), 'utf8');
    expect(page).toContain('steps.step3_vitalBefore');
    expect(page).toContain('steps.step4_infusion');
    expect(page).toContain('steps.step7_vitalAfter');
    expect(page).not.toContain('sessionInfo.isCompleted && !isCompletionCancelled && (\n        <WhatsAppReportCard');
  });
});
