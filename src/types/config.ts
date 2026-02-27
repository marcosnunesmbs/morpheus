export interface AgentConfig {
  name: string;
  personality: string;
}

export type LLMProvider = 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'gemini';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number;
  max_tokens?: number;
  api_key?: string;
  base_url?: string;
  context_window?: number;
}

export interface TelegramConfig {
  enabled: boolean;
  token?: string;
  allowedUsers: string[];
}

export interface DiscordConfig {
  enabled: boolean;
  token?: string;
  allowedUsers: string[];
}

export interface ChannelsConfig {
  telegram: TelegramConfig;
  discord: DiscordConfig;
}

export interface UIConfig {
  enabled: boolean;
  port: number;
}

export interface LogConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  retention: string;
}

export type AudioProvider = 'google' | 'openai' | 'openrouter' | 'ollama';

export interface AudioConfig {
  provider: AudioProvider;
  model: string;
  enabled: boolean;
  apiKey?: string;
  base_url?: string;
  maxDurationSeconds: number;
  supportedMimeTypes: string[];
}

export interface SatiConfig extends LLMConfig {
  memory_limit?: number;
  enabled_archived_sessions?: boolean;
}

export type SubAgentExecutionMode = 'sync' | 'async';

export interface DevKitConfig {
  /** Root directory for all DevKit operations. All file/shell/git paths are confined here. */
  sandbox_dir?: string;
  /** When true, blocks all write/delete/create operations (read-only mode). */
  readonly_mode?: boolean;
  /** Shell command allowlist. Empty array = no restriction. When populated, only listed binaries can run. */
  allowed_shell_commands?: string[];
  /** Enable filesystem tools (read, write, list, copy, move, delete). Default: true. */
  enable_filesystem?: boolean;
  /** Enable shell tools (run_command, run_script, which). Default: true. */
  enable_shell?: boolean;
  /** Enable git tools (status, diff, commit, push, pull, clone, etc.). Default: true. */
  enable_git?: boolean;
  /** Enable network tools (http_request, ping, dns_lookup, download_file). Default: true. */
  enable_network?: boolean;
  /** Default timeout in ms for shell operations. Default: 30000. */
  timeout_ms?: number;
}

export interface ApocConfig extends LLMConfig {
  /**
   * @deprecated Use devkit.sandbox_dir instead. Kept for backward compatibility.
   */
  working_dir?: string;
  timeout_ms?: number;
  personality?: string;
  /** When 'sync', Oracle executes Apoc inline and returns result directly. Default: 'async'. */
  execution_mode?: SubAgentExecutionMode;
}

export interface NeoConfig extends LLMConfig {
  personality?: string;
  /** When 'sync', Oracle executes Neo inline and returns result directly. Default: 'async'. */
  execution_mode?: SubAgentExecutionMode;
}

export interface TrinityConfig extends LLMConfig {
  personality?: string;
  /** When 'sync', Oracle executes Trinity inline and returns result directly. Default: 'async'. */
  execution_mode?: SubAgentExecutionMode;
}

export interface KeymakerConfig extends LLMConfig {
  personality?: string;
  skills_dir?: string;
}

export interface WebhookConfig {
  /** If true, all webhook notifications are also sent to Telegram by default */
  telegram_notify_all?: boolean;
}

export interface MemoryConfig {
  /**
   * @deprecated Use llm.context_window instead. This field is kept for backward compatibility.
   */
  limit: number;
}

export interface RuntimeAsyncTasksConfig {
  enabled: boolean;
}

export interface RuntimeConfig {
  async_tasks: RuntimeAsyncTasksConfig;
}

export interface ChronosConfig {
  /** Default IANA timezone for new jobs (e.g., 'America/Sao_Paulo') */
  timezone: string;
  /** How often ChronosWorker polls for due jobs, in ms. Minimum: 60000 */
  check_interval_ms: number;
  /** Maximum number of simultaneously enabled jobs */
  max_active_jobs: number;
}

export interface SmithEntry {
  /** Unique name for this Smith (lowercase alphanumeric, hyphens/underscores) */
  name: string;
  /** Hostname or IP address of the Smith */
  host: string;
  /** Port the Smith listens on (default: 7900) */
  port: number;
  /** Shared secret for authentication */
  auth_token: string;
  /** When true, connect via wss:// (TLS). Default: false (ws://) */
  tls?: boolean;
}

export interface SmithsConfig {
  /** Master switch for the Smiths subsystem */
  enabled: boolean;
  /** Execution mode for smith_delegate tool: sync (inline) or async (background task) */
  execution_mode: SubAgentExecutionMode;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeat_interval_ms: number;
  /** WebSocket connection timeout in ms (default: 10000) */
  connection_timeout_ms: number;
  /** Task execution timeout in ms (default: 60000) */
  task_timeout_ms: number;
  /** List of configured Smith entries */
  entries: SmithEntry[];
}

export interface MorpheusConfig {
  agent: AgentConfig;
  llm: LLMConfig;
  sati?: SatiConfig;
  neo?: NeoConfig;
  apoc?: ApocConfig;
  trinity?: TrinityConfig;
  keymaker?: KeymakerConfig;
  devkit?: DevKitConfig;
  smiths?: SmithsConfig;
  webhooks?: WebhookConfig;
  channels: ChannelsConfig;
  ui: UIConfig;
  logging: LogConfig;
  audio: AudioConfig;
  memory: MemoryConfig;
  runtime?: RuntimeConfig;
  chronos?: ChronosConfig;
  verbose_mode?: boolean;
}

export const DEFAULT_CONFIG: MorpheusConfig = {
  agent: {
    name: 'morpheus',
    personality: 'helpful_dev',
  },
  logging: {
    enabled: true,
    level: 'info',
    retention: '14d',
  },
  audio: {
    provider: 'google',
    model: 'gemini-2.5-flash-lite',
    enabled: true,
    maxDurationSeconds: 300,
    supportedMimeTypes: ['audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav'],
  },
  memory: {
    limit: 100
  },
  runtime: {
    async_tasks: {
      enabled: true,
    },
  },
  llm: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    context_window: 100,
  },
  channels: {
    telegram: { enabled: false, allowedUsers: [] },
    discord: { enabled: false, allowedUsers: [] },
  },
  ui: {
    enabled: true,
    port: 3333,
  },
  sati: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    context_window: 100,
    memory_limit: 100,
    enabled_archived_sessions: true,
  },
  devkit: {
    sandbox_dir: '',
    readonly_mode: false,
    allowed_shell_commands: [],
    enable_filesystem: true,
    enable_shell: true,
    enable_git: true,
    enable_network: true,
    timeout_ms: 30000,
  },
  apoc: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.2,
    timeout_ms: 30000,
    personality: 'pragmatic_dev',
    execution_mode: 'async',
  },
  neo: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.2,
    personality: 'analytical_engineer',
    execution_mode: 'async',
  },
  trinity: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.2,
    personality: 'data_specialist',
    execution_mode: 'async',
  },
  smiths: {
    enabled: false,
    execution_mode: 'async',
    heartbeat_interval_ms: 30000,
    connection_timeout_ms: 10000,
    task_timeout_ms: 60000,
    entries: [],
  },
  verbose_mode: true,
};
