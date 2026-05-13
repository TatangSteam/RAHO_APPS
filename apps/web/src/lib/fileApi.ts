import { api } from './api';

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function normalizeFileRequestPath(fileUrlOrPath: string): string {
  if (!fileUrlOrPath) return '';

  let value = fileUrlOrPath.trim();

  if (isAbsoluteUrl(value)) {
    try {
      const parsed = new URL(value);
      value = `${parsed.pathname}${parsed.search}`;
    } catch {
      return value;
    }
  }

  value = value.replace(/^\/+/, '/');

  if (value.startsWith('/api/v1/')) {
    return value.replace(/^\/api\/v1/, '');
  }

  if (value.startsWith('/raho-uploads/')) {
    return `/files${value.slice('/raho-uploads'.length)}`;
  }

  if (value.startsWith('/invoices/')) {
    return value;
  }

  if (value.startsWith('/files/')) {
    return value;
  }

  if (value.startsWith('/session-photos/') || value.startsWith('/uploads/')) {
    return `/files${value}`;
  }

  return value;
}

export async function createAuthenticatedObjectUrl(fileUrlOrPath: string): Promise<string> {
  const path = normalizeFileRequestPath(fileUrlOrPath);

  if (!path) {
    throw new Error('File path is required');
  }

  const response = await api.get(path, {
    responseType: 'blob',
  });

  const blob = response.data as Blob;
  return URL.createObjectURL(blob);
}
