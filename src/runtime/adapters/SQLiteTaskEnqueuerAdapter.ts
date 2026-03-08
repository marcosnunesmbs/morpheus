/**
 * Adapter: SQLiteTaskEnqueuerAdapter
 *
 * Implements ITaskEnqueuer using TaskRepository.
 * Allows delegation tools to enqueue tasks without
 * importing TaskRepository directly.
 */
import type { ITaskEnqueuer } from '../ports/ITaskEnqueuer.js';
import type { TaskCreateInput, TaskRecord } from '../tasks/types.js';
import { TaskRepository } from '../tasks/repository.js';

export class SQLiteTaskEnqueuerAdapter implements ITaskEnqueuer {
  enqueue(input: TaskCreateInput): TaskRecord {
    return TaskRepository.getInstance().createTask(input);
  }
}
