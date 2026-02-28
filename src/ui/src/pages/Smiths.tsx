import { useState } from 'react';
import useSWR from 'swr';
import {
  HatGlasses,
  Plus,
  X,
  Radio,
  Pencil,
  Trash2,
  Cpu,
  HardDrive,
  Clock,
  Server,
  Settings2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldOff,
  Wifi,
  WifiOff,
  AlertCircle,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { configService } from '../services/config';
import { TextInput } from '../components/forms/TextInput';
import { NumberInput } from '../components/forms/NumberInput';
import { SelectInput } from '../components/forms/SelectInput';
import { Switch } from '../components/forms/Switch';
// @ts-ignore
import type { SmithsConfig, SmithEntry } from '../../../types/config';

interface SmithStatus {
  name: string;
  host: string;
  port: number;
  state: 'online' | 'offline' | 'connecting' | 'error';
  capabilities: string[];
  stats?: {
    cpu_percent: number;
    memory_used_mb: number;
    memory_total_mb: number;
    os: string;
    hostname: string;
    uptime_seconds: number;
  };
  config?: {
    sandbox_dir?: string;
    readonly_mode?: boolean;
    enabled_categories?: string[];
  };
  lastSeen: string | null;
  error: string | null;
}

const EMPTY_SMITH: SmithEntry = { name: '', host: '', port: 7900, auth_token: '', tls: false };

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMemory(usedMb: number, totalMb: number): string {
  const used = usedMb >= 1024 ? `${(usedMb / 1024).toFixed(1)}GB` : `${Math.round(usedMb)}MB`;
  const total = totalMb >= 1024 ? `${(totalMb / 1024).toFixed(1)}GB` : `${Math.round(totalMb)}MB`;
  return `${used} / ${total}`;
}

function StateIndicator({ state }: { state: string }) {
  if (state === 'online') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        online
      </span>
    );
  }
  if (state === 'connecting') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        connecting
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 bg-zinc-500/10 border border-zinc-500/30 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
      offline
    </span>
  );
}

function CapabilityBadge({ cap }: { cap: string }) {
  const colors: Record<string, string> = {
    filesystem: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    shell: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    git: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
    browser: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
    network: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
    packages: 'text-green-400 bg-green-400/10 border-green-400/30',
    processes: 'text-pink-400 bg-pink-400/10 border-pink-400/30',
    system: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/30',
  };
  const cls = colors[cap] ?? 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30';
  return (
    <span className={`text-[10px] font-medium border rounded px-1.5 py-0.5 ${cls}`}>{cap}</span>
  );
}

interface SmithCardProps {
  status: SmithStatus;
  entry?: SmithEntry;
  onPing: (name: string) => void;
  onEdit: (entry: SmithEntry) => void;
  onDelete: (name: string) => void;
}

function SmithCard({ status, entry, onPing, onEdit, onDelete }: SmithCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isOnline = status.state === 'online';

  return (
    <div className={`rounded-lg border bg-white dark:bg-black transition-all ${
      isOnline
        ? 'border-emerald-500/40 dark:border-emerald-500/30'
        : status.state === 'error'
        ? 'border-red-500/40 dark:border-red-500/30'
        : status.state === 'connecting'
        ? 'border-amber-500/40 dark:border-amber-500/30'
        : 'border-azure-border dark:border-matrix-primary'
    }`}>
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isOnline ? 'bg-emerald-500/10' : 'bg-zinc-100 dark:bg-zinc-900'
            }`}>
              <Server className={`w-4 h-4 ${isOnline ? 'text-emerald-500' : 'text-zinc-400 dark:text-matrix-tertiary'}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-azure-text dark:text-matrix-highlight truncate">
                  {status.name}
                </span>
                <StateIndicator state={status.state} />
                {entry?.tls && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
                    <Lock className="w-2.5 h-2.5" />
                    TLS
                  </span>
                )}
              </div>
              <div className="text-xs text-azure-text-secondary dark:text-matrix-tertiary mt-0.5">
                {status.host}:{status.port}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onPing(status.name)}
              className="p-1.5 rounded border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-secondary hover:text-azure-primary dark:hover:text-matrix-highlight hover:border-azure-primary dark:hover:border-matrix-highlight transition-colors"
              title="Ping"
            >
              <Radio className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onEdit(entry ?? { name: status.name, host: status.host, port: status.port, auth_token: '', tls: false })}
              className="p-1.5 rounded border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-secondary hover:text-azure-primary dark:hover:text-matrix-highlight hover:border-azure-primary dark:hover:border-matrix-highlight transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(status.name)}
              className="p-1.5 rounded border border-red-200 dark:border-red-800/50 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
              title="Remove"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Error message */}
        {status.error && (
          <div className="mt-3 flex items-start gap-2 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded p-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{status.error}</span>
          </div>
        )}

        {/* System Stats (when online) */}
        {isOnline && status.stats && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-azure-text-secondary dark:text-matrix-tertiary">OS</span>
                <span className="text-azure-text dark:text-matrix-secondary font-mono">{status.stats.os}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-azure-text-secondary dark:text-matrix-tertiary">Hostname</span>
                <span className="text-azure-text dark:text-matrix-secondary font-mono truncate max-w-[120px]">{status.stats.hostname}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-azure-text-secondary dark:text-matrix-tertiary flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                <span className="text-azure-text dark:text-matrix-secondary font-mono">{status.stats.cpu_percent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-azure-text-secondary dark:text-matrix-tertiary flex items-center gap-1"><HardDrive className="w-3 h-3" /> RAM</span>
                <span className="text-azure-text dark:text-matrix-secondary font-mono">{formatMemory(status.stats.memory_used_mb, status.stats.memory_total_mb)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-azure-text-secondary dark:text-matrix-tertiary flex items-center gap-1"><Clock className="w-3 h-3" /> Uptime</span>
                <span className="text-azure-text dark:text-matrix-secondary font-mono">{formatUptime(status.stats.uptime_seconds)}</span>
              </div>
              {status.config?.sandbox_dir && (
                <div className="flex justify-between col-span-2">
                  <span className="text-azure-text-secondary dark:text-matrix-tertiary shrink-0">Sandbox</span>
                  <span className="text-azure-text dark:text-matrix-secondary font-mono truncate text-right ml-2">{status.config.sandbox_dir}</span>
                </div>
              )}
              {status.config && (
                <div className="flex justify-between">
                  <span className="text-azure-text-secondary dark:text-matrix-tertiary">Read-only</span>
                  <span className={`font-medium ${status.config.readonly_mode ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {status.config.readonly_mode ? 'yes' : 'no'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Last seen (offline) */}
        {!isOnline && status.lastSeen && (
          <div className="mt-2 text-xs text-azure-text-secondary dark:text-matrix-tertiary">
            Last seen: {new Date(status.lastSeen).toLocaleString()}
          </div>
        )}
      </div>

      {/* Expandable — Capabilities */}
      {status.capabilities.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-2 border-t border-azure-border dark:border-matrix-primary/30 text-xs text-azure-text-secondary dark:text-matrix-tertiary hover:text-azure-text dark:hover:text-matrix-secondary hover:bg-azure-surface/50 dark:hover:bg-zinc-900/50 transition-colors"
          >
            <span>Capabilities ({status.capabilities.length})</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {expanded && (
            <div className="px-4 pb-4 pt-3 border-t border-azure-border dark:border-matrix-primary/30 bg-azure-surface/30 dark:bg-zinc-900/30">
              <div className="flex flex-wrap gap-1.5">
                {status.capabilities.map((cap) => (
                  <CapabilityBadge key={cap} cap={cap} />
                ))}
              </div>
              {status.lastSeen && (
                <div className="text-xs text-azure-text-secondary dark:text-matrix-tertiary mt-3">
                  Last seen: {new Date(status.lastSeen).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface SmithFormModalProps {
  title: string;
  initial: SmithEntry;
  isEdit?: boolean;
  onSave: (entry: SmithEntry) => void;
  onClose: () => void;
  saving: boolean;
  error?: string | null;
}

function SmithFormModal({ title, initial, isEdit, onSave, onClose, saving, error }: SmithFormModalProps) {
  const [form, setForm] = useState<SmithEntry>(initial);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = () => {
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!form.host.trim()) { setFormError('Host is required.'); return; }
    if (!isEdit && !form.auth_token.trim()) { setFormError('Auth token is required.'); return; }
    setFormError(null);
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-black border border-azure-border dark:border-matrix-primary rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-azure-border dark:border-matrix-primary">
          <h2 className="text-base font-semibold text-azure-text dark:text-matrix-highlight flex items-center gap-2">
            <HatGlasses className="w-4 h-4" />
            {title}
          </h2>
          <button onClick={onClose} className="text-azure-text-secondary dark:text-matrix-tertiary hover:text-azure-text dark:hover:text-matrix-highlight transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {(formError || error) && (
            <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError || error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <TextInput
                label="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={isEdit}
                helperText={isEdit ? 'Name cannot be changed after creation.' : 'Unique identifier (lowercase, hyphens ok).'}
              />
            </div>
            <TextInput
              label="Host"
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              placeholder="localhost"
            />
            <NumberInput
              label="Port"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
              min={1}
              max={65535}
            />
            <div className="col-span-2">
              <TextInput
                label="Auth Token"
                value={form.auth_token}
                onChange={(e) => setForm({ ...form, auth_token: e.target.value })}
                placeholder={isEdit ? 'Leave blank to keep existing token' : 'Shared secret'}
                helperText={isEdit ? 'Leave blank to keep the current token.' : undefined}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="smith-tls"
              checked={form.tls ?? false}
              onChange={(e) => setForm({ ...form, tls: e.target.checked })}
              className="w-4 h-4 accent-azure-primary dark:accent-matrix-highlight"
            />
            <label htmlFor="smith-tls" className="text-sm text-azure-text-secondary dark:text-matrix-secondary cursor-pointer">
              Use TLS (<code className="text-xs font-mono">wss://</code>)
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-azure-border dark:border-matrix-primary">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm text-azure-text-secondary dark:text-matrix-tertiary hover:text-azure-text dark:hover:text-matrix-highlight transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded text-sm font-medium bg-azure-primary text-white hover:bg-azure-active dark:bg-matrix-highlight dark:text-black dark:hover:bg-matrix-highlight/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : isEdit ? 'Update Smith' : 'Add Smith'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SmithsPage() {
  const { data: smithsList, mutate: mutateList } = useSWR(
    '/api/smiths',
    configService.getSmithsList,
    { refreshInterval: 10_000 }
  );
  const { data: smithsConfig, mutate: mutateConfig } = useSWR(
    '/api/smiths/config',
    configService.getSmithsConfig
  );

  const [localConfig, setLocalConfig] = useState<SmithsConfig | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editingSmith, setEditingSmith] = useState<SmithEntry | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Sync config to local state when loaded
  if (smithsConfig && !localConfig) {
    setLocalConfig(smithsConfig);
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handlePing = async (name: string) => {
    try {
      const result = await configService.pingSmith(name);
      showNotification('success', `Ping ${name}: ${result.latency_ms}ms`);
    } catch (err: any) {
      showNotification('error', `Ping failed: ${err.message}`);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Remove Smith "${name}" from the registry?`)) return;
    try {
      await configService.removeSmith(name);
      mutateList();
      mutateConfig();
      setLocalConfig(null);
      showNotification('success', `Smith "${name}" removed.`);
    } catch (err: any) {
      showNotification('error', `Failed to remove: ${err.message}`);
    }
  };

  const handleAddSmith = async (entry: SmithEntry) => {
    if (!localConfig) return;
    if (localConfig.entries.some((e) => e.name === entry.name)) {
      setModalError(`Smith "${entry.name}" already exists.`);
      return;
    }
    setModalSaving(true);
    setModalError(null);
    try {
      const updated: SmithsConfig = { ...localConfig, entries: [...localConfig.entries, entry] };
      await configService.updateSmithsConfig(updated);
      setAddOpen(false);
      setLocalConfig(null);
      mutateList();
      mutateConfig();
      showNotification('success', `Smith "${entry.name}" added.`);
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setModalSaving(false);
    }
  };

  const handleEditSmith = async (entry: SmithEntry) => {
    if (!localConfig) return;
    setModalSaving(true);
    setModalError(null);
    try {
      const updated: SmithsConfig = {
        ...localConfig,
        entries: localConfig.entries.map((e) => (e.name === entry.name ? entry : e)),
      };
      await configService.updateSmithsConfig(updated);
      setEditingSmith(null);
      setLocalConfig(null);
      mutateList();
      mutateConfig();
      showNotification('success', `Smith "${entry.name}" updated.`);
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setModalSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!localConfig) return;
    setConfigSaving(true);
    try {
      await configService.updateSmithsConfig(localConfig);
      mutateList();
      mutateConfig();
      showNotification('success', 'Settings saved.');
      setConfigOpen(false);
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setConfigSaving(false);
    }
  };

  const smiths: SmithStatus[] = (smithsList?.smiths ?? []) as SmithStatus[];
  const onlineCount = smiths.filter((s) => s.state === 'online').length;
  const offlineCount = smiths.filter((s) => s.state === 'offline' || s.state === 'error').length;
  const connectingCount = smiths.filter((s) => s.state === 'connecting').length;

  // Build a lookup for config entries (for TLS info etc.)
  const entryMap: Record<string, SmithEntry> = {};
  (localConfig ?? smithsConfig)?.entries?.forEach((e: SmithEntry) => { entryMap[e.name] = e; });

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm border ${
          notification.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-400'
        }`}>
          {notification.type === 'success' ? <ShieldCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {notification.message}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-azure-primary/10 dark:bg-matrix-highlight/10 border border-azure-primary/20 dark:border-matrix-highlight/30 flex items-center justify-center">
            <HatGlasses className="w-5 h-5 text-azure-primary dark:text-matrix-highlight" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-azure-text dark:text-matrix-highlight">Smiths</h1>
            <p className="text-sm text-azure-text-secondary dark:text-matrix-tertiary">Remote DevKit agents via WebSocket</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setRefreshing(true);
              await Promise.all([
                mutateList(),
                mutateConfig(),
                new Promise((r) => setTimeout(r, 500)),
              ]);
              setRefreshing(false);
            }}
            className="p-2 rounded border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-secondary hover:text-azure-primary dark:hover:text-matrix-highlight transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 transition-transform ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setConfigOpen(!configOpen); if (!localConfig && smithsConfig) setLocalConfig(smithsConfig); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded border text-sm transition-colors ${
              configOpen
                ? 'bg-azure-primary/10 border-azure-primary dark:bg-matrix-highlight/10 dark:border-matrix-highlight text-azure-primary dark:text-matrix-highlight'
                : 'border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-secondary hover:text-azure-primary dark:hover:text-matrix-highlight'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={() => { setAddOpen(true); setModalError(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-azure-primary text-white hover:bg-azure-active dark:bg-matrix-highlight dark:text-black dark:hover:bg-matrix-highlight/90 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Smith
          </button>
        </div>
      </div>

      {/* Status Summary */}
      {smithsList && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-azure-text-secondary dark:text-matrix-tertiary">Total</span>
            <span className="font-semibold text-azure-text dark:text-matrix-secondary">{smithsList.total}</span>
          </div>
          {onlineCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-semibold text-emerald-500">{onlineCount} online</span>
            </div>
          )}
          {connectingCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <Radio className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-semibold text-amber-500">{connectingCount} connecting</span>
            </div>
          )}
          {offlineCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <WifiOff className="w-3.5 h-3.5 text-zinc-400 dark:text-matrix-tertiary" />
              <span className="font-semibold text-zinc-500 dark:text-matrix-tertiary">{offlineCount} offline</span>
            </div>
          )}
          {!smithsList.enabled && (
            <div className="flex items-center gap-1.5 text-sm text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-0.5">
              <ShieldOff className="w-3.5 h-3.5" />
              <span>Smiths subsystem disabled</span>
            </div>
          )}
        </div>
      )}

      {/* Settings Panel */}
      {configOpen && localConfig && (
        <div className="rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-black p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-azure-text dark:text-matrix-highlight flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Global Settings
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Switch
                label="Enable Smiths"
                checked={localConfig.enabled}
                onChange={(checked) => setLocalConfig({ ...localConfig, enabled: checked })}
                helperText="Master switch — disabling stops all Smith connections."
              />
            </div>
            <SelectInput
              label="Execution Mode"
              value={localConfig.execution_mode}
              onChange={(e) => setLocalConfig({ ...localConfig, execution_mode: e.target.value as 'sync' | 'async' })}
              options={[
                { label: 'Sync — inline result', value: 'sync' },
                { label: 'Async — background task', value: 'async' },
              ]}
            />
            <NumberInput
              label="Heartbeat Interval (s)"
              value={Math.round(localConfig.heartbeat_interval_ms / 1000)}
              onChange={(e) => setLocalConfig({ ...localConfig, heartbeat_interval_ms: Number(e.target.value) * 1000 })}
              min={5}
            />
            <NumberInput
              label="Connection Timeout (s)"
              value={Math.round(localConfig.connection_timeout_ms / 1000)}
              onChange={(e) => setLocalConfig({ ...localConfig, connection_timeout_ms: Number(e.target.value) * 1000 })}
              min={1}
            />
            <NumberInput
              label="Task Timeout (s)"
              value={Math.round(localConfig.task_timeout_ms / 1000)}
              onChange={(e) => setLocalConfig({ ...localConfig, task_timeout_ms: Number(e.target.value) * 1000 })}
              min={5}
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleSaveConfig}
              disabled={configSaving}
              className="px-4 py-2 rounded text-sm font-medium bg-azure-primary text-white hover:bg-azure-active dark:bg-matrix-highlight dark:text-black dark:hover:bg-matrix-highlight/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {configSaving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Smith Cards */}
      {smiths.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary flex items-center justify-center mb-4">
            <HatGlasses className="w-7 h-7 text-azure-text-secondary dark:text-matrix-tertiary" />
          </div>
          <h3 className="text-base font-semibold text-azure-text dark:text-matrix-highlight mb-1">No Smiths configured</h3>
          <p className="text-sm text-azure-text-secondary dark:text-matrix-tertiary mb-4">
            Add a remote agent to delegate DevKit tasks to isolated environments.
          </p>
          <button
            onClick={() => { setAddOpen(true); setModalError(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded bg-azure-primary text-white hover:bg-azure-active dark:bg-matrix-highlight dark:text-black text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Smith
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {smiths.map((smith) => (
            <SmithCard
              key={smith.name}
              status={smith}
              entry={entryMap[smith.name]}
              onPing={handlePing}
              onEdit={(entry) => { setEditingSmith({ ...entry, auth_token: '' }); setModalError(null); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add Smith Modal */}
      {addOpen && (
        <SmithFormModal
          title="Add Smith"
          initial={EMPTY_SMITH}
          onSave={handleAddSmith}
          onClose={() => setAddOpen(false)}
          saving={modalSaving}
          error={modalError}
        />
      )}

      {/* Edit Smith Modal */}
      {editingSmith && (
        <SmithFormModal
          title="Edit Smith"
          initial={editingSmith}
          isEdit
          onSave={handleEditSmith}
          onClose={() => setEditingSmith(null)}
          saving={modalSaving}
          error={modalError}
        />
      )}
    </div>
  );
}
