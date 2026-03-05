/**
 * Skill Tool — load_skill
 *
 * Oracle uses this tool to load skill content into context on-demand.
 * Replaces the old skill_execute/skill_delegate + Keymaker pattern.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SkillRegistry } from "./registry.js";
import { AuditRepository } from "../audit/repository.js";
import { TaskRequestContext } from "../tasks/context.js";

/**
 * Creates the load_skill tool for Oracle.
 * Returns skill content as context — Oracle handles execution with its own tools.
 */
export function createLoadSkillTool() {
  return tool(
    async ({ skillName }: { skillName: string }) => {
      const registry = SkillRegistry.getInstance();
      const skill = registry.get(skillName);

      if (!skill) {
        const available = registry.getEnabled().map(s => s.name).join(', ');
        return `Skill '${skillName}' not found. Available skills: ${available || 'none'}`;
      }

      if (!skill.enabled) {
        return `Skill '${skillName}' is disabled.`;
      }

      // Emit audit event
      try {
        const ctx = TaskRequestContext.get();
        const sessionId = ctx?.session_id ?? 'default';
        AuditRepository.getInstance().insert({
          session_id: sessionId,
          event_type: 'skill_loaded',
          agent: 'oracle',
          tool_name: skillName,
          status: 'success',
        });
      } catch { /* non-critical */ }

      return `Loaded skill: ${skillName}\n\n${skill.content}`;
    },
    {
      name: "load_skill",
      description: buildLoadSkillDescription(),
      schema: z.object({
        skillName: z.string().describe("The name of the skill to load"),
      }),
    }
  );
}

/**
 * Builds the load_skill tool description with available skills.
 */
function buildLoadSkillDescription(): string {
  const registry = SkillRegistry.getInstance();
  const enabled = registry.getEnabled();

  const skillList = enabled.length > 0
    ? enabled.map(s => `- ${s.name}: ${s.description}`).join('\n')
    : '(no skills available)';

  return `Load a skill's instructions into your context. After loading, follow the instructions to handle the request using your existing tools or delegate to Agents.

Available skills:
${skillList}`;
}
