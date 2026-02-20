import { tool } from "@langchain/core/tools";
import type { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskRepository } from "../tasks/repository.js";
import { TaskRequestContext } from "../tasks/context.js";

const NEO_BASE_DESCRIPTION = `Delegate execution to Neo asynchronously.

This tool creates a background task and returns an acknowledgement with task id.
Use it for requests that require tools, MCPs, filesystem, shell, git, web research,
or external/stateful verification.`;

function normalizeDescription(text: string | undefined): string {
  if (!text) return "No description";
  return text.replace(/\s+/g, " ").trim();
}

function buildCatalogSection(tools: StructuredTool[]): string {
  if (tools.length === 0) {
    return "\n\nNeo tool catalog: no tools currently loaded.";
  }

  const maxItems = 32;
  const lines = tools.slice(0, maxItems).map((t) => {
    const desc = normalizeDescription(t.description).slice(0, 120);
    return `- ${t.name}: ${desc}`;
  });
  const hidden = tools.length - lines.length;
  if (hidden > 0) {
    lines.push(`- ... and ${hidden} more tools`);
  }

  return `\n\nNeo tool catalog (runtime loaded):\n${lines.join("\n")}`;
}

export function updateNeoDelegateToolDescription(tools: StructuredTool[]): void {
  const full = `${NEO_BASE_DESCRIPTION}${buildCatalogSection(tools)}`;
  (NeoDelegateTool as any).description = full;
}

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
    description: NEO_BASE_DESCRIPTION,
    schema: z.object({
      task: z.string().describe("Clear task objective for Neo to execute **in the user's language**"),
      context: z.string().optional().describe("Optional context from conversation **in the user's language**"),
    }),
  }
);
