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
import { StructuredTool, tool } from "@langchain/core/tools";
import {
  ConfigQueryTool,
  ConfigUpdateTool,
  DiagnosticTool,
  MessageCountTool,
  TokenUsageTool,
  ProviderModelUsageTool
} from "../tools/index.js";

export class ProviderFactory {
  static async create(config: LLMConfig, tools: StructuredTool[] = []): Promise<ReactAgent> {

    let display = DisplayManager.getInstance();

    const toolMonitoringMiddleware = createMiddleware({
      name: "ToolMonitoringMiddleware",
      wrapToolCall: (request, handler) => {
        display.log(`Executing tool: ${request.toolCall.name}`, { level: "warning", source: 'ConstructLoad' });
        display.log(`Arguments: ${JSON.stringify(request.toolCall.args)}`, { level: "info", source: 'ConstructLoad' });
        try {
          const result = handler(request);
          display.log("Tool completed successfully", { level: "info", source: 'ConstructLoad' });
          return result;
        } catch (e) {
          display.log(`Tool failed: ${e}`, { level: "error", source: 'ConstructLoad' });
          throw e;
        }
      },
    });

    let model: BaseChatModel;

    const responseSchema = z.object({
      content: z.string().describe("The main response content from the agent"),
    });

    // Removed direct MCP client instantiation

    try {
      switch (config.provider) {
        case 'openai':
          model = new ChatOpenAI({
            modelName: config.model,
            temperature: config.temperature,
            apiKey: config.api_key, // LangChain will also check process.env.OPENAI_API_KEY
          });
          break;
        case 'anthropic':
          model = new ChatAnthropic({
            modelName: config.model,
            temperature: config.temperature,
            apiKey: config.api_key,
          });
          break;
        case 'ollama':
          // Ollama usually runs locally, api_key optional
          model = new ChatOllama({
            model: config.model,
            temperature: config.temperature,
            baseUrl: config.api_key, // Sometimes users might overload api_key for base URL or similar, but simplified here
          });
          break;
        case 'gemini':
          model = new ChatGoogleGenerativeAI({
            model: config.model,
            temperature: config.temperature,
            apiKey: config.api_key
          });
          break;
        default:
          throw new Error(`Unsupported provider: ${config.provider}`);
      }

      const toolsForAgent = [
        ...tools,
        ConfigQueryTool,
        ConfigUpdateTool,
        DiagnosticTool,
        MessageCountTool,
        TokenUsageTool,
        ProviderModelUsageTool
      ];

      return createAgent({
        model: model,
        tools: toolsForAgent,
        middleware: [toolMonitoringMiddleware]
      });


    } catch (error: any) {
      let suggestion = "Check your configuration and API keys.";

      const msg = error.message?.toLowerCase() || '';

      // Constructor validation errors (Missing Keys)
      if (msg.includes("api key") && (msg.includes("missing") || msg.includes("not found"))) {
        suggestion = `API Key is missing for ${config.provider}. Run 'morpheus config' or set it in .env.`;
      }
      // Network/Auth errors (unlikely in constructor, but possible if pre-validation exists)
      else if (msg.includes("401") || msg.includes("unauthorized")) {
        suggestion = `Run 'morpheus config' to update your ${config.provider} API key.`;
      } else if ((msg.includes("econnrefused") || msg.includes("fetch failed")) && config.provider === 'ollama') {
        suggestion = "Is Ollama running? Try 'ollama serve'.";
      } else if (msg.includes("model not found") || msg.includes("404")) {
        suggestion = `Model '${config.model}' may not be available. Check provider docs.`;
      } else if (msg.includes("unsupported provider")) {
        suggestion = "Edit your config file to use a supported provider (openai, anthropic, ollama, gemini).";
      }

      throw new ProviderError(
        config.provider,
        error,
        suggestion
      );
    }
  }
}
