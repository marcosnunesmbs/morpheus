import crypto from 'crypto';
import fs from 'fs-extra';

/**
 * Calculates the MD5 hash of a string.
 */
export function calculateMd5(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Calculates the MD5 hash of a file.
 */
export async function calculateFileMd5(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  return calculateMd5(content);
}
