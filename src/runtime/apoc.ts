import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderFactory } from "./providers/factory.js";
import { ReactAgent } from "langchain";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";
import { buildDevKit } from "../devkit/index.js";
import { SQLiteChatMessageHistory } from "./memory/sqlite.js";

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
  private static currentSessionId: string | undefined = undefined;

  private agent?: ReactAgent;
  private config: MorpheusConfig;
  private display = DisplayManager.getInstance();

  private constructor(config?: MorpheusConfig) {
    this.config = config || ConfigManager.getInstance().get();
  }

  /**
   * Called by Oracle before each chat() so Apoc knows which session to
   * attribute its token usage to.
   */
  public static setSessionId(sessionId: string | undefined): void {
    Apoc.currentSessionId = sessionId;
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
   * @param sessionId Session to attribute token usage to (defaults to 'apoc')
   */
  async execute(task: string, context?: string, sessionId?: string): Promise<string> {
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
- Navigate websites, inspect DOM, click elements, fill forms using a real browser (for JS-heavy pages and SPAs)
- Search the internet with browser_search (DuckDuckGo, returns structured results)

OPERATING RULES:
1. Use tools to accomplish the task. Do not speculate.
2. Always verify results after execution.
3. Report clearly what was done and what the result was.
4. If something fails, report the error and what you tried.
5. Stay focused on the delegated task only.

BROWSER WORKFLOW RULES (when using browser tools):
1. ALWAYS call browser_navigate first to load the page.
2. ALWAYS call browser_get_dom before browser_click or browser_fill to inspect the page structure and choose the correct CSS selectors. Never guess selectors — analyze the DOM.
3. Analyze the DOM to identify interactive elements (inputs, buttons, links), their selectors (id, class, name), and the page flow.
4. If the task requires information you don't have (e.g. email, password, form fields, personal data), DO NOT proceed. Instead, immediately return to Oracle with a clear message listing exactly what information is needed from the user. Example: "To complete the login form I need: email address and password."
5. After clicking or filling, call browser_get_dom again to verify the page changed as expected.
6. Report what was done, the final URL, and any relevant content extracted.

SEARCH & FACT-CHECKING RULES (when using browser_search to answer factual questions):
1. Call browser_search first to get a list of relevant sources.
2. ALWAYS open at least 3 of the returned URLs with browser_navigate to read the actual content. Do not rely solely on the snippet — snippets may be outdated or incomplete.
3. Cross-reference the information across the sources. If they agree, report the fact with confidence. If they disagree, report all versions found and indicate the discrepancy.
4. Prefer authoritative sources (official team sites, major sports outlets, official event pages) over aggregators.
5. Include the source URLs in your final report so Oracle can pass them to the user.

${context ? `CONTEXT FROM ORACLE:\n${context}` : ""}
    `);

    const userMessage = new HumanMessage(task);
    const messages: BaseMessage[] = [systemMessage, userMessage];

    try {
      const response = await this.agent!.invoke({ messages });

      // Persist Apoc-generated messages so token usage is tracked in short-memory.db.
      // Use the caller's session when provided, then the static session set by Oracle,
      // otherwise fall back to 'apoc'.
      const apocConfig = this.config.apoc || this.config.llm;
      const newMessages = response.messages.slice(messages.length);
      if (newMessages.length > 0) {
        const targetSession = sessionId ?? Apoc.currentSessionId ?? 'apoc';
        const history = new SQLiteChatMessageHistory({ sessionId: targetSession });
        for (const msg of newMessages) {
          (msg as any).provider_metadata = {
            provider: apocConfig.provider,
            model: apocConfig.model,
          };
        }
        await history.addMessages(newMessages);
        history.close();
      }

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
