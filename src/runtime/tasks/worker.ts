import { randomUUID } from 'crypto';
import { DisplayManager } from '../display.js';
import { Apoc } from '../apoc.js';
import { Neo } from '../neo.js';
import { Trinity } from '../trinity.js';
import { TaskRepository } from './repository.js';
import type { TaskRecord } from './types.js';

export class TaskWorker {
  private readonly workerId: string;
  private readonly pollIntervalMs: number;
  private readonly staleRunningMs: number;
  private readonly repository = TaskRepository.getInstance();
  private readonly display = DisplayManager.getInstance();
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(opts?: { pollIntervalMs?: number; staleRunningMs?: number }) {
    this.workerId = `task-worker-${randomUUID().slice(0, 8)}`;
    this.pollIntervalMs = opts?.pollIntervalMs ?? 1000;
    this.staleRunningMs = opts?.staleRunningMs ?? 5 * 60 * 1000;
  }

  start(): void {
    if (this.timer) return;

    const recovered = this.repository.recoverStaleRunning(this.staleRunningMs);
    if (recovered > 0) {
      this.display.log(`Recovered ${recovered} stale running task(s).`, { source: 'TaskWorker', level: 'warning' });
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);

    this.display.log(`Task worker started (${this.workerId}).`, { source: 'TaskWorker' });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.display.log(`Task worker stopped (${this.workerId}).`, { source: 'TaskWorker' });
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const task = this.repository.claimNextPending(this.workerId);
      if (!task) return;
      await this.executeTask(task);
    } finally {
      this.running = false;
    }
  }

  private async executeTask(task: TaskRecord): Promise<void> {
    try {
      let output: string;
      switch (task.agent) {
        case 'apoc': {
          const apoc = Apoc.getInstance();
          output = await apoc.execute(task.input, task.context ?? undefined, task.session_id);
          break;
        }
        case 'neo': {
          const neo = Neo.getInstance();
          output = await neo.execute(task.input, task.context ?? undefined, task.session_id, {
            origin_channel: task.origin_channel,
            session_id: task.session_id,
            origin_message_id: task.origin_message_id ?? undefined,
            origin_user_id: task.origin_user_id ?? undefined,
          });
          break;
        }
        case 'trinit': {
          const trinity = Trinity.getInstance();
          output = await trinity.execute(task.input, task.context ?? undefined, task.session_id);
          break;
        }
        default: {
          throw new Error(`Unknown task agent: ${task.agent}`);
        }
      }

      this.repository.markCompleted(task.id, output);
      this.display.log(`Task completed: ${task.id}`, { source: 'TaskWorker', level: 'success' });
    } catch (err: any) {
      const latest = this.repository.getTaskById(task.id);
      const attempt = latest?.attempt_count ?? task.attempt_count;
      const maxAttempts = latest?.max_attempts ?? task.max_attempts;
      const errorMessage = err?.message ? String(err.message) : String(err);

      if (attempt < maxAttempts) {
        const backoffMs = Math.min(30_000, 1000 * Math.pow(2, Math.max(0, attempt - 1)));
        this.repository.requeueForRetry(task.id, `Attempt ${attempt}/${maxAttempts} failed: ${errorMessage}`, backoffMs);
        this.display.log(`Task retry scheduled: ${task.id} in ${backoffMs}ms`, { source: 'TaskWorker', level: 'warning' });
        return;
      }

      this.repository.markFailed(task.id, errorMessage);
      this.display.log(`Task failed: ${task.id} (${errorMessage})`, { source: 'TaskWorker', level: 'error' });
    }
  }
}
