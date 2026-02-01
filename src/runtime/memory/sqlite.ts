import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import Database from "better-sqlite3";
import * as fs from "fs-extra";
import * as path from "path";
import { homedir } from "os";

export interface SQLiteChatMessageHistoryInput {
  sessionId: string;
  databasePath?: string;
  limit?: number;
  config?: Database.Options;
}

export class SQLiteChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "sqlite"];
  
  private db: Database.Database;
  private sessionId: string;
  private limit?: number;

  constructor(fields: SQLiteChatMessageHistoryInput) {
    super();
    this.sessionId = fields.sessionId;
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
      
      // Try to ensure table, if it fails due to corruption, backup and recreate
      try {
        this.ensureTable();
      } catch (tableError) {
        // Database might be corrupted, attempt recovery
        this.handleCorruption(dbPath, tableError);
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
          cache_read_tokens INTEGER
        );
        
        CREATE INDEX IF NOT EXISTS idx_messages_session_id 
        ON messages(session_id);
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
      const tableInfo = this.db.pragma('table_info(messages)') as Array<{ name: string }>;
      const columns = new Set(tableInfo.map(c => c.name));
      
      const newColumns = [
        'input_tokens',
        'output_tokens',
        'total_tokens',
        'cache_read_tokens'
      ];
      
      for (const col of newColumns) {
        if (!columns.has(col)) {
          try {
            this.db.exec(`ALTER TABLE messages ADD COLUMN ${col} INTEGER`);
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
        "SELECT type, content, input_tokens, output_tokens, total_tokens, cache_read_tokens FROM messages WHERE session_id = ? ORDER BY id ASC LIMIT ?"
      );
      const rows = stmt.all(this.sessionId, this.limit) as Array<{ 
        type: string; 
        content: string;
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
        cache_read_tokens?: number;
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
        "INSERT INTO messages (session_id, type, content, created_at, input_tokens, output_tokens, total_tokens, cache_read_tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      );
      stmt.run(this.sessionId, type, finalContent, Date.now(), inputTokens, outputTokens, totalTokens, cacheReadTokens);
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
