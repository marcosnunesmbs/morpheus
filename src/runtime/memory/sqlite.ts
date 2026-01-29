import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import Database from "better-sqlite3";
import * as fs from "fs-extra";
import * as path from "path";
import { homedir } from "os";

export interface SQLiteChatMessageHistoryInput {
  sessionId: string;
  databasePath?: string;
  config?: Database.Options;
}

export class SQLiteChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "sqlite"];
  
  private db: Database.Database;
  private sessionId: string;

  constructor(fields: SQLiteChatMessageHistoryInput) {
    super();
    this.sessionId = fields.sessionId;
    
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
          created_at INTEGER NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_messages_session_id 
        ON messages(session_id);
      `);
    } catch (error) {
      throw new Error(`Failed to create messages table: ${error}`);
    }
  }

  /**
   * Retrieves all messages for the current session from the database.
   * @returns Promise resolving to an array of BaseMessage objects
   */
  async getMessages(): Promise<BaseMessage[]> {
    try {
      const stmt = this.db.prepare(
        "SELECT type, content FROM messages WHERE session_id = ? ORDER BY id ASC"
      );
      const rows = stmt.all(this.sessionId) as Array<{ type: string; content: string }>;

      return rows.map((row) => {
        switch (row.type) {
          case "human":
            return new HumanMessage(row.content);
          case "ai":
            return new AIMessage(row.content);
          case "system":
            return new SystemMessage(row.content);
          default:
            throw new Error(`Unknown message type: ${row.type}`);
        }
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
      } else {
        throw new Error(`Unsupported message type: ${message.constructor.name}`);
      }

      const content = typeof message.content === "string" 
        ? message.content 
        : JSON.stringify(message.content);

      const stmt = this.db.prepare(
        "INSERT INTO messages (session_id, type, content, created_at) VALUES (?, ?, ?, ?)"
      );
      stmt.run(this.sessionId, type, content, Date.now());
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
