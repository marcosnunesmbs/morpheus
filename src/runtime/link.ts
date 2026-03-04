import type { ISubagent } from './ISubagent.js';
import { ConfigManager } from '../config/manager.js';
import type { LinkConfig, MorpheusConfig } from '../types/config.js';
import { LinkRepository } from './link-repository.js';
import { LinkSearch } from './link-search.js';
import { randomUUID } from 'crypto';
import { buildAgentResult, extractRawUsage, persistAgentMessage } from './subagent-utils.js';
import { buildDelegationTool } from './tools/delegation-utils.js';
import type { StructuredTool } from '@langchain/core/tools';
import type { AIMessage } from '@langchain/core/messages';
import type { OracleTaskContext } from './tasks/types.js';

/**
 * Link - Documentation Specialist Subagent
 *
 * Provides RAG (Retrieval-Augmented Generation) capabilities over user documents.
 * Monitors ~/.morpheus/docs for files, chunks them, creates vector embeddings,
 * and provides hybrid search (80% vector + 20% BM25) for Oracle.
 */
export class Link implements ISubagent {
  private static instance: Link | null = null;
  private static currentSessionId: string | undefined = undefined;
  private static _delegateTool: StructuredTool | null = null;

  private config: MorpheusConfig;
  private agentConfig: LinkConfig;
  private repository: LinkRepository;
  private search: LinkSearch;

  private constructor(config: MorpheusConfig) {
    this.config = config;
    this.agentConfig = ConfigManager.getInstance().getLinkConfig();
    this.repository = LinkRepository.getInstance();
    this.search = LinkSearch.getInstance();
  }

  public static getInstance(config?: MorpheusConfig): Link {
    if (!Link.instance) {
      if (!config) {
        config = ConfigManager.getInstance().get();
      }
      Link.instance = new Link(config);
    }
    return Link.instance;
  }

  public static resetInstance(): void {
    Link.instance = null;
    Link._delegateTool = null;
  }

  public static setSessionId(id: string | undefined): void {
    Link.currentSessionId = id;
  }

  async initialize(): Promise<void> {
    this.repository.initialize();
    await this.search.initialize();
  }

  /**
   * Search documents for relevant information.
   */
  async searchDocuments(query: string, limit?: number): Promise<{
    results: Array<{
      chunk_id: string;
      content: string;
      document_id: string;
      filename: string;
      position: number;
      score: number;
    }>;
    total: number;
  }> {
    const maxResults = limit ?? this.agentConfig.max_results;
    const threshold = this.agentConfig.score_threshold;

    const results = await this.search.search(query, maxResults, threshold);

    return {
      results: results.map(r => ({
        chunk_id: r.chunk_id,
        content: r.content,
        document_id: r.document_id,
        filename: r.filename,
        position: r.position,
        score: r.score,
      })),
      total: results.length,
    };
  }

  /**
   * Execute a search query and return formatted results.
   */
  async execute(
    task: string,
    context?: string,
    sessionId?: string,
    taskContext?: OracleTaskContext
  ): Promise<{
    output: string;
    results: Array<{
      chunk_id: string;
      content: string;
      document_id: string;
      filename: string;
      position: number;
      score: number;
    }>;
    total_found: number;
    duration_ms: number;
  }> {
    const startTime = Date.now();

    // Parse the task to extract the search query
    const query = task.trim();

    if (!query) {
      return {
        output: 'Please provide a search query to find information in your documents.',
        results: [],
        total_found: 0,
        duration_ms: Date.now() - startTime,
      };
    }

    // Perform the search
    const searchResult = await this.searchDocuments(query);
    const durationMs = Date.now() - startTime;

    // Build the output message
    let output: string;
    if (searchResult.results.length === 0) {
      output = `No relevant documentation found for query: "${query}"`;
    } else {
      const formattedResults = searchResult.results
        .map((r, i) => `[${i + 1}] **${r.filename}** (score: ${r.score.toFixed(2)})\n${r.content}`)
        .join('\n\n---\n\n');

      output = `Found ${searchResult.results.length} relevant passage(s) for query: "${query}"\n\n${formattedResults}`;
    }

    // Persist audit event if session is available
    const targetSession = sessionId ?? Link.currentSessionId;
    if (targetSession) {
      await persistAgentMessage(
        'link',
        output,
        this.agentConfig,
        targetSession,
        { inputTokens: 0, outputTokens: 0 }, // Link doesn't use LLM tokens directly
        durationMs
      );
    }

    return {
      output,
      results: searchResult.results,
      total_found: searchResult.total,
      duration_ms: durationMs,
    };
  }

  /**
   * Create the delegation tool for Oracle.
   */
  createDelegateTool(): StructuredTool {
    if (!Link._delegateTool) {
      Link._delegateTool = buildDelegationTool({
        name: 'link_search',
        description: `Search user documentation for relevant information. Use this tool when the user asks about information that might be in their uploaded documents (PDFs, Markdown files, text files, Word documents).

The Link agent maintains a searchable index of all documents in ~/.morpheus/docs and uses hybrid search (vector similarity + keyword matching) to find the most relevant passages.

Input should be a natural language query describing what information you're looking for.`,
        agentKey: 'link',
        agentLabel: 'Link',
        auditAgent: 'link',
        isSync: () => ConfigManager.getInstance().getLinkConfig().execution_mode === 'sync',
        notifyText: '🔍 Link is searching your documentation...',
        executeSync: (task, context, sessionId, ctx) =>
          Link.getInstance().execute(task, context, sessionId, ctx),
      });
    }
    return Link._delegateTool;
  }

  /**
   * Refresh the delegate tool description (called when documents change).
   */
  static async refreshDelegateCatalog(): Promise<void> {
    // Tool description could be updated based on available documents
    // For now, we keep the static description
  }

  async reload(): Promise<void> {
    this.config = ConfigManager.getInstance().get();
    this.agentConfig = ConfigManager.getInstance().getLinkConfig();
    // Re-initialize if needed
  }
}