import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { env } from '@config/env';

function encryptionKey(): Buffer {
  // JWT fallback keeps existing development installs usable. Production must
  // configure the dedicated key so JWT rotation cannot affect voucher export.
  const secret = env.VOUCHER_CODE_ENCRYPTION_KEY || env.JWT_ACCESS_SECRET;
  return createHash('sha256').update(secret).digest();
}

export function encryptVoucherCode(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptVoucherCode(value: string): string {
  const [version, ivValue, tagValue, encryptedValue] = value.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Format kode voucher terenkripsi tidak valid.');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function hashVoucherIdentity(value: string): string {
  return createHmac('sha256', encryptionKey()).update(value.trim(), 'utf8').digest('hex');
}
