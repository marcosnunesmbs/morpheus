import { EventEmitter } from 'events';
import { DisplayManager } from '../display.js';
import { ConfigManager } from '../../config/manager.js';
import type { SmithEntry } from '../../types/config.js';
import type { SmithConnectionState, SmithInfo, SmithSystemStats } from './types.js';
import { SmithConnection } from './connection.js';

/**
 * SmithRegistry — singleton that manages all Smith connections.
 * Pattern follows ChannelRegistry from src/channels/registry.ts.
 */
export class SmithRegistry extends EventEmitter {
  private static instance: SmithRegistry;
  private smiths = new Map<string, SmithInfo>();
  private connections = new Map<string, SmithConnection>();
  private display = DisplayManager.getInstance();

  private constructor() {
    super();
  }

  public static getInstance(): SmithRegistry {
    if (!SmithRegistry.instance) {
      SmithRegistry.instance = new SmithRegistry();
    }
    return SmithRegistry.instance;
  }

  /** Reset singleton (for testing) */
  public static resetInstance(): void {
    if (SmithRegistry.instance) {
      SmithRegistry.instance.removeAllListeners();
      SmithRegistry.instance.smiths.clear();
      SmithRegistry.instance.connections.clear();
    }
    SmithRegistry.instance = undefined as any;
  }

  /**
   * Register a Smith from config entry.
   * Does NOT initiate connection — call connectAll() for that.
   */
  public register(entry: SmithEntry): void {
    if (this.smiths.has(entry.name)) {
      this.display.log(`Smith '${entry.name}' already registered, skipping.`, {
        source: 'SmithRegistry',
        level: 'warning',
      });
      return;
    }

    const info: SmithInfo = {
      name: entry.name,
      host: entry.host,
      port: entry.port,
      state: 'offline',
      capabilities: [],
    };

    this.smiths.set(entry.name, info);
    this.display.log(`Smith '${entry.name}' registered (${entry.host}:${entry.port})`, {
      source: 'SmithRegistry',
      level: 'info',
    });
  }

  /**
   * Register a Smith that self-announced via HTTP handshake.
   */
  public registerFromHandshake(name: string, host: string, port: number, capabilities: string[]): void {
    const existing = this.smiths.get(name);
    if (existing) {
      // Update existing entry with new info
      existing.host = host;
      existing.port = port;
      existing.capabilities = capabilities;
      existing.state = 'online';
      existing.lastSeen = new Date();
      this.emit('smith:updated', name);
      return;
    }

    const info: SmithInfo = {
      name,
      host,
      port,
      state: 'online',
      capabilities,
      lastSeen: new Date(),
    };

    this.smiths.set(name, info);
    this.emit('smith:connected', name);
    this.display.log(`Smith '${name}' self-registered (${host}:${port})`, {
      source: 'SmithRegistry',
      level: 'info',
    });
  }

  /** Remove a Smith by name */
  public unregister(name: string): boolean {
    const connection = this.connections.get(name);
    if (connection) {
      connection.disconnect().catch(() => {});
      this.connections.delete(name);
    }

    const removed = this.smiths.delete(name);
    if (removed) {
      this.emit('smith:disconnected', name);
      this.display.log(`Smith '${name}' unregistered.`, {
        source: 'SmithRegistry',
        level: 'info',
      });
    }
    return removed;
  }

  /** Get a specific Smith's info */
  public get(name: string): SmithInfo | undefined {
    return this.smiths.get(name);
  }

  /** List all registered Smiths */
  public list(): SmithInfo[] {
    return Array.from(this.smiths.values());
  }

  /** List only online Smiths */
  public getOnline(): SmithInfo[] {
    return this.list().filter(s => s.state === 'online');
  }

  /** Get a SmithConnection by name (for sending messages) */
  public getConnection(name: string): SmithConnection | undefined {
    return this.connections.get(name);
  }

  /** Update Smith state (called by SmithConnection) */
  public updateState(name: string, state: SmithConnectionState, stats?: SmithSystemStats): void {
    const smith = this.smiths.get(name);
    if (!smith) return;

    const previousState = smith.state;
    smith.state = state;
    if (stats) smith.stats = stats;
    if (state === 'online') smith.lastSeen = new Date();

    if (previousState !== state) {
      this.emit(`smith:${state}`, name);
      this.display.log(`Smith '${name}' state: ${previousState} → ${state}`, {
        source: 'SmithRegistry',
        level: state === 'error' ? 'warning' : 'info',
      });
    }
  }

  /** Initialize WebSocket connections to all configured Smiths */
  public async connectAll(): Promise<void> {
    const config = ConfigManager.getInstance().getSmithsConfig();
    if (!config.enabled) {
      this.display.log('Smiths subsystem disabled.', { source: 'SmithRegistry', level: 'info' });
      return;
    }

    // Register all entries from config
    for (const entry of config.entries) {
      this.register(entry);
    }

    // Initiate connections
    const connectPromises: Promise<void>[] = [];
    for (const entry of config.entries) {
      const connection = new SmithConnection(entry, this);
      this.connections.set(entry.name, connection);
      connectPromises.push(
        connection.connect().catch(err => {
          this.display.log(`Failed to connect to Smith '${entry.name}': ${err.message}`, {
            source: 'SmithRegistry',
            level: 'error',
          });
        })
      );
    }

    await Promise.allSettled(connectPromises);

    const online = this.getOnline().length;
    const total = this.smiths.size;
    this.display.log(`Smiths connected: ${online}/${total}`, {
      source: 'SmithRegistry',
      level: 'info',
    });
  }

  /** Disconnect all Smiths gracefully */
  public async disconnectAll(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];
    for (const [name, connection] of this.connections) {
      disconnectPromises.push(
        connection.disconnect().catch(err => {
          this.display.log(`Error disconnecting Smith '${name}': ${err.message}`, {
            source: 'SmithRegistry',
            level: 'warning',
          });
        })
      );
    }
    await Promise.allSettled(disconnectPromises);
    this.connections.clear();

    // Mark all as offline
    for (const smith of this.smiths.values()) {
      smith.state = 'offline';
    }
  }

  /**
   * Generate a system prompt section listing available Smiths.
   * Injected into Oracle's system prompt.
   */
  public getSystemPromptSection(): string {
    const online = this.getOnline();
    if (online.length === 0) return '';

    const lines = online.map(s => {
      const caps = s.capabilities.length > 0 ? ` (capabilities: ${s.capabilities.join(', ')})` : '';
      const os = s.stats?.os ? ` [${s.stats.os}]` : '';
      return `- **${s.name}**: ${s.host}:${s.port}${os}${caps}`;
    });

    return `\n## Available Smiths (Remote Agents)
The following remote Smiths are online and can execute DevKit tasks on external machines:
${lines.join('\n')}

Use "smith_delegate" tool to delegate a task to a specific Smith by name.
`;
  }
}
