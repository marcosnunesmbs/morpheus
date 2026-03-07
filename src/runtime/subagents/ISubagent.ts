import type { StructuredTool } from "@langchain/core/tools";
import type { OracleTaskContext, AgentResult } from "../tasks/types.js";

/**
 * Shared interface for all singleton subagents (Apoc, Neo, Trinity).
 *
 * Static contract (by convention — TypeScript cannot enforce statics on interfaces):
 *   static getInstance(config?: MorpheusConfig): T
 *   static resetInstance(): void
 *   static setSessionId(sessionId: string | undefined): void
 */
export interface ISubagent {
  initialize(): Promise<void>;
  execute(
    task: string,
    context?: string,
    sessionId?: string,
    taskContext?: OracleTaskContext,
  ): Promise<AgentResult>;
  reload(): Promise<void>;
  createDelegateTool(): StructuredTool;
}
