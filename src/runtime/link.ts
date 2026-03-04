import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import type { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import type { ISubagent } from './ISubagent.js';
import { ConfigManager } from '../config/manager.js';
import type { LinkConfig, MorpheusConfig } from '../types/config.js';
import { LinkRepository } from './link-repository.js';
import { LinkSearch } from './link-search.js';
import { ProviderFactory } from './providers/factory.js';
import { ReactAgent } from 'langchain';
import { ProviderError } from './errors.js';
import { DisplayManager } from './display.js';
import { TaskRequestContext } from './tasks/context.js';
import type { OracleTaskContext, AgentResult } from './tasks/types.js';
import { extractRawUsage, persistAgentMessage, buildAgentResult, emitToolAuditEvents } from './subagent-utils.js';
import { buildDelegationTool } from './tools/delegation-utils.js';

const LINK_BASE_DESCRIPTION = `Delegate to Link, the documentation specialist subagent.

Link has access to indexed user documents (PDFs, Markdown, TXT, DOCX) stored in ~/.morpheus/docs.
It uses an LLM to search, reason over, and synthesize answers from document content.

Use this tool when the user asks about information that might be in their uploaded documents.
Input should be a natural language query or question about the user's documentation.`;

function buildDocumentCatalogSection(repository: LinkRepository): string {
  try {
    const docs = repository.listDocuments('indexed');
    if (docs.length === 0) {
      return '\n\nIndexed documents: none currently indexed.';
    }
    const lines = docs.map((d) => `- ${d.filename} (${d.chunk_count} chunks)`);
    return `\n\nIndexed documents:\n${lines.join('\n')}`;
  } catch {
    return '\n\nIndexed documents: unable to retrieve list.';
  }
}

/**
 * Link - Documentation Specialist Subagent
 *
 * Provides RAG (Retrieval-Augmented Generation) capabilities over user documents.
 * Uses a ReactAgent with an LLM to reason over search results and synthesize answers.
 */
export class Link implements ISubagent {
  private static instance: Link | null = null;
  private static currentSessionId: string | undefined = undefined;
  private static _delegateTool: StructuredTool | null = null;

  private config: MorpheusConfig;
  private agentConfig: LinkConfig;
  private repository: LinkRepository;
  private search: LinkSearch;
  private agent?: ReactAgent;
  private display = DisplayManager.getInstance();

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

  /**
   * Build the internal search tool that the ReactAgent will use.
   */
  private buildSearchTool(): DynamicStructuredTool {
    const search = this.search;
    const agentConfig = this.agentConfig;

    return new DynamicStructuredTool({
      name: 'link_search_documents',
      description: 'Search indexed user documents using hybrid vector + keyword search. Returns the most relevant document chunks for a given query.',
      schema: z.object({
        query: z.string().describe('The search query to find relevant document passages'),
        limit: z.number().optional().describe('Maximum number of results to return (default: max_results from config)'),
      }),
      func: async ({ query, limit }) => {
        const maxResults = limit ?? agentConfig.max_results;
        const threshold = agentConfig.score_threshold;
        const results = await search.search(query, maxResults, threshold);

        if (results.length === 0) {
          return `No relevant documents found for query: "${query}"`;
        }

        const formatted = results
          .map((r, i) => `[${i + 1}] Source: ${r.filename} (chunk ${r.position}, score: ${r.score.toFixed(3)})\n${r.content}`)
          .join('\n\n---\n\n');

        return `Found ${results.length} relevant passages:\n\n${formatted}`;
      },
    });
  }

  async initialize(): Promise<void> {
    this.repository.initialize();
    await this.search.initialize();

    const linkConfig = this.agentConfig;
    const personality = linkConfig.personality || 'documentation_specialist';
    const searchTool = this.buildSearchTool();

    // Update delegate tool description with current document catalog
    if (Link._delegateTool) {
      const full = `${LINK_BASE_DESCRIPTION}${buildDocumentCatalogSection(this.repository)}`;
      (Link._delegateTool as any).description = full;
    }

    this.display.log(`Link initialized with personality: ${personality}.`, { source: 'Link' });

    try {
      this.agent = await ProviderFactory.create(linkConfig, [searchTool]);
    } catch (err) {
      throw new ProviderError(
        linkConfig.provider,
        err,
        'Link subagent initialization failed',
      );
    }
  }

  /**
   * Search documents for relevant information (used internally by search tool and HTTP API).
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
   * Execute a query using the LLM-powered ReactAgent.
   */
  async execute(
    task: string,
    context?: string,
    sessionId?: string,
    taskContext?: OracleTaskContext
  ): Promise<AgentResult> {
    const linkConfig = this.agentConfig;
    if (!this.agent) {
      await this.initialize();
    }

    this.display.log(`Executing delegated task in Link: ${task.slice(0, 80)}...`, {
      source: 'Link',
    });

    const personality = linkConfig.personality || 'documentation_specialist';
    const systemMessage = new SystemMessage(`
You are Link, ${personality === 'documentation_specialist' ? 'a documentation specialist and knowledge synthesizer' : personality}, a subagent in Morpheus.

You have access to the user's indexed documents via the link_search_documents tool.

Rules:
1. ALWAYS search the documents before answering. Never answer from general knowledge alone when documents may contain relevant information.
2. Synthesize search results into a clear, natural response. Do not just dump raw chunks.
3. Cite sources by filename when referencing specific information (e.g., "According to readme.md, ...").
4. If no relevant documents are found, clearly state that no matching documentation was found.
5. NEVER fabricate or invent document content. Only report what the search actually returns.
6. If the query is ambiguous, search with multiple relevant terms to maximize coverage.
7. Keep responses concise and focused on the user's question.
8. Respond in the language requested by the user. If not explicit, use the dominant language of the task/context.

${context ? `Context:\n${context}` : ''}
    `);

    const userMessage = new HumanMessage(task);
    const messages: BaseMessage[] = [systemMessage, userMessage];

    try {
      const invokeContext: OracleTaskContext = {
        origin_channel: taskContext?.origin_channel ?? 'api',
        session_id: taskContext?.session_id ?? sessionId ?? 'default',
        origin_message_id: taskContext?.origin_message_id,
        origin_user_id: taskContext?.origin_user_id,
      };
      const inputCount = messages.length;
      const startMs = Date.now();
      const response = await TaskRequestContext.run(invokeContext, () => this.agent!.invoke({ messages }, { recursionLimit: 25 }));
      const durationMs = Date.now() - startMs;

      const lastMessage = response.messages[response.messages.length - 1];
      const content =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      const rawUsage = extractRawUsage(lastMessage);
      const stepCount = response.messages.filter((m: BaseMessage) => m instanceof AIMessage).length;

      const targetSession = sessionId ?? Link.currentSessionId ?? 'link';
      await persistAgentMessage('link', content, linkConfig, targetSession, rawUsage, durationMs);

      emitToolAuditEvents(response.messages.slice(inputCount), targetSession, 'link');

      this.display.log('Link task completed.', { source: 'Link' });
      return buildAgentResult(content, linkConfig, rawUsage, durationMs, stepCount);
    } catch (err) {
      throw new ProviderError(
        linkConfig.provider,
        err,
        'Link task execution failed',
      );
    }
  }

  /**
   * Create the delegation tool for Oracle.
   */
  createDelegateTool(): StructuredTool {
    if (!Link._delegateTool) {
      Link._delegateTool = buildDelegationTool({
        name: 'link_delegate',
        description: LINK_BASE_DESCRIPTION,
        agentKey: 'link',
        agentLabel: 'Link',
        auditAgent: 'link',
        isSync: () => ConfigManager.getInstance().getLinkConfig().execution_mode === 'sync',
        notifyText: '📚 Link is searching your documentation...',
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

  /**
   * Refresh the delegate tool description with current document catalog.
   */
  static async refreshDelegateCatalog(): Promise<void> {
    if (Link._delegateTool) {
      try {
        const repository = LinkRepository.getInstance();
        const full = `${LINK_BASE_DESCRIPTION}${buildDocumentCatalogSection(repository)}`;
        (Link._delegateTool as any).description = full;
      } catch { /* non-critical */ }
    }
  }

  async reload(): Promise<void> {
    this.config = ConfigManager.getInstance().get();
    this.agentConfig = ConfigManager.getInstance().getLinkConfig();
    this.agent = undefined;
    await this.initialize();
  }
}
