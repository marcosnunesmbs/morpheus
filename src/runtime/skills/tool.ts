import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskRepository } from "../tasks/repository.js";
import { TaskRequestContext } from "../tasks/context.js";
import { DisplayManager } from "../display.js";
import { SkillRegistry } from "./registry.js";

/**
 * Generates the skill_delegate tool description dynamically with
 * the list of available skills.
 */
export function getSkillDelegateDescription(): string {
  const registry = SkillRegistry.getInstance();
  const enabled = registry.getEnabled();
  
  const skillList = enabled.length > 0
    ? enabled.map(s => `- ${s.name}: ${s.description}`).join('\n')
    : '(no skills enabled)';

  return `Delegate a task to Keymaker using a specific skill. Keymaker has access to ALL tools (filesystem, shell, git, MCP, etc.) and will execute the skill instructions to accomplish the objective.

Available skills:
${skillList}

Use this when a user request matches one of the available skills. Provide the skill name exactly as listed and a clear objective for Keymaker to accomplish.`;
}

/**
 * Tool that Oracle uses to delegate tasks to Keymaker via a specific skill.
 * Keymaker will execute the skill instructions using its full toolset.
 */
export const SkillDelegateTool = tool(
  async ({ skillName, objective }: { skillName: string; objective: string }) => {
    try {
      const display = DisplayManager.getInstance();
      const registry = SkillRegistry.getInstance();

      // Validate skill exists and is enabled
      const skill = registry.get(skillName);
      if (!skill) {
        const available = registry.getEnabled().map(s => s.name).join(', ');
        return `Error: Skill "${skillName}" not found. Available skills: ${available || 'none'}`;
      }

      if (!skill.enabled) {
        return `Error: Skill "${skillName}" is disabled.`;
      }

      // Check for duplicate delegation
      const existingAck = TaskRequestContext.findDuplicateDelegation("keymaker", `${skillName}:${objective}`);
      if (existingAck) {
        display.log(`Keymaker delegation deduplicated. Reusing task ${existingAck.task_id}.`, {
          source: "SkillDelegateTool",
          level: "info",
        });
        return `Task ${existingAck.task_id} already queued for Keymaker (${skillName}) execution.`;
      }

      if (!TaskRequestContext.canEnqueueDelegation()) {
        display.log(`Keymaker delegation blocked by per-turn limit.`, {
          source: "SkillDelegateTool",
          level: "warning",
        });
        return "Delegation limit reached for this user turn. Wait for current tasks to complete.";
      }

      const ctx = TaskRequestContext.get();
      const repository = TaskRepository.getInstance();

      // Store skill name in context as JSON
      const taskContext = JSON.stringify({ skill: skillName });

      const created = repository.createTask({
        agent: "keymaker",
        input: objective,
        context: taskContext,
        origin_channel: ctx?.origin_channel ?? "api",
        session_id: ctx?.session_id ?? "default",
        origin_message_id: ctx?.origin_message_id ?? null,
        origin_user_id: ctx?.origin_user_id ?? null,
        max_attempts: 3,
      });

      TaskRequestContext.setDelegationAck({
        task_id: created.id,
        agent: "keymaker",
        task: `${skillName}:${objective}`,
      });

      display.log(`Keymaker task created: ${created.id} (skill: ${skillName})`, {
        source: "SkillDelegateTool",
        level: "info",
        meta: {
          agent: created.agent,
          skill: skillName,
          origin_channel: created.origin_channel,
          session_id: created.session_id,
          input: created.input,
        }
      });

      return `Task ${created.id} queued for Keymaker (skill: ${skillName}) execution.`;
    } catch (err: any) {
      const display = DisplayManager.getInstance();
      display.log(`SkillDelegateTool error: ${err.message}`, {
        source: "SkillDelegateTool",
        level: "error",
      });
      return `Keymaker task enqueue failed: ${err.message}`;
    }
  },
  {
    name: "skill_delegate",
    description: getSkillDelegateDescription(),
    schema: z.object({
      skillName: z.string().describe("Exact name of the skill to use"),
      objective: z.string().describe("Clear description of what Keymaker should accomplish"),
    }),
  }
);

/**
 * Updates the skill_delegate tool description with current skill list.
 * Should be called after skills are loaded/reloaded.
 */
export function updateSkillDelegateDescription(): void {
  (SkillDelegateTool as any).description = getSkillDelegateDescription();
}
