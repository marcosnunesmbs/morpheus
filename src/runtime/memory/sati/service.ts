import { SatiRepository } from './repository.js';
import { ISatiService, ISatiRetrievalOutput, ISatiEvaluationInput, ISatiEvaluationOutput, ISatiEvaluationOutputArray } from './types.js';
import { ConfigManager } from '../../../config/manager.js';
import { ProviderFactory } from '../../providers/factory.js';
import { SystemMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { SATI_EVALUATION_PROMPT } from './system-prompts.js';
import { createHash } from 'crypto';
import { DisplayManager } from '../../display.js';
import { SQLiteChatMessageHistory } from '../sqlite.js';
import { EmbeddingService } from '../embedding.service.js';



const display = DisplayManager.getInstance();

export class SatiService implements ISatiService {
  private repository: SatiRepository;
  private static instance: SatiService;

  private constructor() {
    this.repository = SatiRepository.getInstance();
  }

  public static getInstance(): SatiService {
    if (!SatiService.instance) {
      SatiService.instance = new SatiService();
    }
    return SatiService.instance;
  }

  public async initialize(): Promise<void> {
    this.repository.initialize();
  }

  public async recover(
    currentMessage: string,
    recentMessages: string[]
  ): Promise<ISatiRetrievalOutput> {

    const santiConfig = ConfigManager.getInstance().getSatiConfig();
    const memoryLimit = santiConfig.memory_limit || 1000;

    let queryEmbedding: number[] | undefined;

    try {
      const embeddingService = await EmbeddingService.getInstance();

      const queryText = [
        ...recentMessages.slice(-3),
        currentMessage
      ].join(' ');

      queryEmbedding = await embeddingService.generate(
        queryText
      );

    } catch (err) {
      console.warn('[Sati] Failed to generate embedding:', err);
    }

    const memories = this.repository.search(
      currentMessage,
      memoryLimit,
      queryEmbedding // 🔥 agora vai usar vector search
    );

    return {
      relevant_memories: memories.map(m => ({
        summary: m.summary,
        category: m.category,
        importance: m.importance
      }))
    };
  }


  public async evaluateAndPersist(conversation: { role: string; content: string }[]): Promise<void> {
    try {
      const santiConfig = ConfigManager.getInstance().getSatiConfig();
      if (!santiConfig) return;

      // Use the main provider factory to get an agent (Reusing Zion configuration)
      // We pass empty tools as Sati is a pure reasoning agent here
      const agent = await ProviderFactory.create(santiConfig, []);

      // Get existing memories for context (Simulated "Working Memory" or full list if small)
      const allMemories = this.repository.getAllMemories();
      const existingSummaries = allMemories.slice(0, 50).map(m => m.summary);

      // Map conversation to strict types and sanitize
      const recentConversation = conversation.map(c => ({
        role: (c.role === 'human' ? 'user' : c.role) as 'user' | 'assistant',
        content: c.content
      }));

      const inputPayload: ISatiEvaluationInput = {
        recent_conversation: recentConversation,
        existing_memory_summaries: existingSummaries
      };

      const messages = [
        new SystemMessage(SATI_EVALUATION_PROMPT),
        new HumanMessage(JSON.stringify(inputPayload, null, 2))
      ];

      const history = new SQLiteChatMessageHistory({ sessionId: 'sati-evaluation' });

      try {
        const inputMsg = new ToolMessage({
          content: JSON.stringify(inputPayload, null, 2),
          tool_call_id: `sati-input-${Date.now()}`,
          name: 'sati_evaluation_input'
        });

        (inputMsg as any).provider_metadata = {
          provider: santiConfig.provider,
          model: santiConfig.model
        };

        await history.addMessage(inputMsg);
      } catch (e) {
        console.warn('[SatiService] Failed to persist input log:', e);
      }

      const response = await agent.invoke({ messages });

      const lastMessage = response.messages[response.messages.length - 1];
      let content = lastMessage.content.toString();

      try {
        const outputToolMsg = new ToolMessage({
          content: content,
          tool_call_id: `sati-output-${Date.now()}`,
          name: 'sati_evaluation_output'
        });

        if ((lastMessage as any).usage_metadata) {
          (outputToolMsg as any).usage_metadata = (lastMessage as any).usage_metadata;
        }

        (outputToolMsg as any).provider_metadata = {
          provider: santiConfig.provider,
          model: santiConfig.model
        };

        await history.addMessage(outputToolMsg);
      } catch (e) {
        console.warn('[SatiService] Failed to persist output log:', e);
      }

      // Safe JSON parsing (handle markdown blocks if LLM wraps output)
      content = content.replace(/```json/g, '').replace(/```/g, '').trim();

      let result: ISatiEvaluationOutputArray = [];
      try {
        result = JSON.parse(content);
      } catch (e) {
        console.warn('[SatiService] Failed to parse JSON response:', content);
        return;
      }

    for (const item of result) {
      if (item.should_store && item.summary && item.category && item.importance) {
        display.log(`Persisting new memory: [${item.category.toUpperCase()}] ${item.summary}`, { source: 'Sati' });
        try {
          const savedMemory = await this.repository.save({
            summary: item.summary,
            category: item.category,
            importance: item.importance,
            details: item.reason,
            hash: this.generateHash(item.summary),
            source: 'conversation'
          });

          // 🔥 GERAR EMBEDDING
          const embeddingService = await EmbeddingService.getInstance();

          const textForEmbedding = [
            savedMemory.summary,
            savedMemory.details ?? ''
          ].join(' ');

          const embedding = await embeddingService.generate(textForEmbedding);

          display.log(`Generated embedding for memory ID ${savedMemory.id}`, { source: 'Sati', level: 'debug' });

          // 🔥 SALVAR EMBEDDING NO SQLITE_VEC
          this.repository.upsertEmbedding(savedMemory.id, embedding);

          // Quiet success - logging handled by repository/middleware if needed, or verbose debug
        } catch (saveError: any) {
          if (saveError.message && saveError.message.includes('UNIQUE constraint failed')) {
            // Duplicate detected by DB (Hash collision)
            // This is expected given T012 logic
          } else {
            throw saveError;
          }
        }
      }
    }

    } catch (error) {
      console.error('[SatiService] Evaluation failed:', error);
    }
  }

  private generateHash(content: string): string {
    return createHash('sha256').update(content.trim().toLowerCase()).digest('hex');
  }
}
