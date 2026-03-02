import type { StructuredTool } from '@langchain/core/tools';
import { AuditRepository } from './audit/repository.js';

/**
 * Wraps a StructuredTool to record audit events on each invocation.
 * The `getSessionId` getter is called at invocation time so it reflects
 * the current agent's session (not the session at build time).
 */
function instrumentTool(tool: StructuredTool, getSessionId: () => string | undefined, getAgent: () => string): StructuredTool {
  const original = (tool as any)._call.bind(tool);
  (tool as any)._call = async function(input: any, runManager?: any) {
    const startMs = Date.now();
    const sessionId = getSessionId() ?? 'unknown';
    const agent = getAgent();
    try {
      const result = await original(input, runManager);
      const durationMs = Date.now() - startMs;
      AuditRepository.getInstance().insert({
        session_id: sessionId,
        event_type: 'tool_call',
        agent: agent as any,
        tool_name: tool.name,
        duration_ms: durationMs,
        status: 'success',
      });
      return result;
    } catch (err: any) {
      const durationMs = Date.now() - startMs;
      AuditRepository.getInstance().insert({
        session_id: sessionId,
        event_type: 'tool_call',
        agent: agent as any,
        tool_name: tool.name,
        duration_ms: durationMs,
        status: 'error',
        metadata: { error: err?.message ?? String(err) },
      });
      throw err;
    }
  };
  return tool;
}

/**
 * Wraps all DevKit tools with audit instrumentation.
 * Call this after buildDevKit() to add Morpheus audit tracking.
 */
export function instrumentDevKitTools(
  tools: StructuredTool[],
  getSessionId: () => string | undefined,
  getAgent: () => string,
): StructuredTool[] {
  return tools.map(tool => instrumentTool(tool, getSessionId, getAgent));
}
