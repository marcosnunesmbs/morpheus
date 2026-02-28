import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { useChronosConfig, chronosService, type ChronosConfig } from '../services/chronos';
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
  NeoConfig,
  ApocConfig,
  TrinityConfig,
} from '../../../types/config';
import { ZodError } from 'zod';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'agents', label: 'Agents' },
  { id: 'devkit', label: 'DevKit' },
  { id: 'audio', label: 'Audio' },
  { id: 'channels', label: 'Channels' },
  { id: 'ui', label: 'Interface' },
  { id: 'logging', label: 'Logging' },
  { id: 'chronos', label: 'Chronos' },
];

const AGENT_TABS = [
  { id: 'oracle', label: 'Oracle' },
  { id: 'sati', label: 'Sati' },
  { id: 'neo', label: 'Neo' },
  { id: 'apoc', label: 'Apoc' },
  { id: 'trinity', label: 'Trinity' },
];

const PROVIDER_OPTIONS = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'Ollama', value: 'ollama' },
  { label: 'Google Gemini', value: 'gemini' },
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
  const { data: apocServerConfig } = useSWR(
    '/api/config/apoc',
    configService.getApocConfig
  );
  const { data: neoServerConfig } = useSWR(
    '/api/config/neo',
    configService.getNeoConfig
  );
  const { data: trinityServerConfig } = useSWR(
    '/api/config/trinity',
    configService.getTrinityConfig
  );
  const { data: encryptionStatus } = useSWR(
    '/api/config/encryption-status',
    () => configService.getEncryptionStatus()
  );
  const { data: envOverrides } = useSWR(
    '/api/config/env-overrides',
    () => configService.getEnvOverrides()
  );

  const { data: chronosServerConfig } = useChronosConfig();
  const [localChronosConfig, setLocalChronosConfig] = useState<ChronosConfig | null>(null);
  const [chronosSaving, setChronosSaving] = useState(false);

  const [localConfig, setLocalConfig] = useState<MorpheusConfig | null>(null);
  const [localSatiConfig, setLocalSatiConfig] = useState<SatiConfig | null>(null);
  const [localNeoConfig, setLocalNeoConfig] = useState<NeoConfig | null>(null);
  const [localApocConfig, setLocalApocConfig] = useState<ApocConfig | null>(null);
  const [localTrinityConfig, setLocalTrinityConfig] = useState<TrinityConfig | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [activeAgentTab, setActiveAgentTab] = useState('oracle');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (serverConfig && !localConfig) {
      setLocalConfig(serverConfig);
    }
  }, [serverConfig]);

  useEffect(() => {
    if (satiServerConfig && !localSatiConfig) {
      setLocalSatiConfig(satiServerConfig);
    }
  }, [satiServerConfig]);

  useEffect(() => {
    if (apocServerConfig && !localApocConfig) {
      setLocalApocConfig(apocServerConfig);
    } else if (!apocServerConfig && !localApocConfig && localConfig) {
      // Fallback while SWR loads: use apoc from main config or llm defaults
      setLocalApocConfig({
        ...(localConfig.apoc ?? localConfig.llm),
        temperature: localConfig.apoc?.temperature ?? 0.2,
        timeout_ms: localConfig.apoc?.timeout_ms ?? 30000,
      } as ApocConfig);
    }
  }, [apocServerConfig, localConfig]);

  useEffect(() => {
    if (neoServerConfig && !localNeoConfig) {
      setLocalNeoConfig(neoServerConfig);
    } else if (!neoServerConfig && !localNeoConfig && localConfig) {
      setLocalNeoConfig({
        ...(localConfig.neo ?? localConfig.llm),
        temperature: localConfig.neo?.temperature ?? 0.2,
      } as NeoConfig);
    }
  }, [neoServerConfig, localConfig]);

  useEffect(() => {
    if (trinityServerConfig && !localTrinityConfig) {
      setLocalTrinityConfig(trinityServerConfig);
    } else if (!trinityServerConfig && !localTrinityConfig && localConfig) {
      setLocalTrinityConfig({
        ...((localConfig as any).trinity ?? localConfig.llm),
        temperature: (localConfig as any).trinity?.temperature ?? 0.2,
      } as TrinityConfig);
    }
  }, [trinityServerConfig, localConfig]);

  useEffect(() => {
    if (chronosServerConfig && !localChronosConfig) {
      setLocalChronosConfig(chronosServerConfig);
    }
  }, [chronosServerConfig]);

  const isDirty =
    JSON.stringify(serverConfig) !== JSON.stringify(localConfig) ||
    JSON.stringify(satiServerConfig) !== JSON.stringify(localSatiConfig) ||
    JSON.stringify(neoServerConfig) !== JSON.stringify(localNeoConfig) ||
    JSON.stringify(apocServerConfig) !== JSON.stringify(localApocConfig) ||
    JSON.stringify(trinityServerConfig) !== JSON.stringify(localTrinityConfig);

  /**
   * Renders encryption status badge for an agent's API key.
   */
  const renderEncryptionBadge = (
    agentName: 'oracle' | 'sati' | 'neo' | 'apoc' | 'trinity' | 'audio',
    apiKey: string | undefined
  ) => {
    if (!encryptionStatus?.apiKeysEncrypted) return null;

    const { morpheusSecretSet, apiKeysEncrypted } = encryptionStatus;
    const isEncrypted = apiKeysEncrypted[agentName];
    const hasKey = !!apiKey;

    // No API key set
    if (!hasKey) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-azure-surface border border-azure-border text-azure-text-secondary dark:bg-matrix-primary/10 dark:border-matrix-primary dark:text-matrix-tertiary">
          No API key
        </span>
      );
    }

    // Check if this field is overridden by env var - if so, don't show encryption status
    // Env vars are not stored in YAML and can't be encrypted
    if (envOverrides && envOverrides[getEnvKey(agentName)]) {
      return null; // Don't show badge for env var overrides
    }

    // MORPHEUS_SECRET not set
    if (!morpheusSecretSet) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400" title="Set MORPHEUS_SECRET to enable encryption">
          ⚠️ Plaintext
        </span>
      );
    }

    // Encrypted
    if (isEncrypted) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400" title="API key encrypted with AES-256-GCM">
          🔒 Encrypted
        </span>
      );
    }

    // Plaintext (has key, secret set, but not encrypted yet)
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400" title="Re-save this configuration to encrypt the API key">
        ⚠️ Re-save to encrypt
      </span>
    );
  };

  /**
   * Maps agent name to env override key.
   */
  const getEnvKey = (agentName: string): string => {
    const keys: Record<string, string> = {
      'oracle': 'llm.api_key',
      'sati': 'sati.api_key',
      'neo': 'neo.api_key',
      'apoc': 'apoc.api_key',
      'trinity': 'trinity.api_key',
      'audio': 'audio.apiKey',
    };
    return keys[agentName];
  };

  /**
   * Renders environment override badge for a field.
   * Returns null if not overridden.
   */
  const renderEnvOverrideBadge = (fieldPath: string) => {
    if (!envOverrides || !envOverrides[fieldPath]) return null;

    return (
      <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-blue-100 border border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400" title="This field is set by an environment variable and cannot be edited">
        🔒 Env Var
      </span>
    );
  };

  /**
   * Checks if a field is overridden by an environment variable.
   */
  const isEnvOverridden = (fieldPath: string): boolean => {
    return !!(envOverrides && envOverrides[fieldPath]);
  };

  const handleUpdate = (path: string[], value: any) => {
    if (!localConfig) return;

    const newConfig = JSON.parse(JSON.stringify(localConfig));
    let current = newConfig;
    for (let i = 0; i < path.length - 1; i++) {
      if (current[path[i]] === undefined || current[path[i]] === null) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;

    setLocalConfig(newConfig);

    try {
      ConfigSchema.parse(newConfig);
      setErrors({});
    } catch (err: any) {
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
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

  const handleApocUpdate = (field: keyof ApocConfig, value: any) => {
    if (!localApocConfig) return;
    setLocalApocConfig({ ...localApocConfig, [field]: value });
  };

  const handleNeoUpdate = (field: keyof NeoConfig, value: any) => {
    if (!localNeoConfig) return;
    setLocalNeoConfig({ ...localNeoConfig, [field]: value });
  };

  const handleTrinityUpdate = (field: keyof TrinityConfig, value: any) => {
    if (!localTrinityConfig) return;
    setLocalTrinityConfig({ ...localTrinityConfig, [field]: value });
  };

  const handleCopyTrinityFromOracle = () => {
    if (!localConfig || !localTrinityConfig) return;
    setLocalTrinityConfig({
      ...localTrinityConfig,
      provider: localConfig.llm.provider,
      model: localConfig.llm.model,
      api_key: localConfig.llm.api_key,
    });
  };

  const handleCopyFromOracle = () => {
    if (!localConfig || !localSatiConfig) return;
    setLocalSatiConfig({
      ...localSatiConfig,
      provider: localConfig.llm.provider,
      model: localConfig.llm.model,
      api_key: localConfig.llm.api_key,
    });
  };

  const handleCopyApocFromOracle = () => {
    if (!localConfig || !localApocConfig) return;
    setLocalApocConfig({
      ...localApocConfig,
      provider: localConfig.llm.provider,
      model: localConfig.llm.model,
      api_key: localConfig.llm.api_key,
    });
  };

  const handleCopyNeoFromOracle = () => {
    if (!localConfig || !localNeoConfig) return;
    setLocalNeoConfig({
      ...localNeoConfig,
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
      // Main config save returns hot-reload info
      const result = await configService.updateConfig(localConfig);

      if (localSatiConfig) {
        await configService.updateSatiConfig(localSatiConfig);
      }

      if (localNeoConfig) {
        await configService.updateNeoConfig(localNeoConfig);
      }

      if (localApocConfig) {
        await configService.updateApocConfig(localApocConfig);
      }

      if (localTrinityConfig) {
        await configService.updateTrinityConfig(localTrinityConfig);
      }

      mutate('/api/config');
      mutate('/api/config/sati');
      mutate('/api/config/neo');
      mutate('/api/config/apoc');
      mutate('/api/config/trinity');

      // Check if restart is required for certain changes
      const restartRequired = result._restartRequired || [];
      if (restartRequired.length > 0) {
        setNotification({
          type: 'success',
          message: `Settings saved and applied. Some changes require restart: ${restartRequired.join(', ')}`,
        });
      } else {
        setNotification({
          type: 'success',
          message: 'Settings saved and applied successfully.',
        });
      }
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

      {/* Main Tabs */}
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
            <SelectInput
              label="Verbose Mode"
              value={localConfig.verbose_mode !== false ? 'true' : 'false'}
              onChange={(e) =>
                handleUpdate(['verbose_mode'], e.target.value === 'true')
              }
              options={[
                { value: 'true', label: 'Enabled (notify tool execution on channels)' },
                { value: 'false', label: 'Disabled' },
              ]}
              helperText="When enabled, channels like Telegram/Discord show which tools are being executed in real-time."
            />
          </Section>
        )}

        {activeTab === 'agents' && (
          <div className="space-y-4">
            {/* Agent Sub-Tabs */}
            <div className="flex space-x-1 border-b border-azure-border dark:border-matrix-primary pb-px">
              {AGENT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveAgentTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                    activeAgentTab === tab.id
                      ? 'bg-azure-primary/10 text-azure-primary border-b-2 border-azure-primary dark:bg-matrix-highlight/10 dark:text-matrix-highlight dark:border-matrix-highlight'
                      : 'text-azure-text-secondary hover:text-azure-primary dark:text-matrix-secondary dark:hover:text-matrix-highlight'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Oracle */}
            {activeAgentTab === 'oracle' && (
              <Section title="Oracle Agent">
                <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary mb-4">
                  Main orchestration agent — handles user requests and delegates to subagents
                </p>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                    Provider
                  </label>
                  {renderEnvOverrideBadge('llm.provider')}
                </div>
                <SelectInput
                  label=""
                  value={localConfig.llm.provider}
                  onChange={(e) =>
                    handleUpdate(['llm', 'provider'], e.target.value)
                  }
                  options={PROVIDER_OPTIONS}
                  error={errors['llm.provider']}
                  disabled={isEnvOverridden('llm.provider')}
                />
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                    Model Name
                  </label>
                  {renderEnvOverrideBadge('llm.model')}
                </div>
                <TextInput
                  label=""
                  value={localConfig.llm.model}
                  onChange={(e) => handleUpdate(['llm', 'model'], e.target.value)}
                  disabled={isEnvOverridden('llm.model')}
                />
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                    Temperature
                  </label>
                  {renderEnvOverrideBadge('llm.temperature')}
                </div>
                <NumberInput
                  label=""
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
                  disabled={isEnvOverridden('llm.temperature')}
                />
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                    Max Tokens
                  </label>
                  {renderEnvOverrideBadge('llm.max_tokens')}
                </div>
                <NumberInput
                  label=""
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
                  disabled={isEnvOverridden('llm.max_tokens')}
                />
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                    Context Window (Messages)
                  </label>
                  {renderEnvOverrideBadge('llm.context_window')}
                </div>
                <NumberInput
                  label=""
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
                  disabled={isEnvOverridden('llm.context_window')}
                />
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                    API Key
                  </label>
                  <div className="flex items-center gap-2">
                    {renderEnvOverrideBadge('llm.api_key')}
                    {renderEncryptionBadge('oracle', localConfig.llm.api_key)}
                  </div>
                </div>
                <TextInput
                  label=""
                  type="password"
                  value={localConfig.llm.api_key || ''}
                  onChange={(e) =>
                    handleUpdate(['llm', 'api_key'], e.target.value)
                  }
                  placeholder="sk-..."
                  helperText="Stored locally."
                  disabled={isEnvOverridden('llm.api_key')}
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
            )}

            {/* Sati */}
            {activeAgentTab === 'sati' && (
              <Section title="Sati Agent">
                <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary mb-4">
                  Background memory consolidation agent — evaluates conversations and persists important context
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
                    Copy Provider, Model, and API Key from Oracle Agent configuration
                  </p>
                </div>

                {localSatiConfig && (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Provider
                      </label>
                      {renderEnvOverrideBadge('sati.provider')}
                    </div>
                    <SelectInput
                      label=""
                      value={localSatiConfig.provider}
                      onChange={(e) =>
                        handleSatiUpdate('provider', e.target.value)
                      }
                      options={PROVIDER_OPTIONS}
                      disabled={isEnvOverridden('sati.provider')}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Model Name
                      </label>
                      {renderEnvOverrideBadge('sati.model')}
                    </div>
                    <TextInput
                      label=""
                      value={localSatiConfig.model}
                      onChange={(e) => handleSatiUpdate('model', e.target.value)}
                      disabled={isEnvOverridden('sati.model')}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        API Key
                      </label>
                      <div className="flex items-center gap-2">
                        {renderEnvOverrideBadge('sati.api_key')}
                        {renderEncryptionBadge('sati', localSatiConfig.api_key)}
                      </div>
                    </div>
                    <TextInput
                      label=""
                      type="password"
                      value={localSatiConfig.api_key || ''}
                      onChange={(e) =>
                        handleSatiUpdate('api_key', e.target.value)
                      }
                      placeholder="sk-..."
                      helperText="Stored locally."
                      disabled={isEnvOverridden('sati.api_key')}
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
            )}

            {/* Neo */}
            {activeAgentTab === 'neo' && (
              <Section title="Neo Agent">
                <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary mb-4">
                  MCP + internal tools subagent — executes analytical and operational tasks delegated by Oracle
                </p>

                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleCopyNeoFromOracle}
                    className="px-3 py-1.5 text-sm bg-azure-surface border border-azure-border rounded hover:bg-azure-primary/10 dark:bg-matrix-primary/20 dark:border-matrix-primary dark:hover:bg-matrix-highlight/10 text-azure-primary dark:text-matrix-highlight transition-colors"
                  >
                    Copy from Oracle Agent
                  </button>
                  <p className="text-xs text-azure-text-secondary dark:text-matrix-secondary mt-1">
                    Copy Provider, Model, and API Key from Oracle Agent configuration
                  </p>
                </div>

                {localNeoConfig && (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Provider
                      </label>
                      {renderEnvOverrideBadge('neo.provider')}
                    </div>
                    <SelectInput
                      label=""
                      value={localNeoConfig.provider}
                      onChange={(e) =>
                        handleNeoUpdate('provider', e.target.value as any)
                      }
                      options={PROVIDER_OPTIONS}
                      disabled={isEnvOverridden('neo.provider')}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Model Name
                      </label>
                      {renderEnvOverrideBadge('neo.model')}
                    </div>
                    <TextInput
                      label=""
                      value={localNeoConfig.model}
                      onChange={(e) => handleNeoUpdate('model', e.target.value)}
                      disabled={isEnvOverridden('neo.model')}
                    />
                    <TextInput
                      label="Personality"
                      value={localNeoConfig.personality || 'analytical_engineer'}
                      onChange={(e) => handleNeoUpdate('personality', e.target.value)}
                      placeholder="analytical_engineer"
                      helperText="e.g., analytical_engineer, meticulous_auditor, systems_thinker"
                    />
                    <SelectInput
                      label="Execution Mode"
                      value={localNeoConfig.execution_mode || 'async'}
                      onChange={(e) =>
                        handleNeoUpdate('execution_mode' as any, e.target.value as any)
                      }
                      options={[
                        { value: 'async', label: 'Async (background task)' },
                        { value: 'sync', label: 'Sync (inline response)' },
                      ]}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Temperature
                      </label>
                      {renderEnvOverrideBadge('neo.temperature')}
                    </div>
                    <NumberInput
                      label=""
                      value={localNeoConfig.temperature}
                      onChange={(e) =>
                        handleNeoUpdate('temperature', parseFloat(e.target.value))
                      }
                      step={0.1}
                      min={0}
                      max={1}
                      disabled={isEnvOverridden('neo.temperature')}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Max Tokens
                      </label>
                      {renderEnvOverrideBadge('neo.max_tokens')}
                    </div>
                    <NumberInput
                      label=""
                      value={localNeoConfig.max_tokens ?? ''}
                      onChange={(e: any) =>
                        handleNeoUpdate(
                          'max_tokens',
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      min={1}
                      helperText="Maximum tokens per response. Leave empty for model default."
                      disabled={isEnvOverridden('neo.max_tokens')}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Context Window (Messages)
                      </label>
                      {renderEnvOverrideBadge('neo.context_window')}
                    </div>
                    <NumberInput
                      label=""
                      value={localNeoConfig.context_window ?? 100}
                      onChange={(e: any) =>
                        handleNeoUpdate(
                          'context_window',
                          parseInt(e.target.value)
                        )
                      }
                      min={1}
                      step={1}
                      disabled={isEnvOverridden('neo.context_window')}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        API Key
                      </label>
                      <div className="flex items-center gap-2">
                        {renderEnvOverrideBadge('neo.api_key')}
                        {renderEncryptionBadge('neo', localNeoConfig.api_key)}
                      </div>
                    </div>
                    <TextInput
                      label=""
                      type="password"
                      value={localNeoConfig.api_key || ''}
                      onChange={(e) =>
                        handleNeoUpdate('api_key', e.target.value)
                      }
                      placeholder="sk-..."
                      helperText="Stored locally."
                      disabled={isEnvOverridden('neo.api_key')}
                    />
                    {localNeoConfig.provider === 'openrouter' && (
                      <TextInput
                        label="Base URL"
                        value={
                          localNeoConfig.base_url ||
                          'https://openrouter.ai/api/v1'
                        }
                        onChange={(e) =>
                          handleNeoUpdate('base_url', e.target.value)
                        }
                        placeholder="https://openrouter.ai/api/v1"
                        helperText="Base URL for OpenRouter API"
                      />
                    )}
                  </>
                )}
              </Section>
            )}

            {/* Trinity */}
            {activeAgentTab === 'trinity' && (
              <Section title="Trinity Agent">
                <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary mb-4">
                  Database subagent — interprets natural language queries and executes them against registered databases (PostgreSQL, MySQL, SQLite, MongoDB)
                </p>

                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleCopyTrinityFromOracle}
                    className="px-3 py-1.5 text-sm bg-azure-surface border border-azure-border rounded hover:bg-azure-primary/10 dark:bg-matrix-primary/20 dark:border-matrix-primary dark:hover:bg-matrix-highlight/10 text-azure-primary dark:text-matrix-highlight transition-colors"
                  >
                    Copy from Oracle Agent
                  </button>
                  <p className="text-xs text-azure-text-secondary dark:text-matrix-secondary mt-1">
                    Copy Provider, Model, and API Key from Oracle Agent configuration
                  </p>
                </div>

                {localTrinityConfig && (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Provider
                      </label>
                      {renderEnvOverrideBadge('trinity.provider')}
                    </div>
                    <SelectInput
                      label=""
                      value={localTrinityConfig.provider}
                      onChange={(e) =>
                        handleTrinityUpdate('provider', e.target.value as any)
                      }
                      options={PROVIDER_OPTIONS}
                      disabled={isEnvOverridden('trinity.provider')}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Model Name
                      </label>
                      {renderEnvOverrideBadge('trinity.model')}
                    </div>
                    <TextInput
                      label=""
                      value={localTrinityConfig.model}
                      onChange={(e) => handleTrinityUpdate('model', e.target.value)}
                      disabled={isEnvOverridden('trinity.model')}
                    />
                    <TextInput
                      label="Personality"
                      value={localTrinityConfig.personality || 'data_specialist'}
                      onChange={(e) => handleTrinityUpdate('personality', e.target.value)}
                      placeholder="data_specialist"
                      helperText="e.g., data_specialist, query_optimizer, db_architect"
                    />
                    <SelectInput
                      label="Execution Mode"
                      value={localTrinityConfig.execution_mode || 'async'}
                      onChange={(e) =>
                        handleTrinityUpdate('execution_mode' as any, e.target.value as any)
                      }
                      options={[
                        { value: 'async', label: 'Async (background task)' },
                        { value: 'sync', label: 'Sync (inline response)' },
                      ]}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Temperature
                      </label>
                      {renderEnvOverrideBadge('trinity.temperature')}
                    </div>
                    <NumberInput
                      label=""
                      value={localTrinityConfig.temperature}
                      onChange={(e) =>
                        handleTrinityUpdate('temperature', parseFloat(e.target.value))
                      }
                      step={0.1}
                      min={0}
                      max={1}
                      disabled={isEnvOverridden('trinity.temperature')}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Max Tokens
                      </label>
                      {renderEnvOverrideBadge('trinity.max_tokens')}
                    </div>
                    <NumberInput
                      label=""
                      value={localTrinityConfig.max_tokens ?? ''}
                      onChange={(e: any) =>
                        handleTrinityUpdate(
                          'max_tokens',
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      min={1}
                      helperText="Maximum tokens per response. Leave empty for model default."
                      disabled={isEnvOverridden('trinity.max_tokens')}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        API Key
                      </label>
                      <div className="flex items-center gap-2">
                        {renderEnvOverrideBadge('trinity.api_key')}
                        {renderEncryptionBadge('trinity', localTrinityConfig.api_key)}
                      </div>
                    </div>
                    <TextInput
                      label=""
                      type="password"
                      value={localTrinityConfig.api_key || ''}
                      onChange={(e) =>
                        handleTrinityUpdate('api_key', e.target.value)
                      }
                      placeholder="sk-..."
                      helperText="Stored locally."
                      disabled={isEnvOverridden('trinity.api_key')}
                    />
                    {localTrinityConfig.provider === 'openrouter' && (
                      <TextInput
                        label="Base URL"
                        value={localTrinityConfig.base_url || 'https://openrouter.ai/api/v1'}
                        onChange={(e) =>
                          handleTrinityUpdate('base_url', e.target.value)
                        }
                        placeholder="https://openrouter.ai/api/v1"
                        helperText="Base URL for OpenRouter API"
                      />
                    )}
                  </>
                )}
              </Section>
            )}

            {/* Apoc */}
            {activeAgentTab === 'apoc' && (
              <Section title="Apoc Agent">
                <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary mb-4">
                  DevTools subagent — executes file, shell, git, network, and system operations on behalf of Oracle
                </p>

                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleCopyApocFromOracle}
                    className="px-3 py-1.5 text-sm bg-azure-surface border border-azure-border rounded hover:bg-azure-primary/10 dark:bg-matrix-primary/20 dark:border-matrix-primary dark:hover:bg-matrix-highlight/10 text-azure-primary dark:text-matrix-highlight transition-colors"
                  >
                    Copy from Oracle Agent
                  </button>
                  <p className="text-xs text-azure-text-secondary dark:text-matrix-secondary mt-1">
                    Copy Provider, Model, and API Key from Oracle Agent configuration
                  </p>
                </div>

                {localApocConfig && (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Provider
                      </label>
                      {renderEnvOverrideBadge('apoc.provider')}
                    </div>
                    <SelectInput
                      label=""
                      value={localApocConfig.provider}
                      onChange={(e) =>
                        handleApocUpdate('provider', e.target.value as any)
                      }
                      options={PROVIDER_OPTIONS}
                      disabled={isEnvOverridden('apoc.provider')}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Model Name
                      </label>
                      {renderEnvOverrideBadge('apoc.model')}
                    </div>
                    <TextInput
                      label=""
                      value={localApocConfig.model}
                      onChange={(e) => handleApocUpdate('model', e.target.value)}
                      disabled={isEnvOverridden('apoc.model')}
                    />
                    <TextInput
                      label="Personality"
                      value={localApocConfig.personality || 'pragmatic_dev'}
                      onChange={(e) => handleApocUpdate('personality', e.target.value)}
                      placeholder="pragmatic_dev"
                      helperText="e.g., pragmatic_dev, cautious_admin, automation_specialist"
                    />
                    <SelectInput
                      label="Execution Mode"
                      value={(localApocConfig as any).execution_mode || 'async'}
                      onChange={(e) =>
                        handleApocUpdate('execution_mode' as any, e.target.value as any)
                      }
                      options={[
                        { value: 'async', label: 'Async (background task)' },
                        { value: 'sync', label: 'Sync (inline response)' },
                      ]}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        Temperature
                      </label>
                      {renderEnvOverrideBadge('apoc.temperature')}
                    </div>
                    <NumberInput
                      label=""
                      value={localApocConfig.temperature}
                      onChange={(e) =>
                        handleApocUpdate('temperature', parseFloat(e.target.value))
                      }
                      step={0.1}
                      min={0}
                      max={1}
                      disabled={isEnvOverridden('apoc.temperature')}
                    />
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                        API Key
                      </label>
                      <div className="flex items-center gap-2">
                        {renderEnvOverrideBadge('apoc.api_key')}
                        {renderEncryptionBadge('apoc', localApocConfig.api_key)}
                      </div>
                    </div>
                    <TextInput
                      label=""
                      type="password"
                      value={localApocConfig.api_key || ''}
                      onChange={(e) =>
                        handleApocUpdate('api_key', e.target.value)
                      }
                      placeholder="sk-..."
                      helperText="Stored locally."
                      disabled={isEnvOverridden('apoc.api_key')}
                    />
                    {localApocConfig.provider === 'openrouter' && (
                      <TextInput
                        label="Base URL"
                        value={
                          localApocConfig.base_url ||
                          'https://openrouter.ai/api/v1'
                        }
                        onChange={(e) =>
                          handleApocUpdate('base_url', e.target.value)
                        }
                        placeholder="https://openrouter.ai/api/v1"
                        helperText="Base URL for OpenRouter API"
                      />
                    )}
                    <TextInput
                      label="Working Directory"
                      value={(localApocConfig as any).working_dir || ''}
                      onChange={(e) =>
                        handleApocUpdate('working_dir' as any, e.target.value)
                      }
                      placeholder="(deprecated — use DevKit tab)"
                      helperText="Deprecated: Use the DevKit tab's Sandbox Directory instead."
                      disabled={true}
                    />
                    <NumberInput
                      label="Timeout (ms)"
                      value={(localApocConfig as any).timeout_ms ?? 30000}
                      onChange={(e: any) =>
                        handleApocUpdate(
                          'timeout_ms' as any,
                          parseInt(e.target.value)
                        )
                      }
                      min={1000}
                      step={1000}
                      helperText="Maximum execution time for shell and system operations in milliseconds."
                    />
                  </>
                )}
              </Section>
            )}
          </div>
        )}

        {activeTab === 'devkit' && (
          <>
          <Section title="DevKit Security">
            <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary mb-4">
              Shared security configuration for DevKit tools used by Apoc and Keymaker.
              Controls path sandboxing, shell command restrictions, and tool category access.
            </p>

            <TextInput
              label="Sandbox Directory"
              value={localConfig.devkit?.sandbox_dir || ''}
              onChange={(e) =>
                handleUpdate(['devkit', 'sandbox_dir'], e.target.value)
              }
              placeholder={typeof window !== 'undefined' ? '(defaults to process.cwd())' : ''}
              helperText="Root directory for all DevKit operations. All file, shell, and git paths are confined here."
              disabled={isEnvOverridden('devkit.sandbox_dir')}
            />

            <SelectInput
              label="Read-Only Mode"
              value={localConfig.devkit?.readonly_mode ? 'true' : 'false'}
              onChange={(e) =>
                handleUpdate(['devkit', 'readonly_mode'], e.target.value === 'true')
              }
              options={[
                { value: 'false', label: 'Disabled (read + write)' },
                { value: 'true', label: 'Enabled (read-only, blocks writes/deletes)' },
              ]}
              helperText="When enabled, blocks all write, delete, and create operations on the filesystem."
              disabled={isEnvOverridden('devkit.readonly_mode')}
            />

            <NumberInput
              label="Timeout (ms)"
              value={localConfig.devkit?.timeout_ms ?? 30000}
              onChange={(e: any) =>
                handleUpdate(['devkit', 'timeout_ms'], parseInt(e.target.value))
              }
              min={1000}
              step={1000}
              helperText="Default timeout for shell and system operations in milliseconds."
              disabled={isEnvOverridden('devkit.timeout_ms')}
            />
          </Section>

          <Section title="Tool Categories">
            <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary mb-4">
              Enable or disable entire categories of DevKit tools.
            </p>

            <Switch
              label="Filesystem (read, write, list, copy, move, delete files)"
              checked={localConfig.devkit?.enable_filesystem !== false}
              onChange={(checked: boolean) =>
                handleUpdate(['devkit', 'enable_filesystem'], checked)
              }
            />
            <Switch
              label="Shell (run_command, run_script, which)"
              checked={localConfig.devkit?.enable_shell !== false}
              onChange={(checked: boolean) =>
                handleUpdate(['devkit', 'enable_shell'], checked)
              }
            />
            <Switch
              label="Git (status, diff, commit, push, pull, clone, branch)"
              checked={localConfig.devkit?.enable_git !== false}
              onChange={(checked: boolean) =>
                handleUpdate(['devkit', 'enable_git'], checked)
              }
            />
            <Switch
              label="Network (http_request, ping, dns_lookup, download_file)"
              checked={localConfig.devkit?.enable_network !== false}
              onChange={(checked: boolean) =>
                handleUpdate(['devkit', 'enable_network'], checked)
              }
            />
          </Section>

          <Section title="Shell Command Allowlist">
            <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary mb-4">
              Restrict which shell commands Apoc and Keymaker can execute.
              Leave empty to allow all commands (default).
            </p>

            <TextInput
              label="Allowed Commands"
              value={(localConfig.devkit?.allowed_shell_commands || []).join(', ')}
              onChange={(e) =>
                handleUpdate(
                  ['devkit', 'allowed_shell_commands'],
                  e.target.value
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                )
              }
              placeholder="e.g. node, npm, git, python, cargo"
              helperText="Comma-separated list of allowed binary names. Empty = all commands allowed."
              disabled={isEnvOverridden('devkit.allowed_shell_commands')}
            />
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

            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                Provider
              </label>
              {renderEnvOverrideBadge('audio.provider')}
            </div>
            <SelectInput
              label=""
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
              disabled={isEnvOverridden('audio.provider')}
            />

            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                Model
              </label>
              {renderEnvOverrideBadge('audio.model')}
            </div>
            <TextInput
              label=""
              value={localConfig.audio.model}
              onChange={(e: any) =>
                handleUpdate(['audio', 'model'], e.target.value)
              }
              placeholder="e.g. whisper-1, gemini-2.5-flash-lite..."
              helperText="Model to use for audio transcription."
              error={errors['audio.model']}
              disabled={isEnvOverridden('audio.model')}
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

            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                API Key
              </label>
              <div className="flex items-center gap-2">
                {renderEnvOverrideBadge('audio.apiKey')}
                {renderEncryptionBadge('audio', localConfig.audio.apiKey)}
              </div>
            </div>
            <TextInput
              label=""
              type="password"
              value={localConfig.audio.apiKey || ''}
              onChange={(e: any) =>
                handleUpdate(['audio', 'apiKey'], e.target.value)
              }
              placeholder="If different from LLM key..."
              helperText="Leave empty to use LLM API key if using the same provider."
              disabled={isEnvOverridden('audio.apiKey')}
            />

            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-azure-text-primary dark:text-matrix-secondary">
                Max Duration (Seconds)
              </label>
              {renderEnvOverrideBadge('audio.maxDurationSeconds')}
            </div>
            <NumberInput
              label=""
              value={localConfig.audio.maxDurationSeconds}
              onChange={(e: any) =>
                handleUpdate(
                  ['audio', 'maxDurationSeconds'],
                  parseInt(e.target.value)
                )
              }
              min={1}
              disabled={isEnvOverridden('audio.maxDurationSeconds')}
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
          <>
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

            <Section title="Discord">
              <Switch
                label="Enable Discord"
                checked={localConfig.channels.discord.enabled}
                onChange={(checked) =>
                  handleUpdate(['channels', 'discord', 'enabled'], checked)
                }
              />
              {localConfig.channels.discord.enabled && (
                <div className="space-y-4 mt-4 pl-4 border-l border-matrix-primary">
                  <TextInput
                    label="Bot Token"
                    type="password"
                    value={localConfig.channels.discord.token || ''}
                    onChange={(e) =>
                      handleUpdate(
                        ['channels', 'discord', 'token'],
                        e.target.value
                      )
                    }
                  />
                  <TextInput
                    label="Allowed Users (comma separated)"
                    value={(localConfig.channels.discord.allowedUsers ?? []).join(', ')}
                    onChange={(e) =>
                      handleUpdate(
                        ['channels', 'discord', 'allowedUsers'],
                        e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                    helperText="Discord user IDs allowed to interact with the bot"
                  />
                </div>
              )}
            </Section>
          </>
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
              helperText="Port changes require daemon restart."
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

        {activeTab === 'chronos' && localChronosConfig && (
          <Section title="Chronos — Temporal Intent Engine">
            <SelectInput
              label="Timezone"
              value={localChronosConfig.timezone}
              onChange={(e) =>
                setLocalChronosConfig({ ...localChronosConfig, timezone: e.target.value })
              }
              options={[
                { label: 'UTC', value: 'UTC' },
                { label: 'America/New_York', value: 'America/New_York' },
                { label: 'America/Chicago', value: 'America/Chicago' },
                { label: 'America/Denver', value: 'America/Denver' },
                { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
                { label: 'America/Sao_Paulo', value: 'America/Sao_Paulo' },
                { label: 'America/Buenos_Aires', value: 'America/Buenos_Aires' },
                { label: 'America/Bogota', value: 'America/Bogota' },
                { label: 'America/Lima', value: 'America/Lima' },
                { label: 'America/Santiago', value: 'America/Santiago' },
                { label: 'America/Mexico_City', value: 'America/Mexico_City' },
                { label: 'America/Toronto', value: 'America/Toronto' },
                { label: 'America/Vancouver', value: 'America/Vancouver' },
                { label: 'Europe/London', value: 'Europe/London' },
                { label: 'Europe/Paris', value: 'Europe/Paris' },
                { label: 'Europe/Berlin', value: 'Europe/Berlin' },
                { label: 'Europe/Madrid', value: 'Europe/Madrid' },
                { label: 'Europe/Rome', value: 'Europe/Rome' },
                { label: 'Europe/Amsterdam', value: 'Europe/Amsterdam' },
                { label: 'Europe/Brussels', value: 'Europe/Brussels' },
                { label: 'Europe/Zurich', value: 'Europe/Zurich' },
                { label: 'Europe/Lisbon', value: 'Europe/Lisbon' },
                { label: 'Europe/Warsaw', value: 'Europe/Warsaw' },
                { label: 'Europe/Stockholm', value: 'Europe/Stockholm' },
                { label: 'Europe/Helsinki', value: 'Europe/Helsinki' },
                { label: 'Europe/Moscow', value: 'Europe/Moscow' },
                { label: 'Asia/Dubai', value: 'Asia/Dubai' },
                { label: 'Asia/Kolkata', value: 'Asia/Kolkata' },
                { label: 'Asia/Bangkok', value: 'Asia/Bangkok' },
                { label: 'Asia/Singapore', value: 'Asia/Singapore' },
                { label: 'Asia/Hong_Kong', value: 'Asia/Hong_Kong' },
                { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
                { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
                { label: 'Asia/Seoul', value: 'Asia/Seoul' },
                { label: 'Australia/Sydney', value: 'Australia/Sydney' },
                { label: 'Australia/Melbourne', value: 'Australia/Melbourne' },
                { label: 'Pacific/Auckland', value: 'Pacific/Auckland' },
                { label: 'Africa/Cairo', value: 'Africa/Cairo' },
                { label: 'Africa/Johannesburg', value: 'Africa/Johannesburg' },
              ]}
            />
            <NumberInput
              label="Check Interval (seconds)"
              value={Math.round(localChronosConfig.check_interval_ms / 1000)}
              onChange={(e) =>
                setLocalChronosConfig({
                  ...localChronosConfig,
                  check_interval_ms: Number(e.target.value) * 1000,
                })
              }
              min={60}
            />
            <NumberInput
              label="Max Active Jobs"
              value={localChronosConfig.max_active_jobs}
              onChange={(e) =>
                setLocalChronosConfig({
                  ...localChronosConfig,
                  max_active_jobs: Number(e.target.value),
                })
              }
              min={1}
              max={1000}
            />
            <div className="flex justify-end pt-2">
              <button
                onClick={async () => {
                  setChronosSaving(true);
                  setNotification(null);
                  try {
                    await chronosService.updateConfig(localChronosConfig);
                    mutate('/api/config/chronos');
                    setNotification({ type: 'success', message: 'Chronos settings saved.' });
                  } catch (err: any) {
                    setNotification({ type: 'error', message: err.message });
                  } finally {
                    setChronosSaving(false);
                  }
                }}
                disabled={chronosSaving}
                className="px-4 py-2 rounded font-medium bg-azure-primary text-white hover:bg-azure-active dark:bg-matrix-highlight dark:text-black dark:hover:bg-matrix-highlight/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {chronosSaving ? 'Saving…' : 'Save Chronos Settings'}
              </button>
            </div>
          </Section>
        )}

      </div>
    </div>
  );
}
