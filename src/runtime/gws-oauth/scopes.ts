/**
 * GWS OAuth scope mapping.
 * Maps short, user-friendly names to full Google API scope URLs.
 */

import { DEFAULT_GWS_OAUTH_SCOPES } from '../../types/config.js';

export const GWS_SCOPE_MAP: Record<string, string> = {
  gmail: 'https://www.googleapis.com/auth/gmail.modify',
  drive: 'https://www.googleapis.com/auth/drive',
  calendar: 'https://www.googleapis.com/auth/calendar',
  contacts: 'https://www.googleapis.com/auth/contacts',
  docs: 'https://www.googleapis.com/auth/docs',
  sheets: 'https://www.googleapis.com/auth/spreadsheets',
  presentations: 'https://www.googleapis.com/auth/presentations',
  chat: 'https://www.googleapis.com/auth/chat',
  tasks: 'https://www.googleapis.com/auth/tasks',
  people: 'https://www.googleapis.com/auth/userinfo.profile',
  admin_reports: 'https://www.googleapis.com/auth/admin.reports.audit.readonly',
  classroom: 'https://www.googleapis.com/auth/classroom.courses',
  forms: 'https://www.googleapis.com/auth/forms.body',
  meet: 'https://www.googleapis.com/auth/meetings.space.created',
  keep: 'https://www.googleapis.com/auth/keep',
  slides: 'https://www.googleapis.com/auth/presentations',
};

/**
 * Resolves short scope names to full Google API scope URLs.
 * Unknown scopes are passed through as-is (assumed to be full URLs).
 */
export function resolveGwsScopes(shortNames: string[]): string[] {
  return shortNames.map((s) => GWS_SCOPE_MAP[s] ?? s);
}

/**
 * Returns the default OAuth scopes for GWS.
 */
export function getDefaultGwsScopes(): string[] {
  return [...DEFAULT_GWS_OAUTH_SCOPES];
}

/**
 * Resolves and returns default scopes as full Google API URLs.
 */
export function getDefaultResolvedScopes(): string[] {
  return resolveGwsScopes(getDefaultGwsScopes());
}
