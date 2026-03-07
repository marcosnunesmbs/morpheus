import type { StructuredTool } from "@langchain/core/tools";
import type { ISubagent } from "./ISubagent.js";
import type { TaskRecord, AgentResult } from "../tasks/types.js";
import type { AuditAgent } from "../audit/types.js";
import { DisplayManager } from "../display.js";

export interface SubagentDisplayMeta {
  agentKey: string;
  auditAgent: string;
  label: string;
  delegateToolName: string;
  emoji: string;
  color: string;
  description: string;
  colorClass: string;
  bgClass: string;
  badgeClass: string;
}

export interface SubagentRegistration extends SubagentDisplayMeta {
  instance: ISubagent;
  hasDynamicDescription: boolean;
  isMultiInstance: boolean;
  setSessionId?: (id: string | undefined) => void;
  refreshCatalog?: () => Promise<void>;
  executeTask?: (task: TaskRecord) => Promise<AgentResult>;
}

/**
 * System-level agents that are not subagents but need display metadata for audit/UI.
 */
export const SYSTEM_AGENTS: SubagentDisplayMeta[] = [
  {
    agentKey: 'oracle', auditAgent: 'oracle', label: 'Oracle',
    delegateToolName: '', emoji: '🔮', color: 'blue',
    description: 'Root orchestrator',
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-50 dark:bg-blue-900/10',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  {
    agentKey: 'chronos', auditAgent: 'chronos', label: 'Chronos',
    delegateToolName: '', emoji: '⏰', color: 'orange',
    description: 'Temporal scheduler',
    colorClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-50 dark:bg-orange-900/10',
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  {
    agentKey: 'sati', auditAgent: 'sati', label: 'Sati',
    delegateToolName: '', emoji: '🧠', color: 'emerald',
    description: 'Long-term memory',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 dark:bg-emerald-900/10',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    agentKey: 'telephonist', auditAgent: 'telephonist', label: 'Telephonist',
    delegateToolName: '', emoji: '📞', color: 'rose',
    description: 'Audio transcription',
    colorClass: 'text-rose-600 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-900/10',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
];

/**
 * Central registry for all subagents. Static singleton following ChannelRegistry pattern.
 */
export class SubagentRegistry {
  private static readonly agents = new Map<string, SubagentRegistration>();
  private static display = DisplayManager.getInstance();

  static register(reg: SubagentRegistration): void {
    SubagentRegistry.agents.set(reg.agentKey, reg);
    SubagentRegistry.display.log(
      `Subagent registered: ${reg.label} (${reg.agentKey})`,
      { source: 'SubagentRegistry', level: 'info' },
    );
  }

  static get(agentKey: string): SubagentRegistration | undefined {
    return SubagentRegistry.agents.get(agentKey);
  }

  static getAll(): SubagentRegistration[] {
    return [...SubagentRegistry.agents.values()];
  }

  static getByToolName(toolName: string): SubagentRegistration | undefined {
    for (const reg of SubagentRegistry.agents.values()) {
      if (reg.delegateToolName === toolName) return reg;
    }
    return undefined;
  }

  /** Returns the set of all delegation tool names (replaces ORACLE_DELEGATION_TOOLS). */
  static getDelegationToolNames(): Set<string> {
    const names = new Set<string>();
    for (const reg of SubagentRegistry.agents.values()) {
      if (reg.delegateToolName) names.add(reg.delegateToolName);
    }
    return names;
  }

  /** Returns all delegation tools for Oracle's coreTools array. */
  static getDelegationTools(): StructuredTool[] {
    return SubagentRegistry.getAll().map(reg => reg.instance.createDelegateTool());
  }

  /** Sets session ID on all registered subagents that support it. */
  static setAllSessionIds(sessionId: string | undefined): void {
    for (const reg of SubagentRegistry.agents.values()) {
      reg.setSessionId?.(sessionId);
    }
  }

  /** Refreshes dynamic descriptions on all subagents that support it. */
  static async refreshAllCatalogs(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const reg of SubagentRegistry.agents.values()) {
      if (reg.hasDynamicDescription && reg.refreshCatalog) {
        promises.push(reg.refreshCatalog().catch(() => {}));
      }
    }
    await Promise.all(promises);
  }

  /** Executes a task by routing to the correct subagent (replaces worker switch/case). */
  static async executeTask(task: TaskRecord): Promise<AgentResult> {
    const reg = SubagentRegistry.agents.get(task.agent);
    if (!reg) {
      throw new Error(`Unknown task agent: ${task.agent}`);
    }
    if (reg.executeTask) {
      return reg.executeTask(task);
    }
    return reg.instance.execute(task.input, task.context ?? undefined, task.session_id, {
      origin_channel: task.origin_channel,
      session_id: task.session_id,
      origin_message_id: task.origin_message_id ?? undefined,
      origin_user_id: task.origin_user_id ?? undefined,
    });
  }

  /** Maps task agent key to audit agent name (e.g. 'trinit' -> 'trinity'). */
  static resolveAuditAgent(taskAgent: string): AuditAgent {
    const reg = SubagentRegistry.agents.get(taskAgent);
    return (reg?.auditAgent ?? taskAgent) as AuditAgent;
  }

  /** Returns display metadata for all agents (subagents + system agents). */
  static getDisplayMetadata(): SubagentDisplayMeta[] {
    const subagents: SubagentDisplayMeta[] = SubagentRegistry.getAll().map(reg => ({
      agentKey: reg.agentKey,
      auditAgent: reg.auditAgent,
      label: reg.label,
      delegateToolName: reg.delegateToolName,
      emoji: reg.emoji,
      color: reg.color,
      description: reg.description,
      colorClass: reg.colorClass,
      bgClass: reg.bgClass,
      badgeClass: reg.badgeClass,
    }));
    return [...SYSTEM_AGENTS, ...subagents];
  }

  /** Reloads all registered subagents. */
  static async reloadAll(): Promise<void> {
    for (const reg of SubagentRegistry.agents.values()) {
      await reg.instance.reload();
    }
  }
}
