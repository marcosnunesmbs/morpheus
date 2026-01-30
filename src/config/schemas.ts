import { z } from 'zod';
import { DEFAULT_CONFIG } from '../types/config.js';

// Zod Schema matching MorpheusConfig interface
export const ConfigSchema = z.object({
  agent: z.object({
    name: z.string().default(DEFAULT_CONFIG.agent.name),
    personality: z.string().default(DEFAULT_CONFIG.agent.personality),
  }).default(DEFAULT_CONFIG.agent),
  llm: z.object({
    provider: z.enum(['openai', 'anthropic', 'ollama', 'gemini']).default(DEFAULT_CONFIG.llm.provider),
    model: z.string().min(1).default(DEFAULT_CONFIG.llm.model),
    temperature: z.number().min(0).max(1).default(DEFAULT_CONFIG.llm.temperature),
    api_key: z.string().optional(),
  }).default(DEFAULT_CONFIG.llm),
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
