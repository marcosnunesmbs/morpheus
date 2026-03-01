import { tool } from "@langchain/core/tools";
import type { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskRepository } from "../tasks/repository.js";
import { TaskRequestContext } from "../tasks/context.js";
import { compositeDelegationError, isLikelyCompositeDelegationTask } from "./delegation-guard.js";
import { DisplayManager } from "../display.js";
import { ChannelRegistry } from "../../channels/registry.js";
import { AuditRepository } from "../audit/repository.js";
import type { TaskAgent } from "../tasks/types.js";
import type { AuditAgent } from "../audit/types.js";
import type { AgentResult } from "../tasks/types.js";

export interface DelegationToolOptions {
  name: string;
  description: string | (() => string);
  /** Key used for deduplication (e.g. 'apoc', 'neo', 'trinit') */
  agentKey: TaskAgent;
  /** Display label for log messages (e.g. 'Apoc', 'Neo', 'Trinity') */
  agentLabel: string;
  auditAgent: AuditAgent;
  isSync: () => boolean;
  notifyText: string;
  executeSync: (
    task: string,
    context: string | undefined,
    sessionId: string,
    ctx: ReturnType<typeof TaskRequestContext.get>,
  ) => Promise<AgentResult>;
}

/**
 * Factory that builds a delegation StructuredTool for Apoc/Neo/Trinity.
 * Handles: composite guard, sync branch (notify→execute→audit→increment),
 * async branch (dedup→canEnqueue→createTask→setAck).
 */
export function buildDelegationTool(opts: DelegationToolOptions): StructuredTool {
  const {
    name,
    agentKey,
    agentLabel,
    auditAgent,
    isSync,
    notifyText,
    executeSync,
  } = opts;

  const toolInstance = tool(
    async ({ task, context }: { task: string; context?: string }) => {
      const display = DisplayManager.getInstance();
      const source = `${agentLabel}DelegateTool`;

      try {
        if (isLikelyCompositeDelegationTask(task)) {
          display.log(`${agentLabel} delegation rejected (non-atomic task): ${task.slice(0, 140)}`, {
            source,
            level: "warning",
          });
          return compositeDelegationError();
        }

        // ── Sync mode: execute inline and return result directly ──
        if (isSync()) {
          display.log(`${agentLabel} executing synchronously: ${task.slice(0, 80)}...`, {
            source,
            level: "info",
          });

          const ctx = TaskRequestContext.get();
          const sessionId = ctx?.session_id ?? "default";

          if (ctx?.origin_channel && ctx.origin_user_id && ctx.origin_channel !== 'api' && ctx.origin_channel !== 'ui') {
            ChannelRegistry.sendToUser(ctx.origin_channel, ctx.origin_user_id, notifyText)
              .catch(() => {});
          }

          try {
            const result = await executeSync(task, context, sessionId, ctx);

            TaskRequestContext.incrementSyncDelegation();

            display.log(`${agentLabel} sync execution completed.`, { source, level: "info" });

            if (result.usage) {
              AuditRepository.getInstance().insert({
                session_id: sessionId,
                event_type: 'llm_call',
                agent: auditAgent,
                provider: result.usage.provider,
                model: result.usage.model,
                input_tokens: result.usage.inputTokens,
                output_tokens: result.usage.outputTokens,
                duration_ms: result.usage.durationMs,
                status: 'success',
                metadata: { step_count: result.usage.stepCount, mode: 'sync' },
              });
            }

            return result.output;
          } catch (syncErr: any) {
            TaskRequestContext.incrementSyncDelegation();
            display.log(`${agentLabel} sync execution failed: ${syncErr.message}`, { source, level: "error" });
            return `❌ ${agentLabel} error: ${syncErr.message}`;
          }
        }

        // ── Async mode (default): create background task ──
        const existingAck = TaskRequestContext.findDuplicateDelegation(agentKey, task);
        if (existingAck) {
          display.log(`${agentLabel} delegation deduplicated. Reusing task ${existingAck.task_id}.`, {
            source,
            level: "info",
          });
          return `Task ${existingAck.task_id} already queued for ${existingAck.agent} execution.`;
        }

        if (!TaskRequestContext.canEnqueueDelegation()) {
          display.log(`${agentLabel} delegation blocked by per-turn limit.`, { source, level: "warning" });
          return "Delegation limit reached for this user turn. Split the request or wait for current tasks.";
        }

        const ctx = TaskRequestContext.get();
        const repository = TaskRepository.getInstance();
        const created = repository.createTask({
          agent: agentKey,
          input: task,
          context: context ?? null,
          origin_channel: ctx?.origin_channel ?? "api",
          session_id: ctx?.session_id ?? "default",
          origin_message_id: ctx?.origin_message_id ?? null,
          origin_user_id: ctx?.origin_user_id ?? null,
          max_attempts: 3,
        });

        TaskRequestContext.setDelegationAck({ task_id: created.id, agent: agentKey, task });

        display.log(`${agentLabel} task created: ${created.id}`, {
          source,
          level: "info",
          meta: {
            agent: created.agent,
            origin_channel: created.origin_channel,
            session_id: created.session_id,
            input: created.input,
          },
        });

        return `Task ${created.id} queued for ${agentLabel} execution.`;
      } catch (err: any) {
        display.log(`${source} error: ${err.message}`, { source, level: "error" });
        return `${agentLabel} task enqueue failed: ${err.message}`;
      }
    },
    {
      name,
      description: typeof opts.description === 'string' ? opts.description : opts.description(),
      schema: z.object({
        task: z.string().describe(`Clear task description **in the user's language**`),
        context: z.string().optional().describe(`Optional context from the conversation **in the user's language**`),
      }),
    }
  );

  // If description is dynamic, expose an updater method on the tool instance
  if (typeof opts.description === 'function') {
    (toolInstance as any)._descriptionFn = opts.description;
  }

  return toolInstance;
}
