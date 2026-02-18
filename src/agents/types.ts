import type { LLMConfig } from '../types/config.js';

export interface SubAgentConfig extends LLMConfig {
  system_prompt?: string;
  timeout_ms?: number;
}

export type AgentName = 'architect' | 'keymaker' | 'apoc' | 'merovingian';

export interface AgentsConfig {
  architect?: SubAgentConfig;
  keymaker?: SubAgentConfig;
  apoc?: SubAgentConfig;
  merovingian?: SubAgentConfig;
}

export interface AgentResult {
  content: string;
  provider: string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
}

export interface PlanTask {
  title: string;
  description: string;
  assigned_to: 'apoc' | 'merovingian';
  depends_on?: number[]; // indices into tasks array
}

export interface PlanResult {
  objective: string;
  tasks: PlanTask[];
  raw_plan: string;
}

export interface BlueprintResult {
  task_index: number;
  blueprint: string; // Markdown with technical details
  files_to_create: string[];
  files_to_modify: string[];
  commands_needed: string[];
}
