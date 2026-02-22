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

  // ── Quantified intervals ──────────────────────────────────────────────────

  // "every N minutes"
  const minuteMatch = lower.match(/every\s+(\d+)\s+min(?:ute)?s?/);
  if (minuteMatch) return `*/${minuteMatch[1]} * * * *`;

  // "every N hours"
  const hourMatch = lower.match(/every\s+(\d+)\s+hours?/);
  if (hourMatch) return `0 */${hourMatch[1]} * * *`;

  // "every N days"
  const dayMatch = lower.match(/every\s+(\d+)\s+days?/);
  if (dayMatch) return `0 0 */${dayMatch[1]} * *`;

  // "every N weeks" → approximate as every N*7 days
  const weekNMatch = lower.match(/every\s+(\d+)\s+weeks?/);
  if (weekNMatch) return `0 0 */${Number(weekNMatch[1]) * 7} * *`;

  // ── Single-unit shorthands ────────────────────────────────────────────────

  if (/every\s+minute/.test(lower)) return `* * * * *`;
  if (/every\s+hour/.test(lower)) return `0 * * * *`;
  if (/every\s+day/.test(lower) || lower === 'daily') return `0 0 * * *`;
  if (/every\s+week(?!\w)/.test(lower) || lower === 'weekly') return `0 0 * * 0`;

  // ── Weekday / weekend ─────────────────────────────────────────────────────

  if (/every\s+weekday/.test(lower)) return `0 0 * * 1-5`;
  if (/every\s+weekend/.test(lower)) return `0 0 * * 0,6`;

  // ── Named day(s)-of-week with optional "at HH[:MM] [am|pm]" ─────────────
  // Handles single and multiple days:
  //   "every monday"
  //   "every monday and sunday at 9am"
  //   "every monday, wednesday and friday at 18:30"

  const DOW: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
  };

  const DAY_NAMES = 'sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat';

  // Strip the leading "every " then capture the day-list and optional time tail
  const multiDowRe = new RegExp(
    `^every\\s+((?:(?:${DAY_NAMES})(?:\\s*(?:,|\\band\\b)\\s*)?)*)(?:\\s+at\\s+(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?)?$`
  );
  const multiDowMatch = lower.match(multiDowRe);
  if (multiDowMatch) {
    const dayListStr = multiDowMatch[1];
    const foundDays = dayListStr.match(new RegExp(DAY_NAMES, 'g'));
    if (foundDays && foundDays.length > 0) {
      const dowValues = [...new Set(foundDays.map((d) => DOW[d]))].sort((a, b) => a - b);

      let hour = 0;
      let minute = 0;
      if (multiDowMatch[2]) {
        hour = parseInt(multiDowMatch[2], 10);
        minute = multiDowMatch[3] ? parseInt(multiDowMatch[3], 10) : 0;
        const period = multiDowMatch[4];
        if (period === 'pm' && hour < 12) hour += 12;
        if (period === 'am' && hour === 12) hour = 0;
      }

      return `${minute} ${hour} * * ${dowValues.join(',')}`;
    }
  }

  throw new Error(
    `Cannot parse interval expression: "${expression}". ` +
    `Supported formats: "every N minutes/hours/days/weeks", "every minute/hour/day/week", ` +
    `"every monday [at 9am]", "every monday and friday at 18:30", "every weekday", "every weekend", "daily", "weekly".`
  );
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
      let parsed: Date | null = null;

      // 1. Relative duration: "in N minutes/hours/days/weeks" (handles abbreviations like "in 5 min")
      const relMatch = expression.toLowerCase().trim().match(
        /^in\s+(\d+)\s+(min(?:ute)?s?|hours?|days?|weeks?)$/
      );
      if (relMatch) {
        const amount = parseInt(relMatch[1], 10);
        const unit = relMatch[2];
        const ms = unit.startsWith('min') ? amount * 60_000
                 : unit.startsWith('hour') ? amount * 3_600_000
                 : unit.startsWith('day') ? amount * 86_400_000
                 : amount * 7 * 86_400_000;
        parsed = new Date(refDate.getTime() + ms);
      }

      // 2. ISO 8601
      if (!parsed) {
        const isoDate = new Date(expression);
        if (!isNaN(isoDate.getTime())) parsed = isoDate;
      }

      // 3. chrono-node NLP fallback ("tomorrow at 9am", "next friday", etc.)
      if (!parsed) {
        const results = chrono.parse(expression, { instant: refDate, timezone });
        if (results.length > 0 && results[0].date()) {
          parsed = results[0].date()!;
        }
      }

      if (!parsed) {
        throw new Error(
          `Could not parse date/time expression: "${expression}". ` +
          `Try: "in 30 minutes", "in 2 hours", "tomorrow at 9am", "next friday at 3pm", or an ISO 8601 datetime.`
        );
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
