import { DisplayManager } from '../display.js';
import type { TaskRecord } from './types.js';
import type { TelegramAdapter } from '../../channels/telegram.js';
import { WebhookRepository } from '../webhooks/repository.js';

export class TaskDispatcher {
  private static telegramAdapter: TelegramAdapter | null = null;
  private static display = DisplayManager.getInstance();

  public static setTelegramAdapter(adapter: TelegramAdapter): void {
    TaskDispatcher.telegramAdapter = adapter;
  }

  public static async notifyTaskResult(task: TaskRecord): Promise<void> {
    if (task.origin_channel === 'webhook') {
      if (!task.origin_message_id) {
        throw new Error('Webhook-origin task has no origin_message_id');
      }
      const repo = WebhookRepository.getInstance();
      const status = task.status === 'completed' ? 'completed' : 'failed';
      const result = task.status === 'completed'
        ? (task.output && task.output.trim().length > 0 ? task.output : 'Task completed without output.')
        : (task.error && task.error.trim().length > 0 ? task.error : 'Task failed with unknown error.');
      repo.updateNotificationResult(task.origin_message_id, status, result);
      return;
    }

    if (task.origin_channel !== 'telegram') {
      return;
    }

    const adapter = TaskDispatcher.telegramAdapter;
    if (!adapter) {
      throw new Error('Telegram adapter not connected');
    }

    const statusIcon = task.status === 'completed' ? '✅' : '❌';
    const body = task.status === 'completed'
      ? (task.output && task.output.trim().length > 0 ? task.output : 'Task completed without output.')
      : (task.error && task.error.trim().length > 0 ? task.error : 'Task failed with unknown error.');

    const header =
      `${statusIcon}\nTask \`${task.id.toUpperCase()}\`\n` +
      `Agent: \`${task.agent.toUpperCase()}\`\n` +
      `Status: \`${task.status.toUpperCase()}\``;
    const message = `${header}\n\n${body}`;

    if (task.origin_user_id) {
      await adapter.sendMessageToUser(task.origin_user_id, message);
      return;
    }

    TaskDispatcher.display.log(
      `Task ${task.id} has telegram origin but no origin_user_id; broadcasting to allowed users.`,
      { source: 'TaskDispatcher', level: 'warning' },
    );
    await adapter.sendMessage(message);
  }

  public static async onTaskFinished(task: TaskRecord): Promise<void> {
    await TaskDispatcher.notifyTaskResult(task);
  }
}

