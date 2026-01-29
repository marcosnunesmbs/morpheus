import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { IAgent } from "./types.js";
import { ProviderFactory } from "./providers/factory.js";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";


export class Agent implements IAgent {
  private provider?: BaseChatModel;
  private config: MorpheusConfig;
  private history: BaseMessage[] = [];
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
      this.provider = ProviderFactory.create(this.config.llm);
      if (!this.provider) {
        throw new Error("Provider factory returned undefined");
      }
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

    try {
      this.display.log('Processing message...', { source: 'Agent' });
      const userMessage = new HumanMessage(message);
      const systemMessage = new SystemMessage(`You are ${this.config.agent.name}, ${this.config.agent.personality}. You are a personal dev assistent.`);
      
      const messages = [
        systemMessage,
        ...this.history,
        userMessage
      ];

      const response = await this.provider.invoke(messages);
      
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      
      this.history.push(userMessage);
      this.history.push(new AIMessage(content));

      this.display.log('Response generated.', { source: 'Agent' });
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
