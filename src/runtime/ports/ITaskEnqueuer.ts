/**
 * Port: ITaskEnqueuer
 *
 * Abstraction for creating background tasks.
 * Decouples tools and delegation logic from TaskRepository.
 */
import type { TaskCreateInput, TaskRecord } from '../tasks/types.js';

export interface ITaskEnqueuer {
  /** Enqueue a new task and return the created record. */
  enqueue(input: TaskCreateInput): TaskRecord;
}
