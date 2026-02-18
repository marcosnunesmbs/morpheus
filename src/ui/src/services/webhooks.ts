import { httpClient } from './httpClient';

export type NotificationChannel = 'ui' | 'telegram';
export type NotificationStatus = 'pending' | 'completed' | 'failed';

export interface Webhook {
  id: string;
  name: string;
  api_key: string;
  prompt: string;
  enabled: boolean;
  notification_channels: NotificationChannel[];
  created_at: number;
  last_triggered_at: number | null;
  trigger_count: number;
}

export interface WebhookNotification {
  id: string;
  webhook_id: string;
  webhook_name: string;
  status: NotificationStatus;
  payload: string;
  result: string | null;
  read: boolean;
  created_at: number;
  completed_at: number | null;
}

export type CreateWebhookPayload = {
  name: string;
  prompt: string;
  notification_channels: NotificationChannel[];
};

export type UpdateWebhookPayload = Partial<
  Pick<Webhook, 'name' | 'prompt' | 'enabled' | 'notification_channels'>
>;

export const webhookService = {
  // ─── Webhooks ───────────────────────────────────────────────────────────────

  list: (): Promise<Webhook[]> =>
    httpClient.get<Webhook[]>('/webhooks'),

  get: (id: string): Promise<Webhook> =>
    httpClient.get<Webhook>(`/webhooks/${id}`),

  create: (data: CreateWebhookPayload): Promise<Webhook> =>
    httpClient.post<Webhook>('/webhooks', data),

  update: (id: string, data: UpdateWebhookPayload): Promise<Webhook> =>
    httpClient.put<Webhook>(`/webhooks/${id}`, data),

  delete: (id: string): Promise<{ success: boolean }> =>
    httpClient.delete<{ success: boolean }>(`/webhooks/${id}`),

  // ─── Notifications ──────────────────────────────────────────────────────────

  listNotifications: (params?: {
    webhookId?: string;
    unreadOnly?: boolean;
  }): Promise<WebhookNotification[]> => {
    const qs = new URLSearchParams();
    if (params?.webhookId) qs.set('webhookId', params.webhookId);
    if (params?.unreadOnly) qs.set('unreadOnly', 'true');
    const suffix = qs.toString() ? `?${qs}` : '';
    return httpClient.get<WebhookNotification[]>(`/webhooks/notifications${suffix}`);
  },

  unreadCount: (): Promise<{ count: number }> =>
    httpClient.get<{ count: number }>('/webhooks/notifications/unread-count'),

  markRead: (ids: string[]): Promise<{ success: boolean }> =>
    httpClient.post<{ success: boolean }>('/webhooks/notifications/read', { ids }),
};
