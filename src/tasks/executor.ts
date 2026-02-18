import { TaskStore } from './store.js';
import { ProjectStore } from '../projects/store.js';
import { Apoc } from '../agents/apoc.js';
import { TheMerovingian } from '../agents/merovingian.js';
import type { Task } from './types.js';

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

    // Default: Apoc
    const apoc = new Apoc();

    let project: { path: string; allowed_commands: string[] } | undefined;
    if (task.project_id) {
      const proj = this.projectStore.getById(task.project_id);
      if (proj) {
        project = {
          path: proj.path,
          allowed_commands: proj.allowed_commands,
        };
      }
    }

    return apoc.executeTask(task, project);
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
}

function buildMeroPrompt(task: Task): string {
  const parts = [`# Task: ${task.title}`];
  if (task.description) parts.push(`\n## Description\n${task.description}`);
  if (task.blueprint) parts.push(`\n## Blueprint\n${task.blueprint}`);
  parts.push('\nExecute this task and report the result.');
  return parts.join('\n');
}
