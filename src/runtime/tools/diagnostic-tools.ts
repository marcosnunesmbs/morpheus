import { tool } from "langchain";
import * as z from "zod";
import { ConfigManager } from "../../config/manager.js";
import { promises as fsPromises } from "fs";
import path from "path";
import { homedir } from "os";

// Tool for performing system diagnostics
export const DiagnosticTool = tool(
  async () => {
    try {
      const timestamp = new Date().toISOString();
      const components: Record<string, any> = {};

      const morpheusRoot = path.join(homedir(), ".morpheus");

      // ── Configuration ──────────────────────────────────────────────
      try {
        const configManager = ConfigManager.getInstance();
        await configManager.load();
        const config = configManager.get();

        const requiredFields = ["llm", "logging", "ui"];
        const missingFields = requiredFields.filter(field => !(field in config));

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

      // ── Short-term memory DB ────────────────────────────────────────
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

      // ── Sati long-term memory DB ────────────────────────────────────
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
        // Sati DB may not exist yet if no memories have been stored — treat as warning
        components.satiMemoryDb = {
          status: "warning",
          message: "Sati memory database does not exist yet (no memories stored yet)",
          details: {},
        };
      }

      // ── LLM provider configured ─────────────────────────────────────
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

      // ── Agent process ───────────────────────────────────────────────
      components.agent = {
        status: "healthy",
        message: "Agent is running (this tool is executing inside the agent process)",
        details: { pid: process.pid, uptime: `${Math.floor(process.uptime())}s` },
      };

      // ── Logs directory ──────────────────────────────────────────────
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
      return JSON.stringify({
        timestamp: new Date().toISOString(),
        error: "Failed to run diagnostics",
      });
    }
  },
  {
    name: "diagnostic_check",
    description:
      "Performs system health diagnostics and returns a comprehensive report covering configuration (Oracle/Sati/Apoc), short-memory DB, Sati long-term memory DB, LLM provider, agent process, and logs directory.",
    schema: z.object({}),
  }
);
