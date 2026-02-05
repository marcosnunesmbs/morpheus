import { z } from 'zod';
import { DEFAULT_CONFIG } from '../types/config.js';

export const AudioConfigSchema = z.object({
  provider: z.enum(['google']).default(DEFAULT_CONFIG.audio.provider),
  model: z.string().min(1).default(DEFAULT_CONFIG.audio.model),
  enabled: z.boolean().default(DEFAULT_CONFIG.audio.enabled),
  apiKey: z.string().optional(),
  maxDurationSeconds: z.number().default(DEFAULT_CONFIG.audio.maxDurationSeconds),
  supportedMimeTypes: z.array(z.string()).default(DEFAULT_CONFIG.audio.supportedMimeTypes),
});

export const LLMConfigSchema = z.object({
    provider: z.enum(['openai', 'anthropic', 'openrouter', 'ollama', 'gemini']).default(DEFAULT_CONFIG.llm.provider),
    model: z.string().min(1).default(DEFAULT_CONFIG.llm.model),
    temperature: z.number().min(0).max(1).default(DEFAULT_CONFIG.llm.temperature),
    max_tokens: z.number().int().positive().optional(),
    api_key: z.string().optional(),
    base_url: z.string().optional(),
    context_window: z.number().int().positive().optional(),
});

export const SatiConfigSchema = LLMConfigSchema.extend({
    memory_limit: z.number().int().positive().optional(),
});

// Zod Schema matching MorpheusConfig interface
export const ConfigSchema = z.object({
  agent: z.object({
    name: z.string().default(DEFAULT_CONFIG.agent.name),
    personality: z.string().default(DEFAULT_CONFIG.agent.personality),
  }).default(DEFAULT_CONFIG.agent),
  llm: LLMConfigSchema.default(DEFAULT_CONFIG.llm),
  santi: SatiConfigSchema.optional(),
  audio: AudioConfigSchema.default(DEFAULT_CONFIG.audio),
  memory: z.object({
    limit: z.number().int().positive().optional(),
  }).default(DEFAULT_CONFIG.memory),
  channels: z.object({
    telegram: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      allowedUsers: z.array(z.string()).default([]),
    }).default(DEFAULT_CONFIG.channels.telegram),
    discord: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
    }).default(DEFAULT_CONFIG.channels.discord),
  }).default(DEFAULT_CONFIG.channels),
  ui: z.object({
    enabled: z.boolean().default(DEFAULT_CONFIG.ui.enabled),
    port: z.number().default(DEFAULT_CONFIG.ui.port),
  }).default(DEFAULT_CONFIG.ui),
  logging: z.object({
    enabled: z.boolean().default(DEFAULT_CONFIG.logging.enabled),
    level: z.enum(['debug', 'info', 'warn', 'error']).default(DEFAULT_CONFIG.logging.level),
    retention: z.string().default(DEFAULT_CONFIG.logging.retention),
  }).default(DEFAULT_CONFIG.logging),
});

export const MCPServerConfigSchema = z.discriminatedUnion('transport', [
  z.object({
    transport: z.literal('stdio'),
    command: z.string().min(1, 'Command is required for stdio transport'),
    args: z.array(z.string()).optional().default([]),
    env: z.record(z.string(), z.string()).optional().default({}),
    _comment: z.string().optional(),
  }),
  z.object({
    transport: z.literal('http'),
    url: z.string().url('Valid URL is required for http transport'),
    headers: z.record(z.string(), z.string()).optional().default({}),
    args: z.array(z.string()).optional().default([]),
    env: z.record(z.string(), z.string()).optional().default({}),
    _comment: z.string().optional(),
  }),
]);

export const MCPConfigFileSchema = z.record(
  z.string(),
  z.union([
    MCPServerConfigSchema,
    z.string(),
  ])
);

