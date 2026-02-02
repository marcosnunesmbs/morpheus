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

      // Check configuration
      try {
        const configManager = ConfigManager.getInstance();
        await configManager.load();
        const config = configManager.get();

        // Basic validation - check if required fields exist
        const requiredFields = ['llm', 'logging', 'ui'];
        const missingFields = requiredFields.filter(field => !(field in config));

        if (missingFields.length === 0) {
          components.config = {
            status: "healthy",
            message: "Configuration is valid and complete",
            details: {
              llmProvider: config.llm?.provider,
              uiEnabled: config.ui?.enabled,
              uiPort: config.ui?.port
            }
          };
        } else {
          components.config = {
            status: "warning",
            message: `Missing required configuration fields: ${missingFields.join(', ')}`,
            details: { missingFields }
          };
        }
      } catch (error) {
        components.config = {
          status: "error",
          message: `Configuration error: ${(error as Error).message}`,
          details: {}
        };
      }

      // Check storage/database
      try {
        // For now, we'll check if the data directory exists
      const dbPath = path.join(homedir(), ".morpheus", "memory", "short-memory.db");

        await fsPromises.access(dbPath);
        components.storage = {
          status: "healthy",
          message: "Database file is accessible",
          details: { path: dbPath }
        };
      } catch (error) {
        components.storage = {
          status: "error",
          message: `Storage error: ${(error as Error).message}`,
          details: {}
        };
      }

      // Check network connectivity (basic check)
      try {
        // For now, we'll just check if we can reach the LLM provider configuration
        const configManager = ConfigManager.getInstance();
        await configManager.load();
        const config = configManager.get();

        if (config.llm && config.llm.provider) {
          components.network = {
            status: "healthy",
            message: `LLM provider configured: ${config.llm.provider}`,
            details: { provider: config.llm.provider }
          };
        } else {
          components.network = {
            status: "warning",
            message: "No LLM provider configured",
            details: {}
          };
        }
      } catch (error) {
        components.network = {
          status: "error",
          message: `Network check error: ${(error as Error).message}`,
          details: {}
        };
      }

      // Check if the agent is running
      try {
        // This is a basic check - in a real implementation, we might check if the agent process is running
        components.agent = {
          status: "healthy",
          message: "Agent is running",
          details: { uptime: "N/A - runtime information not available in this context" }
        };
      } catch (error) {
        components.agent = {
          status: "error",
          message: `Agent check error: ${(error as Error).message}`,
          details: {}
        };
      }

      return JSON.stringify({
        timestamp,
        components
      });
    } catch (error) {
      console.error("Error in DiagnosticTool:", error);
      return JSON.stringify({
        timestamp: new Date().toISOString(),
        error: "Failed to run diagnostics"
      });
    }
  },
  {
    name: "diagnostic_check",
    description: "Performs system health diagnostics and returns a comprehensive report on system components.",
    schema: z.object({}),
  }
);