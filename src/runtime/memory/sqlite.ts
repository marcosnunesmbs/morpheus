import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import Database from "better-sqlite3";
import fs from "fs-extra";
import * as path from "path";
import { homedir } from "os";
import type { ProviderModelUsageStats } from "../../types/stats.js";
import { randomUUID } from 'crypto';
import { DisplayManager } from "../display.js";

export interface SQLiteChatMessageHistoryInput {
  sessionId: string | '';
  databasePath?: string;
  limit?: number;
  config?: Database.Options;
}

export interface SessionStatus { embedded: boolean; embedding_status: string, id: string, messageCount: number }

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

  private db: Database.Database;
  private dbSati?: Database.Database; // Optional separate DB for Sati memory, if needed in the future
  private sessionId: string;
  private limit?: number;

  constructor(fields: SQLiteChatMessageHistoryInput) {
    super();
    this.sessionId = fields.sessionId || '';
    this.limit = fields.limit ? fields.limit : 20;

    // Default path: ~/.morpheus/memory/short-memory.db
    const dbPath = fields.databasePath || path.join(homedir(), ".morpheus", "memory", "short-memory.db");
    const dbSatiPath = path.join(homedir(), '.morpheus', 'memory', 'sati-memory.db');

    // Ensure the directory exists
    this.ensureDirectory(dbPath);
    this.ensureDirectory(dbSatiPath);

    // Initialize database with retry logic for locked databases
    try {
      this.db = new Database(dbPath, {
        ...fields.config,
        timeout: 5000, // 5 second timeout for locks
      });
      this.dbSati = new Database(dbSatiPath, {
        ...fields.config,
        timeout: 5000,
      });

      // Try to ensure table, if it fails due to corruption, backup and recreate
      try {
        this.ensureTable();
      } catch (tableError) {
        // Database might be corrupted, attempt recovery
        this.handleCorruption(dbPath, tableError);
      }

      // Initialize session ID if not provided (after db is initialized)
      if (!this.sessionId) {
        this.startSession(); // Initialize session ID if not provided
      }
    } catch (error) {
      throw new Error(`Failed to initialize SQLite database at ${dbPath}: ${error}`);
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
          model TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_messages_session_id 
        ON messages(session_id);

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          embedded INTEGER DEFAULT 0,
          embedding_status TEXT DEFAULT 'active'
        );

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
        'model'
      ];

      const integerColumns = new Set(['input_tokens', 'output_tokens', 'total_tokens', 'cache_read_tokens']);

      for (const col of newColumns) {
        if (!columns.has(col)) {
          try {
            const type = integerColumns.has(col) ? 'INTEGER' : 'TEXT';
            this.db.exec(`ALTER TABLE messages ADD COLUMN ${col} ${type}`);
          } catch (e) {
            // Ignore error if column already exists (race condition or check failed)
            console.warn(`[SQLite] Failed to add column ${col}: ${e}`);
          }
        }
      }

      // Migrate sessions table
      const sessionsTableInfo = this.db.pragma('table_info(sessions)') as Array<{ name: string }>;
      const sessionsColumns = new Set(sessionsTableInfo.map(c => c.name));

      if (!sessionsColumns.has('embedding_status')) {
        try {
          this.db.exec(`ALTER TABLE sessions ADD COLUMN embedding_status TEXT DEFAULT 'active'`);
        } catch (e) {
          console.warn(`[SQLite] Failed to add column embedding_status: ${e}`);
        }
      } else {
        // Compatibility: Ensure active sessions have 'active' status (if they were created with default 'pending')
        try {
          this.db.exec(`UPDATE sessions SET embedding_status = 'active' WHERE ended_at IS NULL AND (embedding_status IS NULL OR embedding_status = 'pending')`);
        } catch (e) {
          console.warn(`[SQLite] Failed to update embedding_status: ${e}`);
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
        "INSERT INTO messages (session_id, type, content, created_at, input_tokens, output_tokens, total_tokens, cache_read_tokens, provider, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      stmt.run(this.sessionId, type, finalContent, Date.now(), inputTokens, outputTokens, totalTokens, cacheReadTokens, provider, model);
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
   * Retrieves aggregated usage statistics for all messages in the database.
   */
  async getGlobalUsageStats(): Promise<{ totalInputTokens: number; totalOutputTokens: number }> {
    try {
      const stmt = this.db.prepare(
        "SELECT SUM(input_tokens) as totalInput, SUM(output_tokens) as totalOutput FROM messages"
      );
      const row = stmt.get() as { totalInput: number; totalOutput: number };
      return {
        totalInputTokens: row.totalInput || 0,
        totalOutputTokens: row.totalOutput || 0
      };
    } catch (error) {
      throw new Error(`Failed to get usage stats: ${error}`);
    }
  }

  async getSessionStatus(): Promise<SessionStatus | null> {
    try {
      const stmt = this.db.prepare(
        "SELECT embedded, embedding_status FROM sessions WHERE id = ?"
      );
      const row = stmt.get(this.sessionId) as { embedded: number; embedding_status: string } | undefined;

      //get messages where session_id = this.sessionId
      const stmtMessages = this.db.prepare(
        "SELECT COUNT(*) as messageCount FROM messages WHERE session_id = ?"
      );

      const msgRow = stmtMessages.get(this.sessionId) as { messageCount: number };

      if (row) {
        return {
          id: this.sessionId,
          embedded: row.embedded === 1,
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
          provider,
          COALESCE(model, 'unknown') as model,
          SUM(input_tokens) as totalInputTokens,
          SUM(output_tokens) as totalOutputTokens,
          SUM(total_tokens) as totalTokens,
          COUNT(*) as messageCount
        FROM messages
        WHERE provider IS NOT NULL
        GROUP BY provider, COALESCE(model, 'unknown')
        ORDER BY provider, model`
      );

      const rows = stmt.all() as Array<{
        provider: string;
        model: string;
        totalInputTokens: number | null;
        totalOutputTokens: number | null;
        totalTokens: number | null;
        messageCount: number | null;
      }>;

      return rows.map((row) => ({
        provider: row.provider,
        model: row.model,
        totalInputTokens: row.totalInputTokens || 0,
        totalOutputTokens: row.totalOutputTokens || 0,
        totalTokens: row.totalTokens || 0,
        messageCount: row.messageCount || 0
      }));
    } catch (error) {
      throw new Error(`Failed to get grouped usage stats: ${error}`);
    }
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
  public async startSession(): Promise<void> {
    try {
      // Try to find an active session
      const selectStmt = this.db.prepare("SELECT id FROM sessions WHERE ended_at IS NULL AND embedding_status = 'active' ORDER BY started_at DESC LIMIT 1");
      const row = selectStmt.get() as { id: string } | undefined;
      if (row) {
        this.sessionId = row.id;
      }
      // If no active session, create a new one
      if (!this.sessionId) {
        const uuid = randomUUID();
        this.sessionId = uuid;

        const insertStmt = this.db.prepare("INSERT INTO sessions (id, started_at, embedded, embedding_status) VALUES (?, ?, 0, 'active')");
        insertStmt.run(this.sessionId, Date.now());
      }
      const updateStmt = this.db.prepare("UPDATE messages SET session_id = ? WHERE session_id = 'default'");
      updateStmt.run(this.sessionId);
    } catch (error) {
      throw new Error(`Failed to start session: ${error}`);
    }
  }

  public async createNewSession(): Promise<void> {
    const now = Date.now();
    let filepath: string | null = null;

    const txShort = this.db.transaction(() => {
      const txSati = this.dbSati!.transaction(() => {

        // 1️⃣ pegar sessão ativa
        const activeSession = this.db.prepare(`
        SELECT * FROM sessions
        WHERE ended_at IS NULL
        LIMIT 1
      `).get() as any;

        if (!activeSession) {
          throw new Error('No active session to archive.');
        }

        this.display.log(`🔒 Finalizando sessão ${activeSession.id}`, { source: 'Sati' });

        // 2️⃣ finalizar sessão
        this.db.prepare(`
        UPDATE sessions
        SET ended_at = ?,
            embedding_status = 'pending',
            embedded = 0
        WHERE id = ?
      `).run(now, activeSession.id);

        // 3️⃣ buscar mensagens
        const messages = this.db.prepare(`
        SELECT type, content
        FROM messages
        WHERE session_id = ?
        ORDER BY created_at ASC
      `).all(activeSession.id) as any[];

        if (messages.length === 0) {
          throw new Error('Sessão vazia.'); // força rollback
        }

        // 4️⃣ montar texto
        const sessionText = messages
          .map(m => `[${m.type}] ${m.content}`)
          .join('\n\n');

        // 5️⃣ salvar TXT
        filepath = path.join(
          homedir(),
          '.morpheus',
          'memory',
          'sessions',
          `${activeSession.id}.txt`
        );

        fs.ensureDirSync(path.dirname(filepath));
        fs.writeFileSync(filepath, sessionText);

        // 6️⃣ criar chunks no sati-memory.db
        const chunks = this.chunkText(sessionText);

        for (let i = 0; i < chunks.length; i++) {
          this.dbSati!.prepare(`
          INSERT INTO session_chunks (
            id,
            session_id,
            chunk_index,
            content,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).run(
            randomUUID(),
            activeSession.id,
            i,
            chunks[i],
            now
          );
        }

        this.display.log(`🧩 ${chunks.length} chunks criados`, { source: 'Sati' });

      });

      txSati(); // executa transação do sati
    });

    try {
      txShort(); // executa tudo
      const newId = this.createFreshSession();
      this.sessionId = newId;

      this.display.log('✅ Nova sessão iniciada', { source: 'Sati' });

    } catch (err) {

      // 🔥 rollback já aconteceu automaticamente
      this.display.log('❌ Erro ao finalizar sessão. Rollback aplicado.', { source: 'Sati' });

      // 🔥 se criou arquivo, apagar
      if (filepath && fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      throw err;
    }
  }


  private createFreshSession(): string {
    const now = Date.now();
    const newId = randomUUID();

    this.db.prepare(`
    INSERT INTO sessions (
      id,
      started_at,
      embedded,
      embedding_status
    ) VALUES (?, ?, 0, 'active')
  `).run(newId, now);

    return newId;
  }

  private chunkText(
    text: string,
    chunkSize: number = 1000,
    overlap: number = 200
  ): string[] {

    if (!text || text.length === 0) {
      return [];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;

      // Evita cortar no meio da palavra
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }

      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      start = end - overlap;

      if (start < 0) start = 0;
    }

    return chunks;
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
