import { randomUUID } from 'crypto';
import { DisplayManager } from '../display.js';
import { Apoc } from '../apoc.js';
import { Neo } from '../neo.js';
import { Trinity } from '../trinity.js';
import { executeKeymakerTask } from '../keymaker.js';
import { SmithDelegator } from '../smiths/delegator.js';
import { TaskRepository } from './repository.js';
import { AuditRepository } from '../audit/repository.js';
import type { TaskRecord, AgentResult } from './types.js';

export class TaskWorker {
  private readonly workerId: string;
  private readonly pollIntervalMs: number;
  private readonly staleRunningMs: number;
  private readonly maxConcurrent: number;
  private readonly repository = TaskRepository.getInstance();
  private readonly display = DisplayManager.getInstance();
  private timer: NodeJS.Timeout | null = null;
  private readonly activeTasks = new Set<string>(); // task IDs currently executing

  constructor(opts?: { pollIntervalMs?: number; staleRunningMs?: number; maxConcurrent?: number }) {
    this.workerId = `task-worker-${randomUUID().slice(0, 8)}`;
    this.pollIntervalMs = opts?.pollIntervalMs ?? 300;
    this.staleRunningMs = opts?.staleRunningMs ?? 5 * 60 * 1000;
    this.maxConcurrent = opts?.maxConcurrent ?? parseInt(process.env.MORPHEUS_TASK_CONCURRENCY ?? '3', 10);
  }

  start(): void {
    if (this.timer) return;

    const recovered = this.repository.recoverStaleRunning(this.staleRunningMs);
    if (recovered > 0) {
      this.display.log(`Recovered ${recovered} stale running task(s).`, { source: 'TaskWorker', level: 'warning' });
    }

    this.timer = setInterval(() => {
      this.tick();
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

  private tick(): void {
    if (this.activeTasks.size >= this.maxConcurrent) return;
    const task = this.repository.claimNextPending(this.workerId);
    if (!task) return;
    this.activeTasks.add(task.id);
    this.executeTask(task).finally(() => this.activeTasks.delete(task.id));
  }

  private async executeTask(task: TaskRecord): Promise<void> {
    const audit = AuditRepository.getInstance();
    audit.insert({
      session_id: task.session_id,
      task_id: task.id,
      event_type: 'task_created',
      agent: task.agent === 'trinit' ? 'trinity' : task.agent as any,
      status: 'success',
      metadata: { agent: task.agent, input_preview: task.input.slice(0, 200) },
    });

    try {
      let result: AgentResult;
      switch (task.agent) {
        case 'apoc': {
          const apoc = Apoc.getInstance();
          result = await apoc.execute(task.input, task.context ?? undefined, task.session_id);
          break;
        }
        case 'neo': {
          const neo = Neo.getInstance();
          result = await neo.execute(task.input, task.context ?? undefined, task.session_id, {
            origin_channel: task.origin_channel,
            session_id: task.session_id,
            origin_message_id: task.origin_message_id ?? undefined,
            origin_user_id: task.origin_user_id ?? undefined,
          });
          break;
        }
        case 'trinit': {
          const trinity = Trinity.getInstance();
          result = await trinity.execute(task.input, task.context ?? undefined, task.session_id);
          break;
        }
        case 'keymaker': {
          // Parse skill name from context JSON
          let skillName = 'unknown';
          if (task.context) {
            try {
              const parsed = JSON.parse(task.context);
              skillName = parsed.skill || 'unknown';
            } catch {
              // context is not JSON, use as skill name directly for backwards compat
              skillName = task.context;
            }
          }
          result = await executeKeymakerTask(skillName, task.input, {
            origin_channel: task.origin_channel,
            session_id: task.session_id,
            origin_message_id: task.origin_message_id ?? undefined,
            origin_user_id: task.origin_user_id ?? undefined,
          });
          break;
        }
        case 'smith': {
          // Parse smith name from context JSON
          let smithName = 'unknown';
          if (task.context) {
            try {
              const parsed = JSON.parse(task.context);
              smithName = parsed.smith_name || parsed.smith || 'unknown';
            } catch {
              smithName = task.context;
            }
          }
          const delegator = SmithDelegator.getInstance();
          result = await delegator.delegate(smithName, task.input, task.context ?? undefined);
          break;
        }
        default: {
          throw new Error(`Unknown task agent: ${task.agent}`);
        }
      }

      this.repository.markCompleted(task.id, result.output, result.usage ? {
        provider: result.usage.provider,
        model: result.usage.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        durationMs: result.usage.durationMs,
        stepCount: result.usage.stepCount,
      } : undefined);

      const agentName = (task.agent === 'trinit' ? 'trinity' : task.agent) as any;

      // Emit task_completed audit event
      audit.insert({
        session_id: task.session_id,
        task_id: task.id,
        event_type: 'task_completed',
        agent: agentName,
        duration_ms: result.usage?.durationMs,
        status: 'success',
      });

      // Emit llm_call audit event if usage data is present (not keymaker skills)
      if (result.usage && (result.usage.inputTokens > 0 || result.usage.outputTokens > 0)) {
        audit.insert({
          session_id: task.session_id,
          task_id: task.id,
          event_type: 'llm_call',
          agent: agentName,
          provider: result.usage.provider,
          model: result.usage.model,
          input_tokens: result.usage.inputTokens,
          output_tokens: result.usage.outputTokens,
          duration_ms: result.usage.durationMs,
          status: 'success',
          metadata: { step_count: result.usage.stepCount },
        });
      }

      // Emit skill_executed for keymaker
      if (task.agent === 'keymaker') {
        let skillName = 'unknown';
        if (task.context) {
          try { skillName = JSON.parse(task.context).skill || task.context; } catch { skillName = task.context; }
        }
        audit.insert({
          session_id: task.session_id,
          task_id: task.id,
          event_type: 'skill_executed',
          agent: 'keymaker',
          tool_name: skillName,
          duration_ms: result.usage?.durationMs,
          status: 'success',
        });
      }

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
      audit.insert({
        session_id: task.session_id,
        task_id: task.id,
        event_type: 'task_completed',
        agent: (task.agent === 'trinit' ? 'trinity' : task.agent) as any,
        status: 'error',
        metadata: { error: errorMessage },
      });
      this.display.log(`Task failed: ${task.id} (${errorMessage})`, { source: 'TaskWorker', level: 'error' });
    }
  }
}
