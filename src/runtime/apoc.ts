import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderFactory } from "./providers/factory.js";
import { ReactAgent } from "langchain";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";
import { buildDevKit } from "../devkit/index.js";

/**
 * Apoc is a subagent of Oracle specialized in devtools operations.
 * It receives delegated tasks from Oracle and executes them using DevKit tools
 * (filesystem, shell, git, network, processes, packages, system).
 *
 * Oracle calls Apoc via the `apoc_delegate` tool when the user requests
 * dev-related tasks such as running commands, reading/writing files,
 * managing git, or inspecting system state.
 */
export class Apoc {
  private static instance: Apoc | null = null;

  private agent?: ReactAgent;
  private config: MorpheusConfig;
  private display = DisplayManager.getInstance();

  private constructor(config?: MorpheusConfig) {
    this.config = config || ConfigManager.getInstance().get();
  }

  public static getInstance(config?: MorpheusConfig): Apoc {
    if (!Apoc.instance) {
      Apoc.instance = new Apoc(config);
    }
    return Apoc.instance;
  }

  public static resetInstance(): void {
    Apoc.instance = null;
  }

  async initialize(): Promise<void> {
    const apocConfig = this.config.apoc || this.config.llm;
    console.log(`Apoc configuration: ${JSON.stringify(apocConfig)}`);

    const working_dir = this.config.apoc?.working_dir || process.cwd();
    const timeout_ms = this.config.apoc?.timeout_ms || 30_000;

    // Import all devkit tool factories (side-effect registration)
    await import("../devkit/index.js");
    const tools = buildDevKit({
      working_dir,
      allowed_commands: [], // no restriction — Oracle is trusted orchestrator
      timeout_ms,
    });

    this.display.log(
      `Apoc initialized with ${tools.length} DevKit tools (working_dir: ${working_dir})`,
      { source: "Apoc" }
    );

    try {
      this.agent = await ProviderFactory.createBare(apocConfig, tools);
    } catch (err) {
      throw new ProviderError(
        apocConfig.provider,
        err,
        "Apoc subagent initialization failed"
      );
    }
  }

  /**
   * Execute a devtools task delegated by Oracle.
   * @param task Natural language task description
   * @param context Optional additional context from the ongoing conversation
   */
  async execute(task: string, context?: string): Promise<string> {
    if (!this.agent) {
      await this.initialize();
    }

    this.display.log(`Executing delegated task: ${task.slice(0, 80)}...`, {
      source: "Apoc",
    });

    const systemMessage = new SystemMessage(`
You are Apoc, a specialized devtools subagent within the Morpheus system.

You are called by Oracle when the user needs dev operations performed.
Your job is to execute the requested task accurately using your available tools.

Available capabilities:
- Read, write, append, and delete files
- Execute shell commands
- Inspect and manage processes
- Run git operations (status, log, diff, clone, commit, etc.)
- Perform network operations (curl, DNS, ping)
- Manage packages (npm, yarn)
- Inspect system information

OPERATING RULES:
1. Use tools to accomplish the task. Do not speculate.
2. Always verify results after execution.
3. Report clearly what was done and what the result was.
4. If something fails, report the error and what you tried.
5. Stay focused on the delegated task only.

${context ? `CONTEXT FROM ORACLE:\n${context}` : ""}
    `);

    const userMessage = new HumanMessage(task);
    const messages: BaseMessage[] = [systemMessage, userMessage];

    try {
      const response = await this.agent!.invoke({ messages });
      const lastMessage = response.messages[response.messages.length - 1];
      const content =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      this.display.log("Apoc task completed.", { source: "Apoc" });
      return content;
    } catch (err) {
      throw new ProviderError(
        this.config.apoc?.provider || this.config.llm.provider,
        err,
        "Apoc task execution failed"
      );
    }
  }

  /** Reload with updated config (called when settings change) */
  async reload(): Promise<void> {
    this.config = ConfigManager.getInstance().get();
    this.agent = undefined;
    await this.initialize();
  }
}
