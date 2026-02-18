import { EventEmitter } from 'events';

export const taskCompletionEmitter = new EventEmitter();

export interface TasksDonePayload {
  taskIds: string[];
  sessionId?: string;
}
