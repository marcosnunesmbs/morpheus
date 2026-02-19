import { BaseMessage } from "@langchain/core/messages";
import { UsageMetadata } from "../types/usage.js";
import type { OracleTaskContext } from "./tasks/types.js";

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
  chat(message: string, extraUsage?: UsageMetadata, isTelephonist?: boolean, taskContext?: OracleTaskContext): Promise<string>;

  /**
   * Get the current conversation history.
   */
  getHistory(): Promise<BaseMessage[]>;

  /**
   * Archives the current session and starts a new one.
   */
  createNewSession(): Promise<void>;

  /**
   * Reset the current session.
   */
  clearMemory(): Promise<void>;

  /**
   * Sets the active session ID for the oracle.
   * @param sessionId - The session ID to switch to.
   */
  setSessionId(sessionId: string): Promise<void>;

  /**
   * Reloads MCP tools at runtime without restarting the process.
   * Recreates the provider with the current MCP configuration.
   */
  reloadTools(): Promise<void>;
}

export interface Session {
  id: string;
  history: BaseMessage[];
  lastActivity: Date;
}
