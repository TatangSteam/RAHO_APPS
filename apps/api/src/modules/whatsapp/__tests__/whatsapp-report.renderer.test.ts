import sharp from 'sharp';
import { renderSessionReportImage } from '../whatsapp-report.renderer';
import type { SessionReportSnapshot } from '../whatsapp-report.types';
import { SESSION_REPORT_BACKGROUND_KEYS } from '../whatsapp-backgrounds';

const snapshot: SessionReportSnapshot = {
  templateVersion: 1,
  sessionId: 'session-1',
  sessionCode: 'SES-2026-0001',
  member: { displayName: 'Tn. Jovan Kuncoro' },
  session: { infusionNumber: 1, date: '30 Juli 2026', branchName: 'RAHO Premier Club' },
  infusion: {},
  vitals: { before: {}, after: {} },
  photo: { allowed: false },
};

describe('WhatsApp session report image renderer', () => {
  it('renders a deterministic mobile-friendly PNG without a session photo', async () => {
    const image = await renderSessionReportImage(snapshot);
    const metadata = await sharp(image).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1080);
  });

  it.each(SESSION_REPORT_BACKGROUND_KEYS)('renders selectable %s background', async (background) => {
    const image = await renderSessionReportImage(snapshot, undefined, background);
    const metadata = await sharp(image).metadata();
    expect(metadata.format).toBe('png');
    expect(image.length).toBeGreaterThan(10_000);
  });
});
