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
import type { MorpheusConfig } from '../../../types/config';
import { ZodError } from 'zod';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'llm', label: 'LLM' },
  { id: 'channels', label: 'Channels' },
  { id: 'ui', label: 'Interface' },
  { id: 'logging', label: 'Logging' },
];

export default function Settings() {
  const { data: serverConfig, error } = useSWR('/api/config', configService.fetchConfig);
  const [localConfig, setLocalConfig] = useState<MorpheusConfig | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Initialize local config when data is loaded
  useEffect(() => {
    if (serverConfig && !localConfig) {
      setLocalConfig(serverConfig);
    }
  }, [serverConfig]);

  const isDirty = JSON.stringify(serverConfig) !== JSON.stringify(localConfig);

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

  const handleSave = async () => {
    if (!localConfig) return;
    setSaving(true);
    setNotification(null);
    try {
        await configService.updateConfig(localConfig);
        mutate('/api/config'); // Refresh SWR
        setNotification({ type: 'success', message: 'Settings saved successfully' });
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

  if (error) return <div className="p-8 text-red-500">Failed to load configuration</div>;
  if (!localConfig) return <div className="p-8 text-matrix-highlight">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-matrix-highlight">Settings</h1>
        <button
            onClick={handleSave}
            disabled={!isDirty || Object.keys(errors).length > 0 || saving}
            className={`px-4 py-2 rounded font-medium transition-colors ${
                isDirty && Object.keys(errors).length === 0
                ? 'bg-matrix-highlight text-black hover:bg-matrix-highlight/90' 
                : 'bg-matrix-primary/50 text-matrix-highlight/50 cursor-not-allowed'
            }`}
        >
            {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {notification && (
          <div className={`p-4 rounded border ${
              notification.type === 'success' ? 'border-matrix-highlight text-matrix-highlight bg-matrix-highlight/10' : 'border-red-500 text-red-500 bg-red-900/10'
          }`}>
              {notification.message}
          </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-matrix-primary pb-px">
        {TABS.map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                    activeTab === tab.id 
                    ? 'bg-matrix-primary/20 text-matrix-highlight border-t border-x border-matrix-primary' 
                    : 'text-matrix-secondary hover:text-matrix-highlight'
                }`}
            >
                {tab.label}
            </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'general' && (
            <Section title="Agent Identity">
                <TextInput
                    label="Agent Name"
                    value={localConfig.agent.name}
                    onChange={e => handleUpdate(['agent', 'name'], e.target.value)}
                    error={errors['agent.name']}
                />
                <TextInput
                    label="Personality"
                    value={localConfig.agent.personality}
                    onChange={e => handleUpdate(['agent', 'personality'], e.target.value)}
                    error={errors['agent.personality']}
                />
            </Section>
        )}

        {activeTab === 'llm' && (
            <Section title="LLM Provider">
                <SelectInput
                    label="Provider"
                    value={localConfig.llm.provider}
                    onChange={e => handleUpdate(['llm', 'provider'], e.target.value)}
                    options={[
                        { label: 'OpenAI', value: 'openai' },
                        { label: 'Anthropic', value: 'anthropic' },
                        { label: 'Ollama', value: 'ollama' },
                        { label: 'Google Gemini', value: 'gemini' },
                    ]}
                    error={errors['llm.provider']}
                />
                <TextInput
                    label="Model Name"
                    value={localConfig.llm.model}
                    onChange={e => handleUpdate(['llm', 'model'], e.target.value)}
                    error={errors['llm.model']}
                />
                <NumberInput
                    label="Temperature"
                    value={localConfig.llm.temperature}
                    onChange={e => handleUpdate(['llm', 'temperature'], parseFloat(e.target.value))}
                    step={0.1}
                    min={0}
                    max={1}
                    error={errors['llm.temperature']}
                />
                <TextInput
                    label="API Key"
                    type="password"
                    value={localConfig.llm.api_key || ''}
                    onChange={e => handleUpdate(['llm', 'api_key'], e.target.value)}
                    placeholder="sk-..."
                    helperText="Stored locally."
                />
            </Section>
        )}

        {activeTab === 'channels' && (
            <Section title="Telegram">
                <Switch
                    label="Enable Telegram"
                    checked={localConfig.channels.telegram.enabled}
                    onChange={checked => handleUpdate(['channels', 'telegram', 'enabled'], checked)}
                />
                {localConfig.channels.telegram.enabled && (
                    <div className="space-y-4 mt-4 pl-4 border-l border-matrix-primary">
                        <TextInput
                            label="Bot Token"
                            type="password"
                            value={localConfig.channels.telegram.token || ''}
                            onChange={e => handleUpdate(['channels', 'telegram', 'token'], e.target.value)}
                        />
                        <TextInput
                            label="Allowed Users (comma separated)"
                            value={localConfig.channels.telegram.allowedUsers.join(', ')}
                            onChange={e => handleUpdate(['channels', 'telegram', 'allowedUsers'], e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
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
                    onChange={checked => handleUpdate(['ui', 'enabled'], checked)}
                />
                <NumberInput
                    label="Port"
                    value={localConfig.ui.port}
                    onChange={e => handleUpdate(['ui', 'port'], parseInt(e.target.value))}
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
                    onChange={checked => handleUpdate(['logging', 'enabled'], checked)}
                />
                <SelectInput
                    label="Log Level"
                    value={localConfig.logging.level}
                    onChange={e => handleUpdate(['logging', 'level'], e.target.value)}
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
