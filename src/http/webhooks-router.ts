import { Router } from 'express';
import { z } from 'zod';
import { WebhookRepository } from '../runtime/webhooks/repository.js';
import { WebhookDispatcher } from '../runtime/webhooks/dispatcher.js';
import { authMiddleware } from './middleware/auth.js';
import { DisplayManager } from '../runtime/display.js';

const CreateWebhookSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-_]+$/, 'Name must be a slug: lowercase letters, numbers, hyphens, underscores only'),
  prompt: z.string().min(1).max(10_000),
  notification_channels: z.array(z.enum(['ui', 'telegram', 'discord'])).min(1).default(['ui']),
});

const UpdateWebhookSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-_]+$/, 'Name must be a slug')
    .optional(),
  prompt: z.string().min(1).max(10_000).optional(),
  enabled: z.boolean().optional(),
  notification_channels: z.array(z.enum(['ui', 'telegram', 'discord'])).min(1).optional(),
});

const MarkReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export function createWebhooksRouter(): Router {
  const router = Router();
  const repo = WebhookRepository.getInstance();
  const display = DisplayManager.getInstance();
  const dispatcher = new WebhookDispatcher();

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC TRIGGER ENDPOINT — no authMiddleware, api_key validated via header
  // Must be declared BEFORE router.use(authMiddleware) below
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/trigger/:webhook_name', async (req, res) => {
    const { webhook_name } = req.params;
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(401).json({ error: 'Missing x-api-key header' });
    }

    const webhook = repo.getAndValidateWebhook(webhook_name, apiKey);
    if (!webhook) {
      // Intentionally ambiguous — don't reveal whether the name exists or is disabled
      return res.status(401).json({ error: 'Invalid webhook name or api key' });
    }

    const payload = req.body ?? {};

    // Create pending notification immediately
    const notification = repo.createNotification({
      webhook_id: webhook.id,
      webhook_name: webhook.name,
      payload: JSON.stringify(payload),
    });

    // Increment trigger counter
    repo.recordTrigger(webhook.id);

    display.log(
      `Webhook "${webhook.name}" triggered (notification: ${notification.id})`,
      { source: 'Webhooks' },
    );

    // Fire-and-forget — respond immediately with 202
    setImmediate(() => {
      dispatcher.dispatch(webhook, payload, notification.id).catch((err) => {
        display.log(
          `Unhandled webhook dispatch error for "${webhook.name}": ${err.message}`,
          { source: 'Webhooks', level: 'error' },
        );
      });
    });

    return res.status(202).json({
      accepted: true,
      notification_id: notification.id,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // NOTIFICATION ENDPOINTS — declared before /:id to prevent route conflict
  // (still public here, authMiddleware applied below protects management routes)
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/notifications', authMiddleware, (req, res) => {
    try {
      const { webhookId, unreadOnly } = req.query;
      const notifications = repo.listNotifications({
        webhookId: typeof webhookId === 'string' ? webhookId : undefined,
        unreadOnly: unreadOnly === 'true',
      });
      res.json(notifications);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/notifications/read', authMiddleware, (req, res) => {
    const parsed = MarkReadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues });
    }
    try {
      repo.markNotificationsRead(parsed.data.ids);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/notifications/unread-count', authMiddleware, (req, res) => {
    try {
      const count = repo.countUnread();
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // WEBHOOK MANAGEMENT ENDPOINTS — all require authMiddleware
  // ─────────────────────────────────────────────────────────────────────────────

  router.use(authMiddleware);

  // GET /api/webhooks — list all webhooks
  router.get('/', (req, res) => {
    try {
      const webhooks = repo.listWebhooks();
      res.json(webhooks);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/webhooks — create a webhook
  router.post('/', (req, res) => {
    const parsed = CreateWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues });
    }
    try {
      const webhook = repo.createWebhook(parsed.data);
      res.status(201).json(webhook);
    } catch (err: any) {
      // SQLite UNIQUE constraint error
      if (err.message?.includes('UNIQUE constraint failed: webhooks.name')) {
        return res.status(409).json({ error: `A webhook with name "${parsed.data.name}" already exists` });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/webhooks/:id — get one webhook
  router.get('/:id', (req, res) => {
    const webhook = repo.getWebhookById(req.params.id);
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });
    res.json(webhook);
  });

  // PUT /api/webhooks/:id — update a webhook
  router.put('/:id', (req, res) => {
    const parsed = UpdateWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues });
    }
    try {
      const updated = repo.updateWebhook(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: 'Webhook not found' });
      res.json(updated);
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint failed: webhooks.name')) {
        return res.status(409).json({ error: `A webhook with that name already exists` });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/webhooks/:id — delete a webhook
  router.delete('/:id', (req, res) => {
    try {
      const deleted = repo.deleteWebhook(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Webhook not found' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
