import { Router } from 'express';
import { z } from 'zod';
import { ConfigManager } from '../../config/manager.js';
import { ChronosConfigSchema } from '../../config/schemas.js';
import { DisplayManager } from '../../runtime/display.js';
import { ChronosRepository, ChronosError, type CreatedBy } from '../../runtime/chronos/repository.js';
import { ChronosWorker } from '../../runtime/chronos/worker.js';
import {
  parseScheduleExpression,
  getNextOccurrences,
  type ParseScheduleOptions,
} from '../../runtime/chronos/parser.js';

const ScheduleTypeSchema = z.enum(['once', 'cron', 'interval']);

const CreateJobSchema = z.object({
  prompt: z.string().min(1).max(10000),
  schedule_type: ScheduleTypeSchema,
  schedule_expression: z.string().min(1),
  timezone: z.string().optional(),
});

const UpdateJobSchema = z.object({
  prompt: z.string().min(1).max(10000).optional(),
  schedule_expression: z.string().min(1).optional(),
  timezone: z.string().optional(),
  enabled: z.boolean().optional(),
});

const PreviewSchema = z.object({
  expression: z.string().min(1),
  schedule_type: ScheduleTypeSchema,
  timezone: z.string().optional(),
});

const ExecutionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Job Router ───────────────────────────────────────────────────────────────

export function createChronosJobRouter(repo: ChronosRepository, _worker: ChronosWorker): Router {
  const router = Router();
  const configManager = ConfigManager.getInstance();

  // POST /api/chronos/preview — must be before /:id routes
  router.post('/preview', (req, res) => {
    const parsed = PreviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const { expression, schedule_type, timezone } = parsed.data;
    const globalTz = configManager.getChronosConfig().timezone;
    const opts: ParseScheduleOptions = { timezone: timezone ?? globalTz };

    try {
      const result = parseScheduleExpression(expression, schedule_type, opts);
      const next_occurrences: string[] = [];

      if (result.cron_normalized) {
        const timestamps = getNextOccurrences(result.cron_normalized, opts.timezone ?? 'UTC', 3);
        for (const ts of timestamps) {
          next_occurrences.push(new Date(ts).toLocaleString('en-US', {
            timeZone: opts.timezone ?? 'UTC',
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
          }));
        }
      }

      res.json({
        next_run_at: result.next_run_at,
        human_readable: result.human_readable,
        next_occurrences,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/chronos — list jobs
  router.get('/', (req, res) => {
    try {
      const enabled = req.query.enabled;
      const created_by = req.query.created_by as CreatedBy | undefined;
      const jobs = repo.listJobs({
        enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
        created_by,
      });
      res.json(jobs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/chronos — create job
  router.post('/', (req, res) => {
    const parsed = CreateJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    const { prompt, schedule_type, schedule_expression, timezone } = parsed.data;
    const globalTz = configManager.getChronosConfig().timezone;
    const tz = timezone ?? globalTz;
    const opts: ParseScheduleOptions = { timezone: tz };

    try {
      const schedule = parseScheduleExpression(schedule_expression, schedule_type, opts);
      const job = repo.createJob({
        prompt,
        schedule_type,
        schedule_expression,
        cron_normalized: schedule.cron_normalized,
        timezone: tz,
        next_run_at: schedule.next_run_at,
        created_by: 'ui',
      });

      const display = DisplayManager.getInstance();
      display.log(`Job ${job.id} created — ${schedule.human_readable}`, { source: 'Chronos' });

      res.status(201).json({
        job,
        human_readable: schedule.human_readable,
        next_run_formatted: new Date(schedule.next_run_at).toLocaleString('en-US', {
          timeZone: tz,
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
        }),
      });
    } catch (err: any) {
      if (err instanceof ChronosError) {
        return res.status(429).json({ error: err.message });
      }
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/chronos/:id
  router.get('/:id', (req, res) => {
    try {
      const job = repo.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      res.json(job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/chronos/:id — update job
  router.put('/:id', (req, res) => {
    const parsed = UpdateJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    try {
      const existing = repo.getJob(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Job not found' });

      const patch = parsed.data;
      const tz = patch.timezone ?? existing.timezone;
      let updatedSchedule = undefined;

      if (patch.schedule_expression) {
        updatedSchedule = parseScheduleExpression(patch.schedule_expression, existing.schedule_type, {
          timezone: tz,
        });
      }

      const job = repo.updateJob(req.params.id, {
        prompt: patch.prompt,
        schedule_expression: patch.schedule_expression,
        cron_normalized: updatedSchedule?.cron_normalized,
        timezone: patch.timezone,
        next_run_at: updatedSchedule?.next_run_at,
        enabled: patch.enabled,
      });

      res.json(job);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/chronos/:id
  router.delete('/:id', (req, res) => {
    try {
      const deleted = repo.deleteJob(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Job not found' });
      res.json({ success: true, deleted_id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/chronos/:id/enable
  router.patch('/:id/enable', (req, res) => {
    try {
      const existing = repo.getJob(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Job not found' });

      // Recompute next_run_at
      let nextRunAt: number | undefined;
      if (existing.cron_normalized) {
        const schedule = parseScheduleExpression(existing.cron_normalized, existing.schedule_type, {
          timezone: existing.timezone,
        });
        nextRunAt = schedule.next_run_at;
      } else if (existing.schedule_type === 'once' && existing.next_run_at && existing.next_run_at > Date.now()) {
        nextRunAt = existing.next_run_at;
      }

      repo.updateJob(req.params.id, { enabled: true, next_run_at: nextRunAt ?? undefined });
      const job = repo.getJob(req.params.id);
      res.json(job);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PATCH /api/chronos/:id/disable
  router.patch('/:id/disable', (req, res) => {
    try {
      const job = repo.disableJob(req.params.id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      res.json(job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/chronos/:id/executions
  router.get('/:id/executions', (req, res) => {
    try {
      const query = ExecutionsQuerySchema.safeParse(req.query);
      const limit = query.success ? query.data.limit : 50;
      const job = repo.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      const executions = repo.listExecutions(req.params.id, limit);
      res.json(executions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// ─── Config Router ────────────────────────────────────────────────────────────

export function createChronosConfigRouter(worker: ChronosWorker): Router {
  const router = Router();
  const configManager = ConfigManager.getInstance();

  // GET /api/config/chronos
  router.get('/', (req, res) => {
    try {
      res.json(configManager.getChronosConfig());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/config/chronos
  router.post('/', async (req, res) => {
    const parsed = ChronosConfigSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    try {
      const current = configManager.get();
      const newChronos = { ...configManager.getChronosConfig(), ...parsed.data };
      await configManager.save({ ...current, chronos: newChronos });

      if (parsed.data.check_interval_ms) {
        worker.updateInterval(parsed.data.check_interval_ms);
      }

      const display = DisplayManager.getInstance();
      display.log('Chronos configuration updated via UI', { source: 'Zaion', level: 'info' });

      res.json(configManager.getChronosConfig());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
