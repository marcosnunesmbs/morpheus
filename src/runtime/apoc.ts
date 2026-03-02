import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import type { StructuredTool } from "@langchain/core/tools";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderFactory } from "./providers/factory.js";
import { ReactAgent } from "langchain";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";
import { buildDevKit } from "morpheus-devkit";
import { instrumentDevKitTools } from "./devkit-instrument.js";
import type { OracleTaskContext, AgentResult } from "./tasks/types.js";
import type { ISubagent } from "./ISubagent.js";
import { extractRawUsage, persistAgentMessage, buildAgentResult, emitToolAuditEvents } from "./subagent-utils.js";
import { buildDelegationTool } from "./tools/delegation-utils.js";

/**
 * Apoc is a subagent of Oracle specialized in devtools operations.
 * It receives delegated tasks from Oracle and executes them using DevKit tools
 * (filesystem, shell, git, network, processes, packages, system).
 *
 * Oracle calls Apoc via the `apoc_delegate` tool when the user requests
 * dev-related tasks such as running commands, reading/writing files,
 * managing git, or inspecting system state.
 */
export class Apoc implements ISubagent {
  private static instance: Apoc | null = null;
  private static currentSessionId: string | undefined = undefined;
  private static _delegateTool: StructuredTool | null = null;

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
    Apoc._delegateTool = null;
  }

  async initialize(): Promise<void> {
    const apocConfig = this.config.apoc || this.config.llm;

    const devkit = ConfigManager.getInstance().getDevKitConfig();
    const timeout_ms = devkit.timeout_ms || this.config.apoc?.timeout_ms || 30_000;
    const personality = this.config.apoc?.personality || 'pragmatic_dev';

    // Import morpheus-devkit to trigger side-effect tool registration
    await import("morpheus-devkit");
    const rawTools = buildDevKit({
      working_dir: devkit.sandbox_dir || process.cwd(),
      allowed_commands: devkit.allowed_shell_commands || [],
      timeout_ms,
      sandbox_dir: devkit.sandbox_dir,
      readonly_mode: devkit.readonly_mode,
      enable_filesystem: devkit.enable_filesystem,
      enable_shell: devkit.enable_shell,
      enable_git: devkit.enable_git,
      enable_network: devkit.enable_network,
    });
    const tools = instrumentDevKitTools(rawTools, () => Apoc.currentSessionId, () => 'apoc');

    this.display.log(
      `Apoc initialized with ${tools.length} DevKit tools (sandbox_dir: ${devkit.sandbox_dir}, personality: ${personality})`,
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
   * @param taskContext Optional Oracle task context (unused by Apoc directly — kept for ISubagent compatibility)
   */
  async execute(task: string, context?: string, sessionId?: string, taskContext?: OracleTaskContext): Promise<AgentResult> {
    if (!this.agent) {
      await this.initialize();
    }

    this.display.log(`Executing delegated task: ${task.slice(0, 80)}...`, {
      source: "Apoc",
    });
    const personality = this.config.apoc?.personality || 'pragmatic_dev';

    const systemMessage = new SystemMessage(`
You are Apoc, ${personality === 'pragmatic_dev' ? 'a pragmatic and methodical developer' : personality}, a high-reliability execution and verification subagent inside the Morpheus system.

You are NOT a conversational assistant.
You are a task executor, evidence collector, and autonomous verifier.

Accuracy is more important than speed.
If verification fails, you must state it clearly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PRINCIPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Never fabricate.
• Never rely on prior knowledge when online tools are available.
• Prefer authoritative sources over secondary commentary.
• Prefer verification over assumption.
• Explicitly measure and report confidence.

If reliable evidence cannot be obtained:
State clearly:
"I was unable to retrieve this information online at this time."

Stop there.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before using tools:

1. Identify task type:
   - Dev operation
   - Web research
   - Browser automation
   - System inspection
   - Network verification

2. Determine whether external verification is required.
   If yes → use tools.
   If no → respond directly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEB RESEARCH STRATEGY (QUALITY-FIRST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You operate in iterative cycles.

Maximum cycles: 2

━━━━━━━━━━━━━━
CYCLE 1
━━━━━━━━━━━━━━

PHASE 1 — Intelligent Query Design
• Identify intent: news, official, documentation, price, general.
• Add year if time-sensitive.
• Add region if relevant.
• Make query precise and focused.

PHASE 2 — Search
• Use browser_search.
• Immediately store titles and snippets.

PHASE 3 — Source Selection
Select up to 3 URLs.
Prefer:
  - One official source
  - One major publication
  - One independent alternative
Avoid:
  - Multiple links from same domain group
  - Obvious paywalls or login walls

PHASE 4 — Navigation & Extraction
• Use browser_navigate.
• For news/media → wait_until: "networkidle0"
• Extract content from:
    article > main > body
• Remove navigation noise.

PHASE 5 — Cross Verification
• Compare findings across sources.
• Detect inconsistencies.
• Identify strongest source.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTO-REFINEMENT LOOP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After completing Cycle 1, evaluate:

Trigger refinement if ANY condition is true:

• No authoritative source was successfully opened.
• Only snippets were available.
• Extracted content did not contain concrete answer.
• Sources contradict each other.
• Confidence would be LOW.
• Search results appear irrelevant or weak.

If refinement is triggered:

1. Reformulate query:
   - Add year
   - Add country
   - Add "official"
   - Add domain filters (gov, org, major media)
   - Remove ambiguous words

2. Execute a second search cycle (Cycle 2).
3. Repeat selection, navigation, extraction, verification.
4. Choose the stronger cycle's evidence.
5. Do NOT perform more than 2 cycles.

If Cycle 2 also fails:
Report inability clearly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELF-CRITIQUE (MANDATORY BEFORE OUTPUT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Internally evaluate:

1. Did I use at least one authoritative source when available?
2. Did I rely only on snippets unnecessarily?
3. Did I merge conflicting data incorrectly?
4. Did I verify the page actually contained the requested information?
5. Did I introduce any information not explicitly found online?
6. Is my confidence level justified?

If issues are found:
Correct them.
If correction is not possible:
Lower confidence explicitly.

Do NOT expose this checklist.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIDENCE CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HIGH:
• Multiple independent authoritative sources agree
• Full page extraction used

MEDIUM:
• One strong source OR minor inconsistencies
• Partial verification

LOW:
• Snippets only OR weak sources OR incomplete confirmation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Direct Answer
2. Evidence Summary
3. Sources (URLs)
4. Confidence Level (HIGH / MEDIUM / LOW)
5. Completion Status (true / false)

No conversational filler.
No reasoning trace.
Only structured output.

${context ? `CONTEXT FROM ORACLE:\n${context}` : ""}
`);

    const userMessage = new HumanMessage(task);
    const messages: BaseMessage[] = [systemMessage, userMessage];

    try {
      const inputCount = messages.length;
      const startMs = Date.now();
      const response = await this.agent!.invoke({ messages }, { recursionLimit: 100 });
      const durationMs = Date.now() - startMs;

      const apocConfig = this.config.apoc || this.config.llm;
      const lastMessage = response.messages[response.messages.length - 1];
      const content =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      const rawUsage = extractRawUsage(lastMessage);
      const stepCount = response.messages.filter((m: BaseMessage) => m instanceof AIMessage).length;

      const targetSession = sessionId ?? Apoc.currentSessionId ?? "apoc";
      await persistAgentMessage('apoc', content, apocConfig, targetSession, rawUsage, durationMs);

      emitToolAuditEvents(response.messages.slice(inputCount), targetSession, 'apoc');

      this.display.log("Apoc task completed.", { source: "Apoc" });
      return buildAgentResult(content, apocConfig, rawUsage, durationMs, stepCount);
    } catch (err) {
      throw new ProviderError(
        this.config.apoc?.provider || this.config.llm.provider,
        err,
        "Apoc task execution failed"
      );
    }
  }

  createDelegateTool(): StructuredTool {
    if (!Apoc._delegateTool) {
      Apoc._delegateTool = buildDelegationTool({
        name: "apoc_delegate",
        description: `Delegate a devtools task to Apoc, the specialized development subagent.

This tool enqueues a background task and returns an acknowledgement with task id.
Do not expect final execution output in the same response.
Each task must contain a single atomic action with a clear expected result.

Use this tool when the user asks for ANY of the following:
- File operations: read, write, create, delete files or directories
- Shell commands: run scripts, execute commands, check output
- Git: status, log, diff, commit, push, pull, clone, branch
- Package management: npm install/update/audit, yarn, package.json inspection
- Process management: list processes, kill processes, check ports
- Network: ping hosts, curl URLs, DNS lookups
- System info: environment variables, OS info, disk space, memory
- Internet search: search DuckDuckGo and verify facts by reading at least 3 sources via browser_navigate before reporting results.
- Browser automation: navigate websites (JS/SPA), inspect DOM, click elements, fill forms. Apoc will ask for missing user input (e.g. credentials, form fields) before proceeding.

Provide a clear natural language task description. Optionally provide context
from the current conversation to help Apoc understand the broader goal.`,
        agentKey: "apoc",
        agentLabel: "Apoc",
        auditAgent: "apoc",
        isSync: () => ConfigManager.getInstance().get().apoc?.execution_mode === 'sync',
        notifyText: '🧑‍🔬 Apoc is executing your request...',
        executeSync: (task, context, sessionId) =>
          Apoc.getInstance().execute(task, context, sessionId),
      });
    }
    return Apoc._delegateTool;
  }

  /** Reload with updated config (called when settings change) */
  async reload(): Promise<void> {
    this.config = ConfigManager.getInstance().get();
    this.agent = undefined;
    await this.initialize();
  }
}
