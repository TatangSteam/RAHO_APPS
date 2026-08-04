import axios from 'axios';

export class ZohoApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number | undefined,
    public readonly retryable: boolean,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ZohoApiError';
  }
}

export function isZohoReconnectRequired(
  error: Pick<ZohoApiError, 'code' | 'message'> | string | null | undefined,
): boolean {
  if (!error) return false;
  const value = typeof error === 'string'
    ? error
    : `${error.code} ${error.message}`;
  return /ZOHO_REFRESH_FAILED|invalid_code|invalid_grant|refresh token.+(?:expired|revoked|invalid)/i.test(value);
}

function retryAfterMs(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

export function normalizeZohoError(error: unknown): ZohoApiError {
  if (error instanceof ZohoApiError) return error;
  if (!axios.isAxiosError(error)) {
    return new ZohoApiError(
      error instanceof Error ? error.message : 'Zoho request failed',
      'ZOHO_UNKNOWN_ERROR',
      undefined,
      true,
    );
  }

  const status = error.response?.status;
  const body = error.response?.data as {
    code?: string | number;
    message?: string;
    error?: string;
    error_description?: string;
  } | undefined;
  const code = body?.code != null
    ? String(body.code)
    : body?.error || `ZOHO_HTTP_${status || 'NETWORK'}`;
  const retryable = status == null || status === 408 || status === 429 || status >= 500;
  return new ZohoApiError(
    body?.message || body?.error_description || body?.error || error.message || 'Zoho request failed',
    code,
    status,
    retryable,
    retryAfterMs(error.response?.headers?.['retry-after']),
  );
}
