/**
 * AES-256-GCM Encryption Utility
 *
 * Provides symmetric encryption for sensitive data like passwords,
 * API keys, and proxy credentials stored in the database.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY or JWT_SECRET must be set for credential encryption');
  }
  // Derive a stable 256-bit key from the secret
  return scryptSync(secret, 'sns-marketing-salt', KEY_LENGTH);
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string containing: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv (16) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return `enc:${combined.toString('base64')}`;
}

/**
 * Decrypt an encrypted string.
 * Handles both encrypted (prefixed with "enc:") and plaintext values
 * for backward compatibility during migration.
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue;

  // If not encrypted, return as-is (backward compatibility)
  if (!encryptedValue.startsWith('enc:')) {
    return encryptedValue;
  }

  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedValue.slice(4), 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Check if a value is already encrypted
 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith('enc:') ?? false;
}

/**
 * Encrypt a value only if it's not already encrypted
 */
export function ensureEncrypted(value: string): string {
  if (!value || isEncrypted(value)) return value;
  return encrypt(value);
}
