import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import Database from "better-sqlite3";
import fs from "fs-extra";
import * as path from "path";
import { homedir } from "os";
import type { ProviderModelUsageStats, ModelPricingEntry } from "../../types/stats.js";
import { randomUUID } from 'crypto';
import { DisplayManager } from "../display.js";

export interface SQLiteChatMessageHistoryInput {
  sessionId: string | '';
  databasePath?: string;
  limit?: number;
  config?: Database.Options;
}

export interface SessionStatus { embedding_status: string, id: string, messageCount: number }

/**
 * Metadata for tracking which provider and model generated a message.
 */
export interface MessageProviderMetadata {
  provider: string;
  model: string;
}

export class SQLiteChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "sqlite"];

  private display = DisplayManager.getInstance();

  private static migrationDone = false; // run migrations only once per process

  private db: Database.Database;
  private sessionId: string;
  private limit?: number;
  private titleSet = false; // cache: skip setSessionTitleIfNeeded after title is set

  get currentSessionId(): string {
    return this.sessionId;
  }

  constructor(fields: SQLiteChatMessageHistoryInput) {
    super();
    this.sessionId = fields.sessionId && fields.sessionId !== '' ? fields.sessionId : '';
    this.limit = fields.limit ? fields.limit : 20;

    // Default path: ~/.morpheus/memory/short-memory.db
    const dbPath = fields.databasePath || path.join(homedir(), ".morpheus", "memory", "short-memory.db");

    // Ensure the directory exists
    this.ensureDirectory(dbPath);

    // Initialize database with retry logic for locked databases
    try {
      this.db = new Database(dbPath, {
        ...fields.config,
        timeout: 5000, // 5 second timeout for locks
      });
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');

      try {
        this.ensureTable();
      } catch (tableError) {
        // Database might be corrupted, attempt recovery
        this.handleCorruption(dbPath, tableError);
      }

    } catch (error) {
      throw new Error(`Failed to initialize SQLite database at ${dbPath}: ${error}`);
    }

    this.initializeSession(); // Initialize session ID
  }

  /**
   * Initializes the session ID after the database is ready.
   * Must be called after the constructor completes.
   */
  async initializeSession(): Promise<void> {
    if (!this.sessionId || this.sessionId === '') {
      this.sessionId = await this.getCurrentSessionOrCreate();
    }
  }

  /**
   * Handles database corruption by backing up the corrupted file and creating a new one.
   */
  private handleCorruption(dbPath: string, error: unknown): void {
    try {
      // Close the current database connection
      this.db.close();

      // Create a backup of the corrupted database
      const timestamp = Date.now();
      const backupPath = dbPath.replace('.db', `.corrupt-${timestamp}.db`);

      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
        fs.removeSync(dbPath);
      }

      // Recreate the database
      this.db = new Database(dbPath, { timeout: 5000 });
      this.ensureTable();

      console.warn(`[SQLite] Database was corrupted and has been reset. Backup saved to: ${backupPath}`);
    } catch (recoveryError) {
      throw new Error(`Failed to recover from database corruption: ${recoveryError}. Original error: ${error}`);
    }
  }

  /**
   * Ensures the directory for the database file exists.
   */
  private ensureDirectory(dbPath: string): void {
    const dir = path.dirname(dbPath);
    try {
      fs.ensureDirSync(dir);
    } catch (error) {
      throw new Error(`Failed to create directory ${dir}: ${error}`);
    }
  }

  /**
   * Creates the messages table if it doesn't exist.
   */
  private ensureTable(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          input_tokens INTEGER,
          output_tokens INTEGER,
          total_tokens INTEGER,
          cache_read_tokens INTEGER,
          provider TEXT,
          model TEXT,
          audio_duration_seconds REAL
        );

        CREATE INDEX IF NOT EXISTS idx_messages_session_id
        ON messages(session_id);

        CREATE INDEX IF NOT EXISTS idx_messages_session_id_id
        ON messages(session_id, id DESC);

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          title TEXT,
          status TEXT CHECK (
            status IN ('active', 'paused', 'archived', 'deleted')
          ) NOT NULL DEFAULT 'paused',
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          archived_at INTEGER,
          deleted_at INTEGER,
          embedding_status TEXT CHECK (embedding_status IN ('none', 'pending', 'embedded', 'failed')) NOT NULL DEFAULT 'none'
        );

        CREATE TABLE IF NOT EXISTS model_pricing (
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          input_price_per_1m REAL NOT NULL DEFAULT 0,
          output_price_per_1m REAL NOT NULL DEFAULT 0,
          PRIMARY KEY (provider, model)
        );

        INSERT OR IGNORE INTO model_pricing (provider, model, input_price_per_1m, output_price_per_1m) VALUES
          ('anthropic', 'claude-opus-4-6', 15.0, 75.0),
          ('anthropic', 'claude-sonnet-4-5-20250929', 3.0, 15.0),
          ('anthropic', 'claude-haiku-4-5-20251001', 0.8, 4.0),
          ('anthropic', 'claude-3-5-sonnet-20241022', 3.0, 15.0),
          ('anthropic', 'claude-3-5-haiku-20241022', 0.8, 4.0),
          ('anthropic', 'claude-3-opus-20240229', 15.0, 75.0),
          ('openai', 'gpt-4o', 2.5, 10.0),
          ('openai', 'gpt-4o-mini', 0.15, 0.6),
          ('openai', 'gpt-4-turbo', 10.0, 30.0),
          ('openai', 'gpt-3.5-turbo', 0.5, 1.5),
          ('openai', 'o1', 15.0, 60.0),
          ('openai', 'o1-mini', 3.0, 12.0),
          ('google', 'gemini-2.5-flash', 0.15, 0.6),
          ('google', 'gemini-2.5-flash-lite', 0.075, 0.3),
          ('google', 'gemini-2.0-flash', 0.1, 0.4),
          ('google', 'gemini-1.5-pro', 1.25, 5.0),
          ('google', 'gemini-1.5-flash', 0.075, 0.3);

      `);

      this.migrateTable();
    } catch (error) {
      throw new Error(`Failed to create messages table: ${error}`);
    }
  }

  /**
   * Checks for missing columns and adds them if necessary.
   */
  private migrateTable(): void {
    if (SQLiteChatMessageHistory.migrationDone) return;
    SQLiteChatMessageHistory.migrationDone = true;
    try {
      // Migrate messages table
      const tableInfo = this.db.pragma('table_info(messages)') as Array<{ name: string }>;
      const columns = new Set(tableInfo.map(c => c.name));

      const newColumns = [
        'input_tokens',
        'output_tokens',
        'total_tokens',
        'cache_read_tokens',
        'provider',
        'model',
        'audio_duration_seconds',
        'agent',
        'duration_ms',
      ];

      const integerColumns = new Set(['input_tokens', 'output_tokens', 'total_tokens', 'cache_read_tokens', 'duration_ms']);
      const realColumns = new Set(['audio_duration_seconds']);

      for (const col of newColumns) {
        if (!columns.has(col)) {
          try {
            const type = integerColumns.has(col) ? 'INTEGER' : realColumns.has(col) ? 'REAL' : 'TEXT';
            this.db.exec(`ALTER TABLE messages ADD COLUMN ${col} ${type}`);
          } catch (e) {
            // Ignore error if column already exists (race condition or check failed)
            console.warn(`[SQLite] Failed to add column ${col}: ${e}`);
          }
        }
      }

    } catch (error) {
      console.warn(`[SQLite] Migration check failed: ${error}`);
    }
  }

  /**
   * Retrieves all messages for the current session from the database.
   * @returns Promise resolving to an array of BaseMessage objects
   */
  async getMessages(): Promise<BaseMessage[]> {
    try {
      // Fetch new columns
      const stmt = this.db.prepare(
        `SELECT type, content, input_tokens, output_tokens, total_tokens, cache_read_tokens, provider, model
         FROM messages
         WHERE session_id = ?
         ORDER BY id DESC
         LIMIT ?`
      );

      const rows = stmt.all(this.sessionId, this.limit) as Array<{
        type: string;
        content: string;
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
        cache_read_tokens?: number;
        provider?: string;
        model?: string;
      }>;

      return rows.map((row) => {
        let msg: BaseMessage;

        // Reconstruct usage metadata if present
        const usage_metadata = row.total_tokens != null ? {
          input_tokens: row.input_tokens || 0,
          output_tokens: row.output_tokens || 0,
          total_tokens: row.total_tokens || 0,
          input_token_details: row.cache_read_tokens ? { cache_read: row.cache_read_tokens } : undefined
        } : undefined;

        // Reconstruct provider metadata
        const provider_metadata: MessageProviderMetadata | undefined = row.provider ? {
          provider: row.provider,
          model: row.model || "unknown"
        } : undefined;

        switch (row.type) {
          case "human":
            msg = new HumanMessage(row.content);
            break;
          case "ai":
            try {
              // Attempt to parse structured content (for tool calls)
              const parsed = JSON.parse(row.content);
              if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tool_calls)) {
                msg = new AIMessage({
                  content: parsed.text || "",
                  tool_calls: parsed.tool_calls
                });
              } else {
                msg = new AIMessage(row.content);
              }
            } catch {
              // Fallback for legacy text-only messages
              msg = new AIMessage(row.content);
            }
            break;
          case "system":
            msg = new SystemMessage(row.content);
            break;
          case "tool":
            try {
              const parsed = JSON.parse(row.content);
              msg = new ToolMessage({
                content: parsed.content,
                tool_call_id: parsed.tool_call_id || 'unknown',
                name: parsed.name
              });
            } catch {
              msg = new ToolMessage({ content: row.content, tool_call_id: 'unknown' });
            }
            break;
          default:
            throw new Error(`Unknown message type: ${row.type}`);
        }

        if (usage_metadata) {
          (msg as any).usage_metadata = usage_metadata;
        }

        if (provider_metadata) {
          (msg as any).provider_metadata = provider_metadata;
        }

        return msg;
      });
    } catch (error) {
      // Check if it's a database lock error
      if (error instanceof Error && error.message.includes('SQLITE_BUSY')) {
        throw new Error(`Database is locked. Please try again. Original error: ${error.message}`);
      }
      throw new Error(`Failed to retrieve messages: ${error}`);
    }
  }

  /**
   * Retrieves raw stored messages for one or more session IDs.
   * Useful when the caller needs metadata like session_id and created_at.
   */
  async getRawMessagesBySessionIds(
    sessionIds: string[],
    limit = this.limit
  ): Promise<Array<{
    id: number;
    session_id: string;
    type: string;
    content: string;
    created_at: number;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cache_read_tokens?: number;
    provider?: string;
    model?: string;
    agent?: string;
    duration_ms?: number | null;
  }>> {
    if (sessionIds.length === 0) {
      return [];
    }

    try {
      const placeholders = sessionIds.map(() => '?').join(', ');
      const stmt = this.db.prepare(
        `SELECT id, session_id, type, content, created_at, input_tokens, output_tokens, total_tokens, cache_read_tokens, provider, model, agent, duration_ms
         FROM messages
         WHERE session_id IN (${placeholders})
         ORDER BY id DESC
         LIMIT ?`
      );

      return stmt.all(...sessionIds, limit) as Array<{
        id: number;
        session_id: string;
        type: string;
        content: string;
        created_at: number;
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
        cache_read_tokens?: number;
        provider?: string;
        model?: string;
        agent?: string;
        duration_ms?: number;
      }>;
    } catch (error) {
      if (error instanceof Error && error.message.includes('SQLITE_BUSY')) {
        throw new Error(`Database is locked. Please try again. Original error: ${error.message}`);
      }
      throw new Error(`Failed to retrieve raw messages: ${error}`);
    }
  }

  /**
   * Adds a message to the database.
   * @param message The message to add
   */
  async addMessage(message: BaseMessage): Promise<void> {
    try {
      let type: string;
      if (message instanceof HumanMessage) {
        type = "human";
      } else if (message instanceof AIMessage) {
        type = "ai";
      } else if (message instanceof SystemMessage) {
        type = "system";
      } else if (message instanceof ToolMessage) {
        type = "tool";
      } else {
        throw new Error(`Unsupported message type: ${message.constructor.name}`);
      }

      const content = typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);

      // Extract usage metadata
      // 1. Try generic usage_metadata (LangChain standard)
      // 2. Try extraUsage (passed via some adapters) - attached to additional_kwargs usually, but we might pass it differently
      // The Spec says we might pass it to chat(), but addMessage receives a BaseMessage. 
      // So we should expect usage to be on the message object properties.

      const anyMsg = message as any;
      const usage = anyMsg.usage_metadata || anyMsg.response_metadata?.usage || anyMsg.response_metadata?.tokenUsage || anyMsg.usage;

      const inputTokens = usage?.input_tokens ?? null;
      const outputTokens = usage?.output_tokens ?? null;
      const totalTokens = usage?.total_tokens ?? null;
      const cacheReadTokens = usage?.input_token_details?.cache_read ?? usage?.cache_read_tokens ?? null;

      // Extract provider metadata
      const provider = anyMsg.provider_metadata?.provider ?? null;
      const model = anyMsg.provider_metadata?.model ?? null;
      const audioDurationSeconds = usage?.audio_duration_seconds ?? null;
      const agent = anyMsg.agent_metadata?.agent ?? 'oracle';
      const durationMs = anyMsg.duration_ms ?? null;

      // Handle special content serialization for Tools
      let finalContent = "";

      if (type === 'ai' && ((message as AIMessage).tool_calls?.length ?? 0) > 0) {
        // Serialize tool calls with content
        finalContent = JSON.stringify({
          text: message.content,
          tool_calls: (message as AIMessage).tool_calls
        });
      } else if (type === 'tool') {
        const tm = message as ToolMessage;
        finalContent = JSON.stringify({
          content: tm.content,
          tool_call_id: tm.tool_call_id,
          name: tm.name
        });
      } else {
        finalContent = typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content);
      }

      const stmt = this.db.prepare(
        "INSERT INTO messages (session_id, type, content, created_at, input_tokens, output_tokens, total_tokens, cache_read_tokens, provider, model, audio_duration_seconds, agent, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      stmt.run(this.sessionId, type, finalContent, Date.now(), inputTokens, outputTokens, totalTokens, cacheReadTokens, provider, model, audioDurationSeconds, agent, durationMs);

      // Verificar se a sessão tem título e definir automaticamente se necessário
      await this.setSessionTitleIfNeeded();
    } catch (error) {
      // Check for specific SQLite errors
      if (error instanceof Error) {
        if (error.message.includes('SQLITE_BUSY')) {
          throw new Error(`Database is locked. Please try again. Original error: ${error.message}`);
        }
        if (error.message.includes('SQLITE_READONLY')) {
          throw new Error(`Database is read-only. Check file permissions. Original error: ${error.message}`);
        }
        if (error.message.includes('SQLITE_FULL')) {
          throw new Error(`Database is full or disk space is exhausted. Original error: ${error.message}`);
        }
      }
      throw new Error(`Failed to add message: ${error}`);
    }
  }

  /**
   * Adds multiple messages in a single SQLite transaction for better performance.
   * Replaces calling addMessage() in a loop when inserting agent-generated messages.
   */
  async addMessages(messages: BaseMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const stmt = this.db.prepare(
      "INSERT INTO messages (session_id, type, content, created_at, input_tokens, output_tokens, total_tokens, cache_read_tokens, provider, model, audio_duration_seconds, agent, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    const insertAll = this.db.transaction((msgs: BaseMessage[]) => {
      for (const message of msgs) {
        let type: string;
        if (message instanceof HumanMessage) type = "human";
        else if (message instanceof AIMessage) type = "ai";
        else if (message instanceof SystemMessage) type = "system";
        else if (message instanceof ToolMessage) type = "tool";
        else throw new Error(`Unsupported message type: ${message.constructor.name}`);

        const anyMsg = message as any;
        const usage = anyMsg.usage_metadata || anyMsg.response_metadata?.usage || anyMsg.response_metadata?.tokenUsage || anyMsg.usage;

        let finalContent: string;
        if (type === 'ai' && ((message as AIMessage).tool_calls?.length ?? 0) > 0) {
          finalContent = JSON.stringify({ text: message.content, tool_calls: (message as AIMessage).tool_calls });
        } else if (type === 'tool') {
          const tm = message as ToolMessage;
          finalContent = JSON.stringify({ content: tm.content, tool_call_id: tm.tool_call_id, name: tm.name });
        } else {
          finalContent = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
        }

        stmt.run(
          this.sessionId,
          type,
          finalContent,
          Date.now(),
          usage?.input_tokens ?? null,
          usage?.output_tokens ?? null,
          usage?.total_tokens ?? null,
          usage?.input_token_details?.cache_read ?? usage?.cache_read_tokens ?? null,
          anyMsg.provider_metadata?.provider ?? null,
          anyMsg.provider_metadata?.model ?? null,
          usage?.audio_duration_seconds ?? null,
          anyMsg.agent_metadata?.agent ?? 'oracle',
          anyMsg.duration_ms ?? null,
        );
      }
    });

    try {
      insertAll(messages);
      await this.setSessionTitleIfNeeded();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('SQLITE_BUSY')) throw new Error(`Database is locked. Please try again. Original error: ${error.message}`);
        if (error.message.includes('SQLITE_READONLY')) throw new Error(`Database is read-only. Check file permissions. Original error: ${error.message}`);
        if (error.message.includes('SQLITE_FULL')) throw new Error(`Database is full or disk space is exhausted. Original error: ${error.message}`);
      }
      throw new Error(`Failed to add messages in batch: ${error}`);
    }
  }

  /**
   * Verifies if the session has a title, and if not, sets it automatically
   * using the first 50 characters of the oldest human message.
   */
  private async setSessionTitleIfNeeded(): Promise<void> {
    // Fast path: skip DB query if we already set the title this session
    if (this.titleSet) return;

    // Verificar se a sessão já tem título
    const session = this.db.prepare(`
      SELECT title FROM sessions
      WHERE id = ?
    `).get(this.sessionId) as { title: string | null } | undefined;

    if (session && session.title) {
      // A sessão já tem título, não precisa fazer nada
      this.titleSet = true;
      return;
    }

    // Obter a mensagem mais antiga do tipo "human" da sessão
    const oldestHumanMessage = this.db.prepare(`
      SELECT content
      FROM messages
      WHERE session_id = ? AND type = 'human'
      ORDER BY created_at ASC
      LIMIT 1
    `).get(this.sessionId) as { content: string } | undefined;

    if (oldestHumanMessage) {
      // Pegar os primeiros 50 caracteres como título
      let title = oldestHumanMessage.content.substring(0, 50);

      // Certificar-se de que o título não termine no meio de uma palavra
      if (title.length === 50) {
        const lastSpaceIndex = title.lastIndexOf(' ');
        if (lastSpaceIndex > 0) {
          title = title.substring(0, lastSpaceIndex);
        }
      }

      // Chamar a função renameSession para definir o título automaticamente
      await this.renameSession(this.sessionId, title);
      this.titleSet = true;
    }
  }

  /**
   * Retrieves aggregated usage statistics for all messages in the database.
   */
  async getGlobalUsageStats(): Promise<{ totalInputTokens: number; totalOutputTokens: number; totalEstimatedCostUsd: number | null }> {
    try {
      const stmt = this.db.prepare(
        "SELECT SUM(input_tokens) as totalInput, SUM(output_tokens) as totalOutput FROM messages"
      );
      const row = stmt.get() as { totalInput: number; totalOutput: number };

      // Calculate total estimated cost by summing per-model costs
      const costStmt = this.db.prepare(
        `SELECT
          SUM((COALESCE(m.input_tokens, 0) / 1000000.0) * p.input_price_per_1m
            + (COALESCE(m.output_tokens, 0) / 1000000.0) * p.output_price_per_1m) as totalCost
        FROM messages m
        INNER JOIN model_pricing p ON p.provider = m.provider AND p.model = COALESCE(m.model, 'unknown')
        WHERE m.provider IS NOT NULL`
      );
      const costRow = costStmt.get() as { totalCost: number | null };

      return {
        totalInputTokens: row.totalInput || 0,
        totalOutputTokens: row.totalOutput || 0,
        totalEstimatedCostUsd: costRow.totalCost ?? null
      };
    } catch (error) {
      throw new Error(`Failed to get usage stats: ${error}`);
    }
  }

  async getSessionStatus(): Promise<SessionStatus | null> {
    try {
      const stmt = this.db.prepare(
        "SELECT embedding_status FROM sessions WHERE id = ?"
      );
      const row = stmt.get(this.sessionId) as { embedding_status: string } | undefined;

      //get messages where session_id = this.sessionId
      const stmtMessages = this.db.prepare(
        "SELECT COUNT(*) as messageCount FROM messages WHERE session_id = ?"
      );

      const msgRow = stmtMessages.get(this.sessionId) as { messageCount: number };

      if (row) {
        return {
          id: this.sessionId,
          embedding_status: row.embedding_status,
          messageCount: msgRow.messageCount || 0,
        };
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to get session status: ${error}`);
    }
  }

  /**
   * Retrieves aggregated usage statistics grouped by provider and model.
   */
  async getUsageStatsByProviderAndModel(): Promise<ProviderModelUsageStats[]> {
    try {
      const stmt = this.db.prepare(
        `SELECT
          m.provider,
          COALESCE(m.model, 'unknown') as model,
          SUM(m.input_tokens) as totalInputTokens,
          SUM(m.output_tokens) as totalOutputTokens,
          SUM(m.total_tokens) as totalTokens,
          COUNT(*) as messageCount,
          COALESCE(SUM(m.audio_duration_seconds), 0) as totalAudioSeconds,
          p.input_price_per_1m,
          p.output_price_per_1m
        FROM messages m
        LEFT JOIN model_pricing p ON p.provider = m.provider AND p.model = COALESCE(m.model, 'unknown')
        WHERE m.provider IS NOT NULL
        GROUP BY m.provider, COALESCE(m.model, 'unknown')
        ORDER BY m.provider, m.model`
      );

      const rows = stmt.all() as Array<{
        provider: string;
        model: string;
        totalInputTokens: number | null;
        totalOutputTokens: number | null;
        totalTokens: number | null;
        messageCount: number | null;
        totalAudioSeconds: number | null;
        input_price_per_1m: number | null;
        output_price_per_1m: number | null;
      }>;

      return rows.map((row) => {
        const inputTokens = row.totalInputTokens || 0;
        const outputTokens = row.totalOutputTokens || 0;
        let estimatedCostUsd: number | null = null;
        if (row.input_price_per_1m != null && row.output_price_per_1m != null) {
          estimatedCostUsd = (inputTokens / 1_000_000) * row.input_price_per_1m
                           + (outputTokens / 1_000_000) * row.output_price_per_1m;
        }
        return {
          provider: row.provider,
          model: row.model,
          totalInputTokens: inputTokens,
          totalOutputTokens: outputTokens,
          totalTokens: row.totalTokens || 0,
          messageCount: row.messageCount || 0,
          totalAudioSeconds: row.totalAudioSeconds || 0,
          estimatedCostUsd
        };
      });
    } catch (error) {
      throw new Error(`Failed to get grouped usage stats: ${error}`);
    }
  }

  /**
   * Retrieves aggregated usage statistics grouped by agent.
   * Merges data from `messages` (Oracle's direct messages) with `audit_events` (subagent LLM calls).
   */
  getUsageStatsByAgent(): Array<{
    agent: string;
    totalInputTokens: number;
    totalOutputTokens: number;
    messageCount: number;
    estimatedCostUsd: number;
  }> {
    try {
      // From messages table (Oracle and any subagent messages stored there)
      const rows = this.db.prepare(`
        SELECT
          COALESCE(m.agent, 'oracle') AS agent,
          SUM(COALESCE(m.input_tokens, 0)) AS totalInputTokens,
          SUM(COALESCE(m.output_tokens, 0)) AS totalOutputTokens,
          COUNT(*) AS messageCount,
          SUM(
            COALESCE(m.input_tokens, 0) / 1000000.0 * COALESCE(mp.input_price_per_1m, 0) +
            COALESCE(m.output_tokens, 0) / 1000000.0 * COALESCE(mp.output_price_per_1m, 0)
          ) AS estimatedCostUsd
        FROM messages m
        LEFT JOIN model_pricing mp ON mp.provider = m.provider AND mp.model = m.model
        WHERE m.type = 'ai' AND (m.input_tokens IS NOT NULL OR m.output_tokens IS NOT NULL)
        GROUP BY COALESCE(m.agent, 'oracle')
      `).all() as any[];

      // Also pull from audit_events if the table exists
      let auditRows: any[] = [];
      try {
        auditRows = this.db.prepare(`
          SELECT
            ae.agent,
            SUM(COALESCE(ae.input_tokens, 0)) AS totalInputTokens,
            SUM(COALESCE(ae.output_tokens, 0)) AS totalOutputTokens,
            COUNT(*) AS messageCount,
            SUM(
              COALESCE(ae.input_tokens, 0) / 1000000.0 * COALESCE(mp.input_price_per_1m, 0) +
              COALESCE(ae.output_tokens, 0) / 1000000.0 * COALESCE(mp.output_price_per_1m, 0)
            ) AS estimatedCostUsd
          FROM audit_events ae
          LEFT JOIN model_pricing mp ON mp.provider = ae.provider AND mp.model = ae.model
          WHERE ae.event_type = 'llm_call' AND ae.agent IS NOT NULL
          GROUP BY ae.agent
        `).all() as any[];
      } catch {
        // audit_events table may not exist yet
      }

      // Merge: group by agent, sum values
      const merged = new Map<string, { totalInputTokens: number; totalOutputTokens: number; messageCount: number; estimatedCostUsd: number }>();
      for (const r of [...rows, ...auditRows]) {
        const key = r.agent as string;
        const existing = merged.get(key) ?? { totalInputTokens: 0, totalOutputTokens: 0, messageCount: 0, estimatedCostUsd: 0 };
        merged.set(key, {
          totalInputTokens: existing.totalInputTokens + (r.totalInputTokens || 0),
          totalOutputTokens: existing.totalOutputTokens + (r.totalOutputTokens || 0),
          messageCount: existing.messageCount + (r.messageCount || 0),
          estimatedCostUsd: existing.estimatedCostUsd + (r.estimatedCostUsd || 0),
        });
      }

      return Array.from(merged.entries()).map(([agent, stats]) => ({ agent, ...stats }));
    } catch (error) {
      throw new Error(`Failed to get agent usage stats: ${error}`);
    }
  }

  // --- Model Pricing CRUD ---

  listModelPricing(): ModelPricingEntry[] {
    const rows = this.db.prepare('SELECT provider, model, input_price_per_1m, output_price_per_1m FROM model_pricing ORDER BY provider, model').all() as ModelPricingEntry[];
    return rows;
  }

  upsertModelPricing(entry: ModelPricingEntry): void {
    this.db.prepare(
      'INSERT INTO model_pricing (provider, model, input_price_per_1m, output_price_per_1m) VALUES (?, ?, ?, ?) ON CONFLICT(provider, model) DO UPDATE SET input_price_per_1m = excluded.input_price_per_1m, output_price_per_1m = excluded.output_price_per_1m'
    ).run(entry.provider, entry.model, entry.input_price_per_1m, entry.output_price_per_1m);
  }

  deleteModelPricing(provider: string, model: string): number {
    const result = this.db.prepare('DELETE FROM model_pricing WHERE provider = ? AND model = ?').run(provider, model);
    return result.changes;
  }

  /**
   * Clears all messages for the current session from the database.
   */
  async clear(): Promise<void> {
    try {
      const stmt = this.db.prepare("DELETE FROM messages WHERE session_id = ?");
      stmt.run(this.sessionId);
    } catch (error) {
      // Check for database lock errors
      if (error instanceof Error && error.message.includes('SQLITE_BUSY')) {
        throw new Error(`Database is locked. Please try again. Original error: ${error.message}`);
      }
      throw new Error(`Failed to clear messages: ${error}`);
    }
  }

  /**
   * Select the last session that time of no ended_at and return its ID, or create a new session if none found.
   * This allows us to group messages into sessions for better organization and potential future features like session management.
   */
  public async getSession(): Promise<void> {
    try {
      // Try to find an active session
      const selectStmt = this.db.prepare("SELECT id FROM sessions WHERE ended_at IS NULL AND status = 'active' ORDER BY started_at DESC LIMIT 1");
      const row = selectStmt.get() as { id: string } | undefined;
      if (row) {
        this.sessionId = row.id;
      }
      // If no active session, create a new one
      if (!this.sessionId) {
        const uuid = randomUUID();
        this.sessionId = uuid;
        const insertStmt = this.db.prepare("INSERT INTO sessions (id, started_at, status) VALUES (?, ?, 'active')");
        const sessionCreated = insertStmt.run(this.sessionId, Date.now());
        this.sessionId = sessionCreated.lastInsertRowid.toString();
      }
      const updateStmt = this.db.prepare("UPDATE messages SET session_id = ? WHERE session_id = 'default'");
      updateStmt.run(this.sessionId);
    } catch (error) {
      throw new Error(`Failed to get session: ${error}`);
    }
  }

  public async createNewSession(): Promise<void> {
    const now = Date.now();

    // Transação para garantir consistência
    const tx = this.db.transaction(() => {
      // Pegar a sessão atualmente ativa
      const activeSession = this.db.prepare(`
        SELECT id FROM sessions
        WHERE status = 'active'
      `).get() as { id: string } | undefined;

      // Se houver uma sessão ativa, mudar seu status para 'paused'
      if (activeSession) {
        this.db.prepare(`
          UPDATE sessions
          SET status = 'paused'
          WHERE id = ?
        `).run(activeSession.id);
      }

      // Criar uma nova sessão ativa
      const newId = randomUUID();
      this.db.prepare(`
        INSERT INTO sessions (
          id,
          started_at,
          status
        ) VALUES (?, ?, 'active')
      `).run(newId, now);

      // Atualizar o ID da sessão atual desta instância
      this.sessionId = newId;
      this.titleSet = false; // reset cache for new session
    });

    tx(); // Executar a transação

    this.display.log('✅ Nova sessão iniciada e sessão anterior pausada', { source: 'Sati' });
  }


  private chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
    if (!text || text.length === 0) return [];
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      let end = start + chunkSize;
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start) end = lastSpace;
      }
      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) chunks.push(chunk);
      start = end - overlap;
      if (start < 0) start = 0;
    }
    return chunks;
  }

  /**
   * Encerrar uma sessão e transformá-la em memória do Sati.
   * Validar sessão existe e está em active ou paused.
   * Marcar sessão como: status = 'archived', ended_at = now, archived_at = now, embedding_status = 'pending'.
   * Exportar mensagens → texto e criar chunks (session_chunks).
   * Remover mensagens da sessão após criar os chunks.
   */
  public async archiveSession(sessionId: string): Promise<void> {
    // Validar sessão existe e está em active ou paused
    const session = this.db.prepare(`
      SELECT id, status FROM sessions
      WHERE id = ?
    `).get(sessionId) as { id: string, status: string } | undefined;

    if (!session) {
      throw new Error(`Sessão com ID ${sessionId} não encontrada.`);
    }

    if (session.status !== 'active' && session.status !== 'paused') {
      throw new Error(`Sessão com ID ${sessionId} não está em estado ativo ou pausado. Status atual: ${session.status}`);
    }

    const now = Date.now();

    // Transação para garantir consistência
    const tx = this.db.transaction(() => {
      // Marcar sessão como: status = 'archived', ended_at = now, archived_at = now, embedding_status = 'pending'
      this.db.prepare(`
        UPDATE sessions
        SET status = 'archived',
            ended_at = ?,
            archived_at = ?,
            embedding_status = 'pending'
        WHERE id = ?
      `).run(now, now, sessionId);

      // Exportar mensagens → texto
      const messages = this.db.prepare(`
        SELECT type, content
        FROM messages
        WHERE session_id = ?
        ORDER BY created_at ASC
      `).all(sessionId) as Array<{ type: string, content: string }>;

      if (messages.length > 0) {
        const sessionText = messages
          .map(m => `[${m.type}] ${m.content}`)
          .join('\n\n');

        // Remover mensagens da sessão após criar os chunks
        this.db.prepare(`
          DELETE FROM messages
          WHERE session_id = ?
        `).run(sessionId);

        return sessionText;
      }
      return null;
    });

    const sessionText: string | null = tx(); // Executar a transação

    // Criar chunks no banco Sati — conexão aberta localmente e fechada ao fim
    if (sessionText) {
      const dbSatiPath = path.join(homedir(), '.morpheus', 'memory', 'sati-memory.db');
      this.ensureDirectory(dbSatiPath);
      const dbSati = new Database(dbSatiPath, { timeout: 5000 });
      dbSati.pragma('journal_mode = WAL');
      try {
        dbSati.exec(`
          CREATE TABLE IF NOT EXISTS session_chunks (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_session_chunks_session_id ON session_chunks(session_id);
        `);

        const chunks = this.chunkText(sessionText);
        const now = Date.now();
        const insert = dbSati.prepare(`
          INSERT INTO session_chunks (id, session_id, chunk_index, content, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        const insertMany = dbSati.transaction((items: string[]) => {
          items.forEach((chunk, i) => insert.run(randomUUID(), sessionId, i, chunk, now));
        });
        insertMany(chunks);
        this.display.log(`${chunks.length} chunks criados para sessão ${sessionId}`, { source: 'Sati' });
      } finally {
        dbSati.close();
      }
    }
  }

  /**
   * Descartar completamente uma sessão sem gerar memória.
   * Validar sessão existe e status ≠ archived.
   * Transação: deletar mensagens da sessão, marcar sessão como: status = 'deleted', deleted_at = now.
   * Se a sessão era active, criar nova sessão ativa.
   */
  public async deleteSession(sessionId: string): Promise<void> {
    // Validar sessão existe
    const session = this.db.prepare(`
      SELECT id, status FROM sessions
      WHERE id = ?
    `).get(sessionId) as { id: string, status: string } | undefined;

    if (!session) {
      throw new Error(`Sessão com ID ${sessionId} não encontrada.`);
    }

    // Validar status ≠ archived
    if (session.status === 'archived') {
      throw new Error(`Não é possível deletar uma sessão arquivada. Sessão ID: ${sessionId}`);
    }

    const now = Date.now();

    // Transação: deletar mensagens da sessão, marcar sessão como: status = 'deleted', deleted_at = now
    const tx = this.db.transaction(() => {
      // Deletar mensagens da sessão
      this.db.prepare(`
        DELETE FROM messages
        WHERE session_id = ?
      `).run(sessionId);

      // Marcar sessão como: status = 'deleted', deleted_at = now
      this.db.prepare(`
        UPDATE sessions
        SET status = 'deleted',
            deleted_at = ?
        WHERE id = ?
      `).run(now, sessionId);
    });

    tx(); // Executar a transação

    // Se a sessão era active, verificar se há outra para ativar
    if (session.status === 'active') {
      const nextSession = this.db.prepare(`
        SELECT id FROM sessions
        WHERE status = 'paused'
        ORDER BY started_at DESC
        LIMIT 1
      `).get() as { id: string } | undefined;

      if (nextSession) {
        // Promover a próxima sessão a ativa
        this.db.prepare(`
          UPDATE sessions
          SET status = 'active'
          WHERE id = ?
        `).run(nextSession.id);
      } else {
        // Nenhuma outra sessão, criar nova
        this.createFreshSession();
      }
    }
  }

  /**
   * Renomear uma sessão ativa ou pausada.
   * Validar sessão existe e status ∈ (paused, active).
   * Atualizar o título da sessão.
   */
  public async renameSession(sessionId: string, title: string): Promise<void> {
    // Validar sessão existe e status ∈ (paused, active)
    const session = this.db.prepare(`
      SELECT id, status FROM sessions
      WHERE id = ?
    `).get(sessionId) as { id: string, status: string } | undefined;

    if (!session) {
      throw new Error(`Sessão com ID ${sessionId} não encontrada.`);
    }

    if (session.status !== 'active' && session.status !== 'paused') {
      throw new Error(`Sessão com ID ${sessionId} não está em estado ativo ou pausado. Status atual: ${session.status}`);
    }

    // Transação para garantir consistência
    const tx = this.db.transaction(() => {
      // Atualizar o título da sessão
      this.db.prepare(`
        UPDATE sessions
        SET title = ?
        WHERE id = ?
      `).run(title, sessionId);
    });

    tx(); // Executar a transação
  }

  /**
   * Trocar o contexto ativo entre sessões não finalizadas.
   * Validar sessão alvo: existe e status ∈ (paused, active).
   * Se já for active, não faz nada.
   * Transação: sessão atual active → paused, sessão alvo → active.
   */
  /**
   * Creates a session row with status 'paused' if it doesn't already exist.
   * Safe to call multiple times — idempotent.
   */
  public ensureSession(sessionId: string): void {
    const existing = this.db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!existing) {
      this.db.prepare(
        "INSERT INTO sessions (id, started_at, status) VALUES (?, ?, 'paused')"
      ).run(sessionId, Date.now());
    }
  }

  public async switchSession(targetSessionId: string): Promise<void> {
    // Validar sessão alvo: existe e status ∈ (paused, active)
    const targetSession = this.db.prepare(`
      SELECT id, status FROM sessions
      WHERE id = ?
    `).get(targetSessionId) as { id: string, status: string } | undefined;

    if (!targetSession) {
      throw new Error(`Sessão alvo com ID ${targetSessionId} não encontrada.`);
    }

    if (targetSession.status !== 'active' && targetSession.status !== 'paused') {
      throw new Error(`Sessão alvo com ID ${targetSessionId} não está em estado ativo ou pausado. Status atual: ${targetSession.status}`);
    }

    // Se já for active, não faz nada
    if (targetSession.status === 'active') {
      return; // A sessão alvo já está ativa, não precisa fazer nada
    }

    // Transação: sessão atual active → paused, sessão alvo → active
    const tx = this.db.transaction(() => {
      // Pegar a sessão atualmente ativa
      const currentActiveSession = this.db.prepare(`
        SELECT id FROM sessions
        WHERE status = 'active'
      `).get() as { id: string } | undefined;

      // Se houver uma sessão ativa, mudar seu status para 'paused'
      if (currentActiveSession) {
        this.db.prepare(`
          UPDATE sessions
          SET status = 'paused'
          WHERE id = ?
        `).run(currentActiveSession.id);
      }

      // Mudar o status da sessão alvo para 'active'
      this.db.prepare(`
        UPDATE sessions
        SET status = 'active'
        WHERE id = ?
      `).run(targetSessionId);
    });

    tx(); // Executar a transação
  }

  /**
   * Garantir que sempre exista uma sessão ativa válida.
   * Buscar sessão com status = 'active', retornar seu id se existir,
   * ou criar nova sessão (createFreshSession) e retornar o novo id.
   */
  public async getCurrentSessionOrCreate(): Promise<string> {
    // Buscar sessão com status = 'active'
    const activeSession = this.db.prepare(`
      SELECT id FROM sessions
      WHERE status = 'active'
    `).get() as { id: string } | undefined;

    if (activeSession) {
      // Se existir, retornar seu id
      return activeSession.id;
    } else {
      // Se não existir, criar nova sessão (createFreshSession) e retornar o novo id
      const newId = await this.createFreshSession();
      return newId;
    }
  }

  private async createFreshSession(): Promise<string> {
    // Validar que não existe sessão 'active'
    const activeSession = this.db.prepare(`
      SELECT id FROM sessions
      WHERE status = 'active'
    `).get() as { id: string } | undefined;

    if (activeSession) {
      throw new Error('Já existe uma sessão ativa. Não é possível criar uma nova sessão ativa.');
    }

    const now = Date.now();
    const newId = randomUUID();

    this.db.prepare(`
    INSERT INTO sessions (
      id,
      started_at,
      status
    ) VALUES (?, ?, 'active')
  `).run(newId, now);

    return newId;
  }

  /**
   * Lists all active and paused sessions with their basic information.
   * Returns an array of session objects containing id, title, status, and started_at.
   */
  public async listSessions(): Promise<Array<{ id: string, title: string | null, status: string, started_at: number }>> {
    const sessions = this.db.prepare(`
      SELECT id, title, status, started_at
      FROM sessions
      WHERE status IN ('active', 'paused')
      ORDER BY started_at DESC
    `).all() as Array<{ id: string, title: string | null, status: string, started_at: number }>;

    return sessions;
  }

  /**
   * Closes the database connection.
   * Should be called when the history object is no longer needed.
   */
  close(): void {
    try {
      this.db.close();
    } catch (error) {
      // Ignore errors when closing
    }
  }
}
