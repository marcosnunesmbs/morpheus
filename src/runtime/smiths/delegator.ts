import { v4 as uuidv4 } from 'uuid';
import { tool } from '@langchain/core/tools';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { DisplayManager } from '../display.js';
import { SmithRegistry } from './registry.js';
import { ConfigManager } from '../../config/manager.js';
import { ProviderFactory } from '../providers/factory.js';
import { buildDevKit } from '../../devkit/index.js';
import { SQLiteChatMessageHistory } from '../memory/sqlite.js';
import type { SmithTaskResultMessage, SmithToMorpheusMessage } from './types.js';
import type { StructuredTool } from '@langchain/core/tools';

/**
 * SmithDelegator — delegates natural-language tasks to a specific Smith.
 *
 * Works like Apoc: creates a LangChain ReactAgent with proxy tools
 * that forward execution to the remote Smith via WebSocket.
 * The LLM plans which DevKit tools to call, and each tool invocation
 * is sent to the Smith for actual execution.
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
   * Build proxy tools that forward calls to a Smith via WebSocket.
   * Uses local DevKit schemas for tool definitions, filtered by Smith capabilities.
   */
  private buildProxyTools(smithName: string): StructuredTool[] {
    const smith = this.registry.get(smithName);
    if (!smith) return [];

    const connection = this.registry.getConnection(smithName);
    if (!connection) return [];

    const capabilities = new Set(smith.capabilities);

    // Build local DevKit tools for schema extraction only
    const localTools = buildDevKit({
      working_dir: process.cwd(),
      allowed_commands: [],
      timeout_ms: 30000,
      sandbox_dir: process.cwd(),
      readonly_mode: false,
      enable_filesystem: true,
      enable_shell: true,
      enable_git: true,
      enable_network: true,
    });

    // Create proxy tools — same schema, but execution forwards to Smith
    return localTools
      .filter(t => capabilities.has(t.name))
      .map(localTool =>
        tool(
          async (args: Record<string, unknown>) => {
            const taskId = uuidv4();
            this.display.log(`Smith '${smithName}' → ${localTool.name}`, {
              source: 'SmithDelegator',
              level: 'info',
            });

            const progressHandler = (msg: SmithToMorpheusMessage) => {
              if (msg.type === 'task_progress' && msg.id === taskId) {
                this.display.log(`Smith '${smithName}' → ${msg.progress.message}`, {
                  source: 'SmithDelegator',
                  level: 'info',
                });
              }
            };
            connection.onMessage(progressHandler);

            try {
              const result: SmithTaskResultMessage['result'] = await connection.sendTask(
                taskId,
                localTool.name,
                args
              );
              if (result.success) {
                return typeof result.data === 'string'
                  ? result.data
                  : JSON.stringify(result.data, null, 2);
              } else {
                return `Error: ${result.error}`;
              }
            } catch (err: any) {
              return `Error executing ${localTool.name} on Smith '${smithName}': ${err.message}`;
            } finally {
              connection.offMessage(progressHandler);
            }
          },
          {
            name: localTool.name,
            description: localTool.description,
            schema: (localTool as any).schema,
          }
        )
      );
  }

  /**
   * Delegate a task to a specific Smith by name.
   * Creates an LLM agent with proxy tools, plans tool calls, and executes on the Smith.
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

    this.display.log(`Delegating to Smith '${smithName}': ${task.slice(0, 100)}...`, {
      source: 'SmithDelegator',
      level: 'info',
      meta: { smith: smithName },
    });

    try {
      // Build proxy tools for this Smith's capabilities
      const proxyTools = this.buildProxyTools(smithName);
      if (proxyTools.length === 0) {
        return `❌ Smith '${smithName}' has no available tools.`;
      }

      // Create a fresh ReactAgent with proxy tools
      const config = ConfigManager.getInstance().get();
      const llmConfig = config.apoc || config.llm;
      const agent = await ProviderFactory.createBare(llmConfig, proxyTools);

      const osInfo = smith.stats?.os ? ` running ${smith.stats.os}` : '';
      const hostname = smith.stats?.hostname ? ` (hostname: ${smith.stats.hostname})` : '';

      const systemMessage = new SystemMessage(
        `You are a remote task executor for Smith '${smithName}'.
Your tools execute on a remote machine at ${smith.host}:${smith.port}${osInfo}${hostname}.

Execute the requested task using the available tools. Be direct and efficient.
If a task fails, report the error clearly.
Respond in the same language as the task.`
      );

      const userContent = context
        ? `Context: ${context}\n\nTask: ${task}`
        : task;

      const messages: BaseMessage[] = [systemMessage, new HumanMessage(userContent)];
      const response = await agent.invoke({ messages });

      // Extract final response
      const lastMessage = response.messages[response.messages.length - 1];
      const content =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      // Persist token usage to session history
      try {
        const history = new SQLiteChatMessageHistory({ sessionId: 'smith' });
        try {
          const persisted = new AIMessage(content);
          (persisted as any).usage_metadata = (lastMessage as any).usage_metadata
            ?? (lastMessage as any).response_metadata?.usage
            ?? (lastMessage as any).response_metadata?.tokenUsage
            ?? (lastMessage as any).usage;
          (persisted as any).provider_metadata = {
            provider: llmConfig.provider,
            model: llmConfig.model,
          };
          await history.addMessage(persisted);
        } finally {
          history.close();
        }
      } catch {
        // Non-critical — don't fail the delegation over token tracking
      }

      this.display.log(`Smith '${smithName}' delegation completed.`, {
        source: 'SmithDelegator',
        level: 'info',
      });

      return content;
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
        const handler = (msg: any) => {
          if (msg.type === 'pong') {
            clearTimeout(timeout);
            connection.offMessage(handler);
            resolve({ online: true, latencyMs: Date.now() - start });
          }
        };

        const timeout = setTimeout(() => {
          connection.offMessage(handler);
          resolve({ online: false, error: 'Ping timeout (5s)' });
        }, 5000);

        connection.onMessage(handler);
      });
    } catch (err: any) {
      return { online: false, error: err.message };
    }
  }
}
