import { DisplayManager } from '../display.js';
import { TaskDispatcher } from './dispatcher.js';
import { TaskRepository } from './repository.js';
import { taskEventBus } from './event-bus.js';
import type { IOracle } from '../types.js';
import type { TaskRecord, OracleTaskContext } from './types.js';
import { ChannelRegistry } from '../../channels/registry.js';

export class TaskNotifier {
  private readonly maxAttempts: number;
  private readonly staleSendingMs: number;
  private readonly recoveryPollMs: number;
  private readonly repository = TaskRepository.getInstance();
  private readonly display = DisplayManager.getInstance();
  private timer: NodeJS.Timeout | null = null;
  private readonly inFlight = new Set<string>(); // task IDs currently being dispatched
  private readonly oracle?: IOracle;

  constructor(opts?: { maxAttempts?: number; staleSendingMs?: number; recoveryPollMs?: number; oracle?: IOracle }) {
    this.maxAttempts = opts?.maxAttempts ?? 5;
    this.staleSendingMs = opts?.staleSendingMs ?? 30_000;
    // Slow poll only for orphan recovery (process restarts, crash scenarios)
    this.recoveryPollMs = opts?.recoveryPollMs ?? 30_000;
    this.oracle = opts?.oracle;
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
      const t = task as TaskRecord;
      if (this.oracle && t.origin_channel !== 'webhook') {
        await this.dispatchViaOracle(t);
      } else {
        await TaskDispatcher.onTaskFinished(t);
      }
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

  /**
   * Routes a completed/failed task through Oracle so the result is injected
   * into the conversation history and Oracle can synthesize a reply, chain
   * follow-up actions, or ask for missing information before responding.
   * Mirrors the pattern used by ChronosWorker for scheduled job execution.
   */
  private async dispatchViaOracle(task: TaskRecord): Promise<void> {
    const agentLabel = task.agent.toUpperCase();
    let prompt: string;

    if (task.status === 'completed') {
      const output = task.output?.trim() || 'Task completed without output.';
      prompt = `[TASK COMPLETED — task_id: ${task.id}]\nAgent: ${agentLabel}\n\n${output}`;
    } else {
      const error = task.error?.trim() || 'Task failed with unknown error.';
      prompt = `[TASK FAILED — task_id: ${task.id}]\nAgent: ${agentLabel}\n\nError: ${error}`;
    }

    const taskContext: OracleTaskContext = {
      origin_channel: task.origin_channel,
      session_id: task.session_id,
      origin_user_id: task.origin_user_id ?? undefined,
      origin_message_id: task.origin_message_id ?? undefined,
      source: 'task',
    };

    this.display.log(
      `Task ${task.id} completed — routing result through Oracle (session: ${task.session_id}, channel: ${task.origin_channel})`,
      { source: 'TaskNotifier' },
    );

    const response = await this.oracle!.chat(prompt, undefined, false, taskContext);

    // ui: Oracle.chat() already wrote to history — UI polls and picks it up
    if (task.origin_channel === 'ui') return;
    // api/cli: no push channel available
    if (task.origin_channel === 'api' || task.origin_channel === 'cli') return;

    // chronos-origin tasks: broadcast Oracle response to all registered adapters
    if (task.origin_channel === 'chronos') {
      await ChannelRegistry.broadcast(response);
      return;
    }

    // telegram, discord, etc.: route to specific user or broadcast on channel
    if (task.origin_user_id) {
      await ChannelRegistry.sendToUser(task.origin_channel, task.origin_user_id, response);
      return;
    }

    const adapter = ChannelRegistry.get(task.origin_channel);
    if (adapter) {
      await adapter.sendMessage(response);
    } else {
      this.display.log(
        `Task ${task.id}: no adapter for channel "${task.origin_channel}" — Oracle response not delivered.`,
        { source: 'TaskNotifier', level: 'warning' },
      );
    }
  }
}
