import { BaseMessage } from "@langchain/core/messages";
import { UsageMetadata } from "../types/usage.js";

export interface IOracle {
  /**
   * Initialize the oracle with configuration.
   * Throws error if validation fails.
   */
  initialize(): Promise<void>;

  /**
   * Process a user message and return the AI response.
   * Maintains internal session state.
   * @param message - The user's input text
   * @param extraUsage - Optional usage metadata to attribute to this message (e.g. from Audio transcription)
   */
  chat(message: string, extraUsage?: UsageMetadata): Promise<string>;

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
