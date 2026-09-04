import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import type { SessionReportSnapshot } from './whatsapp-report.types';
import {
  getSessionReportBackground,
  type SessionReportBackgroundKey,
} from './whatsapp-backgrounds';

export const SESSION_REPORT_WIDTH = 1080;
export const SESSION_REPORT_HEIGHT = 1350;

const REPORT_FONT_FAMILY = 'DejaVu Sans, Liberation Sans, sans-serif';
const BRAND_ASSET_NAMES = {
  imi: 'logo-imi-new.png',
  raho: 'LOGORAHO.png',
} as const;

type BrandAssets = { imi?: Buffer; raho?: Buffer };
let brandAssetsPromise: Promise<BrandAssets> | undefined;

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[character] || character);
}

function truncate(value: string, maxLength: number): string {
  const clean = value.trim();
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 3).trimEnd()}...`;
}

function wrapWords(value: string, maxLength: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const result: string[] = [];
  let line = '';

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] || '';
    if (result.length === maxLines - 1) {
      return [...result, truncate([line, ...words.slice(index)].filter(Boolean).join(' '), maxLength)];
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxLength || !line) {
      line = candidate;
      continue;
    }
    result.push(line);
    line = word;
  }

  if (line && result.length < maxLines) result.push(line);
  return result.length > 0 ? result : ['Member RAHO'];
}

function localBrandCandidates(fileName: string): string[] {
  return [
    path.resolve(process.cwd(), '../web/public/asset', fileName),
    path.resolve(process.cwd(), 'apps/web/public/asset', fileName),
    path.resolve(__dirname, '../../../../../web/public/asset', fileName),
  ];
}

async function loadLocalBrandAsset(fileName: string): Promise<Buffer | undefined> {
  for (const candidate of localBrandCandidates(fileName)) {
    try {
      return await readFile(candidate);
    } catch {
      // Try the next monorepo/runtime location.
    }
  }
  return undefined;
}

async function loadPublicBrandAsset(fileName: string): Promise<Buffer | undefined> {
  const publicOrigins = [
    process.env.WEB_URL,
    process.env.CORS_ORIGIN?.split(',')[0]?.trim(),
    process.env.API_URL,
  ].filter((origin): origin is string => Boolean(origin?.startsWith('http')));

  for (const origin of publicOrigins) {
    try {
      const response = await fetch(new URL(`/asset/${fileName}`, origin), {
        signal: AbortSignal.timeout(3_000),
      });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
    } catch {
      // The renderer still has a text fallback when the public web is offline.
    }
  }
  return undefined;
}

async function loadBrandAsset(fileName: string): Promise<Buffer | undefined> {
  return (await loadLocalBrandAsset(fileName)) || loadPublicBrandAsset(fileName);
}

async function loadBrandAssets(): Promise<BrandAssets> {
  brandAssetsPromise ||= Promise.all([
    loadBrandAsset(BRAND_ASSET_NAMES.imi),
    loadBrandAsset(BRAND_ASSET_NAMES.raho),
  ]).then(([imi, raho]) => ({ imi, raho }));
  return brandAssetsPromise;
}

async function prepareLogo(source: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(source)
    .resize(width, height, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function preparePhoto(sourcePhoto?: Buffer): Promise<Buffer> {
  const photo = sourcePhoto
    ? await sharp(sourcePhoto).rotate().resize(480, 620, { fit: 'cover', position: 'centre' }).png().toBuffer()
    : await sharp({ create: { width: 480, height: 620, channels: 4, background: '#ece9e4' } })
      .composite([{
        input: Buffer.from(`<svg width="480" height="620" xmlns="http://www.w3.org/2000/svg">
          <circle cx="240" cy="258" r="70" fill="#d6d0c8"/>
          <path d="M105 530c16-112 73-174 135-174s119 62 135 174" fill="#d6d0c8"/>
          <text x="240" y="580" text-anchor="middle" font-family="${REPORT_FONT_FAMILY}" font-size="23" fill="#716b64">Foto sesi tidak tersedia</text>
        </svg>`),
      }])
      .png()
      .toBuffer();

  const roundedMask = Buffer.from(
    '<svg width="480" height="620" xmlns="http://www.w3.org/2000/svg"><rect width="480" height="620" rx="27" fill="#fff"/></svg>',
  );
  return sharp(photo)
    .composite([{ input: roundedMask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

export async function renderSessionReportImage(
  snapshot: SessionReportSnapshot,
  sourcePhoto?: Buffer,
  backgroundKey?: SessionReportBackgroundKey,
  customBackground?: Buffer,
): Promise<Buffer> {
  const theme = getSessionReportBackground(backgroundKey);
  const [photo, brandAssets] = await Promise.all([preparePhoto(sourcePhoto), loadBrandAssets()]);
  const memberNameLines = wrapWords(snapshot.member.displayName.toUpperCase(), 24, 2);
  const memberNameSvg = memberNameLines.map((line, index) => (
    `<text x="58" y="${923 + (index * 43)}" font-family="${REPORT_FONT_FAMILY}" font-size="31" font-weight="800" fill="${theme.text}">${escapeXml(line)}</text>`
  )).join('');
  const branchName = truncate(snapshot.session.branchName.toUpperCase(), 28);
  const logoFallback = [
    !brandAssets.imi
      ? `<text x="605" y="79" text-anchor="middle" font-family="${REPORT_FONT_FAMILY}" font-size="25" font-weight="800" fill="${theme.accent}">IMI</text>`
      : '',
    !brandAssets.raho
      ? `<text x="912" y="79" text-anchor="middle" font-family="${REPORT_FONT_FAMILY}" font-size="23" font-weight="800" fill="${theme.accent}">RAHO CLUB</text>`
      : '',
  ].join('');

  const overlay = Buffer.from(`
    <svg width="${SESSION_REPORT_WIDTH}" height="${SESSION_REPORT_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="page" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="0.58" stop-color="${theme.canvas}"/>
          <stop offset="1" stop-color="#ffffff"/>
        </linearGradient>
        <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${theme.header}"/>
          <stop offset="1" stop-color="${theme.accent}"/>
        </linearGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#351114" flood-opacity="0.22"/>
        </filter>
      </defs>

      <rect width="1080" height="1350" fill="url(#page)" fill-opacity="${customBackground ? '0.78' : '1'}"/>
      <rect width="1080" height="12" fill="url(#brand)"/>
      <g opacity="${customBackground ? '0.16' : Math.max(theme.patternOpacity, 0.08)}" fill="none" stroke="${theme.accent}">
        <circle cx="445" cy="305" r="38" stroke-width="3"/><circle cx="470" cy="370" r="13" stroke-width="2"/>
        <circle cx="1010" cy="330" r="46" stroke-width="3"/><circle cx="970" cy="260" r="18" stroke-width="2"/>
        <circle cx="92" cy="1108" r="48" stroke-width="3"/><circle cx="171" cy="1142" r="19" stroke-width="2"/>
      </g>

      <text x="55" y="69" font-family="${REPORT_FONT_FAMILY}" font-size="24" font-weight="800" fill="${theme.accent}">${escapeXml(branchName)}</text>
      <text x="55" y="101" font-family="${REPORT_FONT_FAMILY}" font-size="16" font-weight="700" letter-spacing="2" fill="${theme.mutedText}">REVERSE AGING &amp; HOMEOSTASIS</text>
      ${logoFallback}

      <text x="54" y="252" font-family="${REPORT_FONT_FAMILY}" font-size="92" font-weight="900" fill="${theme.header}" filter="url(#shadow)">Salam</text>
      <text x="54" y="344" font-family="${REPORT_FONT_FAMILY}" font-size="92" font-weight="900" fill="${theme.header}" filter="url(#shadow)">Sehat</text>
      <text x="59" y="389" font-family="${REPORT_FONT_FAMILY}" font-size="18" font-weight="700" letter-spacing="4" fill="${theme.mutedText}">LAPORAN SESI TERAPI</text>

      <rect x="54" y="465" width="407" height="145" rx="30" fill="#ffffff" fill-opacity="0.94" stroke="${theme.cardBorder}" stroke-width="3"/>
      <circle cx="117" cy="537" r="43" fill="${theme.header}"/>
      <path d="M103 505h28v49h-28zM98 513h38M109 498v9M125 498v9M109 555v12M125 555v12" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
      <text x="180" y="516" font-family="${REPORT_FONT_FAMILY}" font-size="20" font-weight="800" fill="${theme.mutedText}">INFUS KE</text>
      <text x="180" y="574" font-family="${REPORT_FONT_FAMILY}" font-size="55" font-weight="900" fill="${theme.text}">${snapshot.session.infusionNumber}</text>

      <rect x="54" y="638" width="407" height="145" rx="30" fill="#ffffff" fill-opacity="0.94" stroke="${theme.cardBorder}" stroke-width="3"/>
      <circle cx="117" cy="710" r="43" fill="${theme.header}"/>
      <rect x="96" y="692" width="42" height="35" rx="5" fill="none" stroke="#ffffff" stroke-width="5"/>
      <path d="M96 701h42M107 683v12M127 683v12" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
      <text x="180" y="690" font-family="${REPORT_FONT_FAMILY}" font-size="20" font-weight="800" fill="${theme.mutedText}">TANGGAL</text>
      <text x="180" y="743" font-family="${REPORT_FONT_FAMILY}" font-size="28" font-weight="900" fill="${theme.text}">${escapeXml(truncate(snapshot.session.date, 20))}</text>

      <rect x="524" y="426" width="520" height="660" rx="42" fill="#ffffff" stroke="${theme.accent}" stroke-width="14" filter="url(#shadow)"/>
      <rect x="540" y="442" width="488" height="628" rx="32" fill="none" stroke="${theme.header}" stroke-width="4"/>

      <text x="58" y="873" font-family="${REPORT_FONT_FAMILY}" font-size="17" font-weight="800" letter-spacing="3" fill="${theme.accent}">PENERIMA LAPORAN</text>
      ${memberNameSvg}
      <text x="58" y="${1012 + ((memberNameLines.length - 1) * 43)}" font-family="${REPORT_FONT_FAMILY}" font-size="22" font-weight="700" fill="${theme.mutedText}">${escapeXml(truncate(snapshot.session.branchName, 31))}</text>
      <text x="58" y="${1050 + ((memberNameLines.length - 1) * 43)}" font-family="${REPORT_FONT_FAMILY}" font-size="18" fill="${theme.mutedText}">${escapeXml(truncate(snapshot.sessionCode, 35))}</text>

      <path d="M0 1180C265 1245 745 1112 1080 1180V1350H0Z" fill="url(#brand)"/>
      <path d="M0 1160C305 1214 730 1098 1080 1158" fill="none" stroke="#ffffff" stroke-opacity="0.92" stroke-width="15"/>
      <circle cx="75" cy="1272" r="30" fill="none" stroke="#ffffff" stroke-width="5"/>
      <circle cx="75" cy="1272" r="10" fill="none" stroke="#ffffff" stroke-width="5"/>
      <circle cx="94" cy="1253" r="4" fill="#ffffff"/>
      <text x="123" y="1281" font-family="${REPORT_FONT_FAMILY}" font-size="28" font-weight="700" fill="#ffffff">@RAHOPREMIER</text>
      <circle cx="603" cy="1272" r="30" fill="none" stroke="#ffffff" stroke-width="5"/>
      <path d="M587 1289l5-13c-9-18 4-35 20-35 17 0 29 13 29 29 0 17-13 30-30 30-7 0-13-2-18-6z" fill="none" stroke="#ffffff" stroke-width="4"/>
      <text x="651" y="1281" font-family="${REPORT_FONT_FAMILY}" font-size="24" font-weight="700" fill="#ffffff">RAHO PREMIER CLUB</text>
      <text x="540" y="1325" text-anchor="middle" font-family="${REPORT_FONT_FAMILY}" font-size="15" fill="#ffffff" fill-opacity="0.85">Dokumen pribadi &#8226; Hanya untuk penerima laporan</text>
    </svg>`);

  const canvas = customBackground
    ? sharp(customBackground).rotate().resize(SESSION_REPORT_WIDTH, SESSION_REPORT_HEIGHT, { fit: 'cover', position: 'centre' })
    : sharp({
        create: {
          width: SESSION_REPORT_WIDTH,
          height: SESSION_REPORT_HEIGHT,
          channels: 4,
          background: theme.canvas,
        },
      });

  const composites: OverlayOptions[] = [{ input: overlay, left: 0, top: 0 }];
  if (brandAssets.imi) {
    composites.push({ input: await prepareLogo(brandAssets.imi, 255, 102), left: 477, top: 25 });
  }
  if (brandAssets.raho) {
    composites.push({ input: await prepareLogo(brandAssets.raho, 188, 130), left: 835, top: 15 });
  }
  composites.push({ input: photo, left: 544, top: 446 });

  return canvas
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
}
