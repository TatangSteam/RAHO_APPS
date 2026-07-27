import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '@config/env';
import { AppError } from '@middleware/errorHandler';

function key(): Buffer {
  if (!env.ZOHO_TOKEN_ENCRYPTION_KEY) {
    throw new AppError(503, 'ZOHO_NOT_CONFIGURED', 'Kunci enkripsi Zoho belum dikonfigurasi.');
  }
  return createHash('sha256').update(env.ZOHO_TOKEN_ENCRYPTION_KEY).digest();
}

export function encryptToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptToken(value: string): string {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted Zoho token');
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
