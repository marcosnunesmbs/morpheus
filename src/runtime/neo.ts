import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderFactory } from "./providers/factory.js";
import { ReactAgent } from "langchain";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";
import { Construtor } from "./tools/factory.js";
import {
  ConfigQueryTool,
  ConfigUpdateTool,
  DiagnosticTool,
  MessageCountTool,
  TokenUsageTool,
  ProviderModelUsageTool,
} from "./tools/index.js";
import { SQLiteChatMessageHistory } from "./memory/sqlite.js";
import { TaskRequestContext } from "./tasks/context.js";
import type { OracleTaskContext } from "./tasks/types.js";
import { updateNeoDelegateToolDescription } from "./tools/neo-tool.js";

export class Neo {
  private static instance: Neo | null = null;
  private static currentSessionId: string | undefined = undefined;

  private agent?: ReactAgent;
  private config: MorpheusConfig;
  private display = DisplayManager.getInstance();

  private constructor(config?: MorpheusConfig) {
    this.config = config || ConfigManager.getInstance().get();
  }

  public static setSessionId(sessionId: string | undefined): void {
    Neo.currentSessionId = sessionId;
  }

  public static getInstance(config?: MorpheusConfig): Neo {
    if (!Neo.instance) {
      Neo.instance = new Neo(config);
    }
    return Neo.instance;
  }

  public static resetInstance(): void {
    Neo.instance = null;
  }

  public static async refreshDelegateCatalog(): Promise<void> {
    const mcpTools = await Construtor.create();
    const catalogTools = [
      ...mcpTools,
      ConfigQueryTool,
      ConfigUpdateTool,
      DiagnosticTool,
      MessageCountTool,
      TokenUsageTool,
      ProviderModelUsageTool
    ];
    updateNeoDelegateToolDescription(catalogTools);
  }

  async initialize(): Promise<void> {
    const mcpTools = await Construtor.create();
    const tools = [
      ...mcpTools,
      ConfigQueryTool,
      ConfigUpdateTool,
      DiagnosticTool,
      MessageCountTool,
      TokenUsageTool,
      ProviderModelUsageTool
    ];
    updateNeoDelegateToolDescription(tools);

    this.display.log(`Neo initialized with ${tools.length} tools.`, { source: "Neo" });

    try {
      this.agent = await ProviderFactory.create(this.config.llm, tools);
    } catch (err) {
      throw new ProviderError(
        this.config.llm.provider,
        err,
        "Neo subagent initialization failed"
      );
    }
  }

  async execute(
    task: string,
    context?: string,
    sessionId?: string,
    taskContext?: OracleTaskContext,
  ): Promise<string> {
    if (!this.agent) {
      await this.initialize();
    }

    this.display.log(`Executing delegated task in Neo: ${task.slice(0, 80)}...`, {
      source: "Neo",
    });

    const systemMessage = new SystemMessage(`
You are Neo, an execution subagent in Morpheus.

You execute tasks using MCP and internal tools.
Focus on verifiable execution and return objective results.

Rules:
1. Use tools whenever task depends on external/system state.
2. Validate outputs before final answer.
3. If blocked, explain what is missing.
4. Keep output concise and actionable.
5. Respond in the language requested by the user. If not explicit, use the dominant language of the task/context.
6. For connectivity checks, prefer the dedicated network "ping" tool semantics (reachability) and avoid forcing shell flags.
7. If delegating shell ping to Apoc is explicitly required, include OS-aware guidance: Windows uses "-n", Linux/macOS uses "-c".

${context ? `Context:\n${context}` : ""}
    `);

    const userMessage = new HumanMessage(task);
    const messages: BaseMessage[] = [systemMessage, userMessage];

    try {
      const invokeContext: OracleTaskContext = {
        origin_channel: taskContext?.origin_channel ?? "api",
        session_id: taskContext?.session_id ?? sessionId ?? "default",
        origin_message_id: taskContext?.origin_message_id,
        origin_user_id: taskContext?.origin_user_id,
      };
      const response = await TaskRequestContext.run(invokeContext, () => this.agent!.invoke({ messages }));

      const lastMessage = response.messages[response.messages.length - 1];
      const content =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      const targetSession = sessionId ?? Neo.currentSessionId ?? "neo";
      const history = new SQLiteChatMessageHistory({ sessionId: targetSession });
      try {
        const persisted = new AIMessage(content);
        (persisted as any).usage_metadata = (lastMessage as any).usage_metadata
          ?? (lastMessage as any).response_metadata?.usage
          ?? (lastMessage as any).response_metadata?.tokenUsage
          ?? (lastMessage as any).usage;
        (persisted as any).provider_metadata = {
          provider: this.config.llm.provider,
          model: this.config.llm.model,
        };
        await history.addMessage(persisted);
      } finally {
        history.close();
      }

      this.display.log("Neo task completed.", { source: "Neo" });
      return content;
    } catch (err) {
      throw new ProviderError(
        this.config.llm.provider,
        err,
        "Neo task execution failed"
      );
    }
  }

  async reload(): Promise<void> {
    this.config = ConfigManager.getInstance().get();
    this.agent = undefined;
    await this.initialize();
  }
}
