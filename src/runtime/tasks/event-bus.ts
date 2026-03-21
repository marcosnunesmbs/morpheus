import { EventEmitter } from 'events';

/**
 * Singleton event bus for task lifecycle events.
 * Emitted by TaskWorker, consumed by TaskNotifier for immediate dispatch.
 *
 * Events:
 *   'task:ready' (taskId: string) — task is completed/failed/cancelled and ready to notify
 */
class TaskEventBus extends EventEmitter {}

export const taskEventBus = new TaskEventBus();
