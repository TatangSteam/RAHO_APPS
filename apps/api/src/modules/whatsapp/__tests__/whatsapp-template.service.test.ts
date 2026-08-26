import { buildSessionReportCaption } from '../whatsapp-template.service';
import { maskWhatsAppNumber, normalizeIndonesianWhatsAppNumber } from '../whatsapp-phone.util';
import type { SessionReportSnapshot } from '../whatsapp-report.types';

const snapshot: SessionReportSnapshot = {
  templateVersion: 1,
  sessionId: 'session-1',
  sessionCode: 'SES-2026-0001',
  member: { displayName: 'Tn. Jovan Kuncoro' },
  session: { infusionNumber: 1, date: '30/7/2026', branchName: 'RAHO Premier Club' },
  infusion: { hho: '5 ml', no: '2.5 ml' },
  vitals: {
    before: { TEKANAN_DARAH: '125/79 mmHg' },
    after: { TEKANAN_DARAH: '117/71 mmHg' },
  },
  recommendation: 'Jaga keseimbangan aktivitas dan istirahat.',
  photo: { allowed: true, sourcePhotoId: 'photo-1' },
};

describe('WhatsApp treatment-session report', () => {
  it('normalizes and masks Indonesian mobile numbers', () => {
    expect(normalizeIndonesianWhatsAppNumber('0812-3456-7890')).toBe('6281234567890');
    expect(normalizeIndonesianWhatsAppNumber('+62 812 3456 7890')).toBe('6281234567890');
    expect(normalizeIndonesianWhatsAppNumber('abc')).toBeNull();
    expect(maskWhatsAppNumber('6281234567890')).toBe('6281****890');
  });

  it('builds a clinical caption only from snapshot fields', () => {
    const caption = buildSessionReportCaption(snapshot, new Date('2026-07-30T13:00:00+07:00'));
    expect(caption).toContain('Selamat Siang Tn. Jovan Kuncoro');
    expect(caption).toContain('HHO: 5 ml');
    expect(caption).toContain('125/79 mmHg → 117/71 mmHg');
    expect(caption).toContain(snapshot.recommendation);
    expect(caption).not.toContain('menyembuhkan kanker');
  });
});
