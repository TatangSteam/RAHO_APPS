import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('treatment session staff grouping contract', () => {
  it('shows doctor and operational staff as separate sections', () => {
    const listPage = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');
    const detailPage = readFileSync(resolve(__dirname, '[sessionId]/page.tsx'), 'utf8');

    expect(listPage).toContain("id: 'doctorStaff'");
    expect(listPage).toContain("id: 'operationalStaff'");
    expect(listPage).toContain("label: 'MSO & Nakes'");
    expect(listPage).toContain("{ key: 'adminLayanan', label: 'MSO' }");
    expect(detailPage).toContain('Tim Dokter & Operasional');
    expect(detailPage).toContain('MSO & Nakes');
    expect(detailPage).not.toContain('Tim Medis & Admin');
  });
});
