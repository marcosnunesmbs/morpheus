import type { StructuredTool } from '@langchain/core/tools';
import type { ToolContext } from './types.js';
import { AuditRepository } from '../runtime/audit/repository.js';

export type DevKitCategory = 'filesystem' | 'shell' | 'git' | 'network' | 'processes' | 'packages' | 'system' | 'browser';
export type DevKitToolFactory = (ctx: ToolContext) => StructuredTool[];

const factories: { category: DevKitCategory; factory: DevKitToolFactory }[] = [];

export function registerToolFactory(factory: DevKitToolFactory, category: DevKitCategory = 'system'): void {
  factories.push({ category, factory });
}

/** Categories that can be toggled off via DevKit config */
const TOGGLEABLE_CATEGORIES: Record<string, keyof ToolContext> = {
  filesystem: 'enable_filesystem',
  shell: 'enable_shell',
  git: 'enable_git',
  network: 'enable_network',
};

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
 * Builds the full DevKit tool set for a given context.
 * Each factory receives the context (working_dir, allowed_commands, etc.)
 * and returns tools with the context captured in closure.
 * Disabled categories are filtered out based on context flags.
 * All tools are wrapped with audit instrumentation.
 */
export function buildDevKit(ctx: ToolContext & { getSessionId?: () => string | undefined; getAgent?: () => string }): StructuredTool[] {
  const getSessionId = ctx.getSessionId ?? (() => undefined);
  const getAgent = ctx.getAgent ?? (() => 'apoc');
  return factories
    .filter(({ category }) => {
      const ctxKey = TOGGLEABLE_CATEGORIES[category];
      if (!ctxKey) return true; // non-toggleable categories always load
      return (ctx as any)[ctxKey] !== false;
    })
    .flatMap(({ factory }) => factory(ctx))
    .map(tool => instrumentTool(tool, getSessionId, getAgent));
}
