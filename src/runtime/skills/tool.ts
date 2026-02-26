/**
 * Skill Tools - skill_execute (sync) and skill_delegate (async)
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskRepository } from "../tasks/repository.js";
import { TaskRequestContext } from "../tasks/context.js";
import { DisplayManager } from "../display.js";
import { SkillRegistry } from "./registry.js";
import { executeKeymakerTask } from "../keymaker.js";

// ============================================================================
// skill_execute - Synchronous execution
// ============================================================================

/**
 * Generates the skill_execute tool description dynamically with sync skills.
 */
export function getSkillExecuteDescription(): string {
  const registry = SkillRegistry.getInstance();
  const syncSkills = registry.getEnabled().filter((s) => s.execution_mode === 'sync');
  
  const skillList = syncSkills.length > 0
    ? syncSkills.map(s => `- ${s.name}: ${s.description}`).join('\n')
    : '(no sync skills enabled)';

  return `Execute a skill synchronously using Keymaker. The result is returned immediately.

Keymaker has access to ALL tools (filesystem, shell, git, MCP, browser, etc.) and will execute the skill instructions.

Available sync skills:
${skillList}

Use this for skills that need immediate results in the conversation.`;
}

/**
 * Tool that Oracle uses to execute skills synchronously via Keymaker.
 * Result is returned directly to Oracle for inclusion in the response.
 */
export const SkillExecuteTool = tool(
  async ({ skillName, objective }: { skillName: string; objective: string }) => {
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

    if (skill.execution_mode === 'async') {
      return `Error: Skill "${skillName}" is async-only. Use skill_delegate instead.`;
    }

    display.log(`Executing skill "${skillName}" synchronously...`, {
      source: "SkillExecuteTool",
      level: "info",
    });

    try {
      const ctx = TaskRequestContext.get();
      const sessionId = ctx?.session_id ?? "default";
      const taskContext = {
        origin_channel: ctx?.origin_channel ?? "api",
        session_id: sessionId,
        origin_message_id: ctx?.origin_message_id,
        origin_user_id: ctx?.origin_user_id,
      };

      // Execute Keymaker directly (synchronous)
      const result = await executeKeymakerTask(skillName, objective, taskContext);

      display.log(`Skill "${skillName}" completed successfully.`, {
        source: "SkillExecuteTool",
        level: "info",
      });

      return result;
    } catch (err: any) {
      display.log(`Skill execution error: ${err.message}`, {
        source: "SkillExecuteTool",
        level: "error",
      });
      return `Skill execution failed: ${err.message}`;
    }
  },
  {
    name: "skill_execute",
    description: getSkillExecuteDescription(),
    schema: z.object({
      skillName: z.string().describe("Exact name of the sync skill to use"),
      objective: z.string().describe("Clear description of what to accomplish"),
    }),
  }
);

// ============================================================================
// skill_delegate - Asynchronous execution (background task)
// ============================================================================

/**
 * Generates the skill_delegate tool description dynamically with async skills.
 */
export function getSkillDelegateDescription(): string {
  const registry = SkillRegistry.getInstance();
  const asyncSkills = registry.getEnabled().filter((s) => s.execution_mode === 'async');
  
  const skillList = asyncSkills.length > 0
    ? asyncSkills.map(s => `- ${s.name}: ${s.description}`).join('\n')
    : '(no async skills enabled)';

  return `Delegate a task to Keymaker as a background job. You will be notified when complete.

Keymaker has access to ALL tools (filesystem, shell, git, MCP, browser, etc.) and will execute the skill instructions.

Available async skills:
${skillList}

Use this for long-running skills like builds, deployments, or batch processing.`;
}

/**
 * Tool that Oracle uses to delegate tasks to Keymaker via async task queue.
 * Keymaker will execute the skill instructions in background.
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

      if (skill.execution_mode !== 'async') {
        return `Error: Skill "${skillName}" is sync. Use skill_execute instead for immediate results.`;
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

      return `Task ${created.id} queued for Keymaker (skill: ${skillName}). You will be notified when complete.`;
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
      skillName: z.string().describe("Exact name of the async skill to use"),
      objective: z.string().describe("Clear description of what Keymaker should accomplish"),
    }),
  }
);

// ============================================================================
// Utility functions
// ============================================================================

/**
 * Updates both skill tool descriptions with current skill list.
 * Should be called after skills are loaded/reloaded.
 */
export function updateSkillToolDescriptions(): void {
  (SkillExecuteTool as any).description = getSkillExecuteDescription();
  (SkillDelegateTool as any).description = getSkillDelegateDescription();
}

// Backwards compatibility alias
export const updateSkillDelegateDescription = updateSkillToolDescriptions;
