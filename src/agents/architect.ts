import { AgentRunner } from './runner.js';
import type { SubAgentConfig, PlanResult, PlanTask } from './types.js';

export class TheArchitect {
  private runner: AgentRunner;

  constructor(config?: SubAgentConfig) {
    this.runner = new AgentRunner('architect', config);
  }

  async createPlan(objective: string, sessionId?: string): Promise<PlanResult> {
    const prompt = `Decompose the following objective into tasks:\n\n${objective}`;

    const result = await this.runner.run(prompt, [], sessionId);

    return this.parsePlan(result.content, objective);
  }

  private parsePlan(raw: string, objective: string): PlanResult {
    // Strip potential markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();

    try {
      const parsed = JSON.parse(cleaned);

      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        throw new Error('Missing tasks array');
      }

      const tasks: PlanTask[] = parsed.tasks.map((t: any, i: number) => ({
        title: t.title ?? `Task ${i + 1}`,
        description: t.description ?? '',
        assigned_to: t.assigned_to === 'merovingian' ? 'merovingian' : 'apoc',
        depends_on: Array.isArray(t.depends_on) ? t.depends_on : [],
      }));

      return {
        objective: parsed.objective ?? objective,
        tasks,
        raw_plan: raw,
      };
    } catch {
      // Fallback: create a single generic task from the raw content
      return {
        objective,
        tasks: [
          {
            title: objective.slice(0, 80),
            description: raw,
            assigned_to: 'apoc',
            depends_on: [],
          },
        ],
        raw_plan: raw,
      };
    }
  }
}
