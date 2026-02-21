import { tool } from "@langchain/core/tools";
import type { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskRepository } from "../tasks/repository.js";
import { TaskRequestContext } from "../tasks/context.js";
import { compositeDelegationError, isLikelyCompositeDelegationTask } from "./delegation-guard.js";
import { DisplayManager } from "../display.js";

const NEO_BUILTIN_CAPABILITIES = `
Neo built-in capabilities (always available — no MCP required):
• Config: morpheus_config_query, morpheus_config_update — read/write Morpheus configuration (LLM, channels, UI, etc.)
• Diagnostics: diagnostic_check — full system health report (config, databases, LLM provider, logs)
• Analytics: message_count, token_usage, provider_model_usage — message counts and token/cost usage stats
• Tasks: task_query — look up task status by id or session
• MCP Management: mcp_list, mcp_manage — list/add/update/delete/enable/disable MCP servers
• Webhooks: webhook_list, webhook_manage — create/update/delete webhooks; create returns api_key
• Trinity DB: trinity_db_list, trinity_db_manage — register/update/delete/test connection/refresh schema for databases`.trim();

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

  const maxItems = 32;
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
