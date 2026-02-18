import { AgentRunner } from './runner.js';
import type { SubAgentConfig, PlanResult, BlueprintResult } from './types.js';

export class TheKeymaker {
  private runner: AgentRunner;

  constructor(config?: SubAgentConfig) {
    this.runner = new AgentRunner('keymaker', config);
  }

  async createBlueprints(plan: PlanResult, sessionId?: string): Promise<BlueprintResult[]> {
    const prompt =
      `Create technical blueprints for the following plan:\n\n` +
      `Objective: ${plan.objective}\n\n` +
      `Tasks:\n${JSON.stringify(plan.tasks, null, 2)}`;

    const result = await this.runner.run(prompt, [], sessionId);

    return this.parseBlueprints(result.content, plan);
  }

  private parseBlueprints(raw: string, plan: PlanResult): BlueprintResult[] {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();

    try {
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        throw new Error('Expected JSON array of blueprints');
      }

      return parsed.map((b: any, i: number) => ({
        task_index: b.task_index ?? i,
        blueprint: b.blueprint ?? '',
        files_to_create: Array.isArray(b.files_to_create) ? b.files_to_create : [],
        files_to_modify: Array.isArray(b.files_to_modify) ? b.files_to_modify : [],
        commands_needed: Array.isArray(b.commands_needed) ? b.commands_needed : [],
      }));
    } catch {
      // Fallback: create a generic blueprint per task
      return plan.tasks.map((task, i) => ({
        task_index: i,
        blueprint: `# ${task.title}\n\n${task.description}\n\n## Notes from Keymaker\n\n${raw}`,
        files_to_create: [],
        files_to_modify: [],
        commands_needed: [],
      }));
    }
  }
}
