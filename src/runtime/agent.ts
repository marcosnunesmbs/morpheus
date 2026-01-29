import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { IAgent } from "./types.js";
import { ProviderFactory } from "./providers/factory.js";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderError } from "./errors.js";

export class Agent implements IAgent {
  private provider?: BaseChatModel;
  private config: MorpheusConfig;
  private history: BaseMessage[] = [];

  constructor(config?: MorpheusConfig) {
    this.config = config || ConfigManager.getInstance().get();
  }

  async initialize(): Promise<void> {
    if (!this.config.llm) {
      throw new Error("LLM configuration missing");
    }
    
    try {
      this.provider = ProviderFactory.create(this.config.llm);
    } catch (err) {
       if (err instanceof ProviderError) throw err;
       throw new ProviderError(this.config.llm.provider, err, "Initialization failed");
    }
  }

  async chat(message: string): Promise<string> {
    if (!this.provider) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    try {
      const userMessage = new HumanMessage(message);
      const systemMessage = new SystemMessage(`You are ${this.config.agent.name}, ${this.config.agent.personality}.`);
      
      const messages = [
        systemMessage,
        ...this.history,
        userMessage
      ];

      const response = await this.provider.invoke(messages);
      
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      
      this.history.push(userMessage);
      this.history.push(new AIMessage(content));

      return content;
    } catch (err) {
      throw new ProviderError(this.config.llm.provider, err, "Chat request failed");
    }
  }

  getHistory(): BaseMessage[] {
    return this.history;
  }

  clearMemory(): void {
    this.history = [];
  }
}
