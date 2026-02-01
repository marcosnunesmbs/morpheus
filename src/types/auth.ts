/**
 * Shared constants and interfaces for HTTP Authentication
 */

export const AUTH_HEADER = 'x-architect-pass';

export interface AuthErrorResponse {
  error: string;
  code: 'UNAUTHORIZED' | 'INVALID_PASSWORD';
}
