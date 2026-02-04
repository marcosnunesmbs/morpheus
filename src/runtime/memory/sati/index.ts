import { AIMessage, BaseMessage, SystemMessage, FunctionMessage } from "@langchain/core/messages";
import { SatiService } from "./service.js";
import { DisplayManager } from "../../display.js";

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

    async beforeAgent(currentMessage: string, history: BaseMessage[]): Promise<AIMessage | null> {
        try {
            // Extract recent messages content strings for context
            const recentText = history.slice(-10).map(m => m.content.toString());
            
            display.log(`[Sati] Searching memories for: "${currentMessage.substring(0, 50)}${currentMessage.length > 50 ? '...' : ''}"`, { source: 'Sati' });
            
            const result = await this.service.recover(currentMessage, recentText);
            
            if (result.relevant_memories.length === 0) {
                display.log('[Sati] No relevant memories found', { source: 'Sati' });
                return null;
            }
            
            const memoryContext = result.relevant_memories
                .map(m => `- [${m.category.toUpperCase()}] ${m.summary}`)
                .join('\n');

            display.log(`[Sati] Retrieved ${result.relevant_memories.length} memories:\n${memoryContext}`, { source: 'Sati' });
                
            return new AIMessage(`
                ### LONG-TERM MEMORY (SATI)
                The following information was retrieved from previous sessions. Use it if relevant:

                ${memoryContext}
            `);
        } catch (error) {
            display.log(`[SatiMiddleware] Error in beforeAgent: ${error}`, { source: 'Sati' });
            // Fail open: return null so execution continues without memory
            return null;
        }
    }

    async afterAgent(generatedResponse: string, history: BaseMessage[]): Promise<void> {
        try {
            // Phase 4 implementation (T013)
             await this.service.evaluateAndPersist([
                ...history.slice(-5).map(m => ({ 
                    role: m._getType() === 'human' ? 'user' : 'assistant', 
                    content: m.content.toString() 
                })),
                { role: 'assistant', content: generatedResponse }
             ]);
        } catch (error) {
            console.error('[SatiMiddleware] Error in afterAgent:', error);
        }
    }
}
