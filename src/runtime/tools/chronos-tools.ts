import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChronosRepository } from '../chronos/repository.js';
import { parseScheduleExpression, getNextOccurrences } from '../chronos/parser.js';
import { ConfigManager } from '../../config/manager.js';

// ─── chronos_schedule ────────────────────────────────────────────────────────
export const ChronosScheduleTool = tool(
  async ({ prompt, schedule_type, schedule_expression, timezone }) => {
    try {
      const cfg = ConfigManager.getInstance().getChronosConfig();
      const tz = timezone ?? cfg.timezone;

      const parsed = parseScheduleExpression(schedule_expression, schedule_type, { timezone: tz });

      const repo = ChronosRepository.getInstance();
      const job = repo.createJob({
        prompt,
        schedule_type,
        schedule_expression,
        timezone: tz,
        next_run_at: parsed.next_run_at,
        cron_normalized: parsed.cron_normalized,
        created_by: 'oracle',
      });

      return JSON.stringify({
        success: true,
        job_id: job.id,
        prompt: job.prompt,
        schedule_type: job.schedule_type,
        human_readable: parsed.human_readable,
        next_run_at: job.next_run_at != null ? new Date(job.next_run_at).toISOString() : null,
        timezone: job.timezone,
      });
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  },
  {
    name: 'chronos_schedule',
    description:
      'Schedule a prompt to be sent to the Oracle at a future time. ' +
      'Use schedule_type "once" for a single execution (e.g. "tomorrow at 9am", "in 2 hours", "2026-03-01T09:00:00"), ' +
      '"cron" for a recurring cron expression (e.g. "0 9 * * 1-5" = every weekday at 9am), ' +
      '"interval" for natural interval phrases (e.g. "every 30 minutes", "every 2 hours", "every day"). ' +
      'Returns the created job ID and the human-readable schedule confirmation.',
    schema: z.object({
      prompt: z.string().describe('The prompt text to send to Oracle at the scheduled time.'),
      schedule_type: z
        .enum(['once', 'cron', 'interval'])
        .describe('"once" for one-time, "cron" for cron expression, "interval" for natural phrase.'),
      schedule_expression: z
        .string()
        .describe(
          'The schedule expression. For "once": ISO datetime or natural language like "tomorrow at 9am". ' +
          'For "cron": 5-field cron expression like "0 9 * * *". ' +
          'For "interval": phrase like "every 30 minutes" or "every 2 hours".'
        ),
      timezone: z
        .string()
        .optional()
        .describe('IANA timezone (e.g. "America/Sao_Paulo"). Defaults to the global Chronos timezone config.'),
    }),
  }
);

// ─── chronos_list ────────────────────────────────────────────────────────────
export const ChronosListTool = tool(
  async ({ enabled_only }) => {
    try {
      const repo = ChronosRepository.getInstance();
      const jobs = repo.listJobs(enabled_only !== false ? { enabled: true } : {});

      if (jobs.length === 0) {
        return JSON.stringify({ success: true, jobs: [], message: 'No Chronos jobs found.' });
      }

      const summary = jobs.map((j) => ({
        id: j.id,
        prompt: j.prompt.length > 80 ? j.prompt.slice(0, 80) + '…' : j.prompt,
        schedule_type: j.schedule_type,
        schedule_expression: j.schedule_expression,
        next_run_at: j.next_run_at != null ? new Date(j.next_run_at).toISOString() : null,
        last_run_at: j.last_run_at != null ? new Date(j.last_run_at).toISOString() : null,
        enabled: j.enabled,
        timezone: j.timezone,
        created_by: j.created_by,
      }));

      return JSON.stringify({ success: true, jobs: summary, total: jobs.length });
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  },
  {
    name: 'chronos_list',
    description:
      'List Chronos scheduled jobs. By default only returns enabled (active) jobs. ' +
      'Set enabled_only to false to include disabled jobs too.',
    schema: z.object({
      enabled_only: z
        .boolean()
        .optional()
        .describe('If true (default), only return enabled jobs. Set to false to include disabled ones.'),
    }),
  }
);

// ─── chronos_cancel ──────────────────────────────────────────────────────────
export const ChronosCancelTool = tool(
  async ({ job_id, action }) => {
    try {
      const repo = ChronosRepository.getInstance();
      const job = repo.getJob(job_id);
      if (!job) {
        return JSON.stringify({ success: false, error: `No job found with id "${job_id}".` });
      }

      if (action === 'delete') {
        repo.deleteJob(job_id);
        return JSON.stringify({ success: true, message: `Job "${job_id}" deleted.` });
      } else if (action === 'disable') {
        repo.disableJob(job_id);
        return JSON.stringify({ success: true, message: `Job "${job_id}" disabled. It can be re-enabled later.` });
      } else {
        repo.enableJob(job_id);
        return JSON.stringify({ success: true, message: `Job "${job_id}" enabled.` });
      }
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  },
  {
    name: 'chronos_cancel',
    description:
      'Manage an existing Chronos job: disable it (pause without losing it), enable it again, or permanently delete it. ' +
      'Use "disable" to pause a recurring job, "delete" to remove it permanently, "enable" to resume a disabled job.',
    schema: z.object({
      job_id: z.string().describe('The UUID of the Chronos job to manage.'),
      action: z
        .enum(['disable', 'enable', 'delete'])
        .describe('"disable" pauses the job, "enable" resumes it, "delete" removes it permanently.'),
    }),
  }
);

// ─── chronos_preview ─────────────────────────────────────────────────────────
export const ChronosPreviewTool = tool(
  async ({ schedule_type, schedule_expression, timezone, occurrences }) => {
    try {
      const cfg = ConfigManager.getInstance().getChronosConfig();
      const tz = timezone ?? cfg.timezone;
      const count = occurrences ?? 3;

      const parsed = parseScheduleExpression(schedule_expression, schedule_type, { timezone: tz });

      let next_occurrences: string[] = [];
      if (schedule_type !== 'once' && parsed.cron_normalized) {
        const timestamps = getNextOccurrences(parsed.cron_normalized, tz, count);
        next_occurrences = timestamps.map((ts) => new Date(ts).toISOString());
      }

      return JSON.stringify({
        success: true,
        valid: true,
        human_readable: parsed.human_readable,
        next_run_at: new Date(parsed.next_run_at).toISOString(),
        next_occurrences,
        timezone: tz,
      });
    } catch (err: any) {
      return JSON.stringify({ success: false, valid: false, error: err.message });
    }
  },
  {
    name: 'chronos_preview',
    description:
      'Preview a schedule expression without creating a job. ' +
      'Shows when the job would next run and the human-readable description. ' +
      'Useful for confirming a schedule before committing to it.',
    schema: z.object({
      schedule_type: z.enum(['once', 'cron', 'interval']).describe('Type of schedule expression.'),
      schedule_expression: z.string().describe('The schedule expression to validate and preview.'),
      timezone: z.string().optional().describe('IANA timezone. Defaults to global Chronos timezone.'),
      occurrences: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe('How many future occurrences to show for recurring schedules (default 3).'),
    }),
  }
);

export const chronosTools = [
  ChronosScheduleTool,
  ChronosListTool,
  ChronosCancelTool,
  ChronosPreviewTool,
];
