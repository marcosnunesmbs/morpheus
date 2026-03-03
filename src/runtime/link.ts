import type { StructuredTool } from "@langchain/core/tools";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { DisplayManager } from "./display.js";
import { LinkRepository } from "./link/repository.js";
import type { LinkDocument, SearchResult } from "./link/types.js";
import type { ISubagent } from "./ISubagent.js";
import type { OracleTaskContext, AgentResult } from "./tasks/types.js";
import { buildDelegationTool } from "./tools/delegation-utils.js";
import { AuditRepository } from "./audit/repository.js";
import { ChannelRegistry } from "../channels/registry.js";
import { ProviderFactory } from "./providers/factory.js";
import { ReactAgent } from "langchain";
import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import { extractRawUsage, persistAgentMessage, buildAgentResult } from "./subagent-utils.js";

/**
 * Link is a documentation specialist subagent that implements RAG (Retrieval-Augmented Generation)
 * with hybrid search (80% vector + 20% BM25) to answer questions based on documents stored
 * in ~/.morpheus/docs/.
 */
export class Link implements ISubagent {
  private static instance: Link | null = null;
  private static currentSessionId: string | undefined = undefined;
  private static _delegateTool: StructuredTool | null = null;

  private repository: LinkRepository;
  private config: MorpheusConfig;
  private display = DisplayManager.getInstance();
  private agent?: ReactAgent;

  private constructor(config?: MorpheusConfig) {
    this.config = config || ConfigManager.getInstance().get();
    this.repository = LinkRepository.getInstance();
  }

  /**
   * Called by Oracle before each chat() so Link knows which session to
   * attribute its token usage to.
   */
  public static setSessionId(sessionId: string | undefined): void {
    Link.currentSessionId = sessionId;
  }

  public static getInstance(config?: MorpheusConfig): Link {
    if (!Link.instance) {
      Link.instance = new Link(config);
    }
    return Link.instance;
  }

  public static resetInstance(): void {
    Link.instance = null;
    Link._delegateTool = null;
  }

  async initialize(): Promise<void> {
    const linkConfig = this.config.link || this.config.llm;

    this.display.log(
      `Link initialized (chunk_size: ${this.config.link?.chunk_size || 500}, score_threshold: ${this.config.link?.score_threshold || 0.7})`,
      { source: "Link" }
    );

    // Link doesn't need an LLM agent since it only does retrieval
    // But we could add one if we want Link to generate summaries
    this.agent = undefined;
  }

  /**
   * Execute a document search task delegated by Oracle.
   * @param task Natural language query
   * @param context Optional additional context
   * @param sessionId Session to attribute usage to
   * @param taskContext Optional Oracle task context for notifications
   */
  async execute(task: string, context?: string, sessionId?: string, taskContext?: OracleTaskContext): Promise<AgentResult> {
    const linkConfig = ConfigManager.getInstance().getLinkConfig();
    const startMs = Date.now();

    // Verbose mode notification
    if (taskContext?.origin_channel && taskContext.origin_user_id && taskContext.origin_channel !== 'api' && taskContext.origin_channel !== 'ui') {
      ChannelRegistry.sendToUser(taskContext.origin_channel, taskContext.origin_user_id, '🔗 Link is searching documents...')
        .catch(() => {});
    }

    this.display.log(`Searching documents: ${task.slice(0, 80)}...`, {
      source: "Link",
    });

    try {
      // Perform hybrid search
      const searchResults = await this.search(task, {
        limit: 5,
        scoreThreshold: linkConfig.score_threshold || 0.7,
        vectorWeight: linkConfig.vector_weight || 0.8,
        bm25Weight: linkConfig.bm25_weight || 0.2,
      });

      const durationMs = Date.now() - startMs;

      // Format results
      const formattedResults = this.formatResults(searchResults);

      // Build response
      const response = this.buildResponse(task, searchResults, formattedResults, context);

      // Emit audit event
      AuditRepository.getInstance().insert({
        session_id: sessionId ?? Link.currentSessionId ?? 'link',
        event_type: 'link_search',
        agent: 'link',
        status: 'success',
        duration_ms: durationMs,
        metadata: {
          query: task,
          results_count: searchResults.length,
          top_score: searchResults[0]?.score || 0,
        },
      });

      this.display.log(`Link search completed: ${searchResults.length} results in ${durationMs}ms`, {
        source: "Link",
        level: "success",
      });

      return {
        output: response,
        usage: {
          provider: linkConfig.provider,
          model: linkConfig.model,
          inputTokens: 0,
          outputTokens: 0,
          durationMs,
          stepCount: 1,
        },
      };
    } catch (err: any) {
      const durationMs = Date.now() - startMs;
      const errorMessage = err?.message || String(err);

      AuditRepository.getInstance().insert({
        session_id: sessionId ?? Link.currentSessionId ?? 'link',
        event_type: 'link_search',
        agent: 'link',
        status: 'error',
        duration_ms: durationMs,
        metadata: { query: task, error: errorMessage },
      });

      throw err;
    }
  }

  /**
   * Search documents using hybrid RAG (vector + BM25)
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      scoreThreshold?: number;
      vectorWeight?: number;
      bm25Weight?: number;
    }
  ): Promise<SearchResult[]> {
    // Get embedding for query
    const queryEmbedding = await this.getQueryEmbedding(query);

    // Perform hybrid search
    const results = this.repository.searchHybrid(
      query,
      queryEmbedding,
      options?.limit || 5,
      options?.scoreThreshold || 0.7,
      options?.vectorWeight || 0.8,
      options?.bm25Weight || 0.2
    );

    return results;
  }

  /**
   * Get embedding for a query using the configured provider
   */
  private async getQueryEmbedding(query: string): Promise<number[]> {
    // For now, we'll use a simple approach - generate a mock embedding
    // In a real implementation, you'd call the LLM provider's embedding API
    // This is a placeholder that should be replaced with actual embedding generation

    // Try to use the provider factory to get embeddings
    try {
      const linkConfig = this.config.link || this.config.llm;
      const bareProvider = await ProviderFactory.createBare(linkConfig, []);

      // Check if the provider has an embed method
      if ((bareProvider as any).embed) {
        const embedding = await (bareProvider as any).embed(query);
        if (Array.isArray(embedding) && embedding.length === 384) {
          return embedding;
        }
      }
    } catch {
      // Fall through to mock embedding
    }

    // Fallback: generate a simple hash-based embedding (not semantic, but consistent)
    // This is just for development - should be replaced with real embeddings
    return this.generateMockEmbedding(query);
  }

  /**
   * Generate a mock embedding for development (should be replaced with real embeddings)
   */
  private generateMockEmbedding(text: string): number[] {
    // Simple hash-based embedding for consistent results during development
    const embedding: number[] = new Array(384).fill(0);

    // Use character codes to generate pseudo-random but consistent values
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      embedding[i % 384] += charCode / 255;
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(v => v / (magnitude || 1));
  }

  /**
   * Format search results for display
   */
  private formatResults(results: SearchResult[]): string {
    if (results.length === 0) {
      return "No relevant documents found.";
    }

    const lines: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      lines.push(`\n[${i + 1}] ${r.document.filename} (score: ${(r.score * 100).toFixed(1)}%)`);
      lines.push(`Source: ${r.document.filepath}`);
      lines.push(`Content: ${r.chunk.content.slice(0, 300)}${r.chunk.content.length > 300 ? '...' : ''}`);
    }

    return lines.join('\n');
  }

  /**
   * Build the final response
   */
  private buildResponse(query: string, results: SearchResult[], formattedResults: string, context?: string): string {
    const parts: string[] = [];

    parts.push(`## Document Search Results`);
    parts.push(`Query: "${query}"`);

    if (context) {
      parts.push(`Context: ${context}`);
    }

    parts.push('');

    if (results.length === 0) {
      parts.push('No relevant documents found in the knowledge base.');
      parts.push('');
      parts.push('Suggestions:');
      parts.push('- Try rephrasing your query');
      parts.push('- Check if relevant documents are in ~/.morpheus/docs/');
      parts.push('- The documents may still be indexing');
    } else {
      parts.push(`Found ${results.length} relevant document section(s):`);
      parts.push(formattedResults);
      parts.push('');
      parts.push('---');
      parts.push('Use the information above to answer the user\'s question. Cite specific sources when possible.');
    }

    return parts.join('\n');
  }

  createDelegateTool(): StructuredTool {
    if (!Link._delegateTool) {
      Link._delegateTool = buildDelegationTool({
        name: "link_delegate",
        description: `Delegate a document/RAG search task to Link, the documentation specialist subagent.

This tool searches the document knowledge base using hybrid RAG (80% vector + 20% BM25)
to find relevant information based on the user's query.

Use this tool when the user asks for information that might be in stored documents:
- Questions about documentation, manuals, or guides
- Queries about code files stored in ~/.morpheus/docs/
- Information retrieval from PDFs, DOCX, or text files
- Finding specific content within the knowledge base

The tool returns relevant document chunks with source information.
Provide a clear natural language query describing what information to find.`,
        agentKey: "link",
        agentLabel: "Link",
        auditAgent: "link",
        isSync: () => ConfigManager.getInstance().get().link?.execution_mode === 'sync',
        notifyText: '🔗 Link is searching documents...',
        executeSync: (task, context, sessionId, ctx) =>
          Link.getInstance().execute(task, context, sessionId, {
            origin_channel: ctx?.origin_channel ?? 'api',
            session_id: sessionId,
            origin_message_id: ctx?.origin_message_id,
            origin_user_id: ctx?.origin_user_id,
          }),
      });
    }
    return Link._delegateTool;
  }

  /** Reload with updated config */
  async reload(): Promise<void> {
    this.config = ConfigManager.getInstance().get();
    await this.initialize();
  }
}
