import type { SmithSystemStats } from './ISmithProtocol.js';

export type SmithConnectionState = 'online' | 'offline' | 'connecting' | 'error';

export interface SmithInfo {
  name: string;
  host: string;
  port: number;
  state: SmithConnectionState;
  capabilities: string[];
  stats?: SmithSystemStats;
  last_seen?: Date;
  error?: string;
}

export interface ISmithRegistry {
  /** Register a new Smith (from config or self-registration) */
  register(entry: SmithConfigEntry): void;

  /** Remove a Smith by name */
  unregister(name: string): void;

  /** Get a specific Smith's info */
  get(name: string): SmithInfo | undefined;

  /** List all registered Smiths */
  list(): SmithInfo[];

  /** List only online Smiths */
  getOnline(): SmithInfo[];

  /** Update Smith state (called by SmithConnection) */
  updateState(name: string, state: SmithConnectionState, stats?: SmithSystemStats): void;

  /** Initialize connections to all configured Smiths */
  connectAll(): Promise<void>;

  /** Disconnect all Smiths gracefully */
  disconnectAll(): Promise<void>;
}

export interface SmithConfigEntry {
  name: string;
  host: string;
  port: number;
  auth_token: string;
}
