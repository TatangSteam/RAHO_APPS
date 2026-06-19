import { NextResponse } from 'next/server';
import { fetchWilayah } from '../../_utils';

interface RouteParams {
  params: {
    provinceCode: string;
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const provinceCode = params.provinceCode;

  if (!/^\d{2}$/.test(provinceCode)) {
    return NextResponse.json(
      { data: [], message: 'Kode provinsi tidak valid' },
      { status: 400 }
    );
  }

  return fetchWilayah(`regencies/${provinceCode}.json`);
}
