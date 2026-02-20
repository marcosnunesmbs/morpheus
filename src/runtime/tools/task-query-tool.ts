import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskRepository } from "../tasks/repository.js";
import { TaskRequestContext } from "../tasks/context.js";
import type { TaskRecord } from "../tasks/types.js";

function toTaskView(task: TaskRecord) {
  return {
    id: task.id,
    agent: task.agent,
    status: task.status,
    input: task.input,
    output: task.output,
    error: task.error,
    session_id: task.session_id,
    origin_channel: task.origin_channel,
    created_at: task.created_at,
    started_at: task.started_at,
    finished_at: task.finished_at,
    updated_at: task.updated_at,
  };
}

export const TaskQueryTool = tool(
  async ({ task_id, limit, session_id, include_completed }) => {
    try {
      const repository = TaskRepository.getInstance();

      if (task_id) {
        const task = repository.getTaskById(task_id);
        if (!task) {
          return JSON.stringify({
            found: false,
            query: { task_id },
            message: "Task not found",
          });
        }

        return JSON.stringify({
          found: true,
          query: { task_id },
          task: toTaskView(task),
        });
      }

      const ctx = TaskRequestContext.get();
      const targetSessionId = session_id ?? ctx?.session_id;
      const requestedLimit = Math.max(1, Math.min(50, limit ?? 10));
      const baseLimit = Math.max(requestedLimit * 5, 50);

      const tasks = repository.listTasks({
        session_id: targetSessionId,
        limit: baseLimit,
      });

      const filtered = tasks.filter((task) => include_completed ? true : task.status !== "completed");
      const latest = filtered.slice(0, requestedLimit);

      return JSON.stringify({
        found: latest.length > 0,
        query: {
          task_id: null,
          limit: requestedLimit,
          session_id: targetSessionId ?? null,
          include_completed: include_completed ?? false,
        },
        count: latest.length,
        tasks: latest.map(toTaskView),
      });
    } catch (error: any) {
      return JSON.stringify({
        found: false,
        error: error?.message ?? String(error),
      });
    }
  },
  {
    name: "task_query",
    description:
      "Query task status directly from database without delegation. Supports lookup by task id, or latest tasks (default: only non-completed) for current session.",
    schema: z.object({
      task_id: z.string().uuid().optional().describe("Specific task id to fetch"),
      limit: z.number().int().min(1).max(50).optional().describe("Max number of tasks to return when task_id is not provided (default: 10)"),
      session_id: z.string().optional().describe("Optional session id filter; if omitted, uses current request session"),
      include_completed: z.boolean().optional().describe("Include completed tasks when listing latest tasks (default: false)"),
    }),
  }
);

