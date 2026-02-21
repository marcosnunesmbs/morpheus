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
  NeoConfig,
  ApocConfig,
  TrinityConfig,
} from '../../../types/config';
import { ZodError } from 'zod';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'agents', label: 'Agents' },
  { id: 'audio', label: 'Audio' },
  { id: 'channels', label: 'Channels' },
  { id: 'ui', label: 'Interface' },
  { id: 'logging', label: 'Logging' },
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

  const isDirty =
    JSON.stringify(serverConfig) !== JSON.stringify(localConfig) ||
    JSON.stringify(satiServerConfig) !== JSON.stringify(localSatiConfig) ||
    JSON.stringify(neoServerConfig) !== JSON.stringify(localNeoConfig) ||
    JSON.stringify(apocServerConfig) !== JSON.stringify(localApocConfig) ||
    JSON.stringify(trinityServerConfig) !== JSON.stringify(localTrinityConfig);

  const handleUpdate = (path: string[], value: any) => {
    if (!localConfig) return;

    const newConfig = JSON.parse(JSON.stringify(localConfig));
    let current = newConfig;
    for (let i = 0; i < path.length - 1; i++) {
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
      await configService.updateConfig(localConfig);

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
                <SelectInput
                  label="Provider"
                  value={localConfig.llm.provider}
                  onChange={(e) =>
                    handleUpdate(['llm', 'provider'], e.target.value)
                  }
                  options={PROVIDER_OPTIONS}
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
                    <SelectInput
                      label="Provider"
                      value={localSatiConfig.provider}
                      onChange={(e) =>
                        handleSatiUpdate('provider', e.target.value)
                      }
                      options={PROVIDER_OPTIONS}
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
                    <SelectInput
                      label="Provider"
                      value={localNeoConfig.provider}
                      onChange={(e) =>
                        handleNeoUpdate('provider', e.target.value as any)
                      }
                      options={PROVIDER_OPTIONS}
                    />
                    <TextInput
                      label="Model Name"
                      value={localNeoConfig.model}
                      onChange={(e) => handleNeoUpdate('model', e.target.value)}
                    />
                    <NumberInput
                      label="Temperature"
                      value={localNeoConfig.temperature}
                      onChange={(e) =>
                        handleNeoUpdate('temperature', parseFloat(e.target.value))
                      }
                      step={0.1}
                      min={0}
                      max={1}
                    />
                    <NumberInput
                      label="Max Tokens"
                      value={localNeoConfig.max_tokens ?? ''}
                      onChange={(e: any) =>
                        handleNeoUpdate(
                          'max_tokens',
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      min={1}
                      helperText="Maximum tokens per response. Leave empty for model default."
                    />
                    <NumberInput
                      label="Context Window (Messages)"
                      value={localNeoConfig.context_window ?? 100}
                      onChange={(e: any) =>
                        handleNeoUpdate(
                          'context_window',
                          parseInt(e.target.value)
                        )
                      }
                      min={1}
                      step={1}
                    />
                    <TextInput
                      label="API Key"
                      type="password"
                      value={localNeoConfig.api_key || ''}
                      onChange={(e) =>
                        handleNeoUpdate('api_key', e.target.value)
                      }
                      placeholder="sk-..."
                      helperText="Stored locally."
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
                    <SelectInput
                      label="Provider"
                      value={localTrinityConfig.provider}
                      onChange={(e) =>
                        handleTrinityUpdate('provider', e.target.value as any)
                      }
                      options={PROVIDER_OPTIONS}
                    />
                    <TextInput
                      label="Model Name"
                      value={localTrinityConfig.model}
                      onChange={(e) => handleTrinityUpdate('model', e.target.value)}
                    />
                    <NumberInput
                      label="Temperature"
                      value={localTrinityConfig.temperature}
                      onChange={(e) =>
                        handleTrinityUpdate('temperature', parseFloat(e.target.value))
                      }
                      step={0.1}
                      min={0}
                      max={1}
                    />
                    <NumberInput
                      label="Max Tokens"
                      value={localTrinityConfig.max_tokens ?? ''}
                      onChange={(e: any) =>
                        handleTrinityUpdate(
                          'max_tokens',
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      min={1}
                      helperText="Maximum tokens per response. Leave empty for model default."
                    />
                    <TextInput
                      label="API Key"
                      type="password"
                      value={localTrinityConfig.api_key || ''}
                      onChange={(e) =>
                        handleTrinityUpdate('api_key', e.target.value)
                      }
                      placeholder="sk-..."
                      helperText="Stored locally."
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
                    <SelectInput
                      label="Provider"
                      value={localApocConfig.provider}
                      onChange={(e) =>
                        handleApocUpdate('provider', e.target.value as any)
                      }
                      options={PROVIDER_OPTIONS}
                    />
                    <TextInput
                      label="Model Name"
                      value={localApocConfig.model}
                      onChange={(e) => handleApocUpdate('model', e.target.value)}
                    />
                    <NumberInput
                      label="Temperature"
                      value={localApocConfig.temperature}
                      onChange={(e) =>
                        handleApocUpdate('temperature', parseFloat(e.target.value))
                      }
                      step={0.1}
                      min={0}
                      max={1}
                    />
                    <TextInput
                      label="API Key"
                      type="password"
                      value={localApocConfig.api_key || ''}
                      onChange={(e) =>
                        handleApocUpdate('api_key', e.target.value)
                      }
                      placeholder="sk-..."
                      helperText="Stored locally."
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
                      placeholder="/home/user/projects"
                      helperText="Root directory for file and shell operations. Leave empty to use process working directory."
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
      </div>
    </div>
  );
}
