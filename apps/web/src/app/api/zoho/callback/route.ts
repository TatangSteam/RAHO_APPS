import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function backendCallbackUrl(request: NextRequest): URL {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  const callbackUrl = `${configuredApiUrl.trim().replace(/\/+$/, '')}/integrations/zoho/callback`;
  const backendUrl = new URL(callbackUrl, request.nextUrl.origin);

  for (const key of ['code', 'state', 'error', 'error_description', 'location', 'accounts-server']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) backendUrl.searchParams.set(key, value);
  }

  return backendUrl;
}

export function GET(request: NextRequest) {
  return NextResponse.redirect(backendCallbackUrl(request));
}
