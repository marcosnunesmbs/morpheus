import { randomUUID } from 'crypto';
import { ConfigManager } from '../../config/manager.js';
import { DisplayManager } from '../display.js';
import type { IOracle } from '../types.js';
import { ChronosRepository, type ChronosJob } from './repository.js';
import { parseNextRun } from './parser.js';

/** Called with the Oracle's response after each successful job execution. */
type NotifyFn = (text: string) => Promise<void>;

export class ChronosWorker {
  private static instance: ChronosWorker | null = null;
  private static notifyFn: NotifyFn | null = null;

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

  /** Register a function that will deliver Oracle responses to users (e.g. Telegram). */
  public static setNotifyFn(fn: NotifyFn): void {
    ChronosWorker.notifyFn = fn;
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

    this.repo.insertExecution({
      id: execId,
      job_id: job.id,
      triggered_at: Date.now(),
      status: 'running',
      session_id: '',
    });

    try {
      // Use the Oracle's current active session — no session switching needed.
      const response = await this.oracle.chat(job.prompt);

      this.repo.completeExecution(execId, 'success');
      display.log(`Job ${job.id} completed — status: success`, { source: 'Chronos' });

      // Deliver Oracle response to notification channels.
      await this.notify(job, response);
    } catch (err: any) {
      const errMsg = err?.message ?? String(err);
      this.repo.completeExecution(execId, 'failed', errMsg);
      display.log(`Job ${job.id} failed — ${errMsg}`, { source: 'Chronos', level: 'error' });
    } finally {
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
    if (!ChronosWorker.notifyFn) return;
    const display = DisplayManager.getInstance();
    const header = `⏰ *Chronos* — _${job.prompt.slice(0, 80)}${job.prompt.length > 80 ? '…' : ''}_\n\n`;
    try {
      await ChronosWorker.notifyFn(header + response);
    } catch (err: any) {
      display.log(`Job ${job.id} notification failed — ${err.message}`, { source: 'Chronos', level: 'error' });
    }
  }
}
