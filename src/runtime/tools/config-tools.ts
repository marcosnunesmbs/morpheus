import { tool } from "langchain";
import * as z from "zod";
import { ConfigManager } from "../../config/manager.js";

// Tool for querying configuration values
export const ConfigQueryTool = tool(
  async ({ key }) => {
    try {
      const configManager = ConfigManager.getInstance();
      // Load config if not already loaded
      await configManager.load();
      const config = configManager.get();
      if (key) {
        // Return specific configuration value
        const value = config[key as keyof typeof config];
        return JSON.stringify({ [key]: value });
      } else {
        // Return all configuration values
        return JSON.stringify(config);
      }
    } catch (error) {
      console.error("Error in ConfigQueryTool:", error);
      return JSON.stringify({ error: "Failed to query configuration" });
    }
  },
  {
    name: "config_query",
    description: "Queries current configuration values. Accepts an optional 'key' parameter to get a specific configuration value, or no parameter to get all configuration values.",
    schema: z.object({
      key: z.string().optional(),
    }),
  }
);

// Tool for updating configuration values
export const ConfigUpdateTool = tool(
  async ({ updates }) => {
    try {
      const configManager = ConfigManager.getInstance();

      // Load current config
      await configManager.load();
      const currentConfig = configManager.get();

      // Create new config with updates
      const newConfig = { ...currentConfig, ...updates };

      // Save the updated config
      await configManager.save(newConfig);

      return JSON.stringify({ success: true, message: "Configuration updated successfully" });
    } catch (error) {
      console.error("Error in ConfigUpdateTool:", error);
      return JSON.stringify({ error: `Failed to update configuration: ${(error as Error).message}` });
    }
  },
  {
    name: "config_update",
    description: "Updates configuration values with validation. Accepts an 'updates' object containing key-value pairs to update.",
    schema: z.object({
      updates: z.object({
        // Define common config properties that might be updated
        // Using optional fields to allow flexible updates
        "llm.provider": z.string().optional(),
        "llm.model": z.string().optional(),
        "llm.temperature": z.number().optional(),
        "llm.api_key": z.string().optional(),
        "ui.enabled": z.boolean().optional(),
        "ui.port": z.number().optional(),
        "logging.enabled": z.boolean().optional(),
        "logging.level": z.enum(['debug', 'info', 'warn', 'error']).optional(),
        "audio.enabled": z.boolean().optional(),
        "audio.provider": z.string().optional(),
        "memory.limit": z.number().optional(),
        // Add more specific fields as needed, or use a catch-all for other properties
      }).passthrough(), // Allow additional properties not explicitly defined
    }),
  }
);