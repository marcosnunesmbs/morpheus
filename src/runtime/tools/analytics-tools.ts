import { tool } from "langchain";
import * as z from "zod";
import Database from "better-sqlite3";
import { homedir } from "os";
import path from "path";

const dbPath = path.join(homedir(), ".morpheus", "memory", "short-memory.db");

// Tool for querying message counts from the database
export const MessageCountTool = tool(
  async ({ timeRange }) => {
    try {
      const db = new Database(dbPath);

      // The messages table uses `created_at` (Unix ms integer), not `timestamp`
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
    description: "Returns count of stored messages. Accepts an optional 'timeRange' parameter with ISO date strings (start/end) for filtering.",
    schema: z.object({
      timeRange: z.object({
        start: z.string().describe("ISO date string, e.g. 2026-01-01T00:00:00Z"),
        end: z.string().describe("ISO date string, e.g. 2026-12-31T23:59:59Z"),
      }).optional(),
    }),
  }
);

// Tool for querying token usage grouped by provider and model
export const ProviderModelUsageTool = tool(
  async () => {
    try {
      const db = new Database(dbPath);

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

      const results = rows.map(row => {
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
    description: "Returns token usage statistics grouped by provider and model, including audio duration and estimated cost in USD (when pricing is configured).",
    schema: z.object({}),
  }
);

// Tool for querying global token usage statistics from the database
export const TokenUsageTool = tool(
  async ({ timeRange }) => {
    try {
      const db = new Database(dbPath);

      // The messages table uses `created_at` (Unix ms integer), not `timestamp`
      let whereClause = "";
      const params: any[] = [];
      if (timeRange) {
        whereClause = " WHERE created_at BETWEEN ? AND ?";
        params.push(new Date(timeRange.start).getTime());
        params.push(new Date(timeRange.end).getTime());
      }

      const row = db.prepare(
        `SELECT
           SUM(input_tokens) as inputTokens,
           SUM(output_tokens) as outputTokens,
           SUM(total_tokens) as totalTokens,
           COALESCE(SUM(audio_duration_seconds), 0) as totalAudioSeconds
         FROM messages${whereClause}`
      ).get(...params) as {
        inputTokens: number | null;
        outputTokens: number | null;
        totalTokens: number | null;
        totalAudioSeconds: number | null;
      };

      // Estimated cost via model_pricing join
      const costRow = db.prepare(
        `SELECT
           SUM((COALESCE(m.input_tokens, 0) / 1000000.0) * p.input_price_per_1m
             + (COALESCE(m.output_tokens, 0) / 1000000.0) * p.output_price_per_1m) as totalCost
         FROM messages m
         INNER JOIN model_pricing p ON p.provider = m.provider AND p.model = COALESCE(m.model, 'unknown')
         WHERE m.provider IS NOT NULL${whereClause ? whereClause.replace("WHERE", "AND") : ""}`
      ).get(...params) as { totalCost: number | null };

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
    description: "Returns global token usage statistics including input/output tokens, total tokens, audio duration in seconds, and estimated cost in USD (when pricing is configured). Accepts an optional 'timeRange' parameter with ISO date strings for filtering.",
    schema: z.object({
      timeRange: z.object({
        start: z.string().describe("ISO date string, e.g. 2026-01-01T00:00:00Z"),
        end: z.string().describe("ISO date string, e.g. 2026-12-31T23:59:59Z"),
      }).optional(),
    }),
  }
);
