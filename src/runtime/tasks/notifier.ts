import { DisplayManager } from '../display.js';
import { TaskDispatcher } from './dispatcher.js';
import { TaskRepository } from './repository.js';
import { taskEventBus } from './event-bus.js';

export class TaskNotifier {
  private readonly maxAttempts: number;
  private readonly staleSendingMs: number;
  private readonly recoveryPollMs: number;
  private readonly repository = TaskRepository.getInstance();
  private readonly display = DisplayManager.getInstance();
  private timer: NodeJS.Timeout | null = null;
  private readonly inFlight = new Set<string>(); // task IDs currently being dispatched

  constructor(opts?: { maxAttempts?: number; staleSendingMs?: number; recoveryPollMs?: number }) {
    this.maxAttempts = opts?.maxAttempts ?? 5;
    this.staleSendingMs = opts?.staleSendingMs ?? 30_000;
    // Slow poll only for orphan recovery (process restarts, crash scenarios)
    this.recoveryPollMs = opts?.recoveryPollMs ?? 30_000;
  }

  start(): void {
    if (this.timer) return;

    const recovered = this.repository.recoverNotificationQueue(this.maxAttempts, this.staleSendingMs);
    if (recovered > 0) {
      this.display.log(`Recovered ${recovered} task notification(s) back to pending.`, {
        source: 'TaskNotifier',
        level: 'warning',
      });
    }

    // Primary path: event-driven — fires immediately when TaskWorker completes a task
    taskEventBus.on('task:ready', (taskId: string) => {
      this.dispatchById(taskId);
    });

    // Fallback path: slow poll for orphaned tasks (e.g. completed before notifier started,
    // or process restarted mid-notification)
    this.timer = setInterval(() => {
      void this.recoveryTick();
    }, this.recoveryPollMs);

    this.display.log('Task notifier started (event-driven + 30s recovery poll).', { source: 'TaskNotifier' });
  }

  stop(): void {
    taskEventBus.removeAllListeners('task:ready');
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.display.log('Task notifier stopped.', { source: 'TaskNotifier' });
  }

  /**
   * Event-driven dispatch: called immediately when a task is marked complete/failed.
   * Uses claimNotificationById to atomically claim — prevents double-dispatch with recovery poll.
   */
  private dispatchById(taskId: string): void {
    if (this.inFlight.has(taskId)) return;
    this.inFlight.add(taskId);

    const task = this.repository.claimNotificationById(taskId);
    if (!task) {
      // Already claimed by recovery poll or another path
      this.inFlight.delete(taskId);
      return;
    }

    void this.dispatch(task).finally(() => this.inFlight.delete(taskId));
  }

  /**
   * Fallback recovery: picks up any orphaned completed tasks not yet notified.
   */
  private async recoveryTick(): Promise<void> {
    // Drain all pending orphans in one recovery sweep
    while (true) {
      const task = this.repository.claimNextNotificationCandidate(0);
      if (!task) break;
      if (this.inFlight.has(task.id)) break; // already being dispatched via event
      await this.dispatch(task);
    }
  }

  private async dispatch(task: { id: string; [key: string]: any }): Promise<void> {
    try {
      await TaskDispatcher.onTaskFinished(task as any);
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
  }
}
