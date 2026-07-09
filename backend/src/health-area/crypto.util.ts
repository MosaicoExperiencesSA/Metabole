import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Cifratura documenti sanitari: AES-256-GCM.
 * Formato: iv (12 byte) + authTag (16 byte) + ciphertext.
 * La chiave deriva da FILE_ENCRYPTION_KEY (env) via SHA-256.
 */
export function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encryptBuffer(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

export function decryptBuffer(payload: Buffer, key: Buffer): Buffer {
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
