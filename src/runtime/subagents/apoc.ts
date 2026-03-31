import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import type { StructuredTool } from "@langchain/core/tools";
import { MorpheusConfig } from "../../types/config.js";
import { ConfigManager } from "../../config/manager.js";
import { ServiceContainer, SERVICE_KEYS } from "../container.js";
import type { ILLMProviderFactory } from "../ports/ILLMProviderFactory.js";
import { ReactAgent } from "langchain";
import { ProviderError } from "../errors.js";
import { DisplayManager } from "../display.js";
import { buildDevKit } from "morpheus-devkit";
import { instrumentDevKitTools } from "./devkit-instrument.js";
import type { OracleTaskContext, AgentResult } from "../tasks/types.js";
import type { ISubagent } from "./ISubagent.js";
import { extractRawUsage, persistAgentMessage, buildAgentResult, emitToolAuditEvents } from "./utils.js";
import { buildDelegationTool } from "../tools/delegation-utils.js";
import { SubagentRegistry } from "./registry.js";
import { USER_HOME } from "../../config/paths.js";
import { SkillRegistry } from "../skills/index.js";

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

  /** Update tool description with available skills */
  static async refreshDelegateCatalog(): Promise<void> {
    if (Apoc._delegateTool) {
      const skills = SkillRegistry.getInstance().getEnabled();
      const gwsSkills = skills.filter(s => s.name.startsWith('gws-') || s.name.startsWith('recipe-'));
      
      let description = `Delegate a devtools task to Apoc, the specialized development subagent.

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
- Google Workspace (GWS) operations: manage Sheets, Docs, Calendar, Drive, Gmail using the \`gws\` CLI. Apoc will ensure proper authentication is set for each command and report any errors encountered.`;
      
      if (gwsSkills.length > 0) {
        description += '\n\nAvailable Google Workspace (GWS) and Recipe capabilities:\n' + 
          gwsSkills.map(s => `- ${s.name}: ${s.description}`).join('\n');
      }
      
      Apoc._delegateTool.description = description;
    }
  }

  public static getInstance(config?: MorpheusConfig): Apoc {
    if (!Apoc.instance) {
      Apoc.instance = new Apoc(config);
      SubagentRegistry.register({
        agentKey: 'apoc', auditAgent: 'apoc', label: 'Apoc',
        delegateToolName: 'apoc_delegate', emoji: '🧑‍🔬', color: 'amber',
        description: 'Filesystem, shell & browser',
        colorClass: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-amber-50 dark:bg-amber-900/30',
        badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-800 dark:text-amber-200',
        instance: Apoc.instance,
        hasDynamicDescription: true,
        isMultiInstance: false,
        setSessionId: (id) => Apoc.setSessionId(id),
        refreshCatalog: () => Apoc.refreshDelegateCatalog(),
      });
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
      allowed_paths: devkit.allowed_paths || [],
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
      this.agent = await ServiceContainer.get<ILLMProviderFactory>(SERVICE_KEYS.providerFactory).createBare(apocConfig, tools);
    } catch (err) {
      throw new ProviderError(
        apocConfig.provider,
        err,
        "Apoc subagent initialization failed"
      );
    }
  }

  /**
   * Auto-resolve relevant skills for a task by matching keywords to skill names.
   * Returns the concatenated skill content to inject into Apoc's system prompt.
   */
  private resolveSkillsForTask(task: string, context?: string): string {
    const registry = SkillRegistry.getInstance();
    const enabled = registry.getEnabled();
    if (enabled.length === 0) return '';

    const combined = `${task} ${context || ''}`.toLowerCase();

    // Check if skill content was already provided in the context (Oracle loaded it)
    if (context && context.includes('Loaded skill:')) return '';

    // GWS keyword → skill name mapping
    const gwsKeywordMap: Record<string, string[]> = {
      'tasks': ['gws-tasks'],
      'task': ['gws-tasks'],
      'google tasks': ['gws-tasks'],
      'calendar': ['gws-calendar', 'gws-calendar-insert', 'gws-calendar-agenda'],
      'evento': ['gws-calendar', 'gws-calendar-insert'],
      'event': ['gws-calendar', 'gws-calendar-insert'],
      'agenda': ['gws-calendar-agenda', 'gws-calendar'],
      'gmail': ['gws-gmail', 'gws-gmail-send'],
      'email': ['gws-gmail', 'gws-gmail-send'],
      'e-mail': ['gws-gmail', 'gws-gmail-send'],
      'enviar email': ['gws-gmail-send'],
      'send email': ['gws-gmail-send'],
      'forward': ['gws-gmail-forward'],
      'encaminhar': ['gws-gmail-forward'],
      'reply': ['gws-gmail-reply'],
      'responder email': ['gws-gmail-reply'],
      'drive': ['gws-drive', 'gws-drive-upload'],
      'upload': ['gws-drive-upload'],
      'docs': ['gws-docs', 'gws-docs-write'],
      'documento': ['gws-docs', 'gws-docs-write'],
      'document': ['gws-docs', 'gws-docs-write'],
      'sheets': ['gws-sheets'],
      'planilha': ['gws-sheets'],
      'spreadsheet': ['gws-sheets'],
      'meet': ['gws-meet'],
      'reunião': ['gws-meet'],
      'meeting': ['gws-meet'],
      'forms': ['gws-forms'],
      'formulário': ['gws-forms'],
      'keep': ['gws-keep'],
      'nota': ['gws-keep'],
      'note': ['gws-keep'],
      'chat': ['gws-chat', 'gws-chat-send'],
      'classroom': ['gws-classroom'],
    };

    const matchedSkills = new Set<string>();

    // Check if task involves GWS at all
    const isGwsTask = combined.includes('gws') || combined.includes('google') ||
      Object.keys(gwsKeywordMap).some(kw => combined.includes(kw));

    if (!isGwsTask) return '';

    // Find matching skills by keyword
    for (const [keyword, skillNames] of Object.entries(gwsKeywordMap)) {
      if (combined.includes(keyword)) {
        for (const name of skillNames) {
          matchedSkills.add(name);
        }
      }
    }

    // If GWS task but no specific match, try to match by skill name fragments
    if (matchedSkills.size === 0 && isGwsTask) {
      for (const skill of enabled) {
        if (skill.name.startsWith('gws-')) {
          const service = skill.name.replace('gws-', '').replace(/-/g, ' ');
          if (combined.includes(service)) {
            matchedSkills.add(skill.name);
          }
        }
      }
    }

    // Also check recipe skills
    for (const skill of enabled) {
      if (skill.name.startsWith('recipe-')) {
        const recipe = skill.name.replace('recipe-', '').replace(/-/g, ' ');
        if (combined.includes(recipe)) {
          matchedSkills.add(skill.name);
        }
      }
    }

    if (matchedSkills.size === 0) return '';

    // Load skill content (limit to 3 most relevant)
    const skillContents: string[] = [];
    let count = 0;
    for (const name of matchedSkills) {
      if (count >= 3) break;
      const skill = registry.get(name);
      if (skill?.enabled && skill.content) {
        skillContents.push(`━━━ SKILL: ${skill.name} ━━━\n${skill.content}`);
        count++;
      }
    }

    if (skillContents.length === 0) return '';

    this.display.log(`Auto-injected ${skillContents.length} skill(s) for task: ${[...matchedSkills].slice(0, 3).join(', ')}`, {
      source: 'Apoc',
      level: 'info',
    });

    return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOADED SKILLS — FOLLOW THESE INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The following skill instructions tell you EXACTLY how to execute this task.
Use \`gws schema <resource>.<method>\` to discover required params before calling any method.
Do NOT guess command syntax — follow the skill instructions below.

${skillContents.join('\n\n')}`;
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

    // Auto-resolve and inject relevant skill content for the task
    const skillSection = this.resolveSkillsForTask(task, context);

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
• You have the capability to execute \`gws\` CLI commands for Google Workspace operations (Sheets, Calendar, Drive, etc.).
• **CRITICAL GWS AUTH**: Every time you run a \`gws\` command, you MUST ensure \`GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE\` is set to the absolute path of your credentials file: \`${USER_HOME}/.morpheus/gws/credentials.json\` (or the equivalent absolute path on the current OS). If not already set in your environment, prepend the command with the export (e.g., \`export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=... && gws ...\` on Linux/macOS or \`$env:GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE='...'; gws ...\` on Windows).
• If the \`gws\` command fails, report the error detail. If the tool is not installed, inform the user clearly.
• **IMPORTANT**: When skill instructions are loaded below, follow them EXACTLY. Do NOT guess CLI syntax — use \`gws schema\` to discover params first.${skillSection}

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
- Google Workspace (GWS) operations: manage Sheets, Docs, Calendar, Drive, Gmail using the \`gws\` CLI. Apoc will ensure proper authentication is set for each command and report any errors encountered.

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
