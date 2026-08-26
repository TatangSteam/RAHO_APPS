import sharp from 'sharp';
import type { SessionReportSnapshot } from './whatsapp-report.types';
import {
  getSessionReportBackground,
  type SessionReportBackgroundKey,
} from './whatsapp-backgrounds';

const WIDTH = 1080;
const HEIGHT = 1080;

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[character] || character);
}

export async function renderSessionReportImage(
  snapshot: SessionReportSnapshot,
  sourcePhoto?: Buffer,
  backgroundKey?: SessionReportBackgroundKey,
): Promise<Buffer> {
  const theme = getSessionReportBackground(backgroundKey);
  const photo = sourcePhoto
    ? await sharp(sourcePhoto).rotate().resize(560, 650, { fit: 'cover', position: 'centre' }).png().toBuffer()
    : await sharp({ create: { width: 560, height: 650, channels: 4, background: '#e7ece9' } })
      .composite([{ input: Buffer.from(`<svg width="560" height="650"><text x="280" y="325" text-anchor="middle" font-family="Arial" font-size="30" fill="#607068">Foto sesi tidak tersedia</text></svg>`) }])
      .png()
      .toBuffer();

  const overlay = Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1080" fill="${theme.canvas}"/>
      <g opacity="${theme.patternOpacity}" fill="none" stroke="${theme.accent}" stroke-width="4">
        <circle cx="90" cy="890" r="52"/><circle cx="205" cy="950" r="25"/>
        <path d="M35 835L145 945M145 835L35 945M270 835c55 0 55 95 110 95"/>
      </g>
      <path d="M0 0H1080V235C820 180 640 285 0 205Z" fill="${theme.header}"/>
      <text x="70" y="88" font-family="Arial" font-size="30" font-weight="700" fill="#ffffff">RAHO PREMIER CLUB</text>
      <text x="70" y="165" font-family="Arial" font-size="82" font-weight="800" fill="#ffffff">Salam Sehat</text>
      <rect x="450" y="268" width="590" height="710" rx="38" fill="${theme.card}" stroke="${theme.accent}" stroke-width="16"/>
      <rect x="70" y="305" width="310" height="115" rx="20" fill="${theme.card}" stroke="${theme.cardBorder}" stroke-width="3"/>
      <text x="225" y="345" text-anchor="middle" font-family="Arial" font-size="24" fill="${theme.mutedText}">INFUS KE</text>
      <text x="225" y="398" text-anchor="middle" font-family="Arial" font-size="48" font-weight="700" fill="${theme.accent}">${snapshot.session.infusionNumber}</text>
      <rect x="70" y="450" width="310" height="115" rx="20" fill="${theme.card}" stroke="${theme.cardBorder}" stroke-width="3"/>
      <text x="225" y="490" text-anchor="middle" font-family="Arial" font-size="24" fill="${theme.mutedText}">TANGGAL</text>
      <text x="225" y="540" text-anchor="middle" font-family="Arial" font-size="31" font-weight="700" fill="${theme.accent}">${escapeXml(snapshot.session.date)}</text>
      <text x="70" y="670" font-family="Arial" font-size="31" font-weight="700" fill="${theme.text}">${escapeXml(snapshot.member.displayName).slice(0, 29)}</text>
      <text x="70" y="715" font-family="Arial" font-size="25" fill="${theme.mutedText}">${escapeXml(snapshot.session.branchName).slice(0, 34)}</text>
      <text x="70" y="760" font-family="Arial" font-size="22" fill="${theme.mutedText}">${escapeXml(snapshot.sessionCode)}</text>
      <rect x="0" y="1025" width="1080" height="55" fill="${theme.header}"/>
      <text x="540" y="1061" text-anchor="middle" font-family="Arial" font-size="22" fill="#ffffff">Laporan sesi terapi • Rahasia dan hanya untuk penerima</text>
    </svg>`);

  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: '#ffffff' } })
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: photo, left: 465, top: 298 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
