import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ConfigManager } from "../../config/manager.js";
import { promises as fsPromises } from "fs";
import path from "path";
import { homedir } from "os";
import Database from "better-sqlite3";
import { TaskRepository } from "../tasks/repository.js";
import { TaskRequestContext } from "../tasks/context.js";
import type { TaskRecord } from "../tasks/types.js";

// ─── Shared ───────────────────────────────────────────────────────────────────

const shortMemoryDbPath = path.join(homedir(), ".morpheus", "memory", "short-memory.db");

// ─── Config ───────────────────────────────────────────────────────────────────

function setNestedValue(obj: any, dotPath: string, value: any) {
  const keys = dotPath.split(".");
  let curr = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!curr[keys[i]] || typeof curr[keys[i]] !== "object") {
      curr[keys[i]] = {};
    }
    curr = curr[keys[i]];
  }
  curr[keys[keys.length - 1]] = value;
}

export const ConfigQueryTool = tool(
  async ({ key }) => {
    try {
      const configManager = ConfigManager.getInstance();
      await configManager.load();
      const config = configManager.get();
      if (key) {
        const value = key.split(".").reduce((obj: any, k) => (obj ? obj[k] : undefined), config);
        return JSON.stringify({ [key]: value });
      }
      return JSON.stringify(config);
    } catch {
      return JSON.stringify({ error: "Failed to query configuration" });
    }
  },
  {
    name: "morpheus_config_query",
    description:
      "Queries current configuration values. Accepts an optional 'key' parameter (dot notation supported, e.g. 'llm.model') to get a specific configuration value, or no parameter to get all configuration values.",
    schema: z.object({
      key: z.string().optional(),
    }),
  }
);

export const ConfigUpdateTool = tool(
  async ({ updates }) => {
    try {
      const configManager = ConfigManager.getInstance();
      await configManager.load();
      const currentConfig = configManager.get();
      const newConfig = { ...currentConfig };
      for (const key in updates) {
        setNestedValue(newConfig, key, updates[key]);
      }
      await configManager.save(newConfig);
      return JSON.stringify({ success: true, message: "Configuration updated successfully" });
    } catch (error) {
      return JSON.stringify({ error: `Failed to update configuration: ${(error as Error).message}` });
    }
  },
  {
    name: "morpheus_config_update",
    description:
      "Updates configuration values with validation. Accepts an 'updates' object containing key-value pairs to update. Supports dot notation for nested fields (e.g. 'llm.model').",
    schema: z.object({
      updates: z.object({}).passthrough(),
    }),
  }
);

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export const DiagnosticTool = tool(
  async () => {
    try {
      const timestamp = new Date().toISOString();
      const components: Record<string, any> = {};
      const morpheusRoot = path.join(homedir(), ".morpheus");

      // Configuration
      try {
        const configManager = ConfigManager.getInstance();
        await configManager.load();
        const config = configManager.get();
        const requiredFields = ["llm", "logging", "ui"];
        const missingFields = requiredFields.filter((field) => !(field in config));
        if (missingFields.length === 0) {
          const sati = (config as any).sati;
          const apoc = (config as any).apoc;
          components.config = {
            status: "healthy",
            message: "Configuration is valid and complete",
            details: {
              oracleProvider: config.llm?.provider,
              oracleModel: config.llm?.model,
              satiProvider: sati?.provider ?? `${config.llm?.provider} (inherited)`,
              satiModel: sati?.model ?? `${config.llm?.model} (inherited)`,
              apocProvider: apoc?.provider ?? `${config.llm?.provider} (inherited)`,
              apocModel: apoc?.model ?? `${config.llm?.model} (inherited)`,
              apocWorkingDir: apoc?.working_dir ?? "not set",
              uiEnabled: config.ui?.enabled,
              uiPort: config.ui?.port,
            },
          };
        } else {
          components.config = {
            status: "warning",
            message: `Missing required configuration fields: ${missingFields.join(", ")}`,
            details: { missingFields },
          };
        }
      } catch (error) {
        components.config = {
          status: "error",
          message: `Configuration error: ${(error as Error).message}`,
          details: {},
        };
      }

      // Short-term memory DB
      try {
        const dbPath = path.join(morpheusRoot, "memory", "short-memory.db");
        await fsPromises.access(dbPath);
        const stat = await fsPromises.stat(dbPath);
        components.shortMemoryDb = {
          status: "healthy",
          message: "Short-memory database is accessible",
          details: { path: dbPath, sizeBytes: stat.size },
        };
      } catch (error) {
        components.shortMemoryDb = {
          status: "error",
          message: `Short-memory DB not accessible: ${(error as Error).message}`,
          details: {},
        };
      }

      // Sati long-term memory DB
      try {
        const satiDbPath = path.join(morpheusRoot, "memory", "sati-memory.db");
        await fsPromises.access(satiDbPath);
        const stat = await fsPromises.stat(satiDbPath);
        components.satiMemoryDb = {
          status: "healthy",
          message: "Sati memory database is accessible",
          details: { path: satiDbPath, sizeBytes: stat.size },
        };
      } catch {
        components.satiMemoryDb = {
          status: "warning",
          message: "Sati memory database does not exist yet (no memories stored yet)",
          details: {},
        };
      }

      // LLM provider configured
      try {
        const configManager = ConfigManager.getInstance();
        const config = configManager.get();
        if (config.llm?.provider) {
          components.network = {
            status: "healthy",
            message: `Oracle LLM provider configured: ${config.llm.provider}`,
            details: { provider: config.llm.provider, model: config.llm.model },
          };
        } else {
          components.network = {
            status: "warning",
            message: "No Oracle LLM provider configured",
            details: {},
          };
        }
      } catch (error) {
        components.network = {
          status: "error",
          message: `Network check error: ${(error as Error).message}`,
          details: {},
        };
      }

      // Agent process
      components.agent = {
        status: "healthy",
        message: "Agent is running (this tool is executing inside the agent process)",
        details: { pid: process.pid, uptime: `${Math.floor(process.uptime())}s` },
      };

      // Logs directory
      try {
        const logsDir = path.join(morpheusRoot, "logs");
        await fsPromises.access(logsDir);
        components.logs = {
          status: "healthy",
          message: "Logs directory is accessible",
          details: { path: logsDir },
        };
      } catch {
        components.logs = {
          status: "warning",
          message: "Logs directory not found (will be created on first log write)",
          details: {},
        };
      }

      return JSON.stringify({ timestamp, components });
    } catch (error) {
      console.error("Error in DiagnosticTool:", error);
      return JSON.stringify({ timestamp: new Date().toISOString(), error: "Failed to run diagnostics" });
    }
  },
  {
    name: "diagnostic_check",
    description:
      "Performs system health diagnostics and returns a comprehensive report covering configuration (Oracle/Sati/Apoc), short-memory DB, Sati long-term memory DB, LLM provider, agent process, and logs directory.",
    schema: z.object({}),
  }
);

// ─── Analytics ────────────────────────────────────────────────────────────────

export const MessageCountTool = tool(
  async ({ timeRange }) => {
    try {
      const db = new Database(shortMemoryDbPath);
      let query = "SELECT COUNT(*) as count FROM messages";
      const params: any[] = [];
      if (timeRange) {
        query += " WHERE created_at BETWEEN ? AND ?";
        params.push(new Date(timeRange.start).getTime());
        params.push(new Date(timeRange.end).getTime());
      }
      const result = db.prepare(query).get(...params) as { count: number };
      db.close();
      return JSON.stringify(result.count);
    } catch (error) {
      console.error("Error in MessageCountTool:", error);
      return JSON.stringify({ error: `Failed to count messages: ${(error as Error).message}` });
    }
  },
  {
    name: "message_count",
    description:
      "Returns count of stored messages. Accepts an optional 'timeRange' parameter with ISO date strings (start/end) for filtering.",
    schema: z.object({
      timeRange: z
        .object({
          start: z.string().describe("ISO date string, e.g. 2026-01-01T00:00:00Z"),
          end: z.string().describe("ISO date string, e.g. 2026-12-31T23:59:59Z"),
        })
        .optional(),
    }),
  }
);

export const TokenUsageTool = tool(
  async ({ timeRange }) => {
    try {
      const db = new Database(shortMemoryDbPath);
      let whereClause = "";
      const params: any[] = [];
      if (timeRange) {
        whereClause = " WHERE created_at BETWEEN ? AND ?";
        params.push(new Date(timeRange.start).getTime());
        params.push(new Date(timeRange.end).getTime());
      }
      const row = db
        .prepare(
          `SELECT
           SUM(input_tokens) as inputTokens,
           SUM(output_tokens) as outputTokens,
           SUM(total_tokens) as totalTokens,
           COALESCE(SUM(audio_duration_seconds), 0) as totalAudioSeconds
         FROM messages${whereClause}`
        )
        .get(...params) as {
        inputTokens: number | null;
        outputTokens: number | null;
        totalTokens: number | null;
        totalAudioSeconds: number | null;
      };
      const costRow = db
        .prepare(
          `SELECT
           SUM((COALESCE(m.input_tokens, 0) / 1000000.0) * p.input_price_per_1m
             + (COALESCE(m.output_tokens, 0) / 1000000.0) * p.output_price_per_1m) as totalCost
         FROM messages m
         INNER JOIN model_pricing p ON p.provider = m.provider AND p.model = COALESCE(m.model, 'unknown')
         WHERE m.provider IS NOT NULL${whereClause ? whereClause.replace("WHERE", "AND") : ""}`
        )
        .get(...params) as { totalCost: number | null };
      db.close();
      return JSON.stringify({
        inputTokens: row.inputTokens || 0,
        outputTokens: row.outputTokens || 0,
        totalTokens: row.totalTokens || 0,
        totalAudioSeconds: row.totalAudioSeconds || 0,
        estimatedCostUsd: costRow.totalCost ?? null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error in TokenUsageTool:", error);
      return JSON.stringify({ error: `Failed to get token usage: ${(error as Error).message}` });
    }
  },
  {
    name: "token_usage",
    description:
      "Returns global token usage statistics including input/output tokens, total tokens, audio duration in seconds, and estimated cost in USD (when pricing is configured). Accepts an optional 'timeRange' parameter with ISO date strings for filtering.",
    schema: z.object({
      timeRange: z
        .object({
          start: z.string().describe("ISO date string, e.g. 2026-01-01T00:00:00Z"),
          end: z.string().describe("ISO date string, e.g. 2026-12-31T23:59:59Z"),
        })
        .optional(),
    }),
  }
);

export const ProviderModelUsageTool = tool(
  async () => {
    try {
      const db = new Database(shortMemoryDbPath);
      const query = `
        SELECT
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
        ORDER BY m.provider, m.model
      `;
      const rows = db.prepare(query).all() as Array<{
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
      db.close();
      const results = rows.map((row) => {
        const inputTokens = row.totalInputTokens || 0;
        const outputTokens = row.totalOutputTokens || 0;
        let estimatedCostUsd: number | null = null;
        if (row.input_price_per_1m != null && row.output_price_per_1m != null) {
          estimatedCostUsd =
            (inputTokens / 1_000_000) * row.input_price_per_1m +
            (outputTokens / 1_000_000) * row.output_price_per_1m;
        }
        return {
          provider: row.provider,
          model: row.model,
          totalInputTokens: inputTokens,
          totalOutputTokens: outputTokens,
          totalTokens: row.totalTokens || 0,
          messageCount: row.messageCount || 0,
          totalAudioSeconds: row.totalAudioSeconds || 0,
          estimatedCostUsd,
        };
      });
      return JSON.stringify(results);
    } catch (error) {
      console.error("Error in ProviderModelUsageTool:", error);
      return JSON.stringify({ error: `Failed to get provider usage stats: ${(error as Error).message}` });
    }
  },
  {
    name: "provider_model_usage",
    description:
      "Returns token usage statistics grouped by provider and model, including audio duration and estimated cost in USD (when pricing is configured).",
    schema: z.object({}),
  }
);

// ─── Tasks ────────────────────────────────────────────────────────────────────

function toTaskView(task: TaskRecord) {
  return {
    id: task.id,
    agent: task.agent,
    status: task.status,
    input: task.input,
    output: task.output,
    error: task.error,
    session_id: task.session_id,
    origin_channel: task.origin_channel,
    created_at: task.created_at,
    started_at: task.started_at,
    finished_at: task.finished_at,
    updated_at: task.updated_at,
  };
}

export const TaskQueryTool = tool(
  async ({ task_id, limit, session_id, include_completed }) => {
    try {
      const repository = TaskRepository.getInstance();
      if (task_id) {
        const task = repository.getTaskById(task_id);
        if (!task) {
          return JSON.stringify({ found: false, query: { task_id }, message: "Task not found" });
        }
        return JSON.stringify({ found: true, query: { task_id }, task: toTaskView(task) });
      }
      const ctx = TaskRequestContext.get();
      const targetSessionId = session_id ?? ctx?.session_id;
      const requestedLimit = Math.max(1, Math.min(50, limit ?? 10));
      const baseLimit = Math.max(requestedLimit * 5, 50);
      const tasks = repository.listTasks({ session_id: targetSessionId, limit: baseLimit });
      const filtered = tasks.filter((task) => (include_completed ? true : task.status !== "completed"));
      const latest = filtered.slice(0, requestedLimit);
      return JSON.stringify({
        found: latest.length > 0,
        query: {
          task_id: null,
          limit: requestedLimit,
          session_id: targetSessionId ?? null,
          include_completed: include_completed ?? false,
        },
        count: latest.length,
        tasks: latest.map(toTaskView),
      });
    } catch (error: any) {
      return JSON.stringify({ found: false, error: error?.message ?? String(error) });
    }
  },
  {
    name: "task_query",
    description:
      "Query task status directly from database without delegation. Supports lookup by task id, or latest tasks (default: only non-completed) for current session.",
    schema: z.object({
      task_id: z.string().uuid().optional().describe("Specific task id to fetch"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Max number of tasks to return when task_id is not provided (default: 10)"),
      session_id: z
        .string()
        .optional()
        .describe("Optional session id filter; if omitted, uses current request session"),
      include_completed: z
        .boolean()
        .optional()
        .describe("Include completed tasks when listing latest tasks (default: false)"),
    }),
  }
);

// ─── MCP Management ───────────────────────────────────────────────────────────

export const McpListTool = tool(
  async () => {
    try {
      const { MCPManager } = await import("../../config/mcp-manager.js");
      const servers = await MCPManager.listServers();
      const result = servers.map((s) => ({
        name: s.name,
        enabled: s.enabled,
        transport: s.config.transport,
        ...(s.config.transport === "stdio"
          ? { command: (s.config as any).command, args: (s.config as any).args }
          : { url: (s.config as any).url }),
      }));
      return JSON.stringify(result);
    } catch (error) {
      return JSON.stringify({ error: `Failed to list MCP servers: ${(error as Error).message}` });
    }
  },
  {
    name: "mcp_list",
    description:
      "Lists all registered MCP servers with their name, enabled status, transport type, and connection details.",
    schema: z.object({}),
  }
);

export const McpManageTool = tool(
  async ({ action, name, config }) => {
    try {
      const { MCPManager } = await import("../../config/mcp-manager.js");
      const requireName = (): string => {
        if (!name) throw new Error(`"name" is required for action "${action}"`);
        return name;
      };
      switch (action) {
        case "add":
          if (!config) return JSON.stringify({ error: "config is required for add action" });
          await MCPManager.addServer(requireName(), config as any);
          return JSON.stringify({ success: true, message: `MCP server "${name}" added` });
        case "update":
          if (!config) return JSON.stringify({ error: "config is required for update action" });
          await MCPManager.updateServer(requireName(), config as any);
          return JSON.stringify({ success: true, message: `MCP server "${name}" updated` });
        case "delete":
          await MCPManager.deleteServer(requireName());
          return JSON.stringify({ success: true, message: `MCP server "${name}" deleted` });
        case "enable":
          await MCPManager.setServerEnabled(requireName(), true);
          return JSON.stringify({ success: true, message: `MCP server "${name}" enabled` });
        case "disable":
          await MCPManager.setServerEnabled(requireName(), false);
          return JSON.stringify({ success: true, message: `MCP server "${name}" disabled` });
        case "reload":
          await MCPManager.reloadAgents();
          return JSON.stringify({ success: true, message: "MCP tools reloaded across Oracle, Neo, and Trinity" });
        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    } catch (error) {
      return JSON.stringify({ error: `MCP manage failed: ${(error as Error).message}` });
    }
  },
  {
    name: "mcp_manage",
    description: "Manage MCP servers: add, update, delete, enable, disable, or reload (triggers a full tool reload across Oracle, Neo, and Trinity).",
    schema: z.object({
      action: z.enum(["add", "update", "delete", "enable", "disable", "reload"]),
      name: z.string().optional().describe("MCP server name (required for all actions except reload)"),
      config: z
        .object({
          transport: z.enum(["stdio", "http"]),
          command: z.string().optional().describe("Required for stdio transport"),
          args: z.array(z.string()).optional(),
          env: z.record(z.string(), z.string()).optional(),
          url: z.string().optional().describe("Required for http transport"),
          headers: z.record(z.string(), z.string()).optional(),
        })
        .optional()
        .describe("Server configuration (required for add/update)"),
    }),
  }
);

// ─── Webhook Management ───────────────────────────────────────────────────────

export const WebhookListTool = tool(
  async () => {
    try {
      const { WebhookRepository } = await import("../webhooks/repository.js");
      const webhooks = WebhookRepository.getInstance().listWebhooks();
      const result = webhooks.map((w) => ({
        id: w.id,
        name: w.name,
        enabled: w.enabled,
        notification_channels: w.notification_channels,
        prompt: w.prompt.length > 100 ? w.prompt.slice(0, 100) + "…" : w.prompt,
        trigger_count: w.trigger_count,
        created_at: w.created_at,
        last_triggered_at: w.last_triggered_at,
      }));
      return JSON.stringify(result);
    } catch (error) {
      return JSON.stringify({ error: `Failed to list webhooks: ${(error as Error).message}` });
    }
  },
  {
    name: "webhook_list",
    description:
      "Lists all registered webhooks with their name, enabled status, notification channels, and prompt (truncated to 100 chars). Does not include api_key.",
    schema: z.object({}),
  }
);

export const WebhookManageTool = tool(
  async ({ action, name, id, prompt, enabled, notification_channels }) => {
    try {
      const { WebhookRepository } = await import("../webhooks/repository.js");
      const repo = WebhookRepository.getInstance();
      const resolveId = (): string => {
        if (id) return id;
        const wh = repo.getWebhookByName(name);
        if (!wh) throw new Error(`Webhook "${name}" not found`);
        return wh.id;
      };
      switch (action) {
        case "create": {
          if (!prompt) return JSON.stringify({ error: "prompt is required for create action" });
          const wh = repo.createWebhook({
            name,
            prompt,
            notification_channels: (notification_channels ?? ["ui"]) as any,
          });
          return JSON.stringify({ success: true, id: wh.id, name: wh.name, api_key: wh.api_key });
        }
        case "update": {
          const whId = resolveId();
          const updated = repo.updateWebhook(whId, { name, prompt, enabled, notification_channels: notification_channels as any });
          if (!updated) return JSON.stringify({ error: "Webhook not found" });
          return JSON.stringify({ success: true, id: updated.id, name: updated.name });
        }
        case "delete": {
          const whId = resolveId();
          const deleted = repo.deleteWebhook(whId);
          return JSON.stringify({
            success: deleted,
            message: deleted ? `Webhook "${name}" deleted` : "Webhook not found",
          });
        }
        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    } catch (error) {
      return JSON.stringify({ error: `Webhook manage failed: ${(error as Error).message}` });
    }
  },
  {
    name: "webhook_manage",
    description: "Manage webhooks: create, update, or delete a webhook. Create returns the api_key.",
    schema: z.object({
      action: z.enum(["create", "update", "delete"]),
      name: z.string().describe("Webhook name"),
      id: z.string().optional().describe("Webhook id (optional, resolved from name if omitted)"),
      prompt: z.string().optional().describe("Instruction prompt for the webhook (required for create)"),
      enabled: z.boolean().optional().describe("Enable or disable the webhook (for update)"),
      notification_channels: z
        .array(z.string())
        .optional()
        .describe("Notification channels, e.g. ['ui', 'telegram']"),
    }),
  }
);

// ─── Trinity Database Management ──────────────────────────────────────────────

export const TrinityDbListTool = tool(
  async () => {
    try {
      const { DatabaseRegistry } = await import("../memory/trinity-db.js");
      const databases = DatabaseRegistry.getInstance().listDatabases();
      const result = databases.map((db) => ({
        id: db.id,
        name: db.name,
        type: db.type,
        host: db.host,
        port: db.port,
        database_name: db.database_name,
        username: db.username,
        allow_read: db.allow_read,
        allow_insert: db.allow_insert,
        allow_update: db.allow_update,
        allow_delete: db.allow_delete,
        allow_ddl: db.allow_ddl,
        schema_updated_at: db.schema_updated_at,
        created_at: db.created_at,
      }));
      return JSON.stringify(result);
    } catch (error) {
      return JSON.stringify({ error: `Failed to list Trinity databases: ${(error as Error).message}` });
    }
  },
  {
    name: "trinity_db_list",
    description:
      "Lists all registered Trinity databases with their metadata (without passwords or connection strings).",
    schema: z.object({}),
  }
);

export const TrinityDbManageTool = tool(
  async ({
    action,
    name,
    id,
    type,
    host,
    port,
    database_name,
    username,
    password,
    connection_string,
    allow_read,
    allow_insert,
    allow_update,
    allow_delete,
    allow_ddl,
  }) => {
    try {
      const { DatabaseRegistry } = await import("../memory/trinity-db.js");
      const registry = DatabaseRegistry.getInstance();
      const resolveId = (): number => {
        if (id !== undefined) return id;
        const db = registry.getDatabaseByName(name);
        if (!db) throw new Error(`Database "${name}" not found`);
        return db.id;
      };
      switch (action) {
        case "register": {
          if (!type) return JSON.stringify({ error: "type is required for register action" });
          const db = registry.createDatabase({
            name,
            type: type as any,
            host,
            port,
            database_name,
            username,
            password,
            connection_string,
            allow_read,
            allow_insert,
            allow_update,
            allow_delete,
            allow_ddl,
          });
          return JSON.stringify({ success: true, id: db.id, name: db.name, type: db.type });
        }
        case "update": {
          const dbId = resolveId();
          const updated = registry.updateDatabase(dbId, {
            name,
            type: type as any,
            host,
            port,
            database_name,
            username,
            password,
            connection_string,
            allow_read,
            allow_insert,
            allow_update,
            allow_delete,
            allow_ddl,
          });
          if (!updated) return JSON.stringify({ error: "Database not found" });
          return JSON.stringify({ success: true, id: updated.id, name: updated.name });
        }
        case "delete": {
          const dbId = resolveId();
          const deleted = registry.deleteDatabase(dbId);
          return JSON.stringify({
            success: deleted,
            message: deleted ? `Database "${name}" deleted` : "Database not found",
          });
        }
        case "test": {
          const dbId = resolveId();
          const db = registry.getDatabase(dbId);
          if (!db) return JSON.stringify({ error: `Database "${name}" not found` });
          const { testConnection } = await import("../trinity-connector.js");
          const ok = await testConnection(db);
          return JSON.stringify({ status: ok ? "connected" : "failed", database: db.name });
        }
        case "refresh_schema": {
          const dbId = resolveId();
          const db = registry.getDatabase(dbId);
          if (!db) return JSON.stringify({ error: `Database "${name}" not found` });
          const { introspectSchema } = await import("../trinity-connector.js");
          const schema = await introspectSchema(db);
          registry.updateSchema(dbId, JSON.stringify(schema));
          const { Trinity } = await import("../trinity.js");
          await Trinity.refreshDelegateCatalog();
          return JSON.stringify({ success: true, message: `Schema refreshed for "${db.name}"` });
        }
        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    } catch (error) {
      return JSON.stringify({ error: `Trinity DB manage failed: ${(error as Error).message}` });
    }
  },
  {
    name: "trinity_db_manage",
    description:
      "Manage Trinity database registrations: register, update, delete, test connection, or refresh schema.",
    schema: z.object({
      action: z.enum(["register", "update", "delete", "test", "refresh_schema"]),
      name: z.string().describe("Database registration name"),
      id: z.number().int().optional().describe("Database id (optional, resolved from name if omitted)"),
      type: z
        .enum(["postgresql", "mysql", "sqlite", "mongodb"])
        .optional()
        .describe("Database type (required for register)"),
      host: z.string().optional(),
      port: z.number().int().optional(),
      database_name: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional().describe("Password (stored encrypted)"),
      connection_string: z.string().optional().describe("Full connection string (stored encrypted)"),
      allow_read: z.boolean().optional(),
      allow_insert: z.boolean().optional(),
      allow_update: z.boolean().optional(),
      allow_delete: z.boolean().optional(),
      allow_ddl: z.boolean().optional(),
    }),
  }
);

// ─── Unified export ───────────────────────────────────────────────────────────

export const morpheusTools = [
  ConfigQueryTool,
  ConfigUpdateTool,
  DiagnosticTool,
  MessageCountTool,
  TokenUsageTool,
  ProviderModelUsageTool,
  TaskQueryTool,
  McpListTool,
  McpManageTool,
  WebhookListTool,
  WebhookManageTool,
  TrinityDbListTool,
  TrinityDbManageTool,
];
