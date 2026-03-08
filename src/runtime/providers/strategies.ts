import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOllama } from "@langchain/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { LLMConfig } from "../../types/config.js";
import { getUsableApiKey } from "../trinity-crypto.js";

export interface IProviderStrategy {
  build(config: LLMConfig): BaseChatModel;
}

class OpenAIStrategy implements IProviderStrategy {
  build(config: LLMConfig): BaseChatModel {
    return new ChatOpenAI({
      modelName: config.model,
      temperature: config.temperature,
      apiKey: process.env.OPENAI_API_KEY || getUsableApiKey(config.api_key),
    });
  }
}

class AnthropicStrategy implements IProviderStrategy {
  build(config: LLMConfig): BaseChatModel {
    return new ChatAnthropic({
      modelName: config.model,
      temperature: config.temperature,
      apiKey: process.env.ANTHROPIC_API_KEY || getUsableApiKey(config.api_key),
    });
  }
}

class OpenRouterStrategy implements IProviderStrategy {
  build(config: LLMConfig): BaseChatModel {
    return new ChatOpenAI({
      modelName: config.model,
      temperature: config.temperature,
      apiKey: process.env.OPENROUTER_API_KEY || getUsableApiKey(config.api_key),
      configuration: {
        baseURL: config.base_url || 'https://openrouter.ai/api/v1'
      }
    });
  }
}

class OllamaStrategy implements IProviderStrategy {
  build(config: LLMConfig): BaseChatModel {
    return new ChatOllama({
      model: config.model,
      temperature: config.temperature,
      baseUrl: config.base_url || getUsableApiKey(config.api_key),
    });
  }
}

class GeminiStrategy implements IProviderStrategy {
  build(config: LLMConfig): BaseChatModel {
    return new ChatGoogleGenerativeAI({
      model: config.model,
      temperature: config.temperature,
      apiKey: process.env.GOOGLE_API_KEY || getUsableApiKey(config.api_key),
    });
  }
}

const strategies = new Map<string, IProviderStrategy>([
  ['openai', new OpenAIStrategy()],
  ['anthropic', new AnthropicStrategy()],
  ['openrouter', new OpenRouterStrategy()],
  ['ollama', new OllamaStrategy()],
  ['gemini', new GeminiStrategy()],
]);

export function registerStrategy(provider: string, strategy: IProviderStrategy): void {
  strategies.set(provider, strategy);
}

export function getStrategy(provider: string): IProviderStrategy | undefined {
  return strategies.get(provider);
}
