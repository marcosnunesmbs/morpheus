import { SatiRepository } from './repository.js';
import { ISatiService, ISatiRetrievalOutput, ISatiEvaluationInput, ISatiEvaluationResult } from './types.js';
import { ConfigManager } from '../../../config/manager.js';
import { ProviderFactory } from '../../providers/factory.js';
import { SystemMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { SATI_EVALUATION_PROMPT } from './system-prompts.js';
import { createHash } from 'crypto';
import { DisplayManager } from '../../display.js';
import { SQLiteChatMessageHistory } from '../sqlite.js';
import { EmbeddingService } from '../embedding.service.js';
import { AuditRepository } from '../../audit/repository.js';



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

    const satiConfig = ConfigManager.getInstance().getSatiConfig();
    const memoryLimit = satiConfig.memory_limit || 10;

    const enabled_vector_search = satiConfig.enabled_archived_sessions ?? true;

    let queryEmbedding: number[] | undefined;

    try {
      const embeddingService = await EmbeddingService.getInstance();

      const queryText = [
        ...recentMessages.slice(-3),
        currentMessage
      ].join(' ');

      if (enabled_vector_search) {
        queryEmbedding = await embeddingService.generate(
          queryText
        );
      }

    } catch (err) {
      console.warn('[Sati] Failed to generate embedding:', err);
    }

    const memories = this.repository.search(
      currentMessage,
      memoryLimit,
      queryEmbedding
    );

    return {
      relevant_memories: memories.map(m => ({
        summary: m.summary,
        category: m.category,
        importance: m.importance
      }))
    };
  }


  public async evaluateAndPersist(conversation: { role: string; content: string }[], userSessionId?: string): Promise<void> {
    try {
      const satiConfig = ConfigManager.getInstance().getSatiConfig();
      if (!satiConfig) return;

      // Use the main provider factory to get an agent (Reusing Zion configuration)
      // We pass empty tools as Sati is a pure reasoning agent here
      const agent = await ProviderFactory.create(satiConfig, []);

      // Get existing memories for context (Simulated "Working Memory" or full list if small)
      const allMemories = this.repository.getAllMemories();

      // Map conversation to strict types and sanitize
      const recentConversation = conversation.map(c => ({
        role: (c.role === 'human' ? 'user' : c.role) as 'user' | 'assistant',
        content: c.content
      }));

      const inputPayload: ISatiEvaluationInput = {
        recent_conversation: recentConversation,
        existing_memories: allMemories.map(m => ({
          id: m.id,
          category: m.category,
          importance: m.importance,
          summary: m.summary
        }))
      };

      const messages = [
        new SystemMessage(SATI_EVALUATION_PROMPT),
        new HumanMessage(JSON.stringify(inputPayload, null, 2))
      ];

      const satiSessionId = userSessionId ? `sati-evaluation-${userSessionId}` : 'sati-evaluation';
      const history = new SQLiteChatMessageHistory({ sessionId: satiSessionId });

      try {
        const inputMsg = new ToolMessage({
          content: JSON.stringify(inputPayload, null, 2),
          tool_call_id: `sati-input-${Date.now()}`,
          name: 'sati_evaluation_input'
        });

        (inputMsg as any).provider_metadata = {
          provider: satiConfig.provider,
          model: satiConfig.model
        };

        await history.addMessage(inputMsg);
      } catch (e) {
        console.warn('[SatiService] Failed to persist input log:', e);
      }

      const satiStartMs = Date.now();
      const response = await agent.invoke({ messages });
      const satiDurationMs = Date.now() - satiStartMs;

      const lastMessage = response.messages[response.messages.length - 1];
      let content = lastMessage.content.toString();

      // Emit audit event for Sati's LLM call
      try {
        const rawUsage = (lastMessage as any).usage_metadata
          ?? (lastMessage as any).response_metadata?.usage
          ?? (lastMessage as any).usage;
        AuditRepository.getInstance().insert({
          session_id: userSessionId ?? 'sati-evaluation',
          event_type: 'llm_call',
          agent: 'sati',
          provider: satiConfig.provider,
          model: satiConfig.model,
          input_tokens: rawUsage?.input_tokens ?? rawUsage?.prompt_tokens ?? 0,
          output_tokens: rawUsage?.output_tokens ?? rawUsage?.completion_tokens ?? 0,
          duration_ms: satiDurationMs,
          status: 'success',
        });
      } catch { /* non-critical */ }

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
          provider: satiConfig.provider,
          model: satiConfig.model
        };

        await history.addMessage(outputToolMsg);
      } catch (e) {
        console.warn('[SatiService] Failed to persist output log:', e);
      }

      // Safe JSON parsing (handle markdown blocks if LLM wraps output)
      content = content.replace(/```json/g, '').replace(/```/g, '').trim();

      let result: ISatiEvaluationResult = { inclusions: [], edits: [], deletions: [] };
      try {
        result = JSON.parse(content);
      } catch (e) {
        console.warn('[SatiService] Failed to parse JSON response:', content);
        return;
      }

      const embeddingService = await EmbeddingService.getInstance();

      // Process inclusions (new memories)
      for (const item of (result.inclusions ?? [])) {
        if (item.summary && item.category && item.importance) {
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

            const textForEmbedding = [savedMemory.summary, savedMemory.details ?? ''].join(' ');
            const embedding = await embeddingService.generate(textForEmbedding);
            display.log(`Generated embedding for memory ID ${savedMemory.id}`, { source: 'Sati', level: 'debug' });
            this.repository.upsertEmbedding(savedMemory.id, embedding);
          } catch (saveError: any) {
            if (saveError.message && saveError.message.includes('UNIQUE constraint failed')) {
              // Duplicate detected by DB (hash collision) — expected
            } else {
              throw saveError;
            }
          }
        }
      }

      // Process edits (update existing memories)
      for (const edit of (result.edits ?? [])) {
        if (!edit.id) continue;
        const updated = this.repository.update(edit.id, {
          importance: edit.importance,
          summary: edit.summary,
          details: edit.details,
        });
        if (updated) {
          display.log(`Updated memory ${edit.id}: ${edit.reason ?? ''}`, { source: 'Sati' });
          if (edit.summary || edit.details) {
            const text = [updated.summary, updated.details ?? ''].join(' ');
            const embedding = await embeddingService.generate(text);
            this.repository.upsertEmbedding(updated.id, embedding);
          }
        } else {
          display.log(`Edit skipped — memory not found: ${edit.id}`, { source: 'Sati', level: 'warning' });
        }
      }

      // Process deletions (archive memories)
      for (const deletion of (result.deletions ?? [])) {
        if (!deletion.id) continue;
        const archived = this.repository.archiveMemory(deletion.id);
        if (archived) {
          display.log(`Archived memory ${deletion.id}: ${deletion.reason ?? ''}`, { source: 'Sati' });
        } else {
          display.log(`Deletion skipped — memory not found: ${deletion.id}`, { source: 'Sati', level: 'warning' });
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
