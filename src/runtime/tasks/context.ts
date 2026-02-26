import { AsyncLocalStorage } from 'node:async_hooks';
import type { OracleTaskContext } from './types.js';

type DelegationAck = {
  task_id: string;
  agent: string;
  task: string;
};

type RequestContext = OracleTaskContext & {
  delegation_acks?: DelegationAck[];
  sync_delegation_count?: number;
};

const storage = new AsyncLocalStorage<RequestContext>();

export class TaskRequestContext {
  private static readonly MAX_DELEGATIONS_PER_TURN = 6;

  static run<T>(ctx: OracleTaskContext, fn: () => Promise<T>): Promise<T> {
    return storage.run({ ...ctx }, fn);
  }

  static get(): OracleTaskContext | undefined {
    return storage.getStore();
  }

  static getDelegationAck(): DelegationAck | undefined {
    const acks = storage.getStore()?.delegation_acks ?? [];
    return acks[0];
  }

  static setDelegationAck(ack: DelegationAck): void {
    const current = storage.getStore();
    if (!current) return;
    if (!current.delegation_acks) {
      current.delegation_acks = [];
    }
    current.delegation_acks.push(ack);
  }

  static getDelegationAcks(): DelegationAck[] {
    return storage.getStore()?.delegation_acks ?? [];
  }

  static canEnqueueDelegation(): boolean {
    return this.getDelegationAcks().length < this.MAX_DELEGATIONS_PER_TURN;
  }

  /**
   * Record that a delegation tool executed synchronously (inline).
   * Oracle uses this to know that the tool call was NOT an async enqueue.
   */
  static incrementSyncDelegation(): void {
    const current = storage.getStore();
    if (!current) return;
    current.sync_delegation_count = (current.sync_delegation_count ?? 0) + 1;
  }

  /**
   * Returns the number of delegation tools that executed synchronously this turn.
   */
  static getSyncDelegationCount(): number {
    return storage.getStore()?.sync_delegation_count ?? 0;
  }

  static findDuplicateDelegation(agent: string, task: string): DelegationAck | undefined {
    const acks = this.getDelegationAcks();
    if (acks.length === 0) return undefined;
    const normalized = this.normalizeTask(task);

    for (const ack of acks) {
      if (ack.agent !== agent) {
        continue;
      }
      const existing = this.normalizeTask(ack.task);
      if (existing === normalized) {
        return ack;
      }
    }

    return undefined;
  }

  private static normalizeTask(task: string): string {
    return task
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
