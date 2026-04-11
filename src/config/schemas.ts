import { z } from 'zod';
import { DEFAULT_CONFIG } from '../types/config.js';

export const TtsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(['openai', 'gemini']).default('gemini'),
  model: z.string().min(1).default('gemini-2.5-flash-preview-tts'),
  voice: z.string().min(1).default('Kore'),
  apiKey: z.string().optional(),
  style_prompt: z.string().optional(),
});

export const AudioConfigSchema = z.object({
  provider: z.enum(['gemini', 'openai', 'openrouter', 'ollama']).default(DEFAULT_CONFIG.audio.provider),
  model: z.string().min(1).default(DEFAULT_CONFIG.audio.model),
  enabled: z.boolean().default(DEFAULT_CONFIG.audio.enabled),
  apiKey: z.string().optional(),
  base_url: z.string().optional(),
  maxDurationSeconds: z.number().default(DEFAULT_CONFIG.audio.maxDurationSeconds),
  supportedMimeTypes: z.array(z.string()).default(DEFAULT_CONFIG.audio.supportedMimeTypes),
  tts: TtsConfigSchema.optional(),
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
    enabled_archived_sessions: z.boolean().default(true),
    similarity_threshold: z.number().min(0).max(1).default(0.7),
    evaluation_interval: z.number().int().min(1).default(1),
    chunk_size: z.number().int().positive().default(500),
    session_chunk_limit: z.number().int().positive().optional(),
    max_memory_tokens: z.number().int().positive().optional(),
});

export const ApocConfigSchema = LLMConfigSchema.extend({
    working_dir: z.string().optional(),
    timeout_ms: z.number().int().positive().optional(),
    execution_mode: z.enum(['sync', 'async']).default('async'),
});

export const NeoConfigSchema = LLMConfigSchema.extend({
    execution_mode: z.enum(['sync', 'async']).default('async'),
});

export const TrinityConfigSchema = LLMConfigSchema.extend({
    execution_mode: z.enum(['sync', 'async']).default('async'),
});

export const LinkConfigSchema = LLMConfigSchema.extend({
    personality: z.string().optional(),
    chunk_size: z.number().int().positive().default(500),
    score_threshold: z.number().min(0).max(1).default(0.5),
    max_results: z.number().int().positive().default(10),
    execution_mode: z.enum(['sync', 'async']).default('async'),
    scan_interval_ms: z.number().int().min(5000).default(30000),
    max_file_size_mb: z.number().int().positive().default(50),
    vector_weight: z.number().min(0).max(1).default(0.8),
    bm25_weight: z.number().min(0).max(1).default(0.2),
});


export const WebhookConfigSchema = z.object({
  telegram_notify_all: z.boolean().optional(),
}).optional();

export const ChronosConfigSchema = z.object({
  timezone: z.string().default('UTC'),
  check_interval_ms: z.number().min(60000).default(60000),
  max_active_jobs: z.number().min(1).max(1000).default(100),
});

export const DevKitConfigSchema = z.object({
  sandbox_dir: z.string().optional(),
  readonly_mode: z.boolean().default(false),
  allowed_shell_commands: z.array(z.string()).default([]),
  allowed_paths: z.array(z.string()).default([]),
  enable_filesystem: z.boolean().default(true),
  enable_shell: z.boolean().default(true),
  enable_git: z.boolean().default(true),
  enable_network: z.boolean().default(true),
  timeout_ms: z.number().int().positive().default(30000),
});

export const SmithEntrySchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/, 'Smith name must be lowercase alphanumeric with hyphens/underscores'),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(7900),
  auth_token: z.string().min(1),
  tls: z.boolean().default(false),
});

export const SetupConfigSchema = z.object({
  enabled: z.boolean().default(true),
  fields: z.array(z.string()).default(['name', 'timezone', 'preferred_language']),
});

export const SmithsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  execution_mode: z.enum(['sync', 'async']).default('async'),
  heartbeat_interval_ms: z.number().int().min(5000).default(30000),
  connection_timeout_ms: z.number().int().min(1000).default(10000),
  task_timeout_ms: z.number().int().min(1000).default(60000),
  entries: z.array(SmithEntrySchema).default([]),
});

export const CurrencyConfigSchema = z.object({
  code: z.string().min(1).default('USD'),
  symbol: z.string().min(1).default('$'),
  rate: z.number().positive().default(1.0),
});

export const GwsConfigSchema = z.object({
  service_account_json: z.string().optional(),
  service_account_json_content: z.string().optional(),
  enabled: z.boolean().default(true),
});

// Zod Schema matching MorpheusConfig interface
export const ConfigSchema = z.object({
  agent: z.object({
    name: z.string().default(DEFAULT_CONFIG.agent.name),
    personality: z.string().default(DEFAULT_CONFIG.agent.personality),
  }).default(DEFAULT_CONFIG.agent),
  llm: LLMConfigSchema.default(DEFAULT_CONFIG.llm),
  sati: SatiConfigSchema.optional(),
  neo: NeoConfigSchema.optional(),
  apoc: ApocConfigSchema.optional(),
  trinity: TrinityConfigSchema.optional(),
  link: LinkConfigSchema.optional(),
  webhooks: WebhookConfigSchema,
  audio: AudioConfigSchema.default(DEFAULT_CONFIG.audio),
  memory: z.object({
    limit: z.number().int().positive().optional(),
  }).default(DEFAULT_CONFIG.memory),
  runtime: z.object({
    async_tasks: z.object({
      enabled: z.boolean().default(DEFAULT_CONFIG.runtime?.async_tasks.enabled ?? true),
    }).default(DEFAULT_CONFIG.runtime?.async_tasks ?? { enabled: true }),
  }).optional(),
  chronos: ChronosConfigSchema.optional(),
  devkit: DevKitConfigSchema.optional(),
  smiths: SmithsConfigSchema.optional(),
  gws: GwsConfigSchema.optional(),
  setup: SetupConfigSchema.optional(),
  currency: CurrencyConfigSchema.optional(),
  verbose_mode: z.boolean().default(true),
  channels: z.object({
    telegram: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      allowedUsers: z.array(z.string()).default([]),
    }).default(DEFAULT_CONFIG.channels.telegram),
    discord: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      allowedUsers: z.array(z.string()).default([]),
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

export const OAuth2ConfigSchema = z.object({
  grant_type: z.enum(['client_credentials', 'authorization_code']).default('authorization_code'),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  scope: z.string().optional(),
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
    oauth2: OAuth2ConfigSchema.optional(),
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

