import { BaseMessage } from "@langchain/core/messages";

export interface IAgent {
  /**
   * Initialize the agent with configuration.
   * Throws error if validation fails.
   */
  initialize(): Promise<void>;

  /**
   * Process a user message and return the AI response.
   * Maintains internal session state.
   */
  chat(message: string): Promise<string>;

  /**
   * Get the current conversation history.
   */
  getHistory(): Promise<BaseMessage[]>;

  /**
   * Reset the current session.
   */
  clearMemory(): Promise<void>;
}

export interface Session {
  id: string;
  history: BaseMessage[];
  lastActivity: Date;
}
