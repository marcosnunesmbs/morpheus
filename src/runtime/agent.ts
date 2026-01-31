import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { IAgent } from "./types.js";
import { ProviderFactory } from "./providers/factory.js";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";
import { SQLiteChatMessageHistory } from "./memory/sqlite.js";
import { ReactAgent } from "langchain";

export class Agent implements IAgent {
  private provider?: ReactAgent;
  private config: MorpheusConfig;
  private history?: BaseListChatMessageHistory;
  private display = DisplayManager.getInstance();

  constructor(config?: MorpheusConfig) {
    this.config = config || ConfigManager.getInstance().get();
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
      this.provider = await ProviderFactory.create(this.config.llm);
      if (!this.provider) {
        throw new Error("Provider factory returned undefined");
      }

      // Initialize persistent memory with SQLite
      this.history = new SQLiteChatMessageHistory({
        sessionId: "default",
        limit: 15,
      });
    } catch (err) {
       if (err instanceof ProviderError) throw err; // Re-throw known errors
       
       // Wrap unknown errors
       throw new ProviderError(
         this.config.llm.provider || 'unknown',
         err, 
         "Agent initialization failed"
       );
    }
  }

  async chat(message: string): Promise<string> {
    if (!this.provider) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    if (!this.history) {
      throw new Error("Message history not initialized. Call initialize() first.");
    }

    try {
      this.display.log('Processing message...', { source: 'Agent' });

      const userMessage = new HumanMessage(message);
      const systemMessage = new SystemMessage(`You are ${this.config.agent.name}, ${this.config.agent.personality}. You are a personal dev assistent.`);
      
      // Load existing history from database
      const previousMessages = await this.history.getMessages();
      
      const messages = [
        systemMessage,
        ...previousMessages,
        userMessage
      ];

      const response = await this.provider.invoke({ messages});

      console.log('Agent response:', response);
            
      // Persist messages to database
      await this.history.addMessage(userMessage);
      await this.history.addMessage(new AIMessage(response.messages[response.messages.length - 1].text));
      this.display.log('Response generated.', { source: 'Agent' });
      return response.messages[response.messages.length - 1].text;
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
