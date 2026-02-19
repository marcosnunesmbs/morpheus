import { DisplayManager } from '../display.js';
import { TaskDispatcher } from './dispatcher.js';
import { TaskRepository } from './repository.js';

export class TaskNotifier {
  private readonly pollIntervalMs: number;
  private readonly maxAttempts: number;
  private readonly repository = TaskRepository.getInstance();
  private readonly display = DisplayManager.getInstance();
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(opts?: { pollIntervalMs?: number; maxAttempts?: number }) {
    this.pollIntervalMs = opts?.pollIntervalMs ?? 1200;
    this.maxAttempts = opts?.maxAttempts ?? 5;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
    this.display.log('Task notifier started.', { source: 'TaskNotifier' });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.display.log('Task notifier stopped.', { source: 'TaskNotifier' });
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const task = this.repository.claimNextNotificationCandidate();
      if (!task) return;

      try {
        await TaskDispatcher.onTaskFinished(task);
        this.repository.markNotificationSent(task.id);
      } catch (err: any) {
        const latest = this.repository.getTaskById(task.id);
        const attempts = (latest?.notify_attempts ?? 0) + 1;
        const retry = attempts < this.maxAttempts;
        this.repository.markNotificationFailed(task.id, err?.message ?? String(err), retry);
        this.display.log(`Task notification failed (${task.id}): ${err?.message ?? err}`, {
          source: 'TaskNotifier',
          level: retry ? 'warning' : 'error',
        });
      }
    } finally {
      this.running = false;
    }
  }
}

