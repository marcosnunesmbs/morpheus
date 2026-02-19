import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskRepository } from "../tasks/repository.js";
import { TaskRequestContext } from "../tasks/context.js";

export const NeoDelegateTool = tool(
  async ({ task, context }: { task: string; context?: string }) => {
    try {
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
      return `Task ${created.id} queued for Neo execution.`;
    } catch (err: any) {
      return `Neo task enqueue failed: ${err.message}`;
    }
  },
  {
    name: "neo_delegate",
    description: `Delegate execution to Neo asynchronously.

This tool creates a background task and returns an acknowledgement with task id.
Use it for any request that requires tools, MCPs, filesystem, shell, git, web research,
or external/stateful verification.`,
    schema: z.object({
      task: z.string().describe("Clear task objective for Neo to execute **in the user's language**"),
      context: z.string().optional().describe("Optional context from conversation **in the user's language**"),
    }),
  }
);
