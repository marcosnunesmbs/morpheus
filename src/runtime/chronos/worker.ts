import { randomUUID } from 'crypto';
import { ConfigManager } from '../../config/manager.js';
import { DisplayManager } from '../display.js';
import type { IOracle } from '../types.js';
import type { OracleTaskContext } from '../tasks/types.js';
import { ChronosRepository, type ChronosJob } from './repository.js';
import { parseNextRun } from './parser.js';
import { ChannelRegistry } from '../../channels/registry.js';

export class ChronosWorker {
  private static instance: ChronosWorker | null = null;

  /**
   * True while a Chronos job is being executed. Chronos management tools
   * (chronos_cancel, chronos_schedule) check this flag and refuse to operate
   * during execution to prevent the Oracle from self-deleting or re-scheduling
   * the active job.
   */
  public static isExecuting = false;

  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private pollIntervalMs: number;

  constructor(
    private readonly repo: ChronosRepository,
    private readonly oracle: IOracle,
  ) {
    this.pollIntervalMs = ConfigManager.getInstance().getChronosConfig().check_interval_ms;
  }

  public static getInstance(): ChronosWorker | null {
    return ChronosWorker.instance;
  }

  public static setInstance(worker: ChronosWorker): void {
    ChronosWorker.instance = worker;
  }

  public start(): void {
    if (this.timer) return;
    const display = DisplayManager.getInstance();
    display.log(`Worker started (interval: ${this.pollIntervalMs}ms)`, { source: 'Chronos' });
    this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const display = DisplayManager.getInstance();
    display.log('Worker stopped', { source: 'Chronos' });
  }

  /** Hot-reload poll interval without restarting the process */
  public updateInterval(newMs: number): void {
    if (newMs < 60000) return;
    this.pollIntervalMs = newMs;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
    }
    const display = DisplayManager.getInstance();
    display.log(`Worker interval updated to ${newMs}ms`, { source: 'Chronos' });
  }

  public async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const dueJobs = this.repo.getDueJobs(Date.now());
      for (const job of dueJobs) {
        void this.executeJob(job);
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async executeJob(job: ChronosJob): Promise<void> {
    const display = DisplayManager.getInstance();
    const execId = randomUUID();

    display.log(`Job ${job.id} triggered — "${job.prompt.slice(0, 60)}"`, { source: 'Chronos' });

    // Use the currently active Oracle session so Chronos executes in the
    // user's conversation context — no session switching or isolation needed.
    const activeSessionId = this.oracle.getCurrentSessionId() ?? 'default';

    this.repo.insertExecution({
      id: execId,
      job_id: job.id,
      triggered_at: Date.now(),
      status: 'running',
      session_id: activeSessionId,
    });

    try {
      // Prefix the job prompt with the Chronos execution context marker so the
      // Oracle system prompt can detect it in the current HumanMessage.
      // This avoids persisting an AIMessage with the marker in conversation history,
      // which would cause the LLM to reproduce the format in future scheduling responses.
      const promptWithContext = `[CHRONOS EXECUTION — job_id: ${job.id}]\n${job.prompt}`;

      // Determine which channel to tag delegated tasks with.
      // Single notify_channel → use it so TaskDispatcher routes back correctly.
      // Multiple or empty → 'chronos' means broadcast to all registered adapters.
      const taskOriginChannel: OracleTaskContext['origin_channel'] =
        job.notify_channels.length === 1
          ? (job.notify_channels[0] as OracleTaskContext['origin_channel'])
          : 'chronos';
      const taskContext: OracleTaskContext = { origin_channel: taskOriginChannel, session_id: activeSessionId };

      // Hard-block Chronos management tools during execution.
      ChronosWorker.isExecuting = true;
      const response = await this.oracle.chat(promptWithContext, undefined, false, taskContext);

      this.repo.completeExecution(execId, 'success');
      display.log(`Job ${job.id} completed — status: success`, { source: 'Chronos' });

      // Deliver Oracle response to notification channels.
      await this.notify(job, response);
    } catch (err: any) {
      const errMsg = err?.message ?? String(err);
      this.repo.completeExecution(execId, 'failed', errMsg);
      display.log(`Job ${job.id} failed — ${errMsg}`, { source: 'Chronos', level: 'error' });
    } finally {
      ChronosWorker.isExecuting = false;

      if (job.schedule_type === 'once') {
        this.repo.disableJob(job.id);
        display.log(`Job ${job.id} auto-disabled (once-type)`, { source: 'Chronos' });
      } else if (job.cron_normalized) {
        const nextRunAt = parseNextRun(job.cron_normalized, job.timezone);
        this.repo.updateJob(job.id, { next_run_at: nextRunAt, last_run_at: Date.now() });
        display.log(`Job ${job.id} rescheduled — next_run_at: ${new Date(nextRunAt).toISOString()}`, { source: 'Chronos' });
      }
      this.repo.pruneExecutions(job.id, 100);
    }
  }

  private async notify(job: ChronosJob, response: string): Promise<void> {
    if (ChannelRegistry.getAll().length === 0) return;
    const header = `⏰ *Chronos* — _${job.prompt.slice(0, 80)}${job.prompt.length > 80 ? '…' : ''}_\n\n`;
    const text = header + response;

    if (job.notify_channels.length === 0) {
      // No specific channels → broadcast to all registered adapters
      await ChannelRegistry.broadcast(text);
    } else {
      for (const ch of job.notify_channels) {
        const adapter = ChannelRegistry.get(ch);
        if (adapter) {
          await adapter.sendMessage(text).catch((err: any) => {
            DisplayManager.getInstance().log(
              `Job ${job.id} notification failed on channel "${ch}": ${err.message}`,
              { source: 'Chronos', level: 'error' }
            );
          });
        } else {
          DisplayManager.getInstance().log(
            `Job ${job.id}: no adapter registered for channel "${ch}" — notification skipped.`,
            { source: 'Chronos', level: 'warning' }
          );
        }
      }
    }
  }
}
