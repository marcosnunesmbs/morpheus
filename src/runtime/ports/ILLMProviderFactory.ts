/**
 * Port: ILLMProviderFactory
 *
 * Abstraction for building LLM agents.
 * Decouples subagents from ProviderFactory / LangChain internals.
 */
import type { StructuredTool } from '@langchain/core/tools';
import type { ReactAgent } from 'langchain';
import type { LLMConfig } from '../../types/config.js';

export interface ILLMProviderFactory {
  /**
   * Create a ReactAgent with a clean, isolated tool context.
   * Used by subagents (Apoc, Neo, Trinity, Link).
   */
  createBare(config: LLMConfig, tools?: StructuredTool[]): Promise<ReactAgent>;

  /**
   * Create a ReactAgent (same as createBare — kept for backwards compat).
   */
  create(config: LLMConfig, tools?: StructuredTool[]): Promise<ReactAgent>;
}
