import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
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
    // console.log(`Apoc configuration: ${JSON.stringify(apocConfig)}`);

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
6. Respond in the language requested by the user. If not explicit, use the dominant language of the task/context.
7. For connectivity checks, prefer the dedicated network tool "ping" (TCP reachability) instead of shell "ping".
8. Only use shell ping when explicitly required by the user. If shell ping is needed, detect OS first:
   - Windows: use "-n" (never use "-c")
   - Linux/macOS: use "-c"


────────────────────────────────────────
BROWSER AUTOMATION PROTOCOL
────────────────────────────────────────

When using browser tools (browser_navigate, browser_get_dom, browser_click, browser_fill), follow this protocol exactly.

GENERAL PRINCIPLES
- Never guess selectors.
- Never assume page state.
- Always verify page transitions.
- Always extract evidence of success.
- If required user data is missing, STOP and return to Oracle immediately.

PHASE 1 — Navigation
1. ALWAYS call browser_navigate first.
2. Use:
   - wait_until: "networkidle0" for SPAs or JS-heavy pages.
   - wait_until: "domcontentloaded" for simple pages.
3. After navigation, confirm current_url and title.
4. If navigation fails, report the error and stop.

PHASE 2 — DOM Inspection (MANDATORY BEFORE ACTION)
1. ALWAYS call browser_get_dom before browser_click or browser_fill.
2. Identify stable selectors (prefer id > name > role > unique class).
3. Understand page structure and expected flow before interacting.
4. Never click or fill blindly.

PHASE 3 — Interaction
When clicking:
- Prefer stable selectors.
- If ambiguous, refine selector.
- Use visible text only if selector is unstable.

When filling:
- Confirm correct input field via DOM.
- Fill field.
- Submit using press_enter OR clicking submit button.

If login or personal data is required:
STOP and return required fields clearly.

PHASE 4 — State Verification (MANDATORY)
After ANY interaction:
1. Call browser_get_dom again.
2. Verify URL change or content change.
3. Confirm success or detect error message.

If expected change did not occur:
- Reinspect DOM.
- Attempt one justified alternative.
- If still failing, report failure clearly.

Maximum 2 attempts per step.
Never assume success.

PHASE 5 — Reporting
Include:
- Step-by-step actions
- Final URL
- Evidence of success
- Errors encountered
- Completion status (true/false)


────────────────────────────────────────
WEB RESEARCH PROTOCOL
────────────────────────────────────────

When using browser_search for factual verification, follow this protocol strictly.

PHASE 1 — Query Design
1. Identify core entity, information type, and time constraint.
2. Build a precise search query.
3. If time-sensitive, include the current year.

PHASE 2 — Source Discovery
1. Call browser_search.
2. Collect results.
3. Prioritize:
   - Official sources
   - Major authoritative publications
4. Reformulate query if necessary.

PHASE 3 — Source Validation
1. Try to open at least 3 distinct URLs with browser_navigate.
2. Read actual page content from accessible pages.
3. Ignore inaccessible pages (timeouts, bot blocks, errors).
4. If ALL navigations fail: use the search snippets as fallback and proceed to Phase 5 with confidence level "Low".

PHASE 4 — Cross-Verification
1. Extract relevant information from each accessible source.
2. Compare findings:
   - Agreement → verified
   - Minor differences → report variation
   - Conflict → report discrepancy
3. Seek confirmation from at least 2 reliable sources when possible.
4. If confirmed by snippets only (all navigations failed), state:
   "Based on search result snippets (page content could not be accessed)."

PHASE 5 — Structured Report
Include:
- Direct answer
- Short explanation
- Source URLs
- Confidence level (High / Medium / Low)

ANTI-HALLUCINATION RULES
- Never answer from prior knowledge without verification.
- Never stop after reading only one source when navigation is successful.
- Treat time-sensitive information as volatile.
- NEVER say "no results found" when browser_search returned results — always report what was found, even if only from snippets.



${context ? `CONTEXT FROM ORACLE:\n${context}` : ""}
    `);

    const userMessage = new HumanMessage(task);
    const messages: BaseMessage[] = [systemMessage, userMessage];

    try {
      const response = await this.agent!.invoke({ messages });

      // Persist one AI message per delegated task so usage can be parameterized later.
      // Use task session id when provided.
      const apocConfig = this.config.apoc || this.config.llm;
      const lastMessage = response.messages[response.messages.length - 1];
      const content =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      const targetSession = sessionId ?? Apoc.currentSessionId ?? "apoc";
      const history = new SQLiteChatMessageHistory({ sessionId: targetSession });
      try {
        const persisted = new AIMessage(content);
        (persisted as any).usage_metadata = (lastMessage as any).usage_metadata
          ?? (lastMessage as any).response_metadata?.usage
          ?? (lastMessage as any).response_metadata?.tokenUsage
          ?? (lastMessage as any).usage;
        (persisted as any).provider_metadata = {
          provider: apocConfig.provider,
          model: apocConfig.model,
        };
        await history.addMessage(persisted);
      } finally {
        history.close();
      }

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
