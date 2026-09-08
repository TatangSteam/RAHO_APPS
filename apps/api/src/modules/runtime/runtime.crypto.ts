import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '@config/env';
import { AppError } from '@middleware/errorHandler';

function key(): Buffer {
  const secret = env.RUNTIME_CONFIG_ENCRYPTION_KEY || env.ZOHO_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new AppError(
      503,
      'RUNTIME_CONFIG_ENCRYPTION_MISSING',
      'Kunci enkripsi konfigurasi runtime belum tersedia pada server.',
    );
  }
  return createHash('sha256').update(`raho-runtime-config:${secret}`).digest();
}

export function encryptRuntimeSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64url'))
    .join('.');
}

export function decryptRuntimeSecret(value: string): string {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !encrypted) throw new Error('Konfigurasi terenkripsi tidak valid.');
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
