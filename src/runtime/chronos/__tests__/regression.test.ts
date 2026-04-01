import { describe, it, expect } from 'vitest';
import { parseScheduleExpression } from '../parser.js';

describe('Chronos Parser - Regression Tests', () => {
  it('should throw a helpful error instead of crashing when expression is undefined', () => {
    // @ts-ignore - testing runtime safety for undefined input
    expect(() => parseScheduleExpression(undefined, 'once')).toThrow('Schedule expression is required.');
  });

  it('should throw a helpful error instead of crashing when expression is empty string', () => {
    expect(() => parseScheduleExpression('', 'once')).toThrow('Schedule expression is required.');
  });

  it('should parse "in 2 minutes" correctly (the reported case)', () => {
    const now = Date.now();
    const result = parseScheduleExpression('in 2 minutes', 'once', { referenceDate: now });
    
    // Result should be approximately 2 minutes from now (allow small drift)
    const expectedTime = now + (2 * 60 * 1000);
    expect(result.next_run_at).toBeGreaterThanOrEqual(expectedTime - 1000);
    expect(result.next_run_at).toBeLessThanOrEqual(expectedTime + 1000);
    expect(result.type).toBe('once');
  });
});
