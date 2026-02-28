import { tool } from "@langchain/core/tools";
import type { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskRepository } from "../tasks/repository.js";
import { TaskRequestContext } from "../tasks/context.js";
import { compositeDelegationError, isLikelyCompositeDelegationTask } from "./delegation-guard.js";
import { DisplayManager } from "../display.js";
import { ConfigManager } from "../../config/manager.js";
import { Neo } from "../neo.js";
import { ChannelRegistry } from "../../channels/registry.js";
import { AuditRepository } from "../audit/repository.js";

const NEO_BUILTIN_CAPABILITIES = `
Neo built-in capabilities (always available — no MCP required):
• Config: morpheus_config_query, morpheus_config_update — read/write Morpheus configuration (LLM, channels, UI, etc.)
• Diagnostics: diagnostic_check — full system health report (config, databases, LLM provider, logs)
• Analytics: message_count, token_usage, provider_model_usage — message counts and token/cost usage stats
• Tasks: task_query — look up task status by id or session
• MCP Management: mcp_list, mcp_manage — list/add/update/delete/enable/disable MCP servers; use action "reload" to reload tools across all agents after config changes
• Webhooks: webhook_list, webhook_manage — create/update/delete webhooks; create returns api_key`.trim();

const NEO_BASE_DESCRIPTION = `Delegate execution to Neo asynchronously.

This tool creates a background task and returns an acknowledgement with task id.
Use it for any request that requires Neo's built-in capabilities or a runtime MCP tool listed below.
Each delegated task must contain one atomic objective.

${NEO_BUILTIN_CAPABILITIES}`;

function normalizeDescription(text: string | undefined): string {
  if (!text) return "No description";
  return text.replace(/\s+/g, " ").trim();
}

function buildCatalogSection(mcpTools: StructuredTool[]): string {
  if (mcpTools.length === 0) {
    return "\n\nRuntime MCP tools: none currently loaded.";
  }

  const maxItems = 500;
  const lines = mcpTools.slice(0, maxItems).map((t) => {
    const desc = normalizeDescription(t.description).slice(0, 120);
    return `- ${t.name}: ${desc}`;
  });
  const hidden = mcpTools.length - lines.length;
  if (hidden > 0) {
    lines.push(`- ... and ${hidden} more tools`);
  }

  return `\n\nRuntime MCP tools:\n${lines.join("\n")}`;
}

/**
 * Returns true when Neo is configured to execute synchronously (inline).
 */
function isNeoSync(): boolean {
  const config = ConfigManager.getInstance().get();
  return config.neo?.execution_mode === 'sync';
}

export function updateNeoDelegateToolDescription(tools: StructuredTool[]): void {
  const full = `${NEO_BASE_DESCRIPTION}${buildCatalogSection(tools)}`;
  (NeoDelegateTool as any).description = full;
}

export const NeoDelegateTool = tool(
  async ({ task, context }: { task: string; context?: string }) => {
    try {
      const display = DisplayManager.getInstance();

      if (isLikelyCompositeDelegationTask(task)) {
        display.log(`Neo delegation rejected (non-atomic task): ${task.slice(0, 140)}`, {
          source: "NeoDelegateTool",
          level: "warning",
        });
        return compositeDelegationError();
      }

      // ── Sync mode: execute inline and return result directly ──
      if (isNeoSync()) {
        display.log(`Neo executing synchronously: ${task.slice(0, 80)}...`, {
          source: "NeoDelegateTool",
          level: "info",
        });

        const ctx = TaskRequestContext.get();
        const sessionId = ctx?.session_id ?? "default";

        // Notify originating channel that the agent is working
        if (ctx?.origin_channel && ctx.origin_user_id && ctx.origin_channel !== 'api' && ctx.origin_channel !== 'ui') {
          ChannelRegistry.sendToUser(ctx.origin_channel, ctx.origin_user_id, '🥷 Neo is executing your request...')
            .catch(() => {});
        }

        try {
          const neo = Neo.getInstance();
          const result = await neo.execute(task, context, sessionId, {
            origin_channel: ctx?.origin_channel ?? "api",
            session_id: sessionId,
            origin_message_id: ctx?.origin_message_id,
            origin_user_id: ctx?.origin_user_id,
          });

          TaskRequestContext.incrementSyncDelegation();

          display.log(`Neo sync execution completed.`, {
            source: "NeoDelegateTool",
            level: "info",
          });

          if (result.usage) {
            AuditRepository.getInstance().insert({
              session_id: sessionId,
              event_type: 'llm_call',
              agent: 'neo',
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
          // Still count as sync delegation so Oracle passes through the error message
          TaskRequestContext.incrementSyncDelegation();
          display.log(`Neo sync execution failed: ${syncErr.message}`, {
            source: "NeoDelegateTool",
            level: "error",
          });
          return `❌ Neo error: ${syncErr.message}`;
        }
      }

      // ── Async mode (default): create background task ──
      const existingAck = TaskRequestContext.findDuplicateDelegation("neo", task);
      if (existingAck) {
        display.log(`Neo delegation deduplicated. Reusing task ${existingAck.task_id}.`, {
          source: "NeoDelegateTool",
          level: "info",
        });
        return `Task ${existingAck.task_id} already queued for ${existingAck.agent} execution.`;
      }
      if (!TaskRequestContext.canEnqueueDelegation()) {
        display.log(`Neo delegation blocked by per-turn limit.`, {
          source: "NeoDelegateTool",
          level: "warning",
        });
        return "Delegation limit reached for this user turn. Split the request or wait for current tasks.";
      }

      const ctx = TaskRequestContext.get();
      const repository = TaskRepository.getInstance();
      const created = repository.createTask({
        agent: "neo",
        input: task,
        context: context ?? null,
        origin_channel: ctx?.origin_channel ?? "api",
        session_id: ctx?.session_id ?? "default",
        origin_message_id: ctx?.origin_message_id ?? null,
        origin_user_id: ctx?.origin_user_id ?? null,
        max_attempts: 3,
      });
      TaskRequestContext.setDelegationAck({ task_id: created.id, agent: "neo", task });
      display.log(`Neo task created: ${created.id}`, {
        source: "NeoDelegateTool",
        level: "info",
        meta: {
          agent: created.agent,
          origin_channel: created.origin_channel,
          session_id: created.session_id,
          input: created.input,
        }
      });
      return `Task ${created.id} queued for Neo execution.`;
    } catch (err: any) {
      const display = DisplayManager.getInstance();
      display.log(`NeoDelegateTool error: ${err.message}`, { source: "NeoDelegateTool", level: "error" });
      return `Neo task enqueue failed: ${err.message}`;
    }
  },
  {
    name: "neo_delegate",
    description: NEO_BASE_DESCRIPTION,
    schema: z.object({
      task: z.string().describe("Clear task objective for Neo to execute **in the user's language**"),
      context: z.string().optional().describe("Optional context from conversation **in the user's language**"),
    }),
  }
);
