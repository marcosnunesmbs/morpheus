import { Router } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { homedir } from 'os';
import fs from 'fs-extra';
import { z } from 'zod';
import { SatiRepository } from '../../runtime/memory/sati/repository.js';
import { DisplayManager } from '../../runtime/display.js';

/**
 * Valid categories the user can choose to delete.
 */
const VALID_CATEGORIES = [
  'sessions',   // sessions + messages
  'memories',   // sati-memory.db (long-term memory, embeddings, session chunks)
  'tasks',      // background tasks
  'audit',      // audit_events
  'chronos',    // chronos_jobs + chronos_executions
  'webhooks',   // webhooks + webhook_notifications
] as const;

const ResetBodySchema = z.object({
  categories: z.array(z.enum(VALID_CATEGORIES)).min(1, 'At least one category must be selected'),
});

export type ResetCategory = (typeof VALID_CATEGORIES)[number];

/**
 * Creates the Danger Zone API router.
 * Provides destructive operations for resetting user data.
 */
export function createDangerRouter(): Router {
  const router = Router();
  const display = DisplayManager.getInstance();

  /**
   * GET /api/danger/categories — List available reset categories
   */
  router.get('/categories', (_req, res) => {
    res.json({
      categories: VALID_CATEGORIES.map((id) => ({ id })),
    });
  });

  /**
   * DELETE /api/danger/reset — Purge selected user data
   *
   * Body: { categories: ['sessions', 'memories', 'tasks', 'audit', 'chronos', 'webhooks'] }
   */
  router.delete('/reset', async (req, res) => {
    // Validate body
    const parsed = ResetBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues.map((i) => i.message),
      });
    }

    const { categories } = parsed.data;

    try {
      const memoryDir = path.join(homedir(), '.morpheus', 'memory');
      const shortMemoryPath = path.join(memoryDir, 'short-memory.db');
      const satiMemoryPath = path.join(memoryDir, 'sati-memory.db');

      const counts: Record<string, number> = {};

      // ─── 1. Purge short-memory.db tables based on selected categories ───
      const needsShortDb = categories.some((c) =>
        ['sessions', 'tasks', 'audit', 'chronos', 'webhooks'].includes(c)
      );

      if (needsShortDb && fs.existsSync(shortMemoryPath)) {
        const db = new Database(shortMemoryPath, { timeout: 5000 });
        db.pragma('journal_mode = WAL');

        const transaction = db.transaction(() => {
          if (categories.includes('sessions')) {
            const msgResult = db.prepare('DELETE FROM messages').run();
            counts.messages = msgResult.changes;
            const sessResult = db.prepare('DELETE FROM sessions').run();
            counts.sessions = sessResult.changes;
          }

          if (categories.includes('tasks')) {
            const taskResult = db.prepare('DELETE FROM tasks').run();
            counts.tasks = taskResult.changes;
          }

          if (categories.includes('audit')) {
            const auditResult = db.prepare('DELETE FROM audit_events').run();
            counts.audit_events = auditResult.changes;
          }

          if (categories.includes('chronos')) {
            const jobsResult = db.prepare('DELETE FROM chronos_jobs').run();
            counts.chronos_jobs = jobsResult.changes;
            const execResult = db.prepare('DELETE FROM chronos_executions').run();
            counts.chronos_executions = execResult.changes;
          }

          if (categories.includes('webhooks')) {
            const notifResult = db.prepare('DELETE FROM webhook_notifications').run();
            counts.webhook_notifications = notifResult.changes;
            const whResult = db.prepare('DELETE FROM webhooks').run();
            counts.webhooks = whResult.changes;
          }
        });

        transaction();
        db.close();
      }

      // ─── 2. Purge sati-memory.db (close, delete, recreate) ───
      if (categories.includes('memories')) {
        const satiRepo = SatiRepository.getInstance();
        satiRepo.close();

        if (fs.existsSync(satiMemoryPath)) {
          fs.removeSync(satiMemoryPath);
          fs.removeSync(satiMemoryPath + '-wal');
          fs.removeSync(satiMemoryPath + '-shm');
          counts.sati_memory = 1;
        }

        // Reinitialize so schema is recreated cleanly
        satiRepo.initialize();
      }

      display.log(`🗑️ Data reset via Danger Zone: [${categories.join(', ')}]`, {
        source: 'DangerZone',
        level: 'warning',
      });

      res.json({
        success: true,
        message: 'Selected data has been reset successfully.',
        categories,
        deleted: counts,
      });
    } catch (error) {
      display.log(`❌ Danger Zone reset failed: ${error}`, {
        source: 'DangerZone',
        level: 'error',
      });
      res.status(500).json({
        error: 'Failed to reset data',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
