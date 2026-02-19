import { AsyncLocalStorage } from 'node:async_hooks';
import type { OracleTaskContext } from './types.js';

const storage = new AsyncLocalStorage<OracleTaskContext>();

export class TaskRequestContext {
  static run<T>(ctx: OracleTaskContext, fn: () => Promise<T>): Promise<T> {
    return storage.run(ctx, fn);
  }

  static get(): OracleTaskContext | undefined {
    return storage.getStore();
  }
}
