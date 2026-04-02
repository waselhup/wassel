// Replicated from server/_core/encryption.ts — same AES-256-GCM algorithm
// MUST use the same ENCRYPTION_KEY env var as the Vercel server
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey() {
  let key = process.env.ENCRYPTION_KEY || '';
  key = key.trim();
  if (!key || key.length !== 64) {
    throw new Error(`ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Got length=${key.length}`);
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(plaintext) {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  const result = Buffer.concat([iv, encrypted, tag]);
  return result.toString('base64');
}

export function decrypt(encoded) {
  const key = getKey();
  const buffer = Buffer.from(encoded, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(buffer.length - TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}
