import type { SessionReportSnapshot } from './whatsapp-report.types';

const LABELS: Record<string, string> = {
  hho: 'HHO',
  hhoKonsentrat: 'HHO Konsentrat',
  h2: 'H2',
  no: 'NO',
  gaso: 'Gas O',
  o2: 'O2',
  o3: 'O3',
  edta: 'EDTA',
  mb: 'MB',
  h2s: 'H2S',
  kcl: 'KCL',
  jmlNb: 'Nano Bubble',
};

function lines(values: Record<string, string>): string[] {
  return Object.entries(values).map(([key, value]) => `${LABELS[key] || key}: ${value}`);
}

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 11) return 'Pagi';
  if (hour < 15) return 'Siang';
  if (hour < 18) return 'Sore';
  return 'Malam';
}

export function buildSessionReportCaption(snapshot: SessionReportSnapshot, now = new Date()): string {
  const content = [
    `Selamat ${greeting(now)} ${snapshot.member.displayName},`,
    '',
    'Salam Sehat,',
    '',
    `Berikut laporan sesi terapi hari ini (Infus ke-${snapshot.session.infusionNumber}):`,
    ...lines(snapshot.infusion),
  ];

  const vitalKeys = new Set([
    ...Object.keys(snapshot.vitals.before),
    ...Object.keys(snapshot.vitals.after),
  ]);
  if (vitalKeys.size) {
    content.push('', 'Tanda vital sebelum → sesudah:');
    vitalKeys.forEach((key) => {
      content.push(`${key}: ${snapshot.vitals.before[key] || '-'} → ${snapshot.vitals.after[key] || '-'}`);
    });
  }
  if (snapshot.recommendation) content.push('', 'Rekomendasi:', snapshot.recommendation);
  if (snapshot.notes) content.push('', 'Catatan:', snapshot.notes);
  content.push('', `Jadwal kunjungan berikutnya: ${snapshot.nextVisit || 'akan diinformasikan'}`);
  return content.join('\n');
}
