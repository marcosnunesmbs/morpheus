import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { TaskStore } from './store.js';
import { ProjectStore } from '../projects/store.js';
import { Apoc } from '../agents/apoc.js';
import { TheMerovingian } from '../agents/merovingian.js';
import { taskCompletionEmitter } from './emitter.js';
import type { Task } from './types.js';

const execFileAsync = promisify(execFile);

const WORKTREE_NAME = 'morpheus';

/**
 * Ensure the project has a git worktree named "morpheus".
 * - If `project.active_worktree` is already set, returns that path immediately.
 * - Otherwise, creates `<projectPath>/../<projectName>-morpheus` as a worktree
 *   on branch `morpheus` (creates the branch if it doesn't exist).
 * - Updates `projects.active_worktree` in the DB and returns the path.
 */
async function ensureWorktree(
  projectStore: ProjectStore,
  projectId: string,
  projectPath: string,
  projectName: string,
): Promise<string> {
  // Re-fetch to get the latest value (another task might have just created it)
  const fresh = projectStore.getById(projectId);
  if (fresh?.active_worktree) return fresh.active_worktree;

  // Worktree lives as a sibling directory: ../projectName-morpheus
  const worktreePath = path.resolve(projectPath, '..', `${projectName}-${WORKTREE_NAME}`);

  // Check if worktree already exists on disk (git list)
  try {
    const { stdout } = await execFileAsync('git', ['-C', projectPath, 'worktree', 'list', '--porcelain']);
    if (stdout.includes(worktreePath)) {
      // Already exists on disk but not recorded in DB — update DB and return
      projectStore.update(projectId, { active_worktree: worktreePath });
      return worktreePath;
    }
  } catch {
    // git not available or not a git repo — fall through and let Apoc handle it
    console.warn(`[TaskExecutor] Could not list worktrees for '${projectPath}'. Apoc will work in the main project directory.`);
    return projectPath;
  }

  // Check if branch "morpheus" already exists
  let branchExists = false;
  try {
    const { stdout } = await execFileAsync('git', ['-C', projectPath, 'branch', '--list', WORKTREE_NAME]);
    branchExists = stdout.trim().length > 0;
  } catch {
    // ignore
  }

  // Create the worktree
  const args = ['worktree', 'add', worktreePath];
  if (branchExists) {
    args.push(WORKTREE_NAME); // checkout existing branch
  } else {
    args.push('-b', WORKTREE_NAME); // create new branch
  }

  try {
    await execFileAsync('git', ['-C', projectPath, ...args.slice(1)]);
    projectStore.update(projectId, { active_worktree: worktreePath });
    console.log(`[TaskExecutor] Worktree created at '${worktreePath}' (branch: ${WORKTREE_NAME})`);
    return worktreePath;
  } catch (err: any) {
    console.warn(`[TaskExecutor] Failed to create worktree: ${err.message}. Falling back to main project directory.`);
    return projectPath;
  }
}

export class TaskExecutor {
  private taskStore: TaskStore;
  private projectStore: ProjectStore;

  constructor(taskStore: TaskStore, projectStore: ProjectStore) {
    this.taskStore = taskStore;
    this.projectStore = projectStore;
  }

  async runTask(taskId: string): Promise<Task> {
    const task = this.taskStore.getById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status !== 'pending') {
      throw new Error(`Task ${taskId} is not in pending state (current: ${task.status})`);
    }

    // If approval is required but not yet granted, pause here
    if (task.requires_approval && !task.approved_at) {
      return this.taskStore.update(taskId, { status: 'awaiting_approval' }) ?? task;
    }

    // Mark as in_progress
    const running = this.taskStore.update(taskId, {
      status: 'in_progress',
      started_at: Date.now(),
    }) ?? task;

    try {
      const output = await this.executeAgent(running);

      return this.taskStore.update(taskId, {
        status: 'done',
        result: output,
        completed_at: Date.now(),
      }) ?? running;
    } catch (err: any) {
      return this.taskStore.update(taskId, {
        status: 'failed',
        error: err?.message ?? String(err),
        completed_at: Date.now(),
      }) ?? running;
    }
  }

  private async executeAgent(task: Task): Promise<string> {
    const assignedTo = task.assigned_to ?? 'apoc';

    if (assignedTo === 'merovingian') {
      const mero = new TheMerovingian();
      return mero.execute(buildMeroPrompt(task), task.session_id);
    }

    // Default: Apoc — requires a valid registered project
    if (!task.project_id) {
      throw new Error(
        'Apoc requires a project_id. Use list_projects to find a project or create_project to register one.',
      );
    }

    const proj = this.projectStore.getById(task.project_id);
    if (!proj) {
      throw new Error(
        `Project '${task.project_id}' not found in DB. Use list_projects or create_project first.`,
      );
    }

    // Ensure the project has a "morpheus" git worktree before Apoc starts.
    // Apoc always works inside the worktree, never in the main branch.
    const worktreeDir = await ensureWorktree(
      this.projectStore,
      proj.id,
      proj.path,
      proj.name,
    );

    const apoc = new Apoc();
    return apoc.executeTask(task, {
      path: worktreeDir,
      allowed_commands: proj.allowed_commands,
      worktreePath: worktreeDir,
      projectPath: proj.path,
    });
  }

  async runAll(tasks: Task[], parallel = false): Promise<Task[]> {
    if (parallel) {
      return Promise.all(tasks.map((t) => this.runTask(t.id)));
    }

    const results: Task[] = [];
    for (const task of tasks) {
      results.push(await this.runTask(task.id));
    }
    return results;
  }

  /**
   * Fire-and-forget execution. Returns immediately without blocking the caller.
   * Emits 'tasks_done' on taskCompletionEmitter when all tasks finish.
   */
  runInBackground(taskIds: string[], parallel: boolean, sessionId?: string): void {
    const run = parallel
      ? Promise.all(taskIds.map((id) => this.runTask(id)))
      : taskIds.reduce<Promise<unknown>>(
          (chain, id) => chain.then(() => this.runTask(id)),
          Promise.resolve(),
        );

    run
      .then(() => {
        taskCompletionEmitter.emit('tasks_done', { taskIds, sessionId });
      })
      .catch((err: unknown) => {
        console.error('[TaskExecutor] Background execution error:', err);
        taskCompletionEmitter.emit('tasks_done', { taskIds, sessionId });
      });
  }
}

function buildMeroPrompt(task: Task): string {
  const parts = [`# Task: ${task.title}`];
  if (task.description) parts.push(`\n## Description\n${task.description}`);
  if (task.blueprint) parts.push(`\n## Blueprint\n${task.blueprint}`);
  parts.push('\nExecute this task and report the result.');
  return parts.join('\n');
}
