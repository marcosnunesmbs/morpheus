import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChronosWorker } from './worker.js';
import type { ChronosRepository, ChronosJob } from './repository.js';
import type { IOracle } from '../types.js';

// Mock ConfigManager and DisplayManager
vi.mock('../../config/manager.js', () => ({
  ConfigManager: {
    getInstance: () => ({
      getChronosConfig: () => ({ timezone: 'UTC', check_interval_ms: 60000, max_active_jobs: 100 }),
    }),
  },
}));

vi.mock('../display.js', () => ({
  DisplayManager: {
    getInstance: () => ({
      log: vi.fn(),
    }),
  },
}));

function makeJob(overrides: Partial<ChronosJob> = {}): ChronosJob {
  return {
    id: 'job-1',
    prompt: 'Say hello',
    schedule_type: 'once',
    schedule_expression: 'in 1 hour',
    cron_normalized: null,
    timezone: 'UTC',
    next_run_at: Date.now() - 1000,
    last_run_at: null,
    enabled: true,
    created_at: Date.now() - 5000,
    updated_at: Date.now() - 5000,
    created_by: 'ui',
    ...overrides,
  };
}

function makeRepo(jobs: ChronosJob[] = []): ChronosRepository {
  return {
    getDueJobs: vi.fn().mockReturnValue(jobs),
    insertExecution: vi.fn(),
    completeExecution: vi.fn(),
    disableJob: vi.fn(),
    enableJob: vi.fn(),
    updateJob: vi.fn(),
    pruneExecutions: vi.fn(),
    createJob: vi.fn(),
    getJob: vi.fn(),
    listJobs: vi.fn(),
    deleteJob: vi.fn(),
    listExecutions: vi.fn(),
    close: vi.fn(),
  } as unknown as ChronosRepository;
}

function makeOracle(): IOracle {
  return {
    chat: vi.fn().mockResolvedValue('Oracle response'),
    setSessionId: vi.fn().mockResolvedValue(undefined),
    getCurrentSessionId: vi.fn().mockReturnValue('user-session-1'),
    initialize: vi.fn(),
    getHistory: vi.fn(),
    createNewSession: vi.fn(),
    clearMemory: vi.fn(),
    reloadTools: vi.fn(),
  } as unknown as IOracle;
}

describe('ChronosWorker.tick()', () => {
  it('isRunning guard prevents concurrent execution', async () => {
    const repo = makeRepo([]);
    const oracle = makeOracle();
    const worker = new ChronosWorker(repo, oracle);

    // Set isRunning to true via tick (accessing private via casting)
    (worker as any).isRunning = true;
    await worker.tick();
    expect(repo.getDueJobs).not.toHaveBeenCalled();
  });

  it('calls getDueJobs with current timestamp', async () => {
    const repo = makeRepo([]);
    const oracle = makeOracle();
    const worker = new ChronosWorker(repo, oracle);
    const before = Date.now();
    await worker.tick();
    const after = Date.now();
    const [[ts]] = (repo.getDueJobs as any).mock.calls;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('triggers oracle.chat for a once-type due job then disables it', async () => {
    const job = makeJob({ schedule_type: 'once' });
    const repo = makeRepo([job]);
    const oracle = makeOracle();
    const worker = new ChronosWorker(repo, oracle);
    await worker.tick();
    // Wait for fire-and-forget
    await new Promise((r) => setTimeout(r, 50));
    expect(oracle.chat).toHaveBeenCalledWith(expect.stringContaining(job.prompt));
    expect(repo.disableJob).toHaveBeenCalledWith(job.id);
    expect(repo.updateJob).not.toHaveBeenCalled();
  });

  it('triggers oracle.chat for a recurring job then updates next_run_at', async () => {
    const job = makeJob({ schedule_type: 'cron', cron_normalized: '0 9 * * *' });
    const repo = makeRepo([job]);
    const oracle = makeOracle();
    const worker = new ChronosWorker(repo, oracle);
    await worker.tick();
    await new Promise((r) => setTimeout(r, 50));
    expect(oracle.chat).toHaveBeenCalledWith(expect.stringContaining(job.prompt));
    expect(repo.disableJob).not.toHaveBeenCalled();
    expect(repo.updateJob).toHaveBeenCalledWith(
      job.id,
      expect.objectContaining({ next_run_at: expect.any(Number) })
    );
  });

  it('sets execution status to failed when oracle.chat rejects', async () => {
    const job = makeJob({ schedule_type: 'once' });
    const repo = makeRepo([job]);
    const oracle = makeOracle();
    (oracle.chat as any).mockRejectedValue(new Error('LLM error'));
    const worker = new ChronosWorker(repo, oracle);
    await worker.tick();
    await new Promise((r) => setTimeout(r, 50));
    expect(repo.completeExecution).toHaveBeenCalledWith(
      expect.any(String),
      'failed',
      'LLM error'
    );
    // For once-type, still auto-disable even on failure
    expect(repo.disableJob).toHaveBeenCalledWith(job.id);
  });
});
