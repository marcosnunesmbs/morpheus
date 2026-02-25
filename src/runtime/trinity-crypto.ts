import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

function getDerivedKey(): Buffer {
  const secret = process.env.MORPHEUS_SECRET;
  if (!secret) {
    throw new Error(
      'MORPHEUS_SECRET environment variable is required for credential encryption. ' +
      'Set it before saving database credentials.'
    );
  }
  // Derive a 32-byte key from the secret using scrypt
  return scryptSync(secret, 'morpheus-trinity-salt-v1', 32);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a string in format: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getDerivedKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypts a ciphertext string produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getDerivedKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format — expected iv:authTag:ciphertext');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts[2], 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}

/** Returns true if MORPHEUS_SECRET is set (credentials can be stored). */
export function canEncrypt(): boolean {
  return !!process.env.MORPHEUS_SECRET;
}

/**
 * Checks if a string appears to be an encrypted value.
 * Format: base64(iv):base64(authTag):base64(ciphertext)
 */
export function looksLikeEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  
  // Each part should be valid base64
  return parts.every(part => {
    try {
      const decoded = Buffer.from(part, 'base64');
      return decoded.toString('base64') === part;
    } catch {
      return false;
    }
  });
}

/**
 * Safely decrypts a value, returning null if decryption fails.
 * Use this for fail-open scenarios where MORPHEUS_SECRET may not be set.
 */
export function safeDecrypt(ciphertext: string | null): string | null {
  if (!ciphertext) return null;
  try {
    return decrypt(ciphertext);
  } catch {
    return null;
  }
}

/**
 * Gets the usable API key from a potentially encrypted value.
 * If the value looks encrypted, attempts to decrypt it.
 * If decryption fails or MORPHEUS_SECRET is not set, returns the original value.
 * Use this when you need the actual plaintext key for API calls.
 */
export function getUsableApiKey(encryptedOrPlain: string | undefined): string | undefined {
  if (!encryptedOrPlain) return undefined;
  
  // If it looks encrypted, try to decrypt
  if (looksLikeEncrypted(encryptedOrPlain)) {
    const decrypted = safeDecrypt(encryptedOrPlain);
    // If decryption succeeded, return it; otherwise return original
    return decrypted ?? encryptedOrPlain;
  }
  
  // Not encrypted, return as-is
  return encryptedOrPlain;
}
