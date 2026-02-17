import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import { modelPricingService, type ModelPricingEntry } from '../services/modelPricing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/Dialog';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const PROVIDERS = ['anthropic', 'openai', 'google', 'openrouter', 'ollama', 'other'];

const emptyForm = (): ModelPricingEntry => ({
  provider: '',
  model: '',
  input_price_per_1m: 0,
  output_price_per_1m: 0,
});

export const ModelPricing = () => {
  const { data = [], mutate } = useSWR('/api/model-pricing', () => modelPricingService.list());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ModelPricingEntry | null>(null);
  const [form, setForm] = useState<ModelPricingEntry>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<ModelPricingEntry | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleNew = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const handleEdit = (entry: ModelPricingEntry) => {
    setEditTarget(entry);
    setForm({ ...entry });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.provider.trim() || !form.model.trim()) return;
    setSaving(true);
    try {
      await modelPricingService.upsert(form);
      await mutate();
      setIsModalOpen(false);
      notify('success', editTarget ? 'Pricing updated.' : 'Pricing created.');
    } catch {
      notify('error', 'Failed to save pricing entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await modelPricingService.delete(deleteTarget.provider, deleteTarget.model);
      await mutate();
      setDeleteTarget(null);
      notify('success', 'Pricing entry deleted.');
    } catch {
      notify('error', 'Failed to delete pricing entry.');
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-azure-primary dark:text-matrix-highlight" />
          <div>
            <h1 className="text-2xl font-bold text-azure-text-primary dark:text-matrix-highlight">Model Pricing</h1>
            <p className="text-sm text-azure-text-secondary dark:text-matrix-dim mt-0.5">
              Manage per-model pricing to estimate LLM costs in Usage Stats.
            </p>
          </div>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-azure-primary dark:bg-matrix-primary text-white dark:text-matrix-highlight text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Add Pricing
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
              {['Provider', 'Model', 'Input ($/1M tokens)', 'Output ($/1M tokens)', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-azure-text-secondary dark:text-matrix-dim">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-azure-text-secondary dark:text-matrix-dim">
                  No pricing entries. Click "Add Pricing" to get started.
                </td>
              </tr>
            ) : (
              data.map((entry) => (
                <tr
                  key={`${entry.provider}/${entry.model}`}
                  className="border-b border-azure-border dark:border-matrix-primary/30 hover:bg-azure-surface/50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-4 py-3 text-azure-text-primary dark:text-matrix-text capitalize">{entry.provider}</td>
                  <td className="px-4 py-3 font-mono text-azure-text-primary dark:text-matrix-highlight text-xs">{entry.model}</td>
                  <td className="px-4 py-3 text-azure-text-primary dark:text-matrix-text">${entry.input_price_per_1m.toFixed(4)}</td>
                  <td className="px-4 py-3 text-azure-text-primary dark:text-matrix-text">${entry.output_price_per_1m.toFixed(4)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-1.5 rounded hover:bg-azure-border dark:hover:bg-matrix-primary/30 text-azure-text-secondary dark:text-matrix-dim hover:text-azure-primary dark:hover:text-matrix-highlight transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(entry)}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-azure-text-secondary dark:text-matrix-dim hover:text-red-600 dark:hover:text-red-400 transition-colors"
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
            <DialogTitle>{editTarget ? 'Edit Pricing' : 'Add Pricing'}</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-azure-text-secondary dark:text-matrix-dim mb-1">Provider</label>
              {editTarget ? (
                <p className="px-3 py-2 rounded-lg bg-azure-bg dark:bg-zinc-800 text-azure-text-primary dark:text-matrix-text text-sm capitalize">{form.provider}</p>
              ) : (
                <select
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-zinc-800 text-azure-text-primary dark:text-matrix-text text-sm focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight"
                >
                  <option value="">Select provider...</option>
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-azure-text-secondary dark:text-matrix-dim mb-1">Model</label>
              {editTarget ? (
                <p className="px-3 py-2 rounded-lg bg-azure-bg dark:bg-zinc-800 text-azure-text-primary dark:text-matrix-text text-sm font-mono">{form.model}</p>
              ) : (
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="e.g. gpt-4o"
                  className="w-full px-3 py-2 rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-zinc-800 text-azure-text-primary dark:text-matrix-text text-sm focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-azure-text-secondary dark:text-matrix-dim mb-1">Input price / 1M tokens ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  value={form.input_price_per_1m}
                  onChange={(e) => setForm({ ...form, input_price_per_1m: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-zinc-800 text-azure-text-primary dark:text-matrix-text text-sm focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-azure-text-secondary dark:text-matrix-dim mb-1">Output price / 1M tokens ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  value={form.output_price_per_1m}
                  onChange={(e) => setForm({ ...form, output_price_per_1m: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-zinc-800 text-azure-text-primary dark:text-matrix-text text-sm focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-dim text-sm hover:bg-azure-surface dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.provider.trim() || !form.model.trim()}
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
            <DialogTitle>Delete Pricing Entry</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <p className="text-sm text-azure-text-primary dark:text-matrix-text">
              Are you sure you want to delete the pricing for{' '}
              <span className="font-mono font-semibold text-azure-primary dark:text-matrix-highlight">
                {deleteTarget?.provider}/{deleteTarget?.model}
              </span>
              ? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-dim text-sm hover:bg-azure-surface dark:hover:bg-zinc-800 transition-colors"
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
