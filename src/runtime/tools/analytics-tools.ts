import { tool } from "langchain";
import * as z from "zod";
import { promises as fsPromises } from "fs";
import path from "path";
import Database from "better-sqlite3";
import { homedir } from "os";

// Tool for querying message counts from the database
const dbPath = path.join(homedir(), ".morpheus", "memory", "short-memory.db");

export const MessageCountTool = tool(
  async ({ timeRange }) => {
    try {

      // Connect to database
      const db = new Database(dbPath);

      let query = "SELECT COUNT(*) as count FROM messages";
      const params: any[] = [];

      if (timeRange) {
        query += " WHERE timestamp BETWEEN ? AND ?";
        params.push(timeRange.start);
        params.push(timeRange.end);
      }

      const result = db.prepare(query).get(params) as { count: number };
      db.close();

      return JSON.stringify(result.count);
    } catch (error) {
      console.error("Error in MessageCountTool:", error);
      return JSON.stringify({ error: `Failed to count messages: ${(error as Error).message}` });
    }
  },
  {
    name: "message_count",
    description: "Returns count of stored messages. Accepts an optional 'timeRange' parameter with start and end timestamps for filtering.",
    schema: z.object({
      timeRange: z.object({
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, "ISO date string"),
        end: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, "ISO date string"),
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
          provider,
          COALESCE(model, 'unknown') as model,
          SUM(input_tokens) as totalInputTokens,
          SUM(output_tokens) as totalOutputTokens,
          SUM(total_tokens) as totalTokens,
          COUNT(*) as messageCount
        FROM messages
        WHERE provider IS NOT NULL
        GROUP BY provider, COALESCE(model, 'unknown')
        ORDER BY provider, model
      `;

      const results = db.prepare(query).all();
      db.close();

      return JSON.stringify(results);
    } catch (error) {
      console.error("Error in ProviderModelUsageTool:", error);
      return JSON.stringify({ error: `Failed to get provider usage stats: ${(error as Error).message}` });
    }
  },
  {
    name: "provider_model_usage",
    description: "Returns token usage statistics grouped by provider and model.",
    schema: z.object({}),
  }
);

// Tool for querying token usage statistics from the database
export const TokenUsageTool = tool(
  async ({ timeRange }) => {
    try {
      // Connect to database
      const db = new Database(dbPath);

      let query = "SELECT SUM(input_tokens) as inputTokens, SUM(output_tokens) as outputTokens, SUM(input_tokens + output_tokens) as totalTokens FROM messages";
      const params: any[] = [];

      if (timeRange) {
        query += " WHERE timestamp BETWEEN ? AND ?";
        params.push(timeRange.start);
        params.push(timeRange.end);
      }

      const result = db.prepare(query).get(params) as {
        inputTokens: number | null;
        outputTokens: number | null;
        totalTokens: number | null
      };

      db.close();

      // Handle potential null values
      const tokenStats = {
        totalTokens: result.totalTokens || 0,
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
        timestamp: new Date().toISOString()
      };

      return JSON.stringify(tokenStats);
    } catch (error) {
      console.error("Error in TokenUsageTool:", error);
      return JSON.stringify({ error: `Failed to get token usage: ${(error as Error).message}` });
    }
  },
  {
    name: "token_usage",
    description: "Returns token usage statistics. Accepts an optional 'timeRange' parameter with start and end timestamps for filtering.",
    schema: z.object({
      timeRange: z.object({
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, "ISO date string"),
        end: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, "ISO date string"),
      }).optional(),
    }),
  }
);