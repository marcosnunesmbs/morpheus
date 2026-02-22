import * as chrono from 'chrono-node';
import CronParser from 'cron-parser';
const parseCron = CronParser.parseExpression.bind(CronParser);
import cronstrue from 'cronstrue';
import type { ScheduleType } from './repository.js';

export interface ParsedSchedule {
  type: ScheduleType;
  next_run_at: number;
  cron_normalized: string | null;
  human_readable: string;
}

export interface ParseScheduleOptions {
  timezone?: string;
  referenceDate?: number;
}

// Maps interval phrases like "every 30 minutes" to a cron expression.
function intervalToCron(expression: string): string {
  const lower = expression.toLowerCase().trim();

  // "every N minutes/hours/days/weeks"
  const minuteMatch = lower.match(/every\s+(\d+)\s+min(?:ute)?s?/);
  if (minuteMatch) return `*/${minuteMatch[1]} * * * *`;

  const hourMatch = lower.match(/every\s+(\d+)\s+hour?s?/);
  if (hourMatch) return `0 */${hourMatch[1]} * * *`;

  const dayMatch = lower.match(/every\s+(\d+)\s+day?s?/);
  if (dayMatch) return `0 0 */${dayMatch[1]} * *`;

  // "every minute"
  if (/every\s+minute/.test(lower)) return `* * * * *`;

  // "every hour"
  if (/every\s+hour/.test(lower)) return `0 * * * *`;

  // "every day" or "daily"
  if (/every\s+day/.test(lower) || lower === 'daily') return `0 0 * * *`;

  // "every week" or "weekly"
  if (/every\s+week/.test(lower) || lower === 'weekly') return `0 0 * * 0`;

  throw new Error(`Cannot convert interval expression to cron: "${expression}". Supported formats: "every N minutes", "every N hours", "every N days", "every minute", "every hour", "every day", "every week".`);
}

function formatDatetime(date: Date, timezone: string): string {
  try {
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return date.toISOString();
  }
}

export function parseScheduleExpression(
  expression: string,
  type: ScheduleType,
  opts: ParseScheduleOptions = {}
): ParsedSchedule {
  const timezone = opts.timezone ?? 'UTC';
  const refDate = opts.referenceDate ? new Date(opts.referenceDate) : new Date();

  switch (type) {
    case 'once': {
      // Try ISO 8601 first
      let parsed: Date | null = null;
      const isoDate = new Date(expression);
      if (!isNaN(isoDate.getTime())) {
        parsed = isoDate;
      } else {
        // Fall back to chrono-node NLP parsing
        const results = chrono.parse(expression, { instant: refDate, timezone });
        if (results.length > 0 && results[0].date()) {
          parsed = results[0].date()!;
        }
      }

      if (!parsed) {
        throw new Error(`Could not parse date/time expression: "${expression}". Try an ISO 8601 datetime or natural language like "tomorrow at 9am".`);
      }

      if (parsed.getTime() <= refDate.getTime()) {
        throw new Error(`Scheduled time must be in the future. Got: "${expression}" which resolves to ${parsed.toISOString()}.`);
      }

      return {
        type: 'once',
        next_run_at: parsed.getTime(),
        cron_normalized: null,
        human_readable: formatDatetime(parsed, timezone),
      };
    }

    case 'cron': {
      let interval;
      try {
        interval = parseCron(expression, { tz: timezone, currentDate: refDate });
      } catch (err: any) {
        throw new Error(`Invalid cron expression: "${expression}". ${err.message}`);
      }

      // Enforce minimum 60s interval by checking two consecutive occurrences
      const first = interval.next().toDate();
      const second = interval.next().toDate();
      const intervalMs = second.getTime() - first.getTime();
      if (intervalMs < 60000) {
        throw new Error(`Minimum interval is 60 seconds. The cron expression "${expression}" triggers more frequently.`);
      }

      // Recompute for next_run_at (cron-parser iterator was advanced above)
      const nextInterval = parseCron(expression, { tz: timezone, currentDate: refDate });
      const next = nextInterval.next().toDate();

      let human_readable: string;
      try {
        human_readable = cronstrue.toString(expression, { throwExceptionOnParseError: true });
      } catch {
        human_readable = expression;
      }

      return {
        type: 'cron',
        next_run_at: next.getTime(),
        cron_normalized: expression,
        human_readable,
      };
    }

    case 'interval': {
      const cronExpr = intervalToCron(expression);

      // Validate via cron case (will also enforce minimum 60s)
      const result = parseScheduleExpression(cronExpr, 'cron', opts);

      let human_readable: string;
      try {
        human_readable = cronstrue.toString(cronExpr, { throwExceptionOnParseError: true });
      } catch {
        human_readable = expression;
      }

      return {
        type: 'interval',
        next_run_at: result.next_run_at,
        cron_normalized: cronExpr,
        human_readable,
      };
    }

    default:
      throw new Error(`Unknown schedule type: "${type as string}"`);
  }
}

/**
 * Compute the next occurrence for a recurring job after execution.
 * Used by ChronosWorker after each successful trigger.
 */
export function parseNextRun(
  cronNormalized: string,
  timezone: string,
  referenceDate?: number
): number {
  const refDate = referenceDate ? new Date(referenceDate) : new Date();
  const interval = parseCron(cronNormalized, { tz: timezone, currentDate: refDate });
  return interval.next().toDate().getTime();
}

/**
 * Compute the next N occurrences for a recurring schedule.
 * Used by the preview endpoint.
 */
export function getNextOccurrences(
  cronNormalized: string,
  timezone: string,
  count = 3,
  referenceDate?: number
): number[] {
  const refDate = referenceDate ? new Date(referenceDate) : new Date();
  const interval = parseCron(cronNormalized, { tz: timezone, currentDate: refDate });
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(interval.next().toDate().getTime());
  }
  return results;
}
