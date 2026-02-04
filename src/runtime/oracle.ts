import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { IOracle } from "./types.js";
import { ProviderFactory } from "./providers/factory.js";
import { Construtor } from "./tools/factory.js";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";
import { SQLiteChatMessageHistory } from "./memory/sqlite.js";
import { ReactAgent } from "langchain";
import { UsageMetadata } from "../types/usage.js";

export class Oracle implements IOracle {
  private provider?: ReactAgent;
  private config: MorpheusConfig;
  private history?: BaseListChatMessageHistory;
  private display = DisplayManager.getInstance();
  private databasePath?: string;

  constructor(config?: MorpheusConfig, overrides?: { databasePath?: string }) {
    this.config = config || ConfigManager.getInstance().get();
    this.databasePath = overrides?.databasePath;
  }

  async initialize(): Promise<void> {
    if (!this.config.llm) {
      throw new Error("LLM configuration missing in config object.");
    }

    // Basic validation before provider creation
    if (!this.config.llm.provider) {
      throw new Error("LLM provider not specified in configuration.");
    }

    // Note: API Key validation is delegated to ProviderFactory or the Provider itself 
    // to allow for Environment Variable fallback supported by LangChain.

    try {
      const tools = await Construtor.create();
      this.provider = await ProviderFactory.create(this.config.llm, tools);
      if (!this.provider) {
        throw new Error("Provider factory returned undefined");
      }

      // Initialize persistent memory with SQLite
      this.history = new SQLiteChatMessageHistory({
        sessionId: "default",
        databasePath: this.databasePath,
        limit: this.config.memory?.limit || 100, // Fallback purely defensive if config type allows optional
      });
    } catch (err) {
      if (err instanceof ProviderError) throw err; // Re-throw known errors

      // Wrap unknown errors
      throw new ProviderError(
        this.config.llm.provider || 'unknown',
        err,
        "Oracle initialization failed"
      );
    }
  }

  async chat(message: string, extraUsage?: UsageMetadata): Promise<string> {
    if (!this.provider) {
      throw new Error("Oracle not initialized. Call initialize() first.");
    }

    if (!this.history) {
      throw new Error("Message history not initialized. Call initialize() first.");
    }

    try {
      this.display.log('Processing message...', { source: 'Oracle' });

      const userMessage = new HumanMessage(message);
      
      // Inject provider/model metadata for persistence
      (userMessage as any).provider_metadata = {
        provider: this.config.llm.provider,
        model: this.config.llm.model
      };

      // Attach extra usage (e.g. from Audio) to the user message to be persisted
      if (extraUsage) {
        (userMessage as any).usage_metadata = extraUsage;
      }

      const systemMessage = new SystemMessage(
          `You are ${this.config.agent.name}, ${this.config.agent.personality},a local AI operator responsible for orchestrating tools, MCPs, and language models to solve the user’s request accurately and reliably.

          Your primary responsibility is NOT to answer from memory when external tools are available.

          You must follow these rules strictly:

          1. Tool Evaluation First
          Before generating a final answer, always evaluate whether any available tool or MCP is capable of providing a more accurate, up-to-date, or authoritative response.

          If a tool can provide the answer, you MUST call the tool.

          2. No Historical Assumptions for Dynamic Data
          If the user asks something that:
          - may change over time
          - depends on system state
          - depends on filesystem
          - depends on external APIs
          - was previously asked in the conversation

          You MUST NOT reuse previous outputs as final truth.

          Instead:
          - Re-evaluate available tools
          - Re-execute the relevant tool
          - Provide a fresh result

          Even if the user already asked the same question before, you must treat the request as requiring a new verification.

          3. History Is Context, Not Source of Truth
          Conversation history may help with context, but it must not replace real-time verification via tools when tools are available.

          Never assume:
          - System state
          - File contents
          - Database values
          - API responses
          based only on previous messages.

          4. Tool Priority Over Language Guessing
          If a tool can compute, fetch, inspect, or verify something, prefer tool usage over generating a speculative answer.

          Never hallucinate values that could be retrieved through a tool.

          5. Freshness Principle
          Repeated user queries require fresh validation.
          Do not respond with:
          "As I said before..."
          Instead, perform a new tool check if applicable.

          6. Final Answer Policy
          Only provide a direct natural language answer if:
          - No tool is relevant
          - Tools are unavailable
          - The question is conceptual or explanatory

          Otherwise, use tools first.

          You are an operator, not a guesser.
          Accuracy is more important than speed.
      `);

      // Load existing history from database
      const previousMessages = await this.history.getMessages();

      const messages = [
        systemMessage,
        ...previousMessages,
        userMessage
      ];

      const response = await this.provider.invoke({ messages });

      // Identify new messages generated during the interaction
      // The `messages` array passed to invoke had length `messages.length`
      // The `response.messages` contains the full state.
      // New messages start after the inputs.
      const startNewMessagesIndex = messages.length;
      const newGeneratedMessages = response.messages.slice(startNewMessagesIndex);

      // Persist User Message first
      await this.history.addMessage(userMessage);

      // Persist all new intermediate tool calls and responses
      for (const msg of newGeneratedMessages) {
        // Inject provider/model metadata search interactors
        (msg as any).provider_metadata = {
          provider: this.config.llm.provider,
          model: this.config.llm.model
        };
        await this.history.addMessage(msg);
      }

      this.display.log('Response generated.', { source: 'Oracle' });
      
      const lastMessage = response.messages[response.messages.length - 1];
      return (typeof lastMessage.content === 'string') ? lastMessage.content : JSON.stringify(lastMessage.content);
    } catch (err) {
      throw new ProviderError(this.config.llm.provider, err, "Chat request failed");
    }
  }

  async getHistory(): Promise<BaseMessage[]> {
    if (!this.history) {
      throw new Error("Message history not initialized. Call initialize() first.");
    }
    return await this.history.getMessages();
  }

  async clearMemory(): Promise<void> {
    if (!this.history) {
      throw new Error("Message history not initialized. Call initialize() first.");
    }
    await this.history.clear();
  }
}
