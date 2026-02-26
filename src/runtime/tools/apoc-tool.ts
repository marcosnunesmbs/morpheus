import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskRepository } from "../tasks/repository.js";
import { TaskRequestContext } from "../tasks/context.js";
import { compositeDelegationError, isLikelyCompositeDelegationTask } from "./delegation-guard.js";
import { DisplayManager } from "../display.js";
import { ConfigManager } from "../../config/manager.js";
import { Apoc } from "../apoc.js";

/**
 * Returns true when Apoc is configured to execute synchronously (inline).
 */
function isApocSync(): boolean {
  const config = ConfigManager.getInstance().get();
  return config.apoc?.execution_mode === 'sync';
}

/**
 * Tool that Oracle uses to delegate devtools tasks to Apoc.
 * Oracle should call this whenever the user requests operations like:
 * - Reading/writing/listing files
 * - Running shell commands or scripts
 * - Git operations (status, log, commit, push, etc.)
 * - Package management (npm install, etc.)
 * - Process inspection or management
 * - Network diagnostics (ping, curl, DNS)
 * - System information queries
 */
export const ApocDelegateTool = tool(
  async ({ task, context }: { task: string; context?: string }) => {
    try {
      const display = DisplayManager.getInstance();

      if (isLikelyCompositeDelegationTask(task)) {
        display.log(`Apoc delegation rejected (non-atomic task): ${task.slice(0, 140)}`, {
          source: "ApocDelegateTool",
          level: "warning",
        });
        return compositeDelegationError();
      }

      // ── Sync mode: execute inline and return result directly ──
      if (isApocSync()) {
        display.log(`Apoc executing synchronously: ${task.slice(0, 80)}...`, {
          source: "ApocDelegateTool",
          level: "info",
        });

        const ctx = TaskRequestContext.get();
        const sessionId = ctx?.session_id ?? "default";
        const apoc = Apoc.getInstance();
        const result = await apoc.execute(task, context, sessionId);

        TaskRequestContext.incrementSyncDelegation();

        display.log(`Apoc sync execution completed.`, {
          source: "ApocDelegateTool",
          level: "info",
        });

        return result;
      }

      // ── Async mode (default): create background task ──
      const existingAck = TaskRequestContext.findDuplicateDelegation("apoc", task);
      if (existingAck) {
        display.log(`Apoc delegation deduplicated. Reusing task ${existingAck.task_id}.`, {
          source: "ApocDelegateTool",
          level: "info",
        });
        return `Task ${existingAck.task_id} already queued for ${existingAck.agent} execution.`;
      }
      if (!TaskRequestContext.canEnqueueDelegation()) {
        display.log(`Apoc delegation blocked by per-turn limit.`, {
          source: "ApocDelegateTool",
          level: "warning",
        });
        return "Delegation limit reached for this user turn. Split the request or wait for current tasks.";
      }

      const ctx = TaskRequestContext.get();
      const repository = TaskRepository.getInstance();
      const created = repository.createTask({
        agent: "apoc",
        input: task,
        context: context ?? null,
        origin_channel: ctx?.origin_channel ?? "api",
        session_id: ctx?.session_id ?? "default",
        origin_message_id: ctx?.origin_message_id ?? null,
        origin_user_id: ctx?.origin_user_id ?? null,
        max_attempts: 3,
      });
      TaskRequestContext.setDelegationAck({ task_id: created.id, agent: "apoc", task });
      display.log(`Apoc task created: ${created.id}`, {
        source: "ApocDelegateTool",
        level: "info",
        meta: {
          agent: created.agent,
          origin_channel: created.origin_channel,
          session_id: created.session_id,
          input: created.input,
        }
      });
      return `Task ${created.id} queued for Apoc execution.`;
    } catch (err: any) {
      const display = DisplayManager.getInstance();
      display.log(`ApocDelegateTool error: ${err.message}`, { source: "ApocDelegateTool", level: "error" });
      return `Apoc task enqueue failed: ${err.message}`;
    }
  },
  {
    name: "apoc_delegate",
    description: `Delegate a devtools task to Apoc, the specialized development subagent.

This tool enqueues a background task and returns an acknowledgement with task id.
Do not expect final execution output in the same response.
Each task must contain a single atomic action with a clear expected result.

Use this tool when the user asks for ANY of the following:
- File operations: read, write, create, delete files or directories
- Shell commands: run scripts, execute commands, check output
- Git: status, log, diff, commit, push, pull, clone, branch
- Package management: npm install/update/audit, yarn, package.json inspection
- Process management: list processes, kill processes, check ports
- Network: ping hosts, curl URLs, DNS lookups
- System info: environment variables, OS info, disk space, memory
- Internet search: search DuckDuckGo and verify facts by reading at least 3 sources via browser_navigate before reporting results.
- Browser automation: navigate websites (JS/SPA), inspect DOM, click elements, fill forms. Apoc will ask for missing user input (e.g. credentials, form fields) before proceeding.

Provide a clear natural language task description. Optionally provide context
from the current conversation to help Apoc understand the broader goal.`,
    schema: z.object({
      task: z.string().describe("Clear description of the devtools task to execute **in the user's language**"),
      context: z.string().optional().describe("Optional context from the conversation to help Apoc understand the goal **in the user's language**"),
    }),
  }
);
