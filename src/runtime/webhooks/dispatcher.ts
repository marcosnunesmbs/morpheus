import { Apoc } from '../apoc.js';
import { WebhookRepository } from './repository.js';
import { DisplayManager } from '../display.js';
import type { Webhook } from './types.js';
import type { TelegramAdapter } from '../../channels/telegram.js';

export class WebhookDispatcher {
  private static telegramAdapter: TelegramAdapter | null = null;
  private display = DisplayManager.getInstance();

  /**
   * Called at boot time after TelegramAdapter.connect() succeeds,
   * so Telegram notifications can be dispatched from any trigger.
   */
  public static setTelegramAdapter(adapter: TelegramAdapter): void {
    WebhookDispatcher.telegramAdapter = adapter;
  }

  /**
   * Main orchestration method — runs in background (fire-and-forget).
   * 1. Builds the agent prompt from webhook.prompt + payload
   * 2. Executes Apoc agent
   * 3. Persists result to DB
   * 4. Dispatches to configured channels
   */
  public async dispatch(
    webhook: Webhook,
    payload: unknown,
    notificationId: string,
  ): Promise<void> {
    const repo = WebhookRepository.getInstance();
    const task = this.buildPrompt(webhook.prompt, payload);

    let result: string;
    let status: 'completed' | 'failed';

    try {
      const apoc = Apoc.getInstance();
      result = await apoc.execute(task, 'Webhook trigger — analyze the payload and follow instructions.');
      status = 'completed';
      this.display.log(
        `Webhook "${webhook.name}" completed (notification: ${notificationId})`,
        { source: 'Webhooks', level: 'success' },
      );
    } catch (err: any) {
      result = `Execution error: ${err.message}`;
      status = 'failed';
      this.display.log(
        `Webhook "${webhook.name}" failed: ${err.message}`,
        { source: 'Webhooks', level: 'error' },
      );
    }

    // Persist result
    repo.updateNotificationResult(notificationId, status, result);

    // Dispatch to configured channels
    for (const channel of webhook.notification_channels) {
      if (channel === 'telegram') {
        await this.sendTelegram(webhook.name, result, status);
      }
      // 'ui' channel is handled by UI polling — nothing extra needed here
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
      const message = `${icon} *Webhook: ${webhookName}*\n\n${truncated}`;
      await adapter.sendMessage(message);
    } catch (err: any) {
      this.display.log(
        `Failed to send Telegram notification for webhook "${webhookName}": ${err.message}`,
        { source: 'Webhooks', level: 'error' },
      );
    }
  }
}
