/**
 * Adapter: LangChainProviderAdapter
 *
 * Implements ILLMProviderFactory using ProviderFactory.
 * Allows subagents to build LLM agents without importing
 * ProviderFactory directly.
 */
import type { ILLMProviderFactory } from '../ports/ILLMProviderFactory.js';
import type { StructuredTool } from '@langchain/core/tools';
import type { ReactAgent } from 'langchain';
import type { LLMConfig } from '../../types/config.js';
import { ProviderFactory } from '../providers/factory.js';

export class LangChainProviderAdapter implements ILLMProviderFactory {
  async createBare(config: LLMConfig, tools: StructuredTool[] = []): Promise<ReactAgent> {
    return ProviderFactory.createBare(config, tools);
  }

  async create(config: LLMConfig, tools: StructuredTool[] = []): Promise<ReactAgent> {
    return ProviderFactory.createBare(config, tools);
  }
}
