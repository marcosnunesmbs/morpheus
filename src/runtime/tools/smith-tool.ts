import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskRepository } from "../tasks/repository.js";
import { TaskRequestContext } from "../tasks/context.js";
import { DisplayManager } from "../display.js";
import { ConfigManager } from "../../config/manager.js";
import { SmithDelegator } from "../smiths/delegator.js";
import { SmithRegistry } from "../smiths/registry.js";
import { ChannelRegistry } from "../../channels/registry.js";

/**
 * Returns true when Smiths are configured in sync mode (inline execution).
 */
function isSmithSync(): boolean {
  const config = ConfigManager.getInstance().getSmithsConfig();
  return config.execution_mode === 'sync';
}

/**
 * Tool that Oracle uses to delegate tasks to a remote Smith agent.
 * Each Smith is a DevKit executor running on an external machine.
 * Oracle should call this when the user explicitly requests operations
 * on a remote machine / specific Smith by name.
 */
export const SmithDelegateTool = tool(
  async ({ smith, task, context }: { smith: string; task: string; context?: string }) => {
    try {
      const display = DisplayManager.getInstance();
      const registry = SmithRegistry.getInstance();
      const smithInfo = registry.get(smith);

      if (!smithInfo) {
        const available = registry.list().map(s => `${s.name} (${s.state})`).join(', ');
        return `❌ Smith '${smith}' not found. Available Smiths: ${available || 'none configured'}`;
      }

      if (smithInfo.state !== 'online') {
        return `❌ Smith '${smith}' is currently ${smithInfo.state}. Cannot delegate task.`;
      }

      // ── Sync mode: execute inline and return result ──
      if (isSmithSync()) {
        display.log(`Smith '${smith}' executing synchronously: ${task.slice(0, 80)}...`, {
          source: "SmithDelegateTool",
          level: "info",
        });

        const ctx = TaskRequestContext.get();

        // Notify originating channel
        if (ctx?.origin_channel && ctx.origin_user_id && ctx.origin_channel !== 'api' && ctx.origin_channel !== 'ui') {
          ChannelRegistry.sendToUser(ctx.origin_channel, ctx.origin_user_id, `🤖 Smith '${smith}' is executing your request...`)
            .catch(() => {});
        }

        try {
          const delegator = SmithDelegator.getInstance();
          const result = await delegator.delegate(smith, task, context);

          TaskRequestContext.incrementSyncDelegation();

          display.log(`Smith '${smith}' sync execution completed.`, {
            source: "SmithDelegateTool",
            level: "info",
          });

          return result;
        } catch (syncErr: any) {
          TaskRequestContext.incrementSyncDelegation();
          display.log(`Smith '${smith}' sync execution failed: ${syncErr.message}`, {
            source: "SmithDelegateTool",
            level: "error",
          });
          return `❌ Smith '${smith}' error: ${syncErr.message}`;
        }
      }

      // ── Async mode (default): create background task ──
      const existingAck = TaskRequestContext.findDuplicateDelegation("smith", task);
      if (existingAck) {
        display.log(`Smith delegation deduplicated. Reusing task ${existingAck.task_id}.`, {
          source: "SmithDelegateTool",
          level: "info",
        });
        return `Task ${existingAck.task_id} already queued for Smith '${smith}' execution.`;
      }

      if (!TaskRequestContext.canEnqueueDelegation()) {
        display.log(`Smith delegation blocked by per-turn limit.`, {
          source: "SmithDelegateTool",
          level: "warning",
        });
        return "Delegation limit reached for this user turn. Split the request or wait for current tasks.";
      }

      const ctx = TaskRequestContext.get();
      const repository = TaskRepository.getInstance();
      const created = repository.createTask({
        agent: "smith",
        input: task,
        context: context ? JSON.stringify({ smith_name: smith, context }) : JSON.stringify({ smith_name: smith }),
        origin_channel: ctx?.origin_channel ?? "api",
        session_id: ctx?.session_id ?? "default",
        origin_message_id: ctx?.origin_message_id ?? null,
        origin_user_id: ctx?.origin_user_id ?? null,
        max_attempts: 3,
      });

      TaskRequestContext.setDelegationAck({ task_id: created.id, agent: "smith", task });

      display.log(`Smith task created: ${created.id} → ${smith}`, {
        source: "SmithDelegateTool",
        level: "info",
        meta: {
          agent: "smith",
          smith_name: smith,
          origin_channel: created.origin_channel,
          session_id: created.session_id,
          input: created.input,
        }
      });

      return `Task ${created.id} queued for Smith '${smith}' execution.`;
    } catch (err: any) {
      const display = DisplayManager.getInstance();
      display.log(`SmithDelegateTool error: ${err.message}`, { source: "SmithDelegateTool", level: "error" });
      return `Smith task enqueue failed: ${err.message}`;
    }
  },
  {
    name: "smith_delegate",
    description: `Delegate a task to a remote Smith agent running on an external machine.

Smiths are lightweight DevKit executors deployed on remote servers.
Each Smith can execute filesystem, shell, git, and system commands on its host machine.

Use this tool when the user explicitly asks to run something on a remote machine or mentions a specific Smith by name.

Provide:
- smith: The name of the target Smith (must match a registered Smith)
- task: Clear natural-language description of what to execute on the remote machine
- context: Optional context from the conversation

Available Smiths are listed in the system prompt under "Available Smiths".`,
    schema: z.object({
      smith: z.string().describe("Name of the target Smith agent"),
      task: z.string().describe("Clear description of the task to execute on the remote machine **in the user's language**"),
      context: z.string().optional().describe("Optional context from the conversation"),
    }),
  }
);
