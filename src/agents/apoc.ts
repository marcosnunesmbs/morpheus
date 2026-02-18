import { AgentRunner } from './runner.js';
import { buildDevKit } from '../devkit/index.js';
import type { SubAgentConfig } from './types.js';
import type { Task } from '../tasks/types.js';

export interface ApocProject {
  path: string;
  allowed_commands: string[];
}

export class Apoc {
  private runner: AgentRunner;

  constructor(config?: SubAgentConfig) {
    this.runner = new AgentRunner('apoc', config);
  }

  async executeTask(task: Task, project?: ApocProject): Promise<string> {
    const workingDir = task.working_dir ?? project?.path ?? process.cwd();
    const allowedCommands = project?.allowed_commands ?? [];

    const ctx = {
      working_dir: workingDir,
      allowed_commands: allowedCommands,
      permission_scope_id: task.project_id ?? task.session_id,
    };

    const tools = buildDevKit(ctx);

    const prompt = buildPrompt(task);

    const result = await this.runner.run(prompt, tools, task.session_id);
    return result.content;
  }
}

function buildPrompt(task: Task): string {
  const parts: string[] = [];
  parts.push(`# Task: ${task.title}`);
  if (task.description) {
    parts.push(`\n## Description\n${task.description}`);
  }
  if (task.blueprint) {
    parts.push(`\n## Technical Blueprint\n${task.blueprint}`);
  }
  parts.push(`\nExecute this task now. Report what you did and the outcome.`);
  return parts.join('\n');
}
