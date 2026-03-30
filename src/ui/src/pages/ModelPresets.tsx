import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Sliders, Lock, Eye, EyeOff } from 'lucide-react';
import { modelPresetsService, type ModelPresetEntry, type ModelPresetFormData } from '../services/modelPresets';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/Dialog';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const PROVIDERS = ['openai', 'anthropic', 'openrouter', 'ollama', 'gemini'];

const emptyForm = (): ModelPresetFormData => ({
  name: '',
  provider: '',
  model: '',
  api_key: null,
  base_url: null,
  temperature: null,
  max_tokens: null,
});

export const ModelPresets = () => {
  const { data = [], mutate } = useSWR('/api/model-presets', () => modelPresetsService.list());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ModelPresetEntry | null>(null);
  const [form, setForm] = useState<ModelPresetFormData>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<ModelPresetEntry | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleNew = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setShowApiKey(false);
    setIsModalOpen(true);
  };

  const handleEdit = (entry: ModelPresetEntry) => {
    setEditTarget(entry);
    setForm({
      name: entry.name,
      provider: entry.provider,
      model: entry.model,
      api_key: null, // never pre-fill; blank = keep existing
      base_url: entry.base_url ?? null,
      temperature: entry.temperature ?? null,
      max_tokens: entry.max_tokens ?? null,
    });
    setShowApiKey(false);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.provider.trim() || !form.model.trim()) return;
    setSaving(true);
    try {
      const payload: ModelPresetFormData = { ...form };

      // For updates: if api_key is empty string → send null (clear); if null/undefined → omit (keep existing)
      if (editTarget) {
        if (payload.api_key === '') payload.api_key = null;
        // If api_key is null and editTarget has_api_key, send undefined to omit from payload
        if (payload.api_key === null && editTarget.has_api_key) {
          const { api_key: _omit, ...rest } = payload;
          if (editTarget) {
            await modelPresetsService.update(editTarget.id, rest as ModelPresetFormData);
          }
          await mutate();
          setIsModalOpen(false);
          notify('success', 'Preset updated.');
          return;
        }
        await modelPresetsService.update(editTarget.id, payload);
      } else {
        await modelPresetsService.create(payload);
      }
      await mutate();
      setIsModalOpen(false);
      notify('success', editTarget ? 'Preset updated.' : 'Preset created.');
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('409') || msg.includes('already exists')) {
        notify('error', 'A preset with that name already exists.');
      } else {
        notify('error', 'Failed to save preset.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await modelPresetsService.delete(deleteTarget.id);
      await mutate();
      setDeleteTarget(null);
      notify('success', 'Preset deleted.');
    } catch {
      notify('error', 'Failed to delete preset.');
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-azure-border dark:border-matrix-primary bg-azure-surface dark:bg-black text-azure-text-primary dark:text-matrix-secondary text-sm focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight focus:border-azure-primary dark:focus:border-matrix-highlight';
  const labelCls = 'block text-sm font-medium text-azure-text-secondary dark:text-matrix-secondary mb-1';

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-azure-primary/10 dark:bg-matrix-highlight/10 border border-azure-primary/20 dark:border-matrix-highlight/30 flex items-center justify-center">
            <Sliders className="w-5 h-5 text-azure-primary dark:text-matrix-highlight" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-azure-text dark:text-matrix-highlight">Model Presets</h1>
            <p className="text-sm text-azure-text-secondary dark:text-matrix-tertiary mt-0.5">
              Save named LLM configurations. Apply them to any agent in Settings.
            </p>
          </div>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-azure-primary dark:bg-matrix-primary text-white dark:text-matrix-highlight text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Add Preset
        </button>
      </motion.div>

      {/* Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`px-4 py-3 rounded-lg text-sm font-medium border ${
            notification.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-400'
          }`}
        >
          {notification.message}
        </motion.div>
      )}

      {/* Table */}
      <motion.div variants={item} className="rounded-lg border border-azure-border dark:border-matrix-primary overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-azure-surface dark:bg-zinc-900 border-b border-azure-border dark:border-matrix-primary">
            <tr>
              {['Name', 'Provider', 'Model', 'Base URL', 'API Key', 'Temp', 'Max Tokens', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-azure-text-secondary dark:text-matrix-secondary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-azure-text-secondary dark:text-matrix-secondary">
                  No presets yet. Click "Add Preset" to create one.
                </td>
              </tr>
            ) : (
              data.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-azure-border dark:border-matrix-primary/30 hover:bg-azure-surface/50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-azure-text-primary dark:text-matrix-highlight">{entry.name}</td>
                  <td className="px-4 py-3 text-azure-text-primary dark:text-matrix-text capitalize">{entry.provider}</td>
                  <td className="px-4 py-3 font-mono text-azure-text-primary dark:text-matrix-text text-xs">{entry.model}</td>
                  <td className="px-4 py-3 font-mono text-azure-text-secondary dark:text-matrix-secondary text-xs max-w-[160px] truncate">
                    {entry.base_url || <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-azure-text-secondary dark:text-matrix-secondary">
                    {entry.has_api_key
                      ? <Lock className="w-4 h-4 text-azure-primary dark:text-matrix-highlight" />
                      : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-azure-text-primary dark:text-matrix-text">
                    {entry.temperature != null ? entry.temperature : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-azure-text-primary dark:text-matrix-text">
                    {entry.max_tokens != null ? entry.max_tokens : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-1.5 rounded hover:bg-azure-border dark:hover:bg-matrix-primary/30 text-azure-text-secondary dark:text-matrix-secondary hover:text-azure-primary dark:hover:text-matrix-highlight transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(entry)}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-azure-text-secondary dark:text-matrix-secondary hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Preset' : 'Add Preset'}</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div>
              <label className={labelCls}>Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. OpenRouter GPT-4"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Provider <span className="text-red-500">*</span></label>
                <select
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select provider...</option>
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Model <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="e.g. gpt-4o"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>
                API Key
                {editTarget && (
                  <span className="ml-2 text-[11px] font-normal text-azure-text-secondary/60 dark:text-matrix-secondary/40">
                    leave blank to keep existing
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={form.api_key ?? ''}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value || null })}
                  placeholder={editTarget ? '••••••••' : 'sk-...'}
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-azure-text-secondary dark:text-matrix-secondary hover:text-azure-text dark:hover:text-matrix-highlight"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Base URL</label>
              <input
                type="text"
                value={form.base_url ?? ''}
                onChange={(e) => setForm({ ...form, base_url: e.target.value || null })}
                placeholder="https://openrouter.ai/api/v1"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Temperature</label>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.temperature ?? ''}
                  onChange={(e) => setForm({ ...form, temperature: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  placeholder="0.7"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Max Tokens</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.max_tokens ?? ''}
                  onChange={(e) => setForm({ ...form, max_tokens: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                  placeholder="e.g. 4096"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-secondary text-sm hover:bg-azure-surface dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.provider.trim() || !form.model.trim()}
                className="px-4 py-2 rounded-lg bg-azure-primary dark:bg-matrix-primary text-white dark:text-matrix-highlight text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Preset</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <p className="text-sm text-azure-text-primary dark:text-matrix-text">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-azure-primary dark:text-matrix-highlight">
                {deleteTarget?.name}
              </span>
              ? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-secondary text-sm hover:bg-azure-surface dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
