import { WebhookRepository } from './repository.js';
import { DisplayManager } from '../display.js';
import type { IOracle } from '../types.js';
import type { Webhook } from './types.js';
import type { TelegramAdapter } from '../../channels/telegram.js';

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
      await oracle.chat(message, undefined, false, {
        origin_channel: 'webhook',
        session_id: `webhook-${webhook.id}`,
        origin_message_id: notificationId,
      });
      this.display.log(
        `Webhook "${webhook.name}" accepted and queued (notification: ${notificationId})`,
        { source: 'Webhooks', level: 'success' },
      );
    } catch (err: any) {
      const result = `Execution error: ${err.message}`;
      this.display.log(
        `Webhook "${webhook.name}" failed: ${err.message}`,
        { source: 'Webhooks', level: 'error' },
      );
      repo.updateNotificationResult(notificationId, 'failed', result);
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
