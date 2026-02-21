import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskRepository } from "../tasks/repository.js";
import { TaskRequestContext } from "../tasks/context.js";
import { compositeDelegationError, isLikelyCompositeDelegationTask } from "./delegation-guard.js";
import { DisplayManager } from "../display.js";
import type { DatabaseRecord } from "../memory/trinity-db.js";

const TRINITY_BASE_DESCRIPTION = `Delegate a database task to Trinity, the specialized database subagent, asynchronously.

This tool enqueues a background task and returns an acknowledgement with task id.
Trinity interprets natural language database requests, generates the appropriate query, and returns results.

Use this tool when the user asks for ANY of the following:
- Querying data from a registered database (SELECT, find, aggregate)
- Checking database status or schema
- Running reports or analytics against a database
- Listing tables, collections, or fields
- Counting records or summarizing data`;

function buildDatabaseCatalog(databases: DatabaseRecord[]): string {
  if (databases.length === 0) {
    return '\n\nNo databases currently registered. Register databases via /api/trinity/databases.';
  }

  const lines = databases.map((db) => {
    const schema = db.schema_json ? JSON.parse(db.schema_json) : null;
    const tables = schema?.tables?.map((t: any) => t.name).join(', ') || 'schema not loaded';
    return `- [${db.id}] ${db.name} (${db.type}): ${tables}`;
  });

  return `\n\nRegistered databases:\n${lines.join('\n')}`;
}

export function updateTrinityDelegateToolDescription(databases: DatabaseRecord[]): void {
  const full = `${TRINITY_BASE_DESCRIPTION}${buildDatabaseCatalog(databases)}`;
  (TrinityDelegateTool as any).description = full;
}

export const TrinityDelegateTool = tool(
  async ({ task, context }: { task: string; context?: string }) => {
    try {
      const display = DisplayManager.getInstance();

      if (isLikelyCompositeDelegationTask(task)) {
        display.log(`Trinity delegation rejected (non-atomic task): ${task.slice(0, 140)}`, {
          source: 'TrinityDelegateTool',
          level: 'warning',
        });
        return compositeDelegationError();
      }

      const existingAck = TaskRequestContext.findDuplicateDelegation('trinit', task);
      if (existingAck) {
        display.log(`Trinity delegation deduplicated. Reusing task ${existingAck.task_id}.`, {
          source: 'TrinityDelegateTool',
          level: 'info',
        });
        return `Task ${existingAck.task_id} already queued for ${existingAck.agent} execution.`;
      }

      if (!TaskRequestContext.canEnqueueDelegation()) {
        display.log(`Trinity delegation blocked by per-turn limit.`, {
          source: 'TrinityDelegateTool',
          level: 'warning',
        });
        return 'Delegation limit reached for this user turn. Split the request or wait for current tasks.';
      }

      const ctx = TaskRequestContext.get();
      const repository = TaskRepository.getInstance();
      const created = repository.createTask({
        agent: 'trinit',
        input: task,
        context: context ?? null,
        origin_channel: ctx?.origin_channel ?? 'api',
        session_id: ctx?.session_id ?? 'default',
        origin_message_id: ctx?.origin_message_id ?? null,
        origin_user_id: ctx?.origin_user_id ?? null,
        max_attempts: 3,
      });

      TaskRequestContext.setDelegationAck({ task_id: created.id, agent: 'trinit', task });

      display.log(`Trinity task created: ${created.id}`, {
        source: 'TrinityDelegateTool',
        level: 'info',
        meta: {
          agent: created.agent,
          origin_channel: created.origin_channel,
          session_id: created.session_id,
          input: created.input,
        },
      });

      return `Task ${created.id} queued for Trinity execution.`;
    } catch (err: any) {
      const display = DisplayManager.getInstance();
      display.log(`TrinityDelegateTool error: ${err.message}`, {
        source: 'TrinityDelegateTool',
        level: 'error',
      });
      return `Trinity task enqueue failed: ${err.message}`;
    }
  },
  {
    name: 'trinity_delegate',
    description: TRINITY_BASE_DESCRIPTION,
    schema: z.object({
      task: z.string().describe('Clear description of the database task **in the user\'s language**'),
      context: z.string().optional().describe('Optional context from the conversation to help Trinity understand the goal **in the user\'s language**'),
    }),
  }
);
