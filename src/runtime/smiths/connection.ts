import WebSocket from 'ws';
import { DisplayManager } from '../display.js';
import { ConfigManager } from '../../config/manager.js';
import type { SmithEntry } from '../../types/config.js';
import type {
  MorpheusToSmithMessage,
  SmithToMorpheusMessage,
  SmithTaskResultMessage,
  SmithPongMessage,
  SmithRegisterMessage,
  SmithConfigReportMessage,
} from './types.js';
import { SMITH_PROTOCOL_VERSION } from './types.js';
import type { SmithRegistry } from './registry.js';

type MessageHandler = (message: SmithToMorpheusMessage) => void;

/**
 * SmithConnection — WebSocket client wrapper for a single Morpheus → Smith connection.
 * Handles connection lifecycle, reconnection with exponential backoff, auth, and heartbeat.
 */
export class SmithConnection {
  private ws: WebSocket | null = null;
  private entry: SmithEntry;
  private registry: SmithRegistry;
  private display = DisplayManager.getInstance();
  private messageHandlers: MessageHandler[] = [];
  private pendingTasks = new Map<string, {
    resolve: (result: SmithTaskResultMessage['result']) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempt = 0;
  private maxReconnectDelay = 30000;
  private maxReconnectAttempts = 3;
  private intentionalClose = false;
  private _connected = false;
  private _authFailed = false;

  constructor(entry: SmithEntry, registry: SmithRegistry) {
    this.entry = entry;
    this.registry = registry;
  }

  get connected(): boolean {
    return this._connected;
  }

  /** Connect to the Smith WebSocket server */
  async connect(): Promise<void> {
    this.intentionalClose = false;
    this.registry.updateState(this.entry.name, 'connecting');

    return new Promise((resolve, reject) => {
      const config = ConfigManager.getInstance().getSmithsConfig();
      const url = `ws://${this.entry.host}:${this.entry.port}`;

      try {
        this.ws = new WebSocket(url, {
          handshakeTimeout: config.connection_timeout_ms,
          headers: {
            'x-smith-auth': this.entry.auth_token,
            'x-smith-protocol-version': String(SMITH_PROTOCOL_VERSION),
          },
        });
      } catch (err: any) {
        this.registry.updateState(this.entry.name, 'error');
        reject(err);
        return;
      }

      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.terminate();
          const err = new Error(`Connection timeout to Smith '${this.entry.name}'`);
          this.registry.updateState(this.entry.name, 'error');
          reject(err);
        }
      }, config.connection_timeout_ms);

      this.ws.on('open', () => {
        clearTimeout(connectionTimeout);
        this._connected = true;
        this.reconnectAttempt = 0;
        this.registry.updateState(this.entry.name, 'online');
        this.startHeartbeat();
        this.display.log(`Connected to Smith '${this.entry.name}' at ${url}`, {
          source: 'SmithConnection',
          level: 'info',
        });
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as SmithToMorpheusMessage;
          this.handleMessage(message);
        } catch (err: any) {
          this.display.log(`Invalid message from Smith '${this.entry.name}': ${err.message}`, {
            source: 'SmithConnection',
            level: 'warning',
          });
        }
      });

      this.ws.on('close', (code, reason) => {
        clearTimeout(connectionTimeout);
        this._connected = false;
        this.stopHeartbeat();
        this.registry.updateState(this.entry.name, 'offline');

        // Reject all pending tasks
        for (const [id, pending] of this.pendingTasks) {
          clearTimeout(pending.timer);
          pending.reject(new Error(`Connection to Smith '${this.entry.name}' closed`));
        }
        this.pendingTasks.clear();

        if (!this.intentionalClose) {
          this.display.log(
            `Smith '${this.entry.name}' disconnected (code: ${code}). Reconnecting...`,
            { source: 'SmithConnection', level: 'warning' }
          );
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (err: Error) => {
        clearTimeout(connectionTimeout);
        // Detect 401 auth failures — no point retrying
        if (err.message?.includes('401')) {
          this._authFailed = true;
        }
        this.display.log(`WebSocket error with Smith '${this.entry.name}': ${err.message}`, {
          source: 'SmithConnection',
          level: 'error',
        });
        this.registry.updateState(this.entry.name, 'error');
        // 'close' event will fire after 'error', which handles reconnection
      });
    });
  }

  /** Send a message to the Smith */
  public send(message: MorpheusToSmithMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Smith '${this.entry.name}' is not connected`);
    }
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send a task to the Smith and wait for the result.
   * Returns a promise that resolves when the Smith sends a task_result.
   */
  public sendTask(taskId: string, tool: string, args: Record<string, unknown>): Promise<SmithTaskResultMessage['result']> {
    const config = ConfigManager.getInstance().getSmithsConfig();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        reject(new Error(`Task ${taskId} timed out on Smith '${this.entry.name}'`));
      }, config.task_timeout_ms);

      this.pendingTasks.set(taskId, { resolve, reject, timer });

      try {
        this.send({
          type: 'task',
          id: taskId,
          payload: { tool, args },
        });
      } catch (err) {
        clearTimeout(timer);
        this.pendingTasks.delete(taskId);
        reject(err);
      }
    });
  }

  /** Register a handler for incoming messages */
  public onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /** Disconnect gracefully */
  public async disconnect(): Promise<void> {
    this.intentionalClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reject pending tasks
    for (const [id, pending] of this.pendingTasks) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Connection intentionally closed'));
    }
    this.pendingTasks.clear();

    if (this.ws) {
      return new Promise<void>((resolve) => {
        if (this.ws!.readyState === WebSocket.OPEN) {
          this.ws!.once('close', () => {
            this._connected = false;
            resolve();
          });
          this.ws!.close(1000, 'Morpheus shutting down');
          // Force close after 3s if server doesn't respond
          setTimeout(() => {
            if (this.ws?.readyState !== WebSocket.CLOSED) {
              this.ws?.terminate();
            }
            this._connected = false;
            resolve();
          }, 3000);
        } else {
          this.ws?.terminate();
          this._connected = false;
          resolve();
        }
      });
    }
  }

  // ─── Private ───

  private handleMessage(message: SmithToMorpheusMessage): void {
    switch (message.type) {
      case 'task_result':
        this.handleTaskResult(message);
        break;
      case 'pong':
        this.handlePong(message);
        break;
      case 'register':
        this.handleRegister(message);
        break;
      case 'config_report':
        this.handleConfigReport(message);
        break;
      case 'task_progress':
        // Forward to all handlers for real-time progress
        break;
    }

    // Forward to all registered handlers
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (err: any) {
        this.display.log(`Message handler error: ${err.message}`, {
          source: 'SmithConnection',
          level: 'warning',
        });
      }
    }
  }

  private handleTaskResult(message: SmithTaskResultMessage): void {
    const pending = this.pendingTasks.get(message.id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingTasks.delete(message.id);
      pending.resolve(message.result);
    }
  }

  private handlePong(message: SmithPongMessage): void {
    this.registry.updateState(this.entry.name, 'online', message.stats);
  }

  private handleRegister(message: SmithRegisterMessage): void {
    if (message.protocol_version !== SMITH_PROTOCOL_VERSION) {
      this.display.log(
        `Smith '${this.entry.name}' protocol version mismatch: expected ${SMITH_PROTOCOL_VERSION}, got ${message.protocol_version}`,
        { source: 'SmithConnection', level: 'warning' }
      );
    }

    const smith = this.registry.get(this.entry.name);
    if (smith) {
      smith.capabilities = message.capabilities;
    }
  }

  private handleConfigReport(_message: SmithConfigReportMessage): void {
    // Store config for display in UI — future enhancement
  }

  private startHeartbeat(): void {
    const config = ConfigManager.getInstance().getSmithsConfig();
    this.heartbeatTimer = setInterval(() => {
      try {
        this.send({ type: 'ping', timestamp: Date.now() });
      } catch {
        // Connection may be broken — close event will handle reconnect
      }
    }, config.heartbeat_interval_ms);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;

    // Auth failures won't self-resolve — don't retry
    if (this._authFailed) {
      this.display.log(
        `Smith '${this.entry.name}' — authentication failed (401). Check auth_token in config. Not retrying.`,
        { source: 'SmithConnection', level: 'error' }
      );
      this.registry.updateState(this.entry.name, 'offline');
      return;
    }

    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      this.display.log(
        `Smith '${this.entry.name}' — max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`,
        { source: 'SmithConnection', level: 'error' }
      );
      this.registry.updateState(this.entry.name, 'offline');
      return;
    }

    // Exponential backoff: 1s → 2s → 4s (capped by maxReconnectAttempts)
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelay);
    this.reconnectAttempt++;

    this.display.log(
      `Reconnecting to Smith '${this.entry.name}' in ${delay}ms (attempt ${this.reconnectAttempt})`,
      { source: 'SmithConnection', level: 'info' }
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        // connect() failure will trigger 'close' → scheduleReconnect again
      }
    }, delay);
  }
}
