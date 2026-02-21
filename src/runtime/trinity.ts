import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderFactory } from "./providers/factory.js";
import { ReactAgent } from "langchain";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";
import { SQLiteChatMessageHistory } from "./memory/sqlite.js";
import { DatabaseRegistry } from "./memory/trinity-db.js";
import { testConnection, introspectSchema, executeQuery } from "./trinity-connector.js";
import { updateTrinityDelegateToolDescription } from "./tools/trinity-tool.js";

/**
 * Trinity is a subagent of Oracle specialized in database operations.
 * It receives delegated tasks from Oracle, interprets them in natural language,
 * generates appropriate queries (SQL or NoSQL), executes them, and returns results.
 */
export class Trinity {
  private static instance: Trinity | null = null;
  private static currentSessionId: string | undefined = undefined;

  private agent?: ReactAgent;
  private config: MorpheusConfig;
  private display = DisplayManager.getInstance();

  private constructor(config?: MorpheusConfig) {
    this.config = config || ConfigManager.getInstance().get();
  }

  public static setSessionId(sessionId: string | undefined): void {
    Trinity.currentSessionId = sessionId;
  }

  public static getInstance(config?: MorpheusConfig): Trinity {
    if (!Trinity.instance) {
      Trinity.instance = new Trinity(config);
    }
    return Trinity.instance;
  }

  public static resetInstance(): void {
    Trinity.instance = null;
  }

  public static async refreshDelegateCatalog(): Promise<void> {
    const registry = DatabaseRegistry.getInstance();
    const databases = registry.listDatabases();
    updateTrinityDelegateToolDescription(databases);
  }

  private buildTrinityTools() {
    const registry = DatabaseRegistry.getInstance();

    const listDatabases = tool(
      async () => {
        const dbs = registry.listDatabases();
        if (dbs.length === 0) return 'No databases registered.';
        return dbs.map((db) => {
          const schema = db.schema_json
            ? JSON.parse(db.schema_json)
            : null;
          const tableNames = schema?.tables?.map((t: any) => t.name).join(', ') || 'schema not loaded';
          const updatedAt = db.schema_updated_at
            ? new Date(db.schema_updated_at).toISOString()
            : 'never';
          return `[${db.id}] ${db.name} (${db.type}) — tables: ${tableNames} — schema updated: ${updatedAt}`;
        }).join('\n');
      },
      {
        name: 'trinity_list_databases',
        description: 'List all registered databases with their name, type, and schema summary.',
        schema: z.object({}),
      }
    );

    const getSchema = tool(
      async ({ database_id }: { database_id: number }) => {
        const db = registry.getDatabase(database_id);
        if (!db) return `Database with id ${database_id} not found.`;
        if (!db.schema_json) return `No schema cached for database "${db.name}". Use trinity_refresh_schema first.`;
        return `Schema for "${db.name}" (${db.type}):\n${db.schema_json}`;
      },
      {
        name: 'trinity_get_schema',
        description: 'Get the full cached schema of a registered database by its id.',
        schema: z.object({
          database_id: z.number().describe('The id of the database to get schema for'),
        }),
      }
    );

    const refreshSchema = tool(
      async ({ database_id }: { database_id: number }) => {
        const db = registry.getDatabase(database_id);
        if (!db) return `Database with id ${database_id} not found.`;
        try {
          const schema = await introspectSchema(db);
          registry.updateSchema(database_id, JSON.stringify(schema, null, 2));
          return `Schema refreshed for "${db.name}". Tables: ${schema.tables.map((t) => t.name).join(', ')}`;
        } catch (err: any) {
          return `Failed to refresh schema for "${db.name}": ${err.message}`;
        }
      },
      {
        name: 'trinity_refresh_schema',
        description: 'Re-introspect and update the cached schema for a registered database.',
        schema: z.object({
          database_id: z.number().describe('The id of the database to refresh schema for'),
        }),
      }
    );

    const testConnectionTool = tool(
      async ({ database_id }: { database_id: number }) => {
        const db = registry.getDatabase(database_id);
        if (!db) return `Database with id ${database_id} not found.`;
        try {
          const ok = await testConnection(db);
          return ok
            ? `Connection to "${db.name}" (${db.type}) successful.`
            : `Connection to "${db.name}" (${db.type}) failed.`;
        } catch (err: any) {
          return `Connection test failed: ${err.message}`;
        }
      },
      {
        name: 'trinity_test_connection',
        description: 'Test connectivity to a registered database.',
        schema: z.object({
          database_id: z.number().describe('The id of the database to test'),
        }),
      }
    );

    const executeQueryTool = tool(
      async ({
        database_id,
        query,
        params,
      }: {
        database_id: number;
        query: string;
        params?: any[];
      }) => {
        const db = registry.getDatabase(database_id);
        if (!db) return `Database with id ${database_id} not found.`;
        try {
          const result = await executeQuery(db, query, params);
          if (result.rows.length === 0) return `Query returned 0 rows. (rowCount: ${result.rowCount})`;
          const preview = result.rows.slice(0, 50);
          const json = JSON.stringify(preview, null, 2);
          const note = result.rowCount > 50 ? `\n... (${result.rowCount} total rows, showing first 50)` : '';
          return `Rows (${result.rowCount}):\n${json}${note}`;
        } catch (err: any) {
          return `Query execution failed: ${err.message}`;
        }
      },
      {
        name: 'trinity_execute_query',
        description:
          'Execute a SQL query (PostgreSQL/MySQL/SQLite) or MongoDB JSON command on a registered database. ' +
          'For SQL: pass a standard SQL string. ' +
          'For MongoDB: pass a JSON string with { "collection": "name", "operation": "find|aggregate|countDocuments", "filter": {}, "options": {} }.',
        schema: z.object({
          database_id: z.number().describe('The id of the target database'),
          query: z.string().describe('SQL query string or MongoDB JSON command'),
          params: z.array(z.any()).optional().describe('Optional positional parameters for parameterized SQL queries'),
        }),
      }
    );

    return [listDatabases, getSchema, refreshSchema, testConnectionTool, executeQueryTool];
  }

  async initialize(): Promise<void> {
    const trinityConfig = (this.config as any).trinity || this.config.llm;

    const tools = this.buildTrinityTools();

    this.display.log(`Trinity initialized with ${tools.length} tools.`, { source: 'Trinity' });

    try {
      this.agent = await ProviderFactory.createBare(trinityConfig, tools);
    } catch (err) {
      throw new ProviderError(
        trinityConfig.provider,
        err,
        'Trinity subagent initialization failed'
      );
    }
  }

  async execute(task: string, context?: string, sessionId?: string): Promise<string> {
    if (!this.agent) {
      await this.initialize();
    }

    const trinityConfig = (this.config as any).trinity || this.config.llm;

    this.display.log(`Executing delegated task: ${task.slice(0, 80)}...`, { source: 'Trinity' });

    const registry = DatabaseRegistry.getInstance();
    const databases = registry.listDatabases();
    const dbSummary = databases.length > 0
      ? databases.map((db) => {
          const schema = db.schema_json ? JSON.parse(db.schema_json) : null;
          const tables = schema?.tables?.map((t: any) => t.name).join(', ') || 'schema not loaded';
          return `- [${db.id}] ${db.name} (${db.type}): ${tables}`;
        }).join('\n')
      : '  (no databases registered)';

    const systemMessage = new SystemMessage(`
You are Trinity, a specialized database subagent within the Morpheus system.

You receive natural-language database tasks from Oracle and execute them using your available tools.

Registered databases:
${dbSummary}

OPERATING RULES:
1. Interpret the task in natural language and determine the correct query to execute.
2. Always check the schema first using trinity_get_schema before writing queries.
3. If the schema is missing, use trinity_refresh_schema to load it.
4. Write safe, read-only queries by default. Only execute write operations if explicitly requested.
5. Return results in a clear, structured format.
6. If a query fails, try to diagnose the issue and suggest a fix.
7. Never expose raw credentials or connection strings in your responses.
8. Respond in the same language as the task.
9. For SQL databases: write standard SQL appropriate to the database type.
10. For MongoDB: format queries as JSON with { collection, operation, filter, options }.

${context ? `CONTEXT FROM ORACLE:\n${context}` : ''}
    `);

    const userMessage = new HumanMessage(task);
    const messages: BaseMessage[] = [systemMessage, userMessage];

    try {
      const response = await this.agent!.invoke({ messages });

      const lastMessage = response.messages[response.messages.length - 1];
      const content =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      const targetSession = sessionId ?? Trinity.currentSessionId ?? 'trinity';
      const history = new SQLiteChatMessageHistory({ sessionId: targetSession });
      try {
        const persisted = new AIMessage(content);
        (persisted as any).usage_metadata =
          (lastMessage as any).usage_metadata ??
          (lastMessage as any).response_metadata?.usage ??
          (lastMessage as any).response_metadata?.tokenUsage ??
          (lastMessage as any).usage;
        (persisted as any).provider_metadata = {
          provider: trinityConfig.provider,
          model: trinityConfig.model,
        };
        await history.addMessage(persisted);
      } finally {
        history.close();
      }

      this.display.log('Trinity task completed.', { source: 'Trinity' });
      return content;
    } catch (err) {
      throw new ProviderError(
        trinityConfig.provider,
        err,
        'Trinity task execution failed'
      );
    }
  }

  async reload(): Promise<void> {
    this.config = ConfigManager.getInstance().get();
    this.agent = undefined;
    await this.initialize();
  }
}
