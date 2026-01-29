import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOllama } from "@langchain/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { LLMConfig } from "../../types/config.js";
import { ProviderError } from "../errors.js";

export class ProviderFactory {
  static create(config: LLMConfig): BaseChatModel {
    try {
      switch (config.provider) {
        case 'openai':
          return new ChatOpenAI({
            modelName: config.model,
            temperature: config.temperature,
            apiKey: config.api_key, // LangChain will also check process.env.OPENAI_API_KEY
          });
        case 'anthropic':
          return new ChatAnthropic({
            modelName: config.model,
            temperature: config.temperature,
            apiKey: config.api_key,
          });
        case 'ollama':
          // Ollama usually runs locally, api_key optional
          return new ChatOllama({
            model: config.model,
            temperature: config.temperature,
            baseUrl: config.api_key, // Sometimes users might overload api_key for base URL or similar, but simplified here
          });
        case 'gemini':
          return new ChatGoogleGenerativeAI({
            model: config.model,
            temperature: config.temperature,
            apiKey: config.api_key,
          });
        default:
          throw new Error(`Unsupported provider: ${config.provider}`);
      }
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
