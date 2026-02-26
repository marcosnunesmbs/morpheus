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

/**
 * Creates a Date in UTC from a local time in a specific timezone.
 * E.g., createDateInTimezone(2026, 2, 26, 23, 0, 'America/Sao_Paulo') returns
 * a Date representing 23:00 BRT = 02:00 UTC (next day).
 */
function createDateInTimezone(
  year: number, month: number, day: number,
  hour: number, minute: number,
  timezone: string
): Date {
  // Create a candidate UTC date
  const candidateUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  // Get the offset at that moment for the timezone
  const offsetMs = ianaToOffsetMinutes(timezone, new Date(candidateUtc)) * 60_000;
  // Subtract offset: if BRT is -180 min (-3h), local 23:00 = UTC 23:00 - (-3h) = UTC 02:00
  return new Date(candidateUtc - offsetMs);
}

/**
 * Gets the current date components (year, month, day) in a specific timezone.
 */
function getDatePartsInTimezone(date: Date, timezone: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find(p => p.type === 'year')!.value, 10),
    month: parseInt(parts.find(p => p.type === 'month')!.value, 10),
    day: parseInt(parts.find(p => p.type === 'day')!.value, 10),
  };
}

/**
 * Parses Portuguese time expressions and converts to ISO 8601 format.
 * Handles patterns like "às 15h", "hoje às 15:30", "amanhã às 9h".
 */
function parsePortugueseTimeExpression(expression: string, refDate: Date, timezone: string): Date | null {
  const lower = expression.toLowerCase().trim();
  const { year, month, day } = getDatePartsInTimezone(refDate, timezone);

  // Pattern: "às 15h", "as 15h", "às 15:30", "as 15:30"
  const timeOnlyMatch = lower.match(/^(?:à|a)s?\s+(\d{1,2})(?::(\d{2}))?h?$/);
  if (timeOnlyMatch) {
    const hour = parseInt(timeOnlyMatch[1], 10);
    const minute = timeOnlyMatch[2] ? parseInt(timeOnlyMatch[2], 10) : 0;

    let result = createDateInTimezone(year, month, day, hour, minute, timezone);
    // If time is in the past today, schedule for tomorrow
    if (result.getTime() <= refDate.getTime()) {
      result = createDateInTimezone(year, month, day + 1, hour, minute, timezone);
    }
    return result;
  }

  // Pattern: "hoje às 15h", "hoje as 15:30"
  const todayMatch = lower.match(/^hoje\s+(?:à|a)s?\s+(\d{1,2})(?::(\d{2}))?h?$/);
  if (todayMatch) {
    const hour = parseInt(todayMatch[1], 10);
    const minute = todayMatch[2] ? parseInt(todayMatch[2], 10) : 0;

    const result = createDateInTimezone(year, month, day, hour, minute, timezone);
    // If already passed, return null (can't schedule in the past)
    if (result.getTime() <= refDate.getTime()) {
      return null;
    }
    return result;
  }

  // Pattern: "amanhã às 15h", "amanha as 15:30", "amanhã às 15h da tarde"
  const tomorrowMatch = lower.match(/^amanh[aã]\s+(?:à|a)s?\s+(\d{1,2})(?::(\d{2}))?h?(?:\s+(?:da|do)\s+(?:manh[aã]|tarde|noite))?$/);
  if (tomorrowMatch) {
    const hour = parseInt(tomorrowMatch[1], 10);
    const minute = tomorrowMatch[2] ? parseInt(tomorrowMatch[2], 10) : 0;

    return createDateInTimezone(year, month, day + 1, hour, minute, timezone);
  }

  // Pattern: "daqui a X minutos/horas/dias"
  const relativeMatch = lower.match(/^daqui\s+a\s+(\d+)\s+(minutos?|horas?|dias?|semanas?)$/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const ms = unit.startsWith('min') ? amount * 60_000
             : unit.startsWith('hor') ? amount * 3_600_000
             : unit.startsWith('dia') ? amount * 86_400_000
             : amount * 7 * 86_400_000;
    return new Date(refDate.getTime() + ms);
  }
  
  return null;
}

/**
 * Converts an IANA timezone name (e.g. "America/Sao_Paulo") to a UTC offset in minutes.
 * chrono-node only understands abbreviations (EST, BRT) and numeric offsets,
 * NOT IANA names — passing an unrecognised string makes it silently fall back
 * to the system timezone, which breaks on servers running in UTC.
 */
function ianaToOffsetMinutes(timezone: string, refDate: Date): number {
  try {
    const utcStr = refDate.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr  = refDate.toLocaleString('en-US', { timeZone: timezone });
    return Math.round((new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60_000);
  } catch {
    return 0; // fall back to UTC on invalid timezone
  }
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

      // 2. Portuguese time expressions: "às 15h", "hoje às 15:30", "amanhã às 9h", "daqui a 30 minutos"
      if (!parsed) {
        parsed = parsePortugueseTimeExpression(expression, refDate, timezone);
      }

      // 3. ISO 8601
      if (!parsed) {
        const isoDate = new Date(expression);
        if (!isNaN(isoDate.getTime())) parsed = isoDate;
      }

      // 4. chrono-node NLP fallback ("tomorrow at 9am", "next friday", etc.)
      if (!parsed) {
        // chrono-node does NOT support IANA timezone names — convert to numeric offset
        const tzOffset = ianaToOffsetMinutes(timezone, refDate);
        const results = chrono.parse(expression, { instant: refDate, timezone: tzOffset });
        if (results.length > 0 && results[0].date()) {
          parsed = results[0].date()!;
        }
      }

      if (!parsed) {
        throw new Error(
          `Could not parse date/time expression: "${expression}". ` +
          `Try: "in 30 minutes", "in 2 hours", "tomorrow at 9am", "next friday at 3pm", ` +
          `"às 15h", "hoje às 15:30", "amanhã às 9h", "daqui a 30 minutos", or an ISO 8601 datetime.`
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
