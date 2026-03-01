import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { SQLiteChatMessageHistory } from "./memory/sqlite.js";
import type { LLMConfig } from "../types/config.js";
import type { AgentResult } from "./tasks/types.js";

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
