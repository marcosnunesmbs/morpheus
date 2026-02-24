import { DisplayManager } from '../display.js';
import type { TaskRecord } from './types.js';
import { WebhookRepository } from '../webhooks/repository.js';
import { AIMessage } from '@langchain/core/messages';
import { SQLiteChatMessageHistory } from '../memory/sqlite.js';
import { ChannelRegistry } from '../../channels/registry.js';

export class TaskDispatcher {
  private static display = DisplayManager.getInstance();

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

      // Notify channels configured on the webhook
      const notification = repo.getNotificationById(task.origin_message_id);
      if (notification) {
        const webhook = repo.getWebhookById(notification.webhook_id);
        if (webhook) {
          const icon = status === 'completed' ? '✅' : '❌';
          const truncated = result.length > 3500 ? result.slice(0, 3500) + '…' : result;
          const message = `${icon} Webhook: ${webhook.name}\n\n${truncated}`;
          for (const ch of webhook.notification_channels) {
            const adapter = ChannelRegistry.get(ch);
            if (adapter) {
              await adapter.sendMessage(message).catch((err: any) => {
                TaskDispatcher.display.log(
                  `Failed to send notification via ${ch} for webhook "${webhook.name}": ${err.message}`,
                  { source: 'TaskDispatcher', level: 'error' },
                );
              });
            } else {
              TaskDispatcher.display.log(
                `Notification skipped for channel "${ch}" — adapter not registered.`,
                { source: 'TaskDispatcher', level: 'warning' },
              );
            }
          }
        }
      }
      return;
    }

    if (task.origin_channel === 'ui') {
      const statusIcon = task.status === 'completed' ? '✅' : task.status === 'cancelled' ? '🚫' : '❌';
      const body = task.status === 'completed'
        ? (task.output && task.output.trim().length > 0 ? task.output : 'Task completed without output.')
        : task.status === 'cancelled'
        ? 'Task was cancelled.'
        : (task.error && task.error.trim().length > 0 ? task.error : 'Task failed with unknown error.');
      const content =
        `${statusIcon}\ Task \`${task.id.toUpperCase()}\`\n` +
        `Agent: \`${task.agent.toUpperCase()}\`\n` +
        `Status: \`${task.status.toUpperCase()}\`\n\n${body}`;

      TaskDispatcher.display.log(
        `Writing UI task result to session "${task.session_id}" (task ${task.id})`,
        { source: 'TaskDispatcher', level: 'info' },
      );

      const history = new SQLiteChatMessageHistory({ sessionId: task.session_id });
      try {
        const msg = new AIMessage(content);
        (msg as any).provider_metadata = { provider: task.agent, model: 'task-result' };
        await history.addMessage(msg);
        TaskDispatcher.display.log(
          `UI task result written successfully to session "${task.session_id}"`,
          { source: 'TaskDispatcher' },
        );
      } finally {
        history.close();
      }
      return;
    }

    // 'chronos' origin — broadcast to all registered channels
    if (task.origin_channel === 'chronos') {
      const statusIcon = task.status === 'completed' ? '✅' : task.status === 'cancelled' ? '🚫' : '❌';
      const body = task.status === 'completed'
        ? (task.output && task.output.trim().length > 0 ? task.output : 'Task completed without output.')
        : task.status === 'cancelled'
        ? 'Task was cancelled.'
        : (task.error && task.error.trim().length > 0 ? task.error : 'Task failed with unknown error.');
      const message =
        `${statusIcon} Task \`${task.id.toUpperCase()}\`\n` +
        `Agent: \`${task.agent.toUpperCase()}\`\n` +
        `Status: \`${task.status.toUpperCase()}\`\n\n${body}`;
      await ChannelRegistry.broadcast(message);
      return;
    }

    // Channel-specific routing (telegram, discord, etc.)
    const statusIcon = task.status === 'completed' ? '✅' : task.status === 'cancelled' ? '🚫' : '❌';
    const body = task.status === 'completed'
      ? (task.output && task.output.trim().length > 0 ? task.output : 'Task completed without output.')
      : task.status === 'cancelled'
      ? 'Task was cancelled.'
      : (task.error && task.error.trim().length > 0 ? task.error : 'Task failed with unknown error.');

    const header =
      `${statusIcon}\ Task \`${task.id.toUpperCase()}\`\n` +
      `Agent: \`${task.agent.toUpperCase()}\`\n` +
      `Status: \`${task.status.toUpperCase()}\``;
    const message = `${header}\n\n${body}`;

    if (task.origin_user_id) {
      await ChannelRegistry.sendToUser(task.origin_channel, task.origin_user_id, message);
      return;
    }

    // No specific user — broadcast on the originating channel
    const adapter = ChannelRegistry.get(task.origin_channel);
    if (!adapter) {
      TaskDispatcher.display.log(
        `Task ${task.id}: no adapter for channel "${task.origin_channel}" — notification skipped.`,
        { source: 'TaskDispatcher', level: 'warning' },
      );
      return;
    }
    await adapter.sendMessage(message);
  }

  public static async onTaskFinished(task: TaskRecord): Promise<void> {
    await TaskDispatcher.notifyTaskResult(task);
  }
}
