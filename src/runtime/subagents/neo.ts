import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import type { StructuredTool } from "@langchain/core/tools";
import { MorpheusConfig } from "../../types/config.js";
import { ConfigManager } from "../../config/manager.js";
import { ServiceContainer, SERVICE_KEYS } from "../container.js";
import type { ILLMProviderFactory } from "../ports/ILLMProviderFactory.js";
import { ReactAgent } from "langchain";
import { ProviderError } from "../errors.js";
import { DisplayManager } from "../display.js";
import { Construtor } from "../tools/factory.js";
import { morpheusTools } from "../tools/index.js";
import { TaskRequestContext } from "../tasks/context.js";
import type { OracleTaskContext, AgentResult } from "../tasks/types.js";
import type { ISubagent } from "./ISubagent.js";
import { extractRawUsage, persistAgentMessage, buildAgentResult, emitToolAuditEvents } from "./utils.js";
import { buildDelegationTool } from "../tools/delegation-utils.js";
import { SubagentRegistry } from "./registry.js";

// Internal Morpheus tools get 'tool_call' event type; MCP tools get 'mcp_tool'
const MORPHEUS_TOOL_NAMES = new Set(morpheusTools.map((t) => t.name));

const NEO_BUILTIN_CAPABILITIES = `
Neo built-in capabilities (always available — no MCP required):
• Config: morpheus_config_query, morpheus_config_update — read/write Morpheus configuration (LLM, channels, UI, etc.)
• Diagnostics: diagnostic_check — full system health report (config, databases, LLM provider, logs)
• Analytics: message_count, token_usage, provider_model_usage — message counts and token/cost usage stats
• Tasks: task_query — look up task status by id or session
• MCP Management: mcp_list, mcp_manage — list/add/update/delete/enable/disable MCP servers; use action "reload" to reload tools across all agents after config changes
• Webhooks: webhook_list, webhook_manage — create/update/delete webhooks; create returns api_key`.trim();

const NEO_BASE_DESCRIPTION = `Delegate execution to Neo asynchronously.

This tool creates a background task and returns an acknowledgement with task id.
Use it for any request that requires Neo's built-in capabilities or a runtime MCP tool listed below.
Each delegated task must contain one atomic objective.

${NEO_BUILTIN_CAPABILITIES}`;

function normalizeDescription(text: string | undefined): string {
  if (!text) return "No description";
  return text.replace(/\s+/g, " ").trim();
}

function buildCatalogSection(mcpTools: StructuredTool[]): string {
  if (mcpTools.length === 0) {
    return "\n\nRuntime MCP tools: none currently loaded.";
  }

  const maxItems = 500;
  const lines = mcpTools.slice(0, maxItems).map((t) => {
    const desc = normalizeDescription(t.description).slice(0, 120);
    return `- ${t.name}: ${desc}`;
  });
  const hidden = mcpTools.length - lines.length;
  if (hidden > 0) {
    lines.push(`- ... and ${hidden} more tools`);
  }

  return `\n\nRuntime MCP tools:\n${lines.join("\n")}`;
}

export class Neo implements ISubagent {
  private static instance: Neo | null = null;
  private static currentSessionId: string | undefined = undefined;
  private static _delegateTool: StructuredTool | null = null;

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
      SubagentRegistry.register({
        agentKey: 'neo', auditAgent: 'neo', label: 'Neo',
        delegateToolName: 'neo_delegate', emoji: '🥷', color: 'violet',
        description: 'MCP tool orchestration',
        colorClass: 'text-violet-600 dark:text-violet-400',
        bgClass: 'bg-violet-50 dark:bg-violet-900/10',
        badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
        instance: Neo.instance,
        hasDynamicDescription: true,
        isMultiInstance: false,
        setSessionId: (id) => Neo.setSessionId(id),
        refreshCatalog: () => Neo.refreshDelegateCatalog(),
      });
    }
    return Neo.instance;
  }

  public static resetInstance(): void {
    Neo.instance = null;
    Neo._delegateTool = null;
  }

  public static async refreshDelegateCatalog(): Promise<void> {
    const mcpTools = await Construtor.create(() => Neo.currentSessionId);
    if (Neo._delegateTool) {
      const full = `${NEO_BASE_DESCRIPTION}${buildCatalogSection(mcpTools)}`;
      (Neo._delegateTool as any).description = full;
    }
  }

  async initialize(): Promise<void> {
    const neoConfig = this.config.neo || this.config.llm;
    const personality = this.config.neo?.personality || 'analytical_engineer';
    const mcpTools = await Construtor.create(() => Neo.currentSessionId);
    const tools = [...mcpTools, ...morpheusTools];

    // Update delegate tool description with current catalog
    if (Neo._delegateTool) {
      const full = `${NEO_BASE_DESCRIPTION}${buildCatalogSection(mcpTools)}`;
      (Neo._delegateTool as any).description = full;
    }

    this.display.log(`Neo initialized with ${tools.length} tools (personality: ${personality}).`, { source: "Neo" });

    try {
      this.agent = await ServiceContainer.get<ILLMProviderFactory>(SERVICE_KEYS.providerFactory).create(neoConfig, tools);
    } catch (err) {
      throw new ProviderError(
        neoConfig.provider,
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
  ): Promise<AgentResult> {
    const neoConfig = this.config.neo || this.config.llm;
    if (!this.agent) {
      await this.initialize();
    }

    this.display.log(`Executing delegated task in Neo: ${task.slice(0, 80)}...`, {
      source: "Neo",
    });
    const personality = this.config.neo?.personality || 'analytical_engineer';
    const systemMessage = new SystemMessage(`
You are Neo, ${personality === 'analytical_engineer' ? 'an analytical and precise engineer' : personality}, an execution subagent in Morpheus.

You execute tasks using MCP and internal tools.
Focus on verifiable execution and return objective results.

Rules:
1. Use tools whenever the task depends on external/system state.
2. Validate outputs before giving a final answer.
3. If blocked, explain exactly what is missing — tool name, permission, or missing input.
4. Keep output concise and actionable.
5. Respond in the language requested by the user. If not explicit, use the dominant language of the task/context.
6. For connectivity checks, prefer dedicated network "ping" tool semantics and avoid forcing shell flags.
7. If shell ping is required, include OS-aware guidance: Windows uses "-n", Linux/macOS uses "-c".

CRITICAL — NEVER FABRICATE DATA:
- If none of your available tools can retrieve the requested information, respond EXACTLY with:
  "I do not have the required tool to fetch this data. Cannot retrieve: [describe what was requested]. Available tools: [list your actual tool names]."
- NEVER generate fake records, fake IDs, fake names, fake statuses, or fake values of any kind.
- If a tool call fails or returns empty results, report the actual result — do not substitute invented data.
- An honest "I cannot retrieve this" is always correct. A fabricated answer is never acceptable.

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
      const inputCount = messages.length;
      const startMs = Date.now();
      const response = await TaskRequestContext.run(invokeContext, () => this.agent!.invoke({ messages }, { recursionLimit: 100 }));
      const durationMs = Date.now() - startMs;

      const lastMessage = response.messages[response.messages.length - 1];
      const content =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      const rawUsage = extractRawUsage(lastMessage);
      const stepCount = response.messages.filter((m: BaseMessage) => m instanceof AIMessage).length;

      const targetSession = sessionId ?? Neo.currentSessionId ?? "neo";
      await persistAgentMessage('neo', content, neoConfig, targetSession, rawUsage, durationMs);

      // MCP tools are already audited inline by instrumentMcpTool (with timing + args/result).
      // Only emit audit events here for internal Morpheus tools (not MCP tools).
      emitToolAuditEvents(response.messages.slice(inputCount), targetSession, 'neo', {
        defaultEventType: undefined, // skip MCP tools — audited by instrumentMcpTool
        internalToolNames: MORPHEUS_TOOL_NAMES,
      });

      this.display.log("Neo task completed.", { source: "Neo" });
      return buildAgentResult(content, neoConfig, rawUsage, durationMs, stepCount);
    } catch (err) {
      throw new ProviderError(
        neoConfig.provider,
        err,
        "Neo task execution failed"
      );
    }
  }

  createDelegateTool(): StructuredTool {
    if (!Neo._delegateTool) {
      Neo._delegateTool = buildDelegationTool({
        name: "neo_delegate",
        description: NEO_BASE_DESCRIPTION,
        agentKey: "neo",
        agentLabel: "Neo",
        auditAgent: "neo",
        isSync: () => ConfigManager.getInstance().get().neo?.execution_mode === 'sync',
        notifyText: '🥷 Neo is executing your request...',
        executeSync: (task, context, sessionId, ctx) =>
          Neo.getInstance().execute(task, context, sessionId, {
            origin_channel: ctx?.origin_channel ?? "api",
            session_id: sessionId,
            origin_message_id: ctx?.origin_message_id,
            origin_user_id: ctx?.origin_user_id,
          }),
      });
    }
    return Neo._delegateTool;
  }

  async reload(): Promise<void> {
    this.config = ConfigManager.getInstance().get();
    this.agent = undefined;
    await this.initialize();
  }
}
