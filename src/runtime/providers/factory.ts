import { LLMConfig } from "../../types/config.js";
import { ProviderError } from "../errors.js";
import { createAgent, createMiddleware, ReactAgent } from "langchain";
import { DisplayManager } from "../display.js";
import { StructuredTool } from "@langchain/core/tools";
import { ConfigManager } from "../../config/manager.js";
import { TaskRequestContext } from "../tasks/context.js";
import { ChannelRegistry } from "../../channels/registry.js";
import { getStrategy, registerStrategy } from "./strategies.js";
import type { IProviderStrategy } from "./strategies.js";
import { isInteropZodSchema } from "@langchain/core/utils/types";
import { toJsonSchema } from "@langchain/core/utils/json_schema";

/** Channels that should NOT receive verbose tool notifications */
const SILENT_CHANNELS = new Set(['api', 'ui']);

/** The ONLY JSON Schema keywords the Gemini API accepts.
 *  Anything not in this set is stripped after $ref dereferencing. */
const GEMINI_ALLOWED_SCHEMA_FIELDS = new Set([
  'type', 'description', 'properties', 'required',
  'enum', 'items', 'format', 'nullable',
  'anyOf', 'oneOf', 'allOf',
  'minimum', 'maximum',
]);

/**
 * Collect all entries from $defs and definitions into a flat lookup map.
 */
function collectDefs(obj: unknown, defs: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return defs;
  const record = obj as Record<string, unknown>;
  for (const key of ['$defs', 'definitions']) {
    if (record[key] && typeof record[key] === 'object' && !Array.isArray(record[key])) {
      Object.assign(defs, record[key] as Record<string, unknown>);
    }
  }
  for (const v of Object.values(record)) collectDefs(v, defs);
  return defs;
}

/**
 * Resolve a $ref string like "#/$defs/Foo" or "#/definitions/Foo" to its def name.
 */
function resolveRef(ref: string): string | null {
  const m = ref.match(/^#\/(?:\$defs|definitions)\/(.+)$/);
  return m ? m[1] : null;
}

/**
 * Recursively strip unsupported keywords and inline $ref references.
 */
function sanitizeSchemaForGemini(
  obj: unknown,
  defs: Record<string, unknown>,
  depth = 0,
): unknown {
  if (depth > 20) return {}; // guard against circular refs
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => sanitizeSchemaForGemini(v, defs, depth));

  const record = obj as Record<string, unknown>;

  // Inline $ref — look up and recurse into the definition
  if ('$ref' in record && typeof record['$ref'] === 'string') {
    const defName = resolveRef(record['$ref']);
    if (defName && defs[defName]) {
      return sanitizeSchemaForGemini(defs[defName], defs, depth + 1);
    }
    return {}; // unresolvable ref — fall back to empty schema
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (!GEMINI_ALLOWED_SCHEMA_FIELDS.has(k)) continue;
    out[k] = sanitizeSchemaForGemini(v, defs, depth);
  }

  // Ensure every entry in `required` has a matching key in `properties`
  if (Array.isArray(out['required']) && out['properties'] && typeof out['properties'] === 'object') {
    const props = out['properties'] as Record<string, unknown>;
    out['required'] = (out['required'] as string[]).filter((r) => r in props);
    if ((out['required'] as string[]).length === 0) delete out['required'];
  }

  // Filter empty {} elements from anyOf/oneOf/allOf — Gemini fails on them
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    if (!Array.isArray(out[key])) continue;
    const filtered = (out[key] as unknown[]).filter(
      (item) => item !== null && typeof item === 'object' && Object.keys(item as object).length > 0,
    );
    if (filtered.length === 0) {
      delete out[key];
    } else if (filtered.length === 1) {
      // Unwrap single-element combiner (e.g. anyOf:[{type:"string"}] → {type:"string"})
      const unwrapped = filtered[0] as Record<string, unknown>;
      for (const [k, v] of Object.entries(unwrapped)) out[k] = v;
      delete out[key];
    } else {
      out[key] = filtered;
    }
  }

  return out;
}

function sanitizeToolSchemasForGemini(tools: StructuredTool[]): StructuredTool[] {
  for (const tool of tools) {
    const schema = (tool as any).schema;
    if (!schema || typeof schema !== 'object') continue;

    // If the schema is a Zod instance, convert to plain JSON Schema first.
    // Otherwise LangChain recognises it as Zod and re-generates $defs.
    let jsonSchema: any;
    if (isInteropZodSchema(schema)) {
      try {
        jsonSchema = toJsonSchema(schema);
      } catch {
        jsonSchema = schema;
      }
    } else {
      jsonSchema = schema;
    }

    const defs = collectDefs(jsonSchema);
    (tool as any).schema = sanitizeSchemaForGemini(jsonSchema, defs);
  }
  return tools;
}

export { registerStrategy, type IProviderStrategy };

export class ProviderFactory {
  private static buildMonitoringMiddleware() {
    const display = DisplayManager.getInstance();
    return createMiddleware({
      name: "ToolMonitoringMiddleware",
      wrapToolCall: (request, handler) => {
        const toolName = request.toolCall.name;
        
        // Determine which agent is running this tool based on context
        // This is a heuristic - the actual agent should be passed in context
        let agent = 'neo'; // Default to neo for MCP tools
        const ctx = TaskRequestContext.get();
        if (ctx?.session_id) {
          // Try to determine agent from context - this is a simplified approach
          // In practice, we'd need to pass the agent through the context
        }
        
        display.startActivity(agent, `Executing tool: ${toolName}`);
        display.log(`Executing tool: ${toolName}`, { level: "warning", source: 'ConstructLoad' });
        display.log(`Arguments: ${JSON.stringify(request.toolCall.args)}`, { level: "info", source: 'ConstructLoad' });

        // Verbose mode: notify originating channel about which tool is running
        const verboseEnabled = ConfigManager.getInstance().get().verbose_mode !== false;
        if (verboseEnabled) {
          const ctx = TaskRequestContext.get();
          if (ctx?.origin_channel && ctx.origin_user_id && !SILENT_CHANNELS.has(ctx.origin_channel)) {
            ChannelRegistry.sendToUser(ctx.origin_channel, ctx.origin_user_id, `🔧 executing: ${toolName}`)
              .catch(() => {});
          }
        }

        try {
          const result = handler(request);
          if (result instanceof Promise) {
            result.then(
              (r) => {
                display.endActivity(agent, true);
                display.log(`Tool completed successfully. Result: ${JSON.stringify(r)}`, { level: "info", source: 'ConstructLoad' });
              },
              (e) => {
                display.endActivity(agent, false);
                display.log(`Tool failed: ${e}`, { level: "error", source: 'ConstructLoad' });
              },
            );
          } else {
            display.endActivity(agent, true);
            display.log(`Tool completed successfully. Result: ${JSON.stringify(result)}`, { level: "info", source: 'ConstructLoad' });
          }
          return result;
        } catch (e) {
          display.endActivity(agent, false);
          display.log(`Tool failed: ${e}`, { level: "error", source: 'ConstructLoad' });
          throw e;
        }
      },
    });
  }

  private static buildModel(config: LLMConfig) {
    const strategy = getStrategy(config.provider);
    if (!strategy) {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }
    return strategy.build(config);
  }

  private static handleProviderError(config: LLMConfig, error: any): never {
    let suggestion = "Check your configuration and API keys.";
    const msg = error.message?.toLowerCase() || '';

    if (msg.includes("api key") && (msg.includes("missing") || msg.includes("not found"))) {
      suggestion = `API Key is missing for ${config.provider}. Run 'morpheus config' or set it in .env.`;
    } else if (msg.includes("401") || msg.includes("unauthorized")) {
      suggestion = `Run 'morpheus config' to update your ${config.provider} API key.`;
    } else if ((msg.includes("econnrefused") || msg.includes("fetch failed")) && config.provider === 'ollama') {
      suggestion = "Is Ollama running? Try 'ollama serve'.";
    } else if (msg.includes("model not found") || msg.includes("404")) {
      suggestion = `Model '${config.model}' may not be available. Check provider docs.`;
    } else if (msg.includes("unsupported provider")) {
      suggestion = "Edit your config file to use a supported provider (openai, anthropic, openrouter, ollama, gemini).";
    }

    throw new ProviderError(config.provider, error, suggestion);
  }

  /**
   * Creates a ReactAgent with only the provided tools — no internal Oracle tools injected.
   * Used by subagents like Apoc that need a clean, isolated tool context.
   */
  static async createBare(config: LLMConfig, tools: StructuredTool[] = []): Promise<ReactAgent> {
    try {
      const model = ProviderFactory.buildModel(config);
      const middleware = ProviderFactory.buildMonitoringMiddleware();
      const safeTools = config.provider === 'gemini' ? sanitizeToolSchemasForGemini(tools) : tools;
      return createAgent({ model, tools: safeTools, middleware: [middleware] });
    } catch (error: any) {
      ProviderFactory.handleProviderError(config, error);
    }
  }

  /** Alias for createBare — both methods are identical. */
  static create = ProviderFactory.createBare;
}
