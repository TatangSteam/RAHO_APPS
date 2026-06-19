import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const WILAYAH_API_BASE = 'https://wilayah.id/api';

export interface WilayahItem {
  code: string;
  name: string;
}

interface WilayahResponse {
  data?: WilayahItem[];
}

function normalizeWilayahData(payload: WilayahResponse) {
  return Array.isArray(payload.data)
    ? payload.data.map((item) => ({
        code: item.code,
        name: item.name.trim(),
      }))
    : [];
}

async function readCachedWilayah(pathname: string) {
  const filePath = path.join(process.cwd(), 'public', 'data', 'wilayah', pathname);
  const content = await readFile(filePath, 'utf8');
  const payload = JSON.parse(content.replace(/^\uFEFF/, '')) as WilayahResponse;
  return normalizeWilayahData(payload);
}

function wilayahJson(data: WilayahItem[], source: 'remote' | 'cache') {
  return NextResponse.json(
    { data },
    {
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Wilayah-Source': source,
      },
    }
  );
}

export async function fetchWilayah(pathname: string) {
  try {
    const response = await fetch(`${WILAYAH_API_BASE}/${pathname}`, {
      headers: {
        Accept: 'application/json',
      },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      const cachedData = await readCachedWilayah(pathname);
      return wilayahJson(cachedData, 'cache');
    }

    const payload = (await response.json()) as WilayahResponse;
    return wilayahJson(normalizeWilayahData(payload), 'remote');
  } catch {
    try {
      const cachedData = await readCachedWilayah(pathname);
      return wilayahJson(cachedData, 'cache');
    } catch {
      return NextResponse.json(
        { data: [], message: 'Gagal memuat data wilayah' },
        { status: 502 }
      );
    }
  }
}
