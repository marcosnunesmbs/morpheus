import { WebhookRepository } from './repository.js';
import { TaskRepository } from '../tasks/repository.js';
import { DisplayManager } from '../display.js';
import type { IOracle } from '../types.js';
import type { Webhook } from './types.js';
import type { TelegramAdapter } from '../../channels/telegram.js';

const STALE_NOTIFICATION_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export class WebhookDispatcher {
  private static telegramAdapter: TelegramAdapter | null = null;
  private static oracle: IOracle | null = null;
  private display = DisplayManager.getInstance();

  /**
   * Called at boot time after TelegramAdapter.connect() succeeds,
   * so Telegram notifications can be dispatched from any trigger.
   */
  public static setTelegramAdapter(adapter: TelegramAdapter): void {
    WebhookDispatcher.telegramAdapter = adapter;
  }

  /**
   * Called at boot time with the Oracle instance so webhooks can use
   * the full Oracle (MCPs, apoc_delegate, memory, etc.).
   */
  public static setOracle(oracle: IOracle): void {
    WebhookDispatcher.oracle = oracle;
  }

  /**
   * Main orchestration method — runs in background (fire-and-forget).
   * 1. Builds the agent prompt from webhook.prompt + payload
   * 2. Sends to Oracle for async task enqueue
   * 3. Final result is persisted by TaskNotifier through TaskDispatcher
   */
  public async dispatch(
    webhook: Webhook,
    payload: unknown,
    notificationId: string,
  ): Promise<void> {
    const repo = WebhookRepository.getInstance();
    const oracle = WebhookDispatcher.oracle;

    if (!oracle) {
      const errMsg = 'Oracle not available — webhook cannot be processed.';
      this.display.log(errMsg, { source: 'Webhooks', level: 'error' });
      repo.updateNotificationResult(notificationId, 'failed', errMsg);
      return;
    }

    const message = this.buildPrompt(webhook.prompt, payload);

    try {
      const response = await oracle.chat(message, undefined, false, {
        origin_channel: 'webhook',
        session_id: `webhook-${webhook.id}`,
        origin_message_id: notificationId,
      });

      // Check whether Oracle delegated a task for this notification.
      // If a task exists with this origin_message_id, TaskNotifier will update
      // the notification when the task completes. If not (Oracle answered
      // directly), mark it completed now with the direct response.
      const taskRepo = TaskRepository.getInstance();
      const delegatedTask = taskRepo.findTaskByOriginMessageId(notificationId);

      if (delegatedTask) {
        this.display.log(
          `Webhook "${webhook.name}" accepted and queued (notification: ${notificationId})`,
          { source: 'Webhooks', level: 'success' },
        );
      } else {
        repo.updateNotificationResult(notificationId, 'completed', response);
        this.display.log(
          `Webhook "${webhook.name}" completed with direct response (notification: ${notificationId})`,
          { source: 'Webhooks', level: 'success' },
        );
        if (webhook.notification_channels.includes('telegram')) {
          await this.sendTelegram(webhook.name, response, 'completed');
        }
      }
    } catch (err: any) {
      const result = `Execution error: ${err.message}`;
      this.display.log(
        `Webhook "${webhook.name}" failed: ${err.message}`,
        { source: 'Webhooks', level: 'error' },
      );
      repo.updateNotificationResult(notificationId, 'failed', result);
      if (webhook.notification_channels.includes('telegram')) {
        await this.sendTelegram(webhook.name, result, 'failed');
      }
    }
  }

  /**
   * Combines the user-authored webhook prompt with the received payload.
   */
  private buildPrompt(webhookPrompt: string, payload: unknown): string {
    const payloadStr = JSON.stringify(payload, null, 2);
    return `${webhookPrompt}

---
RECEIVED WEBHOOK PAYLOAD:
\`\`\`json
${payloadStr}
\`\`\`

Analyze the payload above and follow the instructions provided. Be concise and actionable in your response.`;
  }

  /**
   * Called at startup to re-dispatch webhook notifications that got stuck in
   * 'pending' status (e.g. from a previous crash or from the direct-response
   * bug). Skips notifications that already have an active task running.
   */
  public static async recoverStale(): Promise<void> {
    const display = DisplayManager.getInstance();
    const oracle = WebhookDispatcher.oracle;

    if (!oracle) {
      display.log('Webhook recovery skipped — Oracle not available.', {
        source: 'Webhooks',
        level: 'warning',
      });
      return;
    }

    const repo = WebhookRepository.getInstance();
    const taskRepo = TaskRepository.getInstance();
    const stale = repo.findStaleNotifications(STALE_NOTIFICATION_THRESHOLD_MS);

    if (stale.length === 0) return;

    display.log(`Recovering ${stale.length} stale webhook notification(s)...`, {
      source: 'Webhooks',
      level: 'warning',
    });

    for (const notification of stale) {
      // Skip if a task is still active for this notification
      const activeTask = taskRepo.findTaskByOriginMessageId(notification.id);
      if (activeTask && (activeTask.status === 'pending' || activeTask.status === 'running')) {
        display.log(
          `Webhook notification ${notification.id} has active task ${activeTask.id} — skipping recovery.`,
          { source: 'Webhooks' },
        );
        continue;
      }

      const webhook = repo.getWebhookById(notification.webhook_id);
      if (!webhook || !webhook.enabled) {
        repo.updateNotificationResult(
          notification.id,
          'failed',
          webhook ? 'Webhook was disabled.' : 'Webhook no longer exists.',
        );
        continue;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(notification.payload);
      } catch {
        payload = {};
      }

      display.log(
        `Re-dispatching stale notification ${notification.id} for webhook "${webhook.name}".`,
        { source: 'Webhooks' },
      );

      // Sequential await — recovery dispatches run one at a time.
      // Firing all at once would flood Oracle and cause concurrent
      // EmbeddingService initializations, leading to repeated ONNX errors.
      try {
        const dispatcher = new WebhookDispatcher();
        await dispatcher.dispatch(webhook, payload, notification.id);
      } catch (err: any) {
        display.log(
          `Recovery dispatch error for notification ${notification.id}: ${err.message}`,
          { source: 'Webhooks', level: 'error' },
        );
      }
    }
  }

  /**
   * Sends a formatted Telegram message to all allowed users.
   * Silently skips if the adapter is not connected.
   */
  private async sendTelegram(
    webhookName: string,
    result: string,
    status: 'completed' | 'failed',
  ): Promise<void> {
    const adapter = WebhookDispatcher.telegramAdapter;
    if (!adapter) {
      this.display.log(
        'Telegram notification skipped — adapter not connected.',
        { source: 'Webhooks', level: 'warning' },
      );
      return;
    }

    try {
      const icon = status === 'completed' ? '✅' : '❌';
      const truncated = result.length > 3500 ? result.slice(0, 3500) + '…' : result;
      const message = `${icon} Webhook: ${webhookName}\n\n${truncated}`;
      await adapter.sendMessage(message);
    } catch (err: any) {
      this.display.log(
        `Failed to send Telegram notification for webhook "${webhookName}": ${err.message}`,
        { source: 'Webhooks', level: 'error' },
      );
    }
  }
}
