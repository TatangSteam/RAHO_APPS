export const SESSION_REPORT_BACKGROUND_KEYS = [
  'RAHO_RED',
  'HEALTH_GREEN',
  'PREMIUM_GOLD',
  'CLEAN_LIGHT',
  'CUSTOM',
] as const;

export type SessionReportBackgroundKey = typeof SESSION_REPORT_BACKGROUND_KEYS[number];

export interface SessionReportBackground {
  key: SessionReportBackgroundKey;
  name: string;
  canvas: string;
  header: string;
  accent: string;
  text: string;
  mutedText: string;
  card: string;
  cardBorder: string;
  patternOpacity: number;
}

export const SESSION_REPORT_BACKGROUNDS: Record<SessionReportBackgroundKey, SessionReportBackground> = {
  RAHO_RED: {
    key: 'RAHO_RED', name: 'Merah RAHO', canvas: '#f7faf8', header: '#7e171b', accent: '#a31e24',
    text: '#1d2a23', mutedText: '#66716a', card: '#ffffff', cardBorder: '#d7ded9', patternOpacity: 0.07,
  },
  HEALTH_GREEN: {
    key: 'HEALTH_GREEN', name: 'Hijau Sehat', canvas: '#eef8f3', header: '#145c43', accent: '#238461',
    text: '#17372c', mutedText: '#547267', card: '#ffffff', cardBorder: '#bed9cd', patternOpacity: 0.08,
  },
  PREMIUM_GOLD: {
    key: 'PREMIUM_GOLD', name: 'Emas Premium', canvas: '#faf6ea', header: '#5e4817', accent: '#b58a2a',
    text: '#342d1e', mutedText: '#766b50', card: '#fffdf7', cardBorder: '#dfcf9d', patternOpacity: 0.08,
  },
  CLEAN_LIGHT: {
    key: 'CLEAN_LIGHT', name: 'Minimal Terang', canvas: '#f6f7f9', header: '#253142', accent: '#52667d',
    text: '#1f2937', mutedText: '#6b7280', card: '#ffffff', cardBorder: '#d9dee5', patternOpacity: 0.04,
  },
  CUSTOM: {
    key: 'CUSTOM', name: 'Upload Sendiri', canvas: '#f5f5f4', header: '#253142', accent: '#52667d',
    text: '#1f2937', mutedText: '#6b7280', card: '#ffffff', cardBorder: '#d9dee5', patternOpacity: 0,
  },
};

export const DEFAULT_SESSION_REPORT_BACKGROUND: SessionReportBackgroundKey = 'RAHO_RED';

export function isSessionReportBackgroundKey(value: unknown): value is SessionReportBackgroundKey {
  return typeof value === 'string'
    && SESSION_REPORT_BACKGROUND_KEYS.includes(value as SessionReportBackgroundKey);
}

export function getSessionReportBackground(key?: string): SessionReportBackground {
  if (key && SESSION_REPORT_BACKGROUND_KEYS.includes(key as SessionReportBackgroundKey)) {
    return SESSION_REPORT_BACKGROUNDS[key as SessionReportBackgroundKey];
  }
  return SESSION_REPORT_BACKGROUNDS[DEFAULT_SESSION_REPORT_BACKGROUND];
}

export function listSessionReportBackgrounds() {
  return SESSION_REPORT_BACKGROUND_KEYS.map((key) => ({
    key,
    name: SESSION_REPORT_BACKGROUNDS[key].name,
  }));
}
