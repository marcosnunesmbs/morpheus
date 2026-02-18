import { AgentRunner } from './runner.js';
import { buildDevKit } from '../devkit/index.js';
import type { SubAgentConfig } from './types.js';
import type { Task } from '../tasks/types.js';

export interface ApocProject {
  /** Working directory for this execution (worktree path when available). */
  path: string;
  allowed_commands: string[];
  /**
   * Absolute path to the git worktree Apoc must work in.
   * Always set by TaskExecutor after ensureWorktree().
   */
  worktreePath?: string;
  /**
   * Absolute path to the main project directory (the real repo root).
   * Provided for context only — Apoc must NOT commit/push from here.
   */
  projectPath?: string;
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
    const prompt = buildPrompt(task, project);

    const result = await this.runner.run(prompt, tools, task.session_id);
    return result.content;
  }
}

function buildPrompt(task: Task, project?: ApocProject): string {
  const parts: string[] = [];

  // ── Worktree context header ───────────────────────────────────────────────
  if (project?.worktreePath) {
    parts.push(
      `## Working Environment\n` +
      `You are operating inside a **git worktree** (branch: \`morpheus\`).\n` +
      `- Worktree path (your working directory): \`${project.worktreePath}\`\n` +
      (project.projectPath
        ? `- Main repo path (for reference only): \`${project.projectPath}\`\n`
        : '') +
      `\n` +
      `**Rules:**\n` +
      `1. All file reads and writes MUST be done inside \`${project.worktreePath}\`.\n` +
      `2. You may run \`git add\`, \`git commit\` within the worktree to checkpoint your work.\n` +
      `3. Do NOT run \`git merge\`, \`git rebase\`, or \`git push\` — those are reserved for the user.\n` +
      `4. Do NOT switch branches or modify the main repo directory.\n`,
    );
  }

  // ── Task ─────────────────────────────────────────────────────────────────
  parts.push(`## Task: ${task.title}`);

  if (task.description) {
    parts.push(`\n### Description\n${task.description}`);
  }

  if (task.blueprint) {
    parts.push(`\n### Technical Blueprint\n${task.blueprint}`);
  }

  parts.push(`\nExecute this task now. Report what you did and the outcome.`);

  return parts.join('\n');
}
