import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '@config/env';

function encryptionKey(): Buffer {
  if (!env.WHATSAPP_ENCRYPTION_KEY) {
    throw new Error('WHATSAPP_ENCRYPTION_KEY is required when WhatsApp is enabled');
  }
  return createHash('sha256').update(env.WHATSAPP_ENCRYPTION_KEY).digest();
}

export function encryptWhatsAppValue(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64url'))
    .join('.');
}

export function decryptWhatsAppValue(value: string): string {
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted WhatsApp value');
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
