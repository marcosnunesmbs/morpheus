# Usage Analytics Page (MNU-6)

## Goal
Create a dedicated analytics page that displays token usage grouped by provider and model, exposed via a new backend endpoint and rendered with a custom accordion UI in the web dashboard.

## Prerequisites
Make sure that the use is currently on the `marcosnunesmbs/mnu-6-mostrar-gastos-por-modelo` branch before beginning implementation.
If not, move them to the correct branch. If the branch does not exist, create it from main.

### Step-by-Step Instructions

#### Step 1: Backend - Grouped Usage Query + API Endpoint
- [ ] Create a new stats type definition file at `src/types/stats.ts`.
- [ ] Copy and paste code below into `src/types/stats.ts`:

```typescript
export interface ProviderModelUsageStats {
  provider: string;
  model: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  messageCount: number;
}
```

- [ ] Add a new grouped usage query method in `src/runtime/memory/sqlite.ts`.
- [ ] Copy and paste the full file below into `src/runtime/memory/sqlite.ts`:

```typescript
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import Database from "better-sqlite3";
import * as fs from "fs-extra";
import * as path from "path";
import { homedir } from "os";
import type { ProviderModelUsageStats } from "../../types/stats.js";

export interface SQLiteChatMessageHistoryInput {
  sessionId: string;
  databasePath?: string;
  limit?: number;
  config?: Database.Options;
}

/**
 * Metadata for tracking which provider and model generated a message.
 */
export interface MessageProviderMetadata {
  provider: string;
  model: string;
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
          cache_read_tokens INTEGER,
          provider TEXT,
          model TEXT
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
        "SELECT type, content, input_tokens, output_tokens, total_tokens, cache_read_tokens, provider, model FROM messages WHERE session_id = ? ORDER BY id ASC LIMIT ?"
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
```

- [ ] Add a new API endpoint in `src/http/api.ts`.
- [ ] Copy and paste the full file below into `src/http/api.ts`:

```typescript
import { Router } from 'express';
import { ConfigManager } from '../config/manager.js';
import { PATHS } from '../config/paths.js';
import { DisplayManager } from '../runtime/display.js';
import fs from 'fs-extra';
import path from 'path';
import { SQLiteChatMessageHistory } from '../runtime/memory/sqlite.js';
import type { ProviderModelUsageStats } from '../types/stats.js';

async function readLastLines(filePath: string, n: number): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n');
    return lines.slice(-n);
  } catch (err) {
    return [];
  }
}

export function createApiRouter() {
  const router = Router();
  const configManager = ConfigManager.getInstance();

  router.get('/status', async (req, res) => {
    let version = 'unknown';
    try {
        const pkg = await fs.readJson(path.join(process.cwd(), 'package.json'));
        version = pkg.version;
    } catch {}

    const config = configManager.get();
    res.json({
      status: 'online',
      uptimeSeconds: process.uptime(),
      pid: process.pid,
      projectVersion: version,
      nodeVersion: process.version,
      agentName: config.agent.name,
      llmProvider: config.llm.provider,
      llmModel: config.llm.model
    });
  });

  router.get('/config', (req, res) => {
    res.json(configManager.get());
  });

  router.get('/stats/usage', async (req, res) => {
    try {
      const history = new SQLiteChatMessageHistory({ sessionId: 'api-reader' });
      const stats = await history.getGlobalUsageStats();
      history.close();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/stats/usage/grouped', async (req, res) => {
    try {
      const history = new SQLiteChatMessageHistory({ sessionId: 'api-reader' });
      const stats: ProviderModelUsageStats[] = await history.getUsageStatsByProviderAndModel();
      history.close();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Calculate diff between two objects
  const getDiff = (obj1: any, obj2: any, prefix = ''): string[] => {
    const changes: string[] = [];
    const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

    for (const key of keys) {
        const val1 = obj1?.[key];
        const val2 = obj2?.[key];
        const currentPath = prefix ? `${prefix}.${key}` : key;

        // Skip if identical
        if (JSON.stringify(val1) === JSON.stringify(val2)) continue;

        if (
            typeof val1 === 'object' && val1 !== null &&
            typeof val2 === 'object' && val2 !== null &&
            !Array.isArray(val1) && !Array.isArray(val2)
        ) {
            changes.push(...getDiff(val1, val2, currentPath));
        } else {
            // Mask secrets in logs
            const isSecret = currentPath.includes('key') || currentPath.includes('token');
            const v1Display = isSecret ? '***' : JSON.stringify(val1);
            const v2Display = isSecret ? '***' : JSON.stringify(val2);
            changes.push(`${currentPath}: ${v1Display} -> ${v2Display}`);
        }
    }
    return changes;
  };

  router.post('/config', async (req, res) => {
    try {
      const oldConfig = JSON.parse(JSON.stringify(configManager.get()));
      
      // Save will validate against Zod schema
      await configManager.save(req.body);
      
      const newConfig = configManager.get();
      const changes = getDiff(oldConfig, newConfig);

      if (changes.length > 0) {
        const display = DisplayManager.getInstance();
        display.log(`Configuration updated via UI:\n  - ${changes.join('\n  - ')}`, { 
            source: 'Config', 
            level: 'info' 
        });
      }

      res.json(newConfig);
    } catch (error: any) {
      if (error.name === 'ZodError') {
          res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
          res.status(400).json({ error: error.message });
      }
    }
  });

  // Keep PUT for backward compatibility if needed, or remove. 
  // Tasks says Implement POST. I'll remove PUT to avoid confusion or redirect it.
  router.put('/config', async (req, res) => {
      // Redirect to POST logic or just reuse
      res.status(307).redirect(307, '/api/config');
  });

  router.get('/logs', async (req, res) => {
    try {
      await fs.ensureDir(PATHS.logs);
      const files = await fs.readdir(PATHS.logs);
      const logFiles = await Promise.all(
        files.filter(f => f.endsWith('.log')).map(async (name) => {
          const stats = await fs.stat(path.join(PATHS.logs, name));
          return {
            name,
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        })
      );
      logFiles.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
      res.json(logFiles);
    } catch (e) {
      res.status(500).json({ error: 'Failed to list logs' });
    }
  });

  router.get('/logs/:filename', async (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
       return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Explicitly cast req.query.limit to string, or handle ParsedQs type
    const limitQuery = req.query.limit;
    const limit = limitQuery ? parseInt(String(limitQuery)) : 50;

    const filePath = path.join(PATHS.logs, filename);
    
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'Log file not found' });
    }

    const lines = await readLastLines(filePath, limit);
    res.json({ lines: lines.reverse() });
  });

  return router;
}
```

##### Step 1 Verification Checklist
- [ ] Start the backend and confirm `/api/stats/usage/grouped` returns an array of grouped stats.
- [ ] Verify the endpoint returns `[]` when the database has no messages.
- [ ] Confirm no TypeScript errors in backend build.

#### Step 1 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

#### Step 2: Frontend - Analytics Accordion Components
- [ ] Create `src/ui/src/components/analytics/ModelStatsCard.tsx`.
- [ ] Copy and paste code below into `src/ui/src/components/analytics/ModelStatsCard.tsx`:

```tsx
import { ArrowDown, ArrowUp, Hash } from 'lucide-react';

export interface ModelStatsCardProps {
  model: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  messageCount: number;
}

const formatNumber = (value: number) => value.toLocaleString();

export function ModelStatsCard({
  model,
  totalInputTokens,
  totalOutputTokens,
  totalTokens,
  messageCount
}: ModelStatsCardProps) {
  return (
    <div className="border border-matrix-primary/50 rounded bg-black/40 p-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
        <div className="md:col-span-2">
          <div className="text-xs text-matrix-secondary uppercase tracking-wide">Model</div>
          <div className="text-matrix-highlight font-bold break-all">{model}</div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-matrix-secondary">
          <div className="flex items-center gap-2">
            <ArrowDown className="w-4 h-4" />
            <span>Input</span>
          </div>
          <span className="text-matrix-highlight font-bold">{formatNumber(totalInputTokens)}</span>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-matrix-secondary">
          <div className="flex items-center gap-2">
            <ArrowUp className="w-4 h-4" />
            <span>Output</span>
          </div>
          <span className="text-matrix-highlight font-bold">{formatNumber(totalOutputTokens)}</span>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-matrix-secondary">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4" />
            <span>Total</span>
          </div>
          <span className="text-matrix-highlight font-bold">{formatNumber(totalTokens)}</span>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-matrix-secondary">
          <span>Messages</span>
          <span className="text-matrix-highlight font-bold">{formatNumber(messageCount)}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] Create `src/ui/src/components/analytics/ProviderAccordion.tsx`.
- [ ] Copy and paste code below into `src/ui/src/components/analytics/ProviderAccordion.tsx`:

```tsx
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ModelStatsCard, type ModelStatsCardProps } from './ModelStatsCard';

export interface ProviderGroup {
  provider: string;
  displayName?: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  messageCount: number;
  models: ModelStatsCardProps[];
}

interface ProviderAccordionProps {
  group: ProviderGroup;
  defaultOpen?: boolean;
}

const formatNumber = (value: number) => value.toLocaleString();

export function ProviderAccordion({ group, defaultOpen = false }: ProviderAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-matrix-primary rounded bg-zinc-950/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-matrix-primary/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="text-matrix-highlight font-bold">
            {(group.displayName ?? group.provider).toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-matrix-secondary">
          <span>Input {formatNumber(group.totalInputTokens)}</span>
          <span>Output {formatNumber(group.totalOutputTokens)}</span>
          <span>Total {formatNumber(group.totalTokens)}</span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {group.models.map((model) => (
                <ModelStatsCard
                  key={`${group.provider}-${model.model}`}
                  {...model}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

##### Step 2 Verification Checklist
- [ ] Run the UI and ensure the accordion expands/collapses smoothly.
- [ ] Verify model cards render with correct labels and token numbers.
- [ ] Confirm no TypeScript errors in the UI build.

#### Step 2 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

#### Step 3: Frontend - Analytics Page + Stats Service
- [ ] Update the stats service to include grouped usage fetching.
- [ ] Copy and paste the full file below into `src/ui/src/services/stats.ts`:

```typescript
// @ts-ignore
import type { UsageStats } from '../../../../specs/016-ui-config-stats/contracts/api-stats';
import { httpClient } from './httpClient';

export interface ProviderModelUsageStats {
  provider: string;
  model: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  messageCount: number;
}

export const statsService = {
  fetchUsageStats: async (): Promise<UsageStats> => {
    return httpClient.get<UsageStats>('/stats/usage');
  },
  fetchGroupedUsageStats: async (): Promise<ProviderModelUsageStats[]> => {
    return httpClient.get<ProviderModelUsageStats[]>('/stats/usage/grouped');
  }
};
```

- [ ] Create the analytics page at `src/ui/src/pages/Analytics.tsx`.
- [ ] Copy and paste code below into `src/ui/src/pages/Analytics.tsx`:

```tsx
import { useMemo } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { BarChart3, AlertTriangle } from 'lucide-react';
import { statsService, type ProviderModelUsageStats } from '../services/stats';
import { ProviderAccordion, type ProviderGroup } from '../components/analytics/ProviderAccordion';
import { Section } from '../components/forms/Section';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  google: 'Google Gemini',
  ollama: 'Ollama'
};

const getProviderLabel = (provider: string) => {
  const normalized = provider.toLowerCase();
  return PROVIDER_LABELS[normalized] ?? provider.toUpperCase();
};

export function Analytics() {
  const { data, error } = useSWR('/api/stats/usage/grouped', statsService.fetchGroupedUsageStats, {
    refreshInterval: 5000
  });

  const groups = useMemo<ProviderGroup[]>(() => {
    if (!data) return [];

    const byProvider = new Map<string, ProviderGroup>();

    data.forEach((stat: ProviderModelUsageStats) => {
      if (!byProvider.has(stat.provider)) {
        byProvider.set(stat.provider, {
          provider: stat.provider,
          displayName: getProviderLabel(stat.provider),
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
          messageCount: 0,
          models: []
        });
      }

      const group = byProvider.get(stat.provider)!;
      group.models.push(stat);
      group.totalInputTokens += stat.totalInputTokens;
      group.totalOutputTokens += stat.totalOutputTokens;
      group.totalTokens += stat.totalTokens;
      group.messageCount += stat.messageCount;
    });

    return Array.from(byProvider.values())
      .map(group => ({
        ...group,
        models: [...group.models].sort((a, b) => b.totalTokens - a.totalTokens)
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);
  }, [data]);

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-matrix-highlight" />
        <div>
          <h2 className="text-2xl font-bold text-matrix-highlight">USAGE ANALYTICS</h2>
          <p className="text-matrix-secondary opacity-80">Token usage grouped by provider and model.</p>
        </div>
      </div>

      {error && (
        <div className="border border-red-500/40 bg-red-500/10 rounded p-4 flex items-center gap-3 text-red-300">
          <AlertTriangle className="w-4 h-4" />
          <span>Failed to load usage stats. Please check the server logs.</span>
        </div>
      )}

      {!data && !error && (
        <div className="border border-matrix-primary/50 bg-zinc-950/50 rounded p-4 text-matrix-secondary">
          Loading usage data...
        </div>
      )}

      {data && groups.length === 0 && (
        <div className="border border-matrix-primary/50 bg-zinc-950/50 rounded p-4 text-matrix-secondary">
          No usage data available yet. Start a conversation to generate token usage.
        </div>
      )}

      {groups.length > 0 && (
        <Section
          title="Provider Breakdown"
          description="Expand each provider to view model-level token usage."
        >
          {groups.map((group, index) => (
            <ProviderAccordion
              key={group.provider}
              group={group}
              defaultOpen={index === 0}
            />
          ))}
        </Section>
      )}
    </motion.div>
  );
}
```

##### Step 3 Verification Checklist
- [ ] Visit `/analytics` and confirm data loads from `/api/stats/usage/grouped`.
- [ ] Confirm providers are sorted by total usage (highest first).
- [ ] Verify the first provider accordion opens by default.
- [ ] Validate empty, loading, and error states render correctly.

#### Step 3 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

#### Step 4: Frontend - Route + Navigation
- [ ] Register the Analytics route in `src/ui/src/App.tsx`.
- [ ] Copy and paste the full file below into `src/ui/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import Settings from './pages/Settings';
import { Logs } from './pages/Logs';
import { Login } from './pages/Login';
import { AuthGuard } from './components/AuthGuard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/config" element={<Settings />} />
                  <Route path="/logs" element={<Logs />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] Add the Analytics nav item in `src/ui/src/components/Layout.tsx`.
- [ ] Copy and paste the full file below into `src/ui/src/components/Layout.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Terminal, Settings, Activity, LayoutDashboard, Sun, Moon, LogOut, BarChart3 } from 'lucide-react';
import { Footer } from './Footer';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isDark, setIsDark] = useState(true);
  const { logout } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      setIsDark(saved === 'dark');
    } else {
      setIsDark(true); // Default to Matrix / Dark
    }
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: Settings, label: 'Configuration', path: '/config' },
    { icon: Terminal, label: 'Logs', path: '/logs' },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-matrix-secondary font-mono overflow-hidden transition-colors duration-300">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <motion.div 
          className="w-64 border-r border-gray-200 dark:border-matrix-primary bg-white dark:bg-zinc-950 flex flex-col shrink-0 transition-colors duration-300"
          initial={{ x: -64, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.9, type: 'spring' }}
        >
          <div className="p-4 border-b border-gray-200 dark:border-matrix-primary flex justify-between items-center">
            <h1 className="text-xl font-bold text-green-700 dark:text-matrix-highlight flex items-center gap-2">
              <Activity className="w-6 h-6" />
              MORPHEUS
            </h1>
            <button 
              onClick={() => setIsDark(!isDark)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-matrix-primary/50 text-gray-500 dark:text-matrix-secondary transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${
                    isActive 
                      ? 'bg-green-100 text-green-800 dark:bg-matrix-primary dark:text-matrix-highlight' 
                      : 'hover:bg-gray-100 dark:hover:bg-matrix-primary/50 text-gray-600 dark:text-matrix-secondary'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          
          {/* Logout Button */}
          <div className="p-4 border-t border-gray-200 dark:border-matrix-primary">
            <button
              onClick={logout}
              className="flex items-center gap-3 px-4 py-3 rounded w-full text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-matrix-secondary hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </motion.div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-8 relative flex flex-col">
          <div className="max-w-6xl w-full mx-auto flex-1">
            {children}
          </div>
          
          {/* Scanline effect overlay (only in dark mode) */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(0,255,0,0.03),rgba(0,255,0,0.01))] bg-[length:100%_2px,3px_100%] opacity-0 dark:opacity-20 transition-opacity duration-300" />
        </main>
      </div>

      <Footer />
    </div>
  );
}
```

##### Step 4 Verification Checklist
- [ ] Navigate to `/analytics` and confirm the page loads.
- [ ] Verify the Analytics item appears in the sidebar between Dashboard and Configuration.
- [ ] Confirm active nav highlighting works for the Analytics route.

#### Step 4 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.
