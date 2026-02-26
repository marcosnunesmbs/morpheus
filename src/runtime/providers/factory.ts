import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOllama } from "@langchain/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { LLMConfig } from "../../types/config.js";
import { ProviderError } from "../errors.js";
import { createAgent, createMiddleware, ReactAgent, toolCallLimitMiddleware } from "langchain";
// import { MultiServerMCPClient, } from "@langchain/mcp-adapters"; // REMOVED
import { z } from "zod";
import { DisplayManager } from "../display.js";
import { StructuredTool } from "@langchain/core/tools";
import { getUsableApiKey } from "../trinity-crypto.js";
import { ConfigManager } from "../../config/manager.js";
import { TaskRequestContext } from "../tasks/context.js";
import { ChannelRegistry } from "../../channels/registry.js";

/** Channels that should NOT receive verbose tool notifications */
const SILENT_CHANNELS = new Set(['api', 'ui']);

export class ProviderFactory {
  private static buildMonitoringMiddleware() {
    const display = DisplayManager.getInstance();
    return createMiddleware({
      name: "ToolMonitoringMiddleware",
      wrapToolCall: (request, handler) => {
        display.log(`Executing tool: ${request.toolCall.name}`, { level: "warning", source: 'ConstructLoad' });
        display.log(`Arguments: ${JSON.stringify(request.toolCall.args)}`, { level: "info", source: 'ConstructLoad' });

        // Verbose mode: notify originating channel about which tool is running
        const verboseEnabled = ConfigManager.getInstance().get().verbose_mode !== false;
        if (verboseEnabled) {
          const ctx = TaskRequestContext.get();
          if (ctx?.origin_channel && ctx.origin_user_id && !SILENT_CHANNELS.has(ctx.origin_channel)) {
            ChannelRegistry.sendToUser(ctx.origin_channel, ctx.origin_user_id, `🔧 executing: ${request.toolCall.name}`)
              .catch(() => {});
          }
        }

        try {
          const result = handler(request);
          display.log(`Tool completed successfully. Result: ${JSON.stringify(result)}`, { level: "info", source: 'ConstructLoad' });
          return result;
        } catch (e) {
          display.log(`Tool failed: ${e}`, { level: "error", source: 'ConstructLoad' });
          throw e;
        }
      },
    });
  }

  private static buildModel(config: LLMConfig): BaseChatModel {
    const usableApiKey = getUsableApiKey(config.api_key);
    
    switch (config.provider) {
      case 'openai':
        return new ChatOpenAI({
          modelName: config.model,
          temperature: config.temperature,
          apiKey: process.env.OPENAI_API_KEY || usableApiKey,
        });
      case 'anthropic':
        return new ChatAnthropic({
          modelName: config.model,
          temperature: config.temperature,
          apiKey: process.env.ANTHROPIC_API_KEY || usableApiKey,
        });
      case 'openrouter':
        return new ChatOpenAI({
          modelName: config.model,
          temperature: config.temperature,
          apiKey: process.env.OPENROUTER_API_KEY || usableApiKey,
          configuration: {
            baseURL: config.base_url || 'https://openrouter.ai/api/v1'
          }
        });
      case 'ollama':
        return new ChatOllama({
          model: config.model,
          temperature: config.temperature,
          baseUrl: config.base_url || usableApiKey,
        });
      case 'gemini':
        return new ChatGoogleGenerativeAI({
          model: config.model,
          temperature: config.temperature,
          apiKey: process.env.GOOGLE_API_KEY || usableApiKey
        });
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
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
      return createAgent({ model, tools, middleware: [middleware] });
    } catch (error: any) {
      ProviderFactory.handleProviderError(config, error);
    }
  }

  static async create(config: LLMConfig, tools: StructuredTool[] = []): Promise<ReactAgent> {
    try {
      const model = ProviderFactory.buildModel(config);
      const middleware = ProviderFactory.buildMonitoringMiddleware();
      return createAgent({ model, tools, middleware: [middleware] });
    } catch (error: any) {
      ProviderFactory.handleProviderError(config, error);
    }
  }
}
