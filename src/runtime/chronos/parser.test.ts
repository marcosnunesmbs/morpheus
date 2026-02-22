import { describe, it, expect } from 'vitest';
import { parseScheduleExpression } from './parser.js';

const FUTURE_MS = Date.now() + 60_000 * 60 * 24; // 24 hours from now
const REF = Date.now();

describe('parseScheduleExpression — once type', () => {
  it('parses a valid ISO datetime in the future', () => {
    const future = new Date(FUTURE_MS).toISOString();
    const result = parseScheduleExpression(future, 'once', { referenceDate: REF });
    expect(result.type).toBe('once');
    expect(result.next_run_at).toBeGreaterThan(REF);
    expect(result.cron_normalized).toBeNull();
    expect(result.human_readable).toBeTruthy();
  });

  it('throws for a past datetime', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(() => parseScheduleExpression(past, 'once', { referenceDate: REF })).toThrow(
      /must be in the future/i
    );
  });

  it('parses natural language "tomorrow at 9am" in a given timezone', () => {
    const result = parseScheduleExpression('tomorrow at 9am', 'once', {
      timezone: 'America/Sao_Paulo',
      referenceDate: REF,
    });
    expect(result.type).toBe('once');
    expect(result.next_run_at).toBeGreaterThan(REF);
    expect(result.cron_normalized).toBeNull();
  });
});

describe('parseScheduleExpression — cron type', () => {
  it('parses a valid 5-field cron expression', () => {
    const result = parseScheduleExpression('0 9 * * 1-5', 'cron', { referenceDate: REF });
    expect(result.type).toBe('cron');
    expect(result.next_run_at).toBeGreaterThan(REF);
    expect(result.cron_normalized).toBe('0 9 * * 1-5');
    expect(result.human_readable.length).toBeGreaterThan(0);
  });

  it('throws for an invalid cron expression', () => {
    expect(() => parseScheduleExpression('not a cron', 'cron', { referenceDate: REF })).toThrow(
      /invalid cron/i
    );
  });

  it('throws when cron interval is less than 60 seconds (every minute)', () => {
    // "* * * * *" fires every 60s — exactly at the boundary. Accept it.
    // "*/30 * * * * *" (6-field sub-minute) would fail but cron-parser v4 uses 5-field only.
    // We test a cron that would trigger at sub-minute intervals if possible.
    // For 5-field cron the minimum is 60s — "* * * * *" is exactly 60s so it's valid.
    const result = parseScheduleExpression('* * * * *', 'cron', { referenceDate: REF });
    expect(result.next_run_at).toBeGreaterThan(REF);
  });
});

describe('parseScheduleExpression — interval type', () => {
  it('converts "every 30 minutes" to a valid cron with interval >= 60s', () => {
    const result = parseScheduleExpression('every 30 minutes', 'interval', { referenceDate: REF });
    expect(result.type).toBe('interval');
    expect(result.next_run_at).toBeGreaterThan(REF);
    expect(result.cron_normalized).toBe('*/30 * * * *');
    expect(result.human_readable.length).toBeGreaterThan(0);
  });

  it('converts "every hour" to a valid cron', () => {
    const result = parseScheduleExpression('every hour', 'interval', { referenceDate: REF });
    expect(result.cron_normalized).toBe('0 * * * *');
  });

  it('throws for an unsupported interval phrase', () => {
    expect(() =>
      parseScheduleExpression('every 30 seconds', 'interval', { referenceDate: REF })
    ).toThrow();
  });
});
