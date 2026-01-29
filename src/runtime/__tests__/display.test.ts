import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DisplayManager } from '../display.js';

// Hoisted mocks to ensure they are available for the module mock factory
const mocks = vi.hoisted(() => {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  };
});

// We need a way to control isSpinning. 
// Since the factory runs hoisting, we can't easily closure over a let variable unless we put it on the mocks object or similar.
// But we can just make the mock implementation toggle a property on itself or use a side channel?
// Simplest: Mock object manages its own state? No, DisplayManager reads `.isSpinning`.
// Let's implement logic IN the mock.

let isSpinningInternal = false;

vi.mock('ora', () => {
  return {
    default: vi.fn(() => ({
      start: mocks.start.mockImplementation(() => { isSpinningInternal = true; }),
      stop: mocks.stop.mockImplementation(() => { isSpinningInternal = false; }),
      succeed: mocks.succeed.mockImplementation(() => { isSpinningInternal = false; }),
      fail: mocks.fail.mockImplementation(() => { isSpinningInternal = false; }),
      get isSpinning() { return isSpinningInternal; },
      set text(val: string) {},
      get text() { return 'loading...'; }
    }))
  };
});

describe('DisplayManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSpinningInternal = false;
    // We cannot reset the singleton instance as it is private and static.
    // So we must ensure state is consistent via public API in tests or beforeEach.
    const dm = DisplayManager.getInstance();
    dm.stopSpinner(); 
  });

  it('should be a singleton', () => {
    const instance1 = DisplayManager.getInstance();
    const instance2 = DisplayManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should start spinner', () => {
    const dm = DisplayManager.getInstance();
    dm.startSpinner('test spinner');
    expect(mocks.start).toHaveBeenCalledWith('test spinner');
    expect(isSpinningInternal).toBe(true);
  });

  it('should not start spinner again if already spinning', () => {
    const dm = DisplayManager.getInstance();
    dm.startSpinner('first');
    expect(mocks.start).toHaveBeenCalledTimes(1);
    
    // Call again
    dm.startSpinner('second');
    expect(mocks.start).toHaveBeenCalledTimes(1); // Should not call start again
    // It might update text, but start is not called
  });

  it('should stop spinner', () => {
    const dm = DisplayManager.getInstance();
    dm.startSpinner();
    dm.stopSpinner();
    expect(mocks.stop).toHaveBeenCalled();
    expect(isSpinningInternal).toBe(false);
  });

  it('should log message and preserve spinner state', () => {
    const dm = DisplayManager.getInstance();
    dm.startSpinner('spinning');
    
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    dm.log('hello world');
    
    // Flow: stop spinner -> log -> start spinner
    // Calls: start(spinning) -> stop() -> log -> start(spinning)
    
    // Check stop called (after initial start)
    expect(mocks.stop).toHaveBeenCalled();
    
    // Check log called
    expect(consoleSpy).toHaveBeenCalledWith('hello world');
    
    // Check start called again (restore)
    // Total start calls: 1 (initial) + 1 (restore) = 2
    expect(mocks.start).toHaveBeenCalledTimes(2);
    expect(mocks.start).toHaveBeenLastCalledWith('loading...'); // Use mocked text getter
  });

  it('should log message without spinner interaction if not spinning', () => {
     const dm = DisplayManager.getInstance();
     // Ensure stopped
     dm.stopSpinner();
     vi.clearAllMocks(); // Clear calls from setup

     const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

     dm.log('hello world');

     expect(mocks.stop).not.toHaveBeenCalled();
     expect(mocks.start).not.toHaveBeenCalled();
     expect(consoleSpy).toHaveBeenCalledWith('hello world');
  });
});
