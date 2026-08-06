import { assertCaughtError } from '@/lib/caughtError';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ICD_TOKEN_ENDPOINT = 'https://icdaccessmanagement.who.int/connect/token';
const ICD_API_BASE_URL = 'https://id.who.int/icd/release/10';
const DATASET_PATHS = [
  path.join(process.cwd(), 'public', 'data', 'icd10-who-2019.json'),
  path.join(process.cwd(), 'apps', 'web', 'public', 'data', 'icd10-who-2019.json'),
];
const DEFAULT_LIMIT = 80;
const DEFAULT_RELEASE_ID = '2019';
const DEFAULT_LANGUAGE = 'en';
const ICD_CODE_PATTERN = /^[A-Z]\d{2}(?:\.[A-Z0-9]+)?$/;

type ICDText = {
  '@value'?: string;
};

type ICD10Entity = {
  code?: string;
  title?: ICDText;
  definition?: ICDText;
  browserUrl?: string;
};

type ICDDatasetItem = {
  code: string;
  title?: string;
  namaIndonesia?: string;
  englishName?: string;
  definition?: string;
};

type ICDDatasetPayload = {
  codes?: ICDDatasetItem[];
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
};

let datasetPromise: Promise<ICDDatasetItem[]> | null = null;
let accessToken: string | null = null;
let accessTokenExpiresAt = 0;

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function normalizeTitle(item: ICDDatasetItem): string {
  return item.namaIndonesia || item.englishName || item.title || item.code;
}

function normalizeDatasetItem(item: ICDDatasetItem): ICDDatasetItem {
  const code = normalizeCode(item.code);
  const englishName = item.englishName || item.title || '';

  return {
    ...item,
    code,
    title: normalizeTitle({ ...item, code, englishName }),
    englishName,
  };
}

async function loadDataset(): Promise<ICDDatasetItem[]> {
  if (!datasetPromise) {
    datasetPromise = Promise.any(DATASET_PATHS.map((datasetPath) => readFile(datasetPath, 'utf8'))).then((content) => {
      const payload = JSON.parse(content) as ICDDatasetPayload | ICDDatasetItem[];
      const rawCodes = Array.isArray(payload) ? payload : payload.codes;

      if (!Array.isArray(rawCodes)) {
        return [];
      }

      return rawCodes
        .filter((item) => item.code)
        .map(normalizeDatasetItem);
    });
  }

  return datasetPromise;
}

function searchDataset(codes: ICDDatasetItem[], query: string, limit: number) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return {
      results: codes.slice(0, limit),
      total: codes.length,
    };
  }

  const matches = codes
    .map((item) => {
      const code = item.code.toLowerCase();
      const title = (item.title || '').toLowerCase();
      const namaIndonesia = (item.namaIndonesia || '').toLowerCase();
      const englishName = (item.englishName || '').toLowerCase();

      const matched =
        code.includes(normalizedQuery) ||
        title.includes(normalizedQuery) ||
        namaIndonesia.includes(normalizedQuery) ||
        englishName.includes(normalizedQuery);

      if (!matched) return null;

      const rank =
        code === normalizedQuery ? 0 :
        code.startsWith(normalizedQuery) ? 1 :
        namaIndonesia.startsWith(normalizedQuery) || englishName.startsWith(normalizedQuery) || title.startsWith(normalizedQuery) ? 2 :
        3;

      return { item, rank };
    })
    .filter((match): match is { item: ICDDatasetItem; rank: number } => Boolean(match))
    .sort((a, b) => a.rank - b.rank || a.item.code.localeCompare(b.item.code, 'en'))
    .map((match) => match.item);

  return {
    results: matches.slice(0, limit),
    total: matches.length,
  };
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.ICD_API_CLIENT_ID;
  const clientSecret = process.env.ICD_API_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('ICD_API_CREDENTIALS_MISSING');
  }

  if (accessToken && Date.now() < accessTokenExpiresAt) {
    return accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'icdapi_access',
  });
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(ICD_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`ICD_TOKEN_HTTP_${response.status}`);
  }

  const token = await response.json() as TokenResponse;

  if (!token.access_token) {
    throw new Error('ICD_TOKEN_MISSING');
  }

  accessToken = token.access_token;
  accessTokenExpiresAt = Date.now() + Math.max((token.expires_in || 3600) - 60, 60) * 1000;

  return accessToken;
}

async function fetchICD10Entity(code: string, releaseId: string, language: string): Promise<ICDDatasetItem | null> {
  const token = await getAccessToken();
  const url = `${ICD_API_BASE_URL}/${encodeURIComponent(releaseId)}/${encodeURIComponent(code)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Accept-Language': language,
      'API-Version': 'v2',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`ICD_ENTITY_HTTP_${response.status}`);
  }

  const entity = await response.json() as ICD10Entity;
  const entityCode = normalizeCode(entity.code || code);
  const englishName = entity.title?.['@value'] || '';

  return {
    code: entityCode,
    title: englishName || entityCode,
    englishName,
    definition: entity.definition?.['@value'],
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const releaseId = searchParams.get('releaseId') || DEFAULT_RELEASE_ID;
  const language = searchParams.get('language') || DEFAULT_LANGUAGE;
  const limitParam = Number(searchParams.get('limit') || DEFAULT_LIMIT);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : DEFAULT_LIMIT;
  const dataset = await loadDataset();
  const normalizedQuery = normalizeCode(query);
  let { results, total } = searchDataset(dataset, query, limit);
  let source: 'who-api' | 'local-dataset' = 'local-dataset';

  if (ICD_CODE_PATTERN.test(normalizedQuery)) {
    try {
      const apiResult = await fetchICD10Entity(normalizedQuery, releaseId, language);

      if (apiResult) {
        const existing = results.filter((item) => item.code !== apiResult.code);
        results = [apiResult, ...existing].slice(0, limit);
        total = Math.max(total, 1);
        source = 'who-api';
      }
    } catch (error) {
      assertCaughtError(error);
      if (error instanceof Error && error.message !== 'ICD_API_CREDENTIALS_MISSING') {
        console.error('Failed to fetch ICD entity from WHO API:', error);
      }
    }
  }

  return NextResponse.json({
    results,
    total,
    source,
    releaseId,
  });
}
