import { AIMessage, BaseMessage, ToolMessage } from "@langchain/core/messages";
import { SQLiteChatMessageHistory } from "../memory/sqlite.js";
import type { LLMConfig } from "../../types/config.js";
import type { AgentResult } from "../tasks/types.js";
import { AuditRepository } from "../audit/repository.js";
import type { AuditAgent, AuditEventType } from "../audit/types.js";

export interface RawUsage {
  input_tokens?: number;
  prompt_tokens?: number;
  output_tokens?: number;
  completion_tokens?: number;
  [key: string]: any;
}

/** Extract token usage from a LangChain message using 4-fallback chain. */
export function extractRawUsage(lastMessage: BaseMessage): RawUsage | undefined {
  return (lastMessage as any).usage_metadata
    ?? (lastMessage as any).response_metadata?.usage
    ?? (lastMessage as any).response_metadata?.tokenUsage
    ?? (lastMessage as any).usage;
}

/**
 * Sum token usage from all messages in a sequence (e.g. ReactAgent multi-step loop).
 */
export function sumRawUsage(messages: BaseMessage[]): RawUsage {
  const total: RawUsage = { input_tokens: 0, output_tokens: 0 };
  for (const msg of messages) {
    if (msg instanceof AIMessage || (msg as any).usage_metadata || (msg as any).response_metadata?.usage) {
      const usage = extractRawUsage(msg);
      if (usage) {
        total.input_tokens = (total.input_tokens || 0) + (usage.input_tokens ?? usage.prompt_tokens ?? 0);
        total.output_tokens = (total.output_tokens || 0) + (usage.output_tokens ?? usage.completion_tokens ?? 0);
      }
    }
  }
  return total;
}

/** Persist an agent's AI message to SQLite with provider + agent metadata. */
export async function persistAgentMessage(
  agentName: string,
  content: string,
  config: Pick<LLMConfig, 'provider' | 'model'>,
  sessionId: string,
  rawUsage: RawUsage | undefined,
  durationMs: number,
): Promise<void> {
  const history = new SQLiteChatMessageHistory({ sessionId });
  try {
    const persisted = new AIMessage(content);
    if (rawUsage) (persisted as any).usage_metadata = rawUsage;
    (persisted as any).provider_metadata = { provider: config.provider, model: config.model };
    (persisted as any).agent_metadata = { agent: agentName };
    (persisted as any).duration_ms = durationMs;
    await history.addMessage(persisted);
  } finally {
    history.close();
  }
}

/**
 * Emit audit events for each tool call found in the given messages.
 * Scans AIMessage.tool_calls and matches results from ToolMessage instances.
 * - defaultEventType: 'tool_call' for DevKit/internal, 'mcp_tool' for MCP tools (default: 'tool_call')
 * - skipTools: tool names to ignore entirely (e.g. delegation tools already audited elsewhere)
 * - internalToolNames: tool names that should always use 'tool_call' even when defaultEventType is 'mcp_tool'
 */
export function emitToolAuditEvents(
  messages: BaseMessage[],
  sessionId: string,
  agent: AuditAgent,
  opts?: {
    defaultEventType?: AuditEventType;
    skipTools?: Set<string>;
    internalToolNames?: Set<string>;
  },
): void {
  try {
    const defaultEventType = opts?.defaultEventType ?? 'tool_call';
    const skipTools = opts?.skipTools;
    const internalToolNames = opts?.internalToolNames;

    const toolResults = new Map<string, string>();
    for (const msg of messages) {
      if (msg instanceof ToolMessage) {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        toolResults.set((msg as any).tool_call_id, content);
      }
    }

    for (const msg of messages) {
      if (!(msg instanceof AIMessage)) continue;
      const toolCalls: any[] = (msg as any).tool_calls ?? [];
      for (const tc of toolCalls) {
        if (!tc?.name) continue;
        if (skipTools?.has(tc.name)) continue;
        const result = tc.id ? toolResults.get(tc.id) : undefined;
        const isError = typeof result === 'string' && /^error:/i.test(result.trim());
        const eventType: AuditEventType | undefined = internalToolNames?.has(tc.name) ? 'tool_call' : defaultEventType;
        if (!eventType) continue; // no event type assigned — caller opted out for this tool
        const meta: Record<string, unknown> = {};
        if (tc.args && Object.keys(tc.args).length > 0) meta.args = tc.args;
        if (result !== undefined) meta.result = result.length > 500 ? result.slice(0, 500) + '…' : result;
        AuditRepository.getInstance().insert({
          session_id: sessionId,
          event_type: eventType,
          agent,
          tool_name: tc.name,
          status: isError ? 'error' : 'success',
          metadata: Object.keys(meta).length > 0 ? meta : undefined,
        });
      }
    }
  } catch { /* non-critical */ }
}

/** Assemble an AgentResult from extracted usage data. */
export function buildAgentResult(
  content: string,
  config: Pick<LLMConfig, 'provider' | 'model'>,
  rawUsage: RawUsage | undefined,
  durationMs: number,
  stepCount: number,
): AgentResult {
  return {
    output: content,
    usage: {
      provider: config.provider,
      model: config.model,
      inputTokens: rawUsage?.input_tokens ?? rawUsage?.prompt_tokens ?? 0,
      outputTokens: rawUsage?.output_tokens ?? rawUsage?.completion_tokens ?? 0,
      durationMs,
      stepCount,
    },
  };
}
