export type NotificationStatus = 'pending' | 'completed' | 'failed';
export type NotificationChannel = 'ui' | 'telegram' | 'discord';

export interface Webhook {
  id: string;
  name: string; // unique slug — used in trigger URL
  api_key: string; // secret validated via x-api-key header
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
  payload: string; // raw JSON string of received payload
  result: string | null;
  read: boolean;
  created_at: number;
  completed_at: number | null;
}

export interface TriggerAckResponse {
  accepted: boolean;
  notification_id: string;
}

export type CreateWebhookInput = Pick<Webhook, 'name' | 'prompt' | 'notification_channels'>;
export type UpdateWebhookInput = Partial<Pick<Webhook, 'name' | 'prompt' | 'enabled' | 'notification_channels'>>;
