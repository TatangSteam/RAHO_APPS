import { NextRequest, NextResponse } from 'next/server';

function backendCallbackUrl(request: NextRequest): URL {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  const backendUrl = new URL(`${configuredApiUrl.replace(/\/$/, '')}/integrations/zoho/callback`);

  for (const key of ['code', 'state', 'error', 'error_description', 'location', 'accounts-server']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) backendUrl.searchParams.set(key, value);
  }

  return backendUrl;
}

export function GET(request: NextRequest) {
  return NextResponse.redirect(backendCallbackUrl(request));
}
