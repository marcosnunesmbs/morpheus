import fs from 'fs';
import path from 'path';
import { PATHS } from '../../config/paths.js';
import type { OAuthStoreData, OAuthServerRecord } from './types.js';
import type { OAuthTokens, OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

/**
 * Persists OAuth tokens, client info, and PKCE state in ~/.morpheus/oauth-tokens.json.
 * Atomic writes (temp → rename). Lazy reads.
 */
export class OAuthStore {
  private static instance: OAuthStore | null = null;
  private data: OAuthStoreData | null = null;
  private filePath: string;

  private constructor() {
    this.filePath = PATHS.oauthTokens;
  }

  static getInstance(): OAuthStore {
    if (!OAuthStore.instance) {
      OAuthStore.instance = new OAuthStore();
    }
    return OAuthStore.instance;
  }

  static resetInstance(): void {
    OAuthStore.instance = null;
  }

  // ── Read ──────────────────────────────────────────────

  private read(): OAuthStoreData {
    if (this.data) return this.data;
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.data = JSON.parse(raw) as OAuthStoreData;
    } catch {
      this.data = {};
    }
    return this.data;
  }

  private getRecord(serverName: string): OAuthServerRecord {
    const data = this.read();
    if (!data[serverName]) data[serverName] = {};
    return data[serverName];
  }

  // ── Write ─────────────────────────────────────────────

  private persist(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data ?? {}, null, 2), 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }

  // ── Tokens ────────────────────────────────────────────

  getTokens(serverName: string): OAuthTokens | undefined {
    return this.getRecord(serverName).tokens;
  }

  saveTokens(serverName: string, tokens: OAuthTokens): void {
    this.getRecord(serverName).tokens = tokens;
    this.persist();
  }

  deleteTokens(serverName: string): void {
    const record = this.getRecord(serverName);
    delete record.tokens;
    this.persist();
  }

  // ── Client Info (dynamic registration) ────────────────

  getClientInfo(serverName: string): OAuthClientInformationFull | undefined {
    return this.getRecord(serverName).clientInfo;
  }

  saveClientInfo(serverName: string, info: OAuthClientInformationFull): void {
    this.getRecord(serverName).clientInfo = info;
    this.persist();
  }

  // ── PKCE ──────────────────────────────────────────────

  savePkceVerifier(serverName: string, state: string, verifier: string): void {
    const record = this.getRecord(serverName);
    if (!record.pkce) record.pkce = {};
    record.pkce[state] = verifier;
    this.persist();
  }

  getPkceVerifier(serverName: string, state: string): string | undefined {
    return this.getRecord(serverName).pkce?.[state];
  }

  getLatestPkceVerifier(serverName: string): string | undefined {
    const pkce = this.getRecord(serverName).pkce;
    if (!pkce) return undefined;
    const entries = Object.values(pkce);
    return entries[entries.length - 1];
  }

  deletePkce(serverName: string, state: string): void {
    const pkce = this.getRecord(serverName).pkce;
    if (pkce) {
      delete pkce[state];
      this.persist();
    }
  }

  // ── Queries ───────────────────────────────────────────

  /** List all server names with stored OAuth data */
  listServers(): string[] {
    return Object.keys(this.read());
  }

  /** Remove all data for a server */
  deleteServer(serverName: string): void {
    const data = this.read();
    delete data[serverName];
    this.persist();
  }

  /** Map state → serverName for callback resolution */
  resolveServerByState(state: string): string | undefined {
    const data = this.read();
    for (const [name, record] of Object.entries(data)) {
      if (record.pkce?.[state]) return name;
    }
    return undefined;
  }
}
