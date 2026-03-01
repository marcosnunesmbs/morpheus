import { AIMessage, BaseMessage, SystemMessage, FunctionMessage } from "@langchain/core/messages";
import { SatiService } from "./service.js";
import { DisplayManager } from "../../display.js";
import { AuditRepository } from "../../audit/repository.js";

const display = DisplayManager.getInstance();

export class SatiMemoryMiddleware {
    private service: SatiService;
    private static instance: SatiMemoryMiddleware;
    
    private constructor() {
        this.service = SatiService.getInstance();
    }

    public static getInstance(): SatiMemoryMiddleware {
        if (!SatiMemoryMiddleware.instance) {
            SatiMemoryMiddleware.instance = new SatiMemoryMiddleware();
        }
        return SatiMemoryMiddleware.instance;
    }

    async beforeAgent(currentMessage: string, history: BaseMessage[], sessionId?: string): Promise<AIMessage | null> {
        const startMs = Date.now();
        try {
            // Extract recent messages content strings for context
            const recentText = history.slice(-10).map(m => m.content.toString());

            display.log(`Searching memories for: "${currentMessage.substring(0, 50)}${currentMessage.length > 50 ? '...' : ''}"`, { source: 'Sati' });

            const result = await this.service.recover(currentMessage, recentText);
            const durationMs = Date.now() - startMs;

            AuditRepository.getInstance().insert({
                session_id: sessionId ?? 'sati-recovery',
                event_type: 'memory_recovery',
                agent: 'sati',
                duration_ms: durationMs,
                status: 'success',
                metadata: {
                    memories_count: result.relevant_memories.length,
                    memories: result.relevant_memories.map(m => ({ category: m.category, importance: m.importance, summary: m.summary })),
                },
            });

            if (result.relevant_memories.length === 0) {
                display.log('No relevant memories found', { source: 'Sati' });
                return null;
            }

            const memoryContext = result.relevant_memories
                .map(m => `- [${m.category.toUpperCase()}] ${m.summary}`)
                .join('\n');

            display.log(`Retrieved ${result.relevant_memories.length} memories.`, { source: 'Sati' });

            return new AIMessage(`
                ### LONG-TERM MEMORY (SATI)
                The following information was retrieved from previous sessions. Use it if relevant:

                ${memoryContext}
            `);
        } catch (error) {
            AuditRepository.getInstance().insert({
                session_id: sessionId ?? 'sati-recovery',
                event_type: 'memory_recovery',
                agent: 'sati',
                duration_ms: Date.now() - startMs,
                status: 'error',
            });
            display.log(`Error in beforeAgent: ${error}`, { source: 'Sati' });
            // Fail open: return null so execution continues without memory
            return null;
        }
    }

    async afterAgent(generatedResponse: string, history: BaseMessage[], userSessionId?: string): Promise<void> {
        try {
             await this.service.evaluateAndPersist([
                ...history.slice(-5).map(m => ({
                    role: m._getType() === 'human' ? 'user' : 'assistant',
                    content: m.content.toString()
                })),
                { role: 'assistant', content: generatedResponse }
             ], userSessionId);
        } catch (error) {
            display.log(`Error in afterAgent: ${error}`, { source: 'Sati' });
        }
    }
}
