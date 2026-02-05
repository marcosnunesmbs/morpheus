import { tool } from "langchain";
import * as z from "zod";
import { ConfigManager } from "../../config/manager.js";

// Tool for querying configuration values
export const ConfigQueryTool = tool(
  async ({ key }) => {
    try {
      const configManager = ConfigManager.getInstance();
      await configManager.load();
      const config = configManager.get();
      if (key) {
        // Suporta busca por chave aninhada, ex: 'llm.model' ou 'channels.telegram.enabled'
        const value = key.split('.').reduce((obj: any, k) => (obj ? obj[k] : undefined), config);
        return JSON.stringify({ [key]: value });
      } else {
        return JSON.stringify(config);
      }
    } catch (error) {
      // Nunca usar console.log, mas manter para debug local
      return JSON.stringify({ error: "Failed to query configuration" });
    }
  },
  {
    name: "morpheus_config_query",
    description: "Queries current configuration values. Accepts an optional 'key' parameter (dot notation supported, e.g. 'llm.model') to get a specific configuration value, or no parameter to get all configuration values.",
    schema: z.object({
      key: z.string().optional(),
    }),
  }
);

// Tool for updating configuration values (suporta objetos aninhados via dot notation)
function setNestedValue(obj: any, path: string, value: any) {
  const keys = path.split('.');
  let curr = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!curr[keys[i]] || typeof curr[keys[i]] !== 'object') {
      curr[keys[i]] = {};
    }
    curr = curr[keys[i]];
  }
  curr[keys[keys.length - 1]] = value;
}

export const ConfigUpdateTool = tool(
  async ({ updates }) => {
    try {
      const configManager = ConfigManager.getInstance();
      await configManager.load();
      const currentConfig = configManager.get();
      // Suporta updates com dot notation para campos aninhados
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
    description: "Updates configuration values with validation. Accepts an 'updates' object containing key-value pairs to update. Supports dot notation for nested fields (e.g. 'llm.model').",
    schema: z.object({
      updates: z.object({}).passthrough(),
    }),
  }
);