import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  renderSessionReportImage,
  SESSION_REPORT_HEIGHT,
  SESSION_REPORT_WIDTH,
} from '../whatsapp-report.renderer';
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
    expect(metadata.width).toBe(SESSION_REPORT_WIDTH);
    expect(metadata.height).toBe(SESSION_REPORT_HEIGHT);

    const headerStats = await sharp(image)
      .extract({ left: 60, top: 35, width: 650, height: 150 })
      .stats();
    const noPhotoStats = await sharp(image)
      .extract({ left: 625, top: 630, width: 320, height: 260 })
      .stats();
    expect(headerStats.channels.some((channel) => channel.stdev > 5)).toBe(true);
    expect(noPhotoStats.channels.some((channel) => channel.stdev > 2)).toBe(true);
  });

  it('installs the report font in the production API image', () => {
    const dockerfile = readFileSync(path.resolve(__dirname, '../../../../Dockerfile'), 'utf8');
    expect(dockerfile).toContain('font-dejavu');
  });

  it.each(SESSION_REPORT_BACKGROUND_KEYS)('renders selectable %s background', async (background) => {
    const image = await renderSessionReportImage(snapshot, undefined, background);
    const metadata = await sharp(image).metadata();
    expect(metadata.format).toBe('png');
    expect(image.length).toBeGreaterThan(10_000);
  });

  it('normalizes and renders an uploaded custom background', async () => {
    const custom = await sharp({
      create: { width: 1400, height: 900, channels: 3, background: '#2563eb' },
    }).jpeg().toBuffer();
    const image = await renderSessionReportImage(snapshot, undefined, 'CUSTOM', custom);
    const metadata = await sharp(image).metadata();
    expect(metadata.width).toBe(SESSION_REPORT_WIDTH);
    expect(metadata.height).toBe(SESSION_REPORT_HEIGHT);
    expect(metadata.format).toBe('png');
  });
});
