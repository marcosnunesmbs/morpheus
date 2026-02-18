import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { Section } from '../components/forms/Section';
import { TextInput } from '../components/forms/TextInput';
import { SelectInput } from '../components/forms/SelectInput';
import { NumberInput } from '../components/forms/NumberInput';
import { Switch } from '../components/forms/Switch';
import { configService } from '../services/config';
// @ts-ignore
import { ConfigSchema } from '../../../config/schemas';
// @ts-ignore
import type {
  MorpheusConfig,
  SatiConfig,
} from '../../../types/config';
import { ZodError } from 'zod';
import { agentConfigService, type AgentsConfig, type SubAgentConfig } from '../services/agentConfig';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'llm', label: 'LLM' },
  { id: 'audio', label: 'Audio' },
  { id: 'channels', label: 'Channels' },
  { id: 'ui', label: 'Interface' },
  { id: 'logging', label: 'Logging' },
  { id: 'agents', label: 'Agents' },
];

const AGENT_NAMES = ['architect', 'keymaker', 'apoc', 'merovingian'] as const;
type AgentName = typeof AGENT_NAMES[number];

const AGENT_LABELS: Record<AgentName, string> = {
  architect: 'The Architect',
  keymaker: 'The Keymaker',
  apoc: 'Apoc',
  merovingian: 'The Merovingian',
};

const PROVIDER_OPTIONS = [
  { value: '', label: 'Inherit from Oracle' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'gemini', label: 'Gemini' },
];

export default function Settings() {
  const { data: serverConfig, error } = useSWR(
    '/api/config',
    configService.fetchConfig
  );
  const { data: satiServerConfig } = useSWR(
    '/api/config/sati',
    configService.getSatiConfig
  );
  const { data: agentServerConfig } = useSWR(
    '/api/config/agents',
    agentConfigService.get
  );
  const [localConfig, setLocalConfig] = useState<MorpheusConfig | null>(null);
  const [localSatiConfig, setLocalSatiConfig] = useState<SatiConfig | null>(
    null
  );
  const [localAgentsConfig, setLocalAgentsConfig] = useState<AgentsConfig>({});
  const [activeTab, setActiveTab] = useState('general');
  const [activeAgentTab, setActiveAgentTab] = useState<AgentName>('architect');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Initialize local config when data is loaded
  useEffect(() => {
    if (serverConfig && !localConfig) {
      setLocalConfig(serverConfig);
    }
  }, [serverConfig]);

  // Initialize Sati config
  useEffect(() => {
    if (satiServerConfig && !localSatiConfig) {
      setLocalSatiConfig(satiServerConfig);
    }
  }, [satiServerConfig]);

  // Initialize Agents config
  useEffect(() => {
    if (agentServerConfig) {
      setLocalAgentsConfig(agentServerConfig);
    }
  }, [agentServerConfig]);

  const isDirty =
    JSON.stringify(serverConfig) !== JSON.stringify(localConfig) ||
    JSON.stringify(satiServerConfig) !== JSON.stringify(localSatiConfig) ||
    JSON.stringify(agentServerConfig) !== JSON.stringify(localAgentsConfig);

  const handleUpdate = (path: string[], value: any) => {
    if (!localConfig) return;

    const newConfig = JSON.parse(JSON.stringify(localConfig));
    let current = newConfig;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;

    setLocalConfig(newConfig);

    // Validate immediately
    try {
      ConfigSchema.parse(newConfig);
      setErrors({}); // Clear errors if valid
    } catch (err: any) {
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        // Force cast to any to avoid type issues with ZodError versioning
        (err as any).errors.forEach((e: any) => {
          const key = e.path.join('.');
          fieldErrors[key] = e.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  const handleSatiUpdate = (field: keyof SatiConfig, value: any) => {
    if (!localSatiConfig) return;
    setLocalSatiConfig({ ...localSatiConfig, [field]: value });
  };

  const handleCopyFromOracle = () => {
    if (!localConfig || !localSatiConfig) return;
    // Copy only provider, model, and api_key from Oracle - NEVER copy memory_limit
    setLocalSatiConfig({
      ...localSatiConfig,
      provider: localConfig.llm.provider,
      model: localConfig.llm.model,
      api_key: localConfig.llm.api_key,
    });
  };

  const handleSave = async () => {
    if (!localConfig) return;
    setSaving(true);
    setNotification(null);
    try {
      // Save main config
      await configService.updateConfig(localConfig);

      // Save Sati config if it exists
      if (localSatiConfig) {
        await configService.updateSatiConfig(localSatiConfig);
      }

      // Save agents config
      await agentConfigService.update(localAgentsConfig);

      mutate('/api/config'); // Refresh SWR
      mutate('/api/config/sati');
      mutate('/api/config/agents');
      setNotification({
        type: 'success',
        message:
          'Settings saved successfully. Restart Morpheus daemon for changes to take effect.',
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
      if (err.details && Array.isArray(err.details)) {
        const fieldErrors: Record<string, string> = {};
        err.details.forEach((e: any) => {
          const key = e.path.join('.');
          fieldErrors[key] = e.message;
        });
        setErrors(fieldErrors);
      }
    } finally {
      setSaving(false);
    }
  };

  if (error)
    return <div className="p-8 text-red-500">Failed to load configuration</div>;
  if (!localConfig)
    return (
      <div className="p-8 text-azure-primary dark:text-matrix-highlight">
        Loading settings...
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto p-0 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-azure-primary dark:text-matrix-highlight">
          Zaion Settings
        </h1>
        <button
          onClick={handleSave}
          disabled={!isDirty || Object.keys(errors).length > 0 || saving}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            isDirty && Object.keys(errors).length === 0
              ? 'bg-azure-primary text-white hover:bg-azure-active dark:bg-matrix-highlight dark:text-black dark:hover:bg-matrix-highlight/90'
              : 'bg-azure-border text-azure-text-secondary cursor-not-allowed dark:bg-matrix-primary/50 dark:text-matrix-highlight/50'
          }`}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {notification && (
        <div
          className={`p-4 rounded border ${
            notification.type === 'success'
              ? 'border-azure-primary text-azure-primary bg-azure-primary/10 dark:border-matrix-highlight dark:text-matrix-highlight dark:bg-matrix-highlight/10'
              : 'border-red-500 text-red-500 bg-red-900/10'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Tabs */}
      <div className="overflow-x-auto py-1 hide-scrollbar">
        <div className="flex space-x-1 border-b border-azure-border dark:border-matrix-primary pb-px min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-azure-surface/50 text-azure-primary border-t border-x border-azure-border dark:bg-matrix-primary/20 dark:text-matrix-highlight dark:border-t dark:border-x dark:border-matrix-primary'
                  : 'text-azure-text-secondary hover:text-azure-primary dark:text-matrix-secondary dark:hover:text-matrix-highlight'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'general' && (
          <Section title="Agent Identity">
            <TextInput
              label="Agent Name"
              value={localConfig.agent.name}
              onChange={(e) => handleUpdate(['agent', 'name'], e.target.value)}
              error={errors['agent.name']}
            />
            <TextInput
              label="Personality"
              value={localConfig.agent.personality}
              onChange={(e) =>
                handleUpdate(['agent', 'personality'], e.target.value)
              }
              error={errors['agent.personality']}
            />
          </Section>
        )}

        {activeTab === 'llm' && (
          <>
            <Section title="Oracle Agent">
              <SelectInput
                label="Provider"
                value={localConfig.llm.provider}
                onChange={(e) =>
                  handleUpdate(['llm', 'provider'], e.target.value)
                }
                options={[
                  { label: 'OpenAI', value: 'openai' },
                  { label: 'Anthropic', value: 'anthropic' },
                  { label: 'OpenRouter', value: 'openrouter' },
                  { label: 'Ollama', value: 'ollama' },
                  { label: 'Google Gemini', value: 'gemini' },
                ]}
                error={errors['llm.provider']}
              />
              <TextInput
                label="Model Name"
                value={localConfig.llm.model}
                onChange={(e) => handleUpdate(['llm', 'model'], e.target.value)}
                error={errors['llm.model']}
              />
              <NumberInput
                label="Temperature"
                value={localConfig.llm.temperature}
                onChange={(e) =>
                  handleUpdate(
                    ['llm', 'temperature'],
                    parseFloat(e.target.value)
                  )
                }
                step={0.1}
                min={0}
                max={1}
                error={errors['llm.temperature']}
              />
              <NumberInput
                label="Max Tokens"
                value={localConfig.llm.max_tokens ?? ''}
                onChange={(e: any) =>
                  handleUpdate(
                    ['llm', 'max_tokens'],
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                min={1}
                error={errors['llm.max_tokens']}
                helperText="Maximum tokens per response. Leave empty for model default."
              />
              <NumberInput
                label="Context Window (Messages)"
                value={localConfig.llm.context_window ?? 100}
                onChange={(e: any) =>
                  handleUpdate(
                    ['llm', 'context_window'],
                    parseInt(e.target.value)
                  )
                }
                min={1}
                step={1}
                error={errors['llm.context_window']}
                helperText="Number of past interactions to load into LLM context (e.g., 100)."
              />
              <TextInput
                label="API Key"
                type="password"
                value={localConfig.llm.api_key || ''}
                onChange={(e) =>
                  handleUpdate(['llm', 'api_key'], e.target.value)
                }
                placeholder="sk-..."
                helperText="Stored locally."
              />
              {localConfig.llm.provider === 'openrouter' && (
                <TextInput
                  label="Base URL"
                  value={
                    localConfig.llm.base_url || 'https://openrouter.ai/api/v1'
                  }
                  onChange={(e) =>
                    handleUpdate(['llm', 'base_url'], e.target.value)
                  }
                  placeholder="https://openrouter.ai/api/v1"
                  helperText="Base URL for OpenRouter API"
                />
              )}
            </Section>

            <Section title="Sati Agent">
              <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary mb-4">
                Configure the LLM used for memory consolidation
              </p>

              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleCopyFromOracle}
                  className="px-3 py-1.5 text-sm bg-azure-surface border border-azure-border rounded hover:bg-azure-primary/10 dark:bg-matrix-primary/20 dark:border-matrix-primary dark:hover:bg-matrix-highlight/10 text-azure-primary dark:text-matrix-highlight transition-colors"
                >
                  Copy from Oracle Agent
                </button>
                <p className="text-xs text-azure-text-secondary dark:text-matrix-secondary mt-1">
                  Copy Provider, Model, and API Key from Oracle Agent
                  configuration
                </p>
              </div>

              {localSatiConfig && (
                <>
                  <SelectInput
                    label="Provider"
                    value={localSatiConfig.provider}
                    onChange={(e) =>
                      handleSatiUpdate('provider', e.target.value)
                    }
                    options={[
                      { label: 'OpenAI', value: 'openai' },
                      { label: 'Anthropic', value: 'anthropic' },
                      { label: 'OpenRouter', value: 'openrouter' },
                      { label: 'Ollama', value: 'ollama' },
                      { label: 'Google Gemini', value: 'gemini' },
                    ]}
                  />
                  <TextInput
                    label="Model Name"
                    value={localSatiConfig.model}
                    onChange={(e) => handleSatiUpdate('model', e.target.value)}
                  />
                  <TextInput
                    label="API Key"
                    type="password"
                    value={localSatiConfig.api_key || ''}
                    onChange={(e) =>
                      handleSatiUpdate('api_key', e.target.value)
                    }
                    placeholder="sk-..."
                    helperText="Stored locally."
                  />
                  {localSatiConfig.provider === 'openrouter' && (
                    <TextInput
                      label="Base URL"
                      value={
                        localSatiConfig.base_url ||
                        'https://openrouter.ai/api/v1'
                      }
                      onChange={(e) =>
                        handleSatiUpdate('base_url', e.target.value)
                      }
                      placeholder="https://openrouter.ai/api/v1"
                      helperText="Base URL for OpenRouter API"
                    />
                  )}
                  <NumberInput
                    label="Memory Limit"
                    value={(localSatiConfig as any).memory_limit ?? 10}
                    onChange={(e: any) =>
                      handleSatiUpdate(
                        'memory_limit' as any,
                        parseInt(e.target.value)
                      )
                    }
                    min={1}
                    step={1}
                    helperText="Number of memory items to retrieve from long-term storage."
                  />
                  <Switch
                    label="Enable Archived Sessions in Memory Retrieval"
                    checked={localSatiConfig.enabled_archived_sessions ?? true}
                    onChange={(checked: boolean) =>
                      handleSatiUpdate('enabled_archived_sessions', checked)
                    }
                  />
                </>
              )}
            </Section>
          </>
        )}

        {activeTab === 'audio' && (
          <Section title="Audio Transcription">
            <Switch
              label="Enable Audio"
              checked={localConfig.audio.enabled}
              onChange={(checked: boolean) =>
                handleUpdate(['audio', 'enabled'], checked)
              }
            />

            <SelectInput
              label="Provider"
              value={localConfig.audio.provider || 'google'}
              onChange={(e: any) =>
                handleUpdate(['audio', 'provider'], e.target.value)
              }
              options={[
                { label: 'Google Gemini', value: 'google' },
                { label: 'OpenAI (Whisper)', value: 'openai' },
                { label: 'OpenRouter (multimodal)', value: 'openrouter' },
                { label: 'Ollama (Whisper local)', value: 'ollama' },
              ]}
              error={errors['audio.provider']}
            />

            <TextInput
              label="Model"
              value={localConfig.audio.model}
              onChange={(e: any) =>
                handleUpdate(['audio', 'model'], e.target.value)
              }
              placeholder="e.g. whisper-1, gemini-2.5-flash-lite..."
              helperText="Model to use for audio transcription."
              error={errors['audio.model']}
            />

            {localConfig.audio.provider === 'ollama' && (
              <TextInput
                label="Base URL"
                value={(localConfig.audio as any).base_url || ''}
                onChange={(e: any) =>
                  handleUpdate(['audio', 'base_url'], e.target.value)
                }
                placeholder="http://localhost:11434"
                helperText="Ollama base URL. Requires a Whisper model loaded (ollama pull whisper)."
              />
            )}

            <TextInput
              label="API Key"
              type="password"
              value={localConfig.audio.apiKey || ''}
              onChange={(e: any) =>
                handleUpdate(['audio', 'apiKey'], e.target.value)
              }
              placeholder="If different from LLM key..."
              helperText="Leave empty to use LLM API key if using the same provider."
            />

            <NumberInput
              label="Max Duration (Seconds)"
              value={localConfig.audio.maxDurationSeconds}
              onChange={(e: any) =>
                handleUpdate(
                  ['audio', 'maxDurationSeconds'],
                  parseInt(e.target.value)
                )
              }
              min={1}
            />

            <TextInput
              label="Supported Mime Types"
              value={localConfig.audio.supportedMimeTypes.join(', ')}
              onChange={(e: any) =>
                handleUpdate(
                  ['audio', 'supportedMimeTypes'],
                  e.target.value
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                )
              }
              helperText="Comma separated list (e.g. audio/ogg, audio/mp3)"
            />
          </Section>
        )}

        {activeTab === 'channels' && (
          <Section title="Telegram">
            <Switch
              label="Enable Telegram"
              checked={localConfig.channels.telegram.enabled}
              onChange={(checked) =>
                handleUpdate(['channels', 'telegram', 'enabled'], checked)
              }
            />
            {localConfig.channels.telegram.enabled && (
              <div className="space-y-4 mt-4 pl-4 border-l border-matrix-primary">
                <TextInput
                  label="Bot Token"
                  type="password"
                  value={localConfig.channels.telegram.token || ''}
                  onChange={(e) =>
                    handleUpdate(
                      ['channels', 'telegram', 'token'],
                      e.target.value
                    )
                  }
                />
                <TextInput
                  label="Allowed Users (comma separated)"
                  value={localConfig.channels.telegram.allowedUsers.join(', ')}
                  onChange={(e) =>
                    handleUpdate(
                      ['channels', 'telegram', 'allowedUsers'],
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                  helperText="User IDs allowed to interact with the bot"
                />
              </div>
            )}
          </Section>
        )}

        {activeTab === 'ui' && (
          <Section title="Dashboard">
            <Switch
              label="Enable Web UI"
              checked={localConfig.ui.enabled}
              onChange={(checked) => handleUpdate(['ui', 'enabled'], checked)}
            />
            <NumberInput
              label="Port"
              value={localConfig.ui.port}
              onChange={(e) =>
                handleUpdate(['ui', 'port'], parseInt(e.target.value))
              }
              disabled={true}
              helperText="Requires restart to change."
            />
          </Section>
        )}

        {activeTab === 'logging' && (
          <Section title="Logging">
            <Switch
              label="Enable Logging"
              checked={localConfig.logging.enabled}
              onChange={(checked) =>
                handleUpdate(['logging', 'enabled'], checked)
              }
            />
            <SelectInput
              label="Log Level"
              value={localConfig.logging.level}
              onChange={(e) =>
                handleUpdate(['logging', 'level'], e.target.value)
              }
              options={[
                { label: 'Debug', value: 'debug' },
                { label: 'Info', value: 'info' },
                { label: 'Warning', value: 'warn' },
                { label: 'Error', value: 'error' },
              ]}
            />
          </Section>
        )}

        {/* ── Agents Tab ────────────────────────────────────────────────── */}
        {activeTab === 'agents' && (
          <div className="space-y-4">
            {/* Agent sub-tabs */}
            <div className="flex space-x-1 border-b border-azure-border dark:border-matrix-primary/50 pb-px">
              {AGENT_NAMES.map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveAgentTab(name)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                    activeAgentTab === name
                      ? 'bg-azure-surface/50 text-azure-primary border-t border-x border-azure-border dark:bg-matrix-primary/20 dark:text-matrix-highlight dark:border-matrix-primary'
                      : 'text-azure-text-secondary hover:text-azure-primary dark:text-matrix-secondary dark:hover:text-matrix-highlight'
                  }`}
                >
                  {AGENT_LABELS[name]}
                </button>
              ))}
            </div>

            {AGENT_NAMES.map((name) => {
              if (activeAgentTab !== name) return null;
              const agentCfg: SubAgentConfig = localAgentsConfig[name] ?? {};
              const update = (field: keyof SubAgentConfig, value: any) => {
                setLocalAgentsConfig((prev) => ({
                  ...prev,
                  [name]: { ...(prev[name] ?? {}), [field]: value || undefined },
                }));
              };

              return (
                <Section key={name} title={`${AGENT_LABELS[name]} Configuration`}>
                  <p className="text-xs text-azure-text-secondary dark:text-matrix-secondary mb-2">
                    Leave fields empty to inherit from Oracle's LLM configuration.
                  </p>
                  <SelectInput
                    label="Provider"
                    value={agentCfg.provider ?? ''}
                    onChange={(e) => update('provider', e.target.value)}
                    options={PROVIDER_OPTIONS}
                  />
                  <TextInput
                    label="Model"
                    value={agentCfg.model ?? ''}
                    onChange={(e) => update('model', e.target.value)}
                    placeholder="Inherit from Oracle"
                  />
                  <NumberInput
                    label="Temperature"
                    value={agentCfg.temperature ?? ''}
                    onChange={(e) =>
                      update('temperature', e.target.value ? parseFloat(e.target.value) : undefined)
                    }
                    min={0}
                    max={2}
                    step={0.1}
                    placeholder="Inherit"
                  />
                  <NumberInput
                    label="Max Tokens"
                    value={agentCfg.max_tokens ?? ''}
                    onChange={(e) =>
                      update('max_tokens', e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    placeholder="Inherit"
                  />
                  <TextInput
                    label="API Key"
                    value={agentCfg.api_key ?? ''}
                    onChange={(e) => update('api_key', e.target.value)}
                    placeholder="Inherit from Oracle"
                    type="password"
                  />
                  <TextInput
                    label="Base URL"
                    value={agentCfg.base_url ?? ''}
                    onChange={(e) => update('base_url', e.target.value)}
                    placeholder="Inherit from Oracle"
                  />
                  {(name === 'apoc' || name === 'merovingian') && (
                    <NumberInput
                      label="Timeout (ms)"
                      value={agentCfg.timeout_ms ?? ''}
                      onChange={(e) =>
                        update('timeout_ms', e.target.value ? parseInt(e.target.value) : undefined)
                      }
                      placeholder="120000"
                    />
                  )}
                  <div>
                    <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary mb-1">
                      System Prompt (extra instructions)
                    </label>
                    <textarea
                      value={agentCfg.system_prompt ?? ''}
                      onChange={(e) => update('system_prompt', e.target.value)}
                      rows={6}
                      placeholder="Additional instructions appended to the agent's default system prompt..."
                      className="w-full bg-azure-surface dark:bg-black border border-azure-border dark:border-matrix-primary/50 rounded px-3 py-2 text-sm font-mono text-azure-text-primary dark:text-matrix-secondary focus:outline-none focus:border-azure-primary dark:focus:border-matrix-highlight resize-y"
                    />
                    <p className="text-xs text-azure-text-secondary dark:text-matrix-secondary mt-1">
                      You can also place instructions in <code className="font-mono">~/.morpheus/agents/{name}/instructions.md</code>
                    </p>
                  </div>
                </Section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
