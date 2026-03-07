import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import type { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import type { ISubagent } from '../ISubagent.js';
import { ConfigManager } from '../../../config/manager.js';
import type { LinkConfig, MorpheusConfig } from '../../../types/config.js';
import { LinkRepository } from './repository.js';
import { LinkSearch } from './search.js';
import { ProviderFactory } from '../../providers/factory.js';
import { ReactAgent } from 'langchain';
import { ProviderError } from '../../errors.js';
import { DisplayManager } from '../../display.js';
import { TaskRequestContext } from '../../tasks/context.js';
import type { OracleTaskContext, AgentResult } from '../../tasks/types.js';
import { extractRawUsage, persistAgentMessage, buildAgentResult, emitToolAuditEvents } from '../utils.js';
import { buildDelegationTool } from '../../tools/delegation-utils.js';
import { SubagentRegistry } from '../registry.js';

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
      SubagentRegistry.register({
        agentKey: 'link', auditAgent: 'link', label: 'Link',
        delegateToolName: 'link_delegate', emoji: '🕵️‍♂️', color: 'indigo',
        description: 'Document search & RAG',
        colorClass: 'text-indigo-600 dark:text-indigo-400',
        bgClass: 'bg-indigo-50 dark:bg-indigo-900/10',
        badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
        instance: Link.instance,
        hasDynamicDescription: true,
        isMultiInstance: false,
        setSessionId: (id) => Link.setSessionId(id),
        refreshCatalog: () => Link.refreshDelegateCatalog(),
      });
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
  private buildTools(): DynamicStructuredTool[] {
    const search = this.search;
    const repository = this.repository;
    const agentConfig = this.agentConfig;

    const searchTool = new DynamicStructuredTool({
      name: 'link_search_documents',
      description: 'Search ALL indexed user documents using hybrid vector + keyword search. Returns the most relevant document chunks for a given query. Use this for broad searches when you don\'t know which document contains the answer.',
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

    const listDocumentsTool = new DynamicStructuredTool({
      name: 'link_list_documents',
      description: 'List indexed documents. Use this to find documents by filename before searching within a specific one. Supports optional name filter (case-insensitive partial match).',
      schema: z.object({
        name_filter: z.string().optional().describe('Optional partial filename to filter by (case-insensitive). E.g. "CV", "contrato", "readme"'),
      }),
      func: async ({ name_filter }) => {
        const docs = repository.listDocuments('indexed');
        if (docs.length === 0) {
          return 'No indexed documents found.';
        }

        let filtered = docs;
        if (name_filter) {
          const lower = name_filter.toLowerCase();
          filtered = docs.filter(d => d.filename.toLowerCase().includes(lower));
        }

        if (filtered.length === 0) {
          const allNames = docs.map(d => `- ${d.filename}`).join('\n');
          return `No documents matching "${name_filter}". Available documents:\n${allNames}`;
        }

        const lines = filtered.map(d => `- [${d.id}] ${d.filename} (${d.chunk_count} chunks)`);
        return `Found ${filtered.length} document(s):\n${lines.join('\n')}`;
      },
    });

    const searchInDocumentTool = new DynamicStructuredTool({
      name: 'link_search_in_document',
      description: 'Search within a SPECIFIC document by its ID. Use this when you know which document to search (e.g. after using link_list_documents to find it). More precise than link_search_documents for targeted queries.',
      schema: z.object({
        document_id: z.string().describe('The document ID to search within (get this from link_list_documents)'),
        query: z.string().describe('The search query to find relevant passages within this document'),
        limit: z.number().optional().describe('Maximum number of results (default: max_results from config)'),
      }),
      func: async ({ document_id, query, limit }) => {
        const doc = repository.getDocument(document_id);
        if (!doc) {
          return `Document not found: ${document_id}`;
        }

        const maxResults = limit ?? agentConfig.max_results;
        const threshold = agentConfig.score_threshold;
        const results = await search.searchInDocument(query, document_id, maxResults, threshold);

        if (results.length === 0) {
          return `No relevant passages found in "${doc.filename}" for query: "${query}"`;
        }

        const formatted = results
          .map((r, i) => `[${i + 1}] (chunk ${r.position}, score: ${r.score.toFixed(3)})\n${r.content}`)
          .join('\n\n---\n\n');

        return `Found ${results.length} passages in "${doc.filename}":\n\n${formatted}`;
      },
    });

    // Tool: Summarize entire document via LLM
    const summarizeDocumentTool = new DynamicStructuredTool({
      name: 'link_summarize_document',
      description: 'Summarize an entire indexed document using the LLM. Use this when user wants a summary of a whole document (e.g., "resuma o contrato", "give me a summary of the report"). Returns a concise summary generated by the LLM.',
      schema: z.object({
        document_id: z.string().describe('The document ID to summarize (get this from link_list_documents)'),
        max_chunks: z.number().optional().describe('Maximum number of chunks to include in summary (default: 50)'),
      }),
      func: async ({ document_id, max_chunks }) => {
        const doc = repository.getDocument(document_id);
        if (!doc) {
          return `Document not found: ${document_id}`;
        }

        const chunks = repository.getChunksByDocument(document_id);
        if (chunks.length === 0) {
          return `Document "${doc.filename}" has no indexed chunks.`;
        }

        const limit = max_chunks ?? 50;
        const chunksToSummarize = chunks.slice(0, limit);
        const content = chunksToSummarize.map(c => c.content).join('\n\n---\n\n');

        // Return the content for LLM to summarize - the ReactAgent will handle the summarization
        return `Document: ${doc.filename}\nTotal chunks: ${chunks.length}\nChunks to summarize: ${chunksToSummarize.length}\n\nContent:\n${content}`;
      },
    });

    // Tool: Summarize specific chunk via LLM
    const summarizeChunkTool = new DynamicStructuredTool({
      name: 'link_summarize_chunk',
      description: 'Summarize a specific chunk from a document. Use this when user wants to summarize a particular section (e.g., "resuma o chunk 5", "summarize section 3").',
      schema: z.object({
        document_id: z.string().describe('The document ID (get this from link_list_documents)'),
        position: z.number().describe('The chunk position to summarize (1-based)'),
      }),
      func: async ({ document_id, position }) => {
        const doc = repository.getDocument(document_id);
        if (!doc) {
          return `Document not found: ${document_id}`;
        }

        const chunks = repository.getChunksByDocument(document_id);
        const chunk = chunks.find(c => c.position === position);

        if (!chunk) {
          return `Chunk not found: position ${position}. Document "${doc.filename}" has ${chunks.length} chunks.`;
        }

        return `Document: ${doc.filename}\nChunk position: ${position}\n\nContent:\n${chunk.content}`;
      },
    });

    // Tool: Extract key points from document
    const extractKeyPointsTool = new DynamicStructuredTool({
      name: 'link_extract_key_points',
      description: 'Extract key points from a document. Use this when user wants to know the main points or key takeaways from a document (e.g., "quais os pontos principais do contrato?", "extract key points from the report").',
      schema: z.object({
        document_id: z.string().describe('The document ID to extract key points from (get this from link_list_documents)'),
        max_chunks: z.number().optional().describe('Maximum number of chunks to analyze (default: 50)'),
      }),
      func: async ({ document_id, max_chunks }) => {
        const doc = repository.getDocument(document_id);
        if (!doc) {
          return `Document not found: ${document_id}`;
        }

        const chunks = repository.getChunksByDocument(document_id);
        if (chunks.length === 0) {
          return `Document "${doc.filename}" has no indexed chunks.`;
        }

        const limit = max_chunks ?? 1000;
        const chunksToAnalyze = chunks.slice(0, limit);
        const content = chunksToAnalyze.map(c => c.content).join('\n\n---\n\n');

        return `Document: ${doc.filename}\nTotal chunks: ${chunks.length}\nChunks to analyze: ${chunksToAnalyze.length}\n\nContent:\n${content}`;
      },
    });

    // Tool: Find differences between two documents
    const findDifferencesTool = new DynamicStructuredTool({
      name: 'link_find_differences',
      description: 'Compare two documents and identify differences. Use this when user wants to compare documents (e.g., "compare os dois contratos", "what is different between doc A and doc B").',
      schema: z.object({
        document_id_a: z.string().describe('First document ID to compare'),
        document_id_b: z.string().describe('Second document ID to compare'),
      }),
      func: async ({ document_id_a, document_id_b }) => {
        const docA = repository.getDocument(document_id_a);
        const docB = repository.getDocument(document_id_b);

        if (!docA) {
          return `Document not found: ${document_id_a}`;
        }
        if (!docB) {
          return `Document not found: ${document_id_b}`;
        }

        if (document_id_a === document_id_b) {
          return 'Os documentos são idênticos (mesmo documento informado duas vezes).';
        }

        const chunksA = repository.getChunksByDocument(document_id_a);
        const chunksB = repository.getChunksByDocument(document_id_b);

        const contentA = chunksA.map(c => c.content).join('\n\n---\n\n');
        const contentB = chunksB.map(c => c.content).join('\n\n---\n\n');

        return `Document A: ${docA.filename} (${chunksA.length} chunks)\nDocument B: ${docB.filename} (${chunksB.length} chunks)\n\n--- Document A Content ---\n${contentA}\n\n--- Document B Content ---\n${contentB}`;
      },
    });

    return [listDocumentsTool, searchTool, searchInDocumentTool, summarizeDocumentTool, summarizeChunkTool, extractKeyPointsTool, findDifferencesTool];
  }

  async initialize(): Promise<void> {
    this.repository.initialize();
    await this.search.initialize();

    const linkConfig = this.agentConfig;
    const personality = linkConfig.personality || 'documentation_specialist';
    const tools = this.buildTools();

    // Update delegate tool description with current document catalog
    if (Link._delegateTool) {
      const full = `${LINK_BASE_DESCRIPTION}${buildDocumentCatalogSection(this.repository)}`;
      (Link._delegateTool as any).description = full;
    }

    this.display.log(`Link initialized with personality: ${personality}.`, { source: 'Link' });

    try {
      this.agent = await ProviderFactory.create(linkConfig, tools);
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

## Tool Selection Strategy
- When the user refers to a SPECIFIC document (by name or partial name like "meu currículo", "CV", "contrato"):
  1. First call **link_list_documents** with a name filter to find the document ID.
  2. Then call **link_search_in_document** with that document ID for a targeted search.
- When the user asks a general question without referencing a specific document:
  - Use **link_search_documents** for a broad search across all documents.
- When unsure which document contains the answer, start with **link_search_documents**, then narrow down with **link_search_in_document** if results point to a specific file.
- When user asks to summarize, extract key points, or compare documents:
  - Use **link_summarize_document**, **link_extract_key_points**, or **link_find_differences** respectively.

## Source Citation with Scores
AT THE END of your response, you MUST include a "Fontes consultadas:" (Sources consulted) section listing all documents used with their final scores.
Format:
- <filename> (<document_id>): score <score_value>

Example:
- readme.md (abc-123): score 0.92
- contract.pdf (xyz-789): score 0.85

If no documents were used, omit this section.

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
