import { v4 as uuidv4 } from 'uuid';
import { DisplayManager } from '../display.js';
import { SmithRegistry } from './registry.js';
import type { SmithTaskResultMessage } from './types.js';

/**
 * SmithDelegator — delegates natural-language tasks to a specific Smith.
 *
 * Unlike Apoc/Neo/Trinity, Smith delegation does NOT create a sub-LLM agent.
 * The Smith is a pure tool executor: Morpheus sends a tool + args payload,
 * and the Smith executes it locally and returns the result.
 *
 * For v1, the delegator sends a generic `shell_exec` or `task_execute` command.
 * Future versions may support multi-tool orchestration via a Smith-side agent.
 */
export class SmithDelegator {
  private static instance: SmithDelegator;
  private display = DisplayManager.getInstance();
  private registry = SmithRegistry.getInstance();

  private constructor() {}

  public static getInstance(): SmithDelegator {
    if (!SmithDelegator.instance) {
      SmithDelegator.instance = new SmithDelegator();
    }
    return SmithDelegator.instance;
  }

  /**
   * Delegate a task to a specific Smith by name.
   * Returns the execution result as a string.
   */
  public async delegate(smithName: string, task: string, context?: string): Promise<string> {
    const smith = this.registry.get(smithName);
    if (!smith) {
      return `❌ Smith '${smithName}' not found. Available: ${this.registry.list().map(s => s.name).join(', ') || 'none'}`;
    }

    if (smith.state !== 'online') {
      return `❌ Smith '${smithName}' is ${smith.state}. Cannot delegate.`;
    }

    const connection = this.registry.getConnection(smithName);
    if (!connection || !connection.connected) {
      return `❌ No active connection to Smith '${smithName}'.`;
    }

    const taskId = uuidv4();

    this.display.log(`Delegating to Smith '${smithName}': ${task.slice(0, 100)}...`, {
      source: 'SmithDelegator',
      level: 'info',
      meta: { taskId, smith: smithName },
    });

    try {
      // For v1, we send the task as a generic "execute" tool.
      // The Smith-side executor will interpret the task and run appropriate DevKit tools.
      const result: SmithTaskResultMessage['result'] = await connection.sendTask(
        taskId,
        'execute',
        {
          task,
          context: context ?? undefined,
        }
      );

      if (result.success) {
        const data = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
        this.display.log(`Smith '${smithName}' task completed (${result.duration_ms}ms)`, {
          source: 'SmithDelegator',
          level: 'info',
        });
        return data;
      } else {
        this.display.log(`Smith '${smithName}' task failed: ${result.error}`, {
          source: 'SmithDelegator',
          level: 'error',
        });
        return `❌ Smith '${smithName}' error: ${result.error}`;
      }
    } catch (err: any) {
      this.display.log(`Smith delegation error: ${err.message}`, {
        source: 'SmithDelegator',
        level: 'error',
      });
      return `❌ Smith '${smithName}' delegation failed: ${err.message}`;
    }
  }

  /**
   * Ping a specific Smith and return latency info.
   */
  public async ping(smithName: string): Promise<{ online: boolean; latencyMs?: number; error?: string }> {
    const smith = this.registry.get(smithName);
    if (!smith) {
      return { online: false, error: `Smith '${smithName}' not found` };
    }

    const connection = this.registry.getConnection(smithName);
    if (!connection || !connection.connected) {
      return { online: false, error: `No active connection to Smith '${smithName}'` };
    }

    const start = Date.now();
    try {
      connection.send({ type: 'ping', timestamp: start });

      // Wait for pong (up to 5s)
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ online: false, error: 'Ping timeout (5s)' });
        }, 5000);

        const handler = (msg: any) => {
          if (msg.type === 'pong') {
            clearTimeout(timeout);
            resolve({ online: true, latencyMs: Date.now() - start });
          }
        };

        connection.onMessage(handler);
      });
    } catch (err: any) {
      return { online: false, error: err.message };
    }
  }
}
