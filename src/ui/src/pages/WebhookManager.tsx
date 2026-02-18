import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  Webhook as WebhookIcon,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Bell,
  Terminal,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { webhookService, type Webhook, type CreateWebhookPayload, type NotificationChannel } from '../services/webhooks';
import { Dialog, DialogHeader, DialogTitle } from '../components/Dialog';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const CHANNELS: NotificationChannel[] = ['ui', 'telegram'];

const emptyForm = (): CreateWebhookPayload => ({
  name: '',
  prompt: '',
  notification_channels: ['ui'],
});

export const WebhookManager = () => {
  const { data: webhooks = [], mutate } = useSWR(
    '/webhooks',
    () => webhookService.list(),
    { refreshInterval: 10_000 },
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Webhook | null>(null);
  const [form, setForm] = useState<CreateWebhookPayload>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const notify = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleNew = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleEdit = (wh: Webhook) => {
    setEditTarget(wh);
    setForm({
      name: wh.name,
      prompt: wh.prompt,
      notification_channels: wh.notification_channels,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const validateSlug = (value: string) => /^[a-z0-9-_]+$/.test(value);

  const handleSave = async () => {
    if (!form.name.trim() || !form.prompt.trim()) return;
    if (!validateSlug(form.name)) {
      setFormError('Name must only contain lowercase letters, numbers, hyphens (-) and underscores (_).');
      return;
    }
    if (form.notification_channels.length === 0) {
      setFormError('Select at least one notification channel.');
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      if (editTarget) {
        await webhookService.update(editTarget.id, form);
        notify('success', 'Webhook updated.');
      } else {
        await webhookService.create(form);
        notify('success', 'Webhook created.');
      }
      await mutate();
      setIsModalOpen(false);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save webhook.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (wh: Webhook) => {
    try {
      await webhookService.update(wh.id, { enabled: !wh.enabled });
      await mutate();
    } catch {
      notify('error', 'Failed to toggle webhook.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await webhookService.delete(deleteTarget.id);
      await mutate();
      setDeleteTarget(null);
      notify('success', 'Webhook deleted.');
    } catch {
      notify('error', 'Failed to delete webhook.');
    }
  };

  const getTriggerUrl = (name: string) =>
    `${window.location.origin}/api/webhooks/trigger/${name}`;

  const getCurlExample = (wh: Webhook) =>
    `curl -X POST ${getTriggerUrl(wh.name)} \\\n  -H "x-api-key: ${wh.api_key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"event":"your_payload"}'`;

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleChannel = (channel: NotificationChannel) => {
    const has = form.notification_channels.includes(channel);
    setForm({
      ...form,
      notification_channels: has
        ? form.notification_channels.filter((c) => c !== channel)
        : [...form.notification_channels, channel],
    });
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <WebhookIcon className="w-6 h-6 text-azure-primary dark:text-matrix-highlight" />
          <div>
            <h1 className="text-2xl font-bold text-azure-text-primary dark:text-matrix-highlight">
              Webhooks
            </h1>
            <p className="text-sm text-azure-text-secondary dark:text-matrix-dim mt-0.5">
              Trigger Oracle agent tasks from external events.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/notifications"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-azure-border dark:border-matrix-primary text-sm text-azure-text-secondary dark:text-matrix-dim hover:bg-azure-surface dark:hover:bg-zinc-800 transition-colors"
          >
            <Bell className="w-4 h-4" />
            Notifications
          </Link>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-azure-primary dark:bg-matrix-primary text-white dark:text-matrix-highlight text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New Webhook
          </button>
        </div>
      </motion.div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`px-4 py-3 rounded-lg text-sm font-medium border ${
            toast.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-400'
          }`}
        >
          {toast.message}
        </motion.div>
      )}

      {/* Webhooks table */}
      <motion.div
        variants={item}
        className="rounded-lg border border-azure-border dark:border-matrix-primary overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-azure-surface dark:bg-zinc-900 border-b border-azure-border dark:border-matrix-primary">
              <tr>
                {['Name', 'API Key', 'Channels', 'Triggers', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-semibold text-azure-text-secondary dark:text-matrix-dim"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {webhooks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-azure-text-secondary dark:text-matrix-dim">
                    No webhooks yet.{' '}
                    <button
                      onClick={handleNew}
                      className="underline text-azure-primary dark:text-matrix-highlight"
                    >
                      Create one
                    </button>
                  </td>
                </tr>
              ) : (
                webhooks.map((wh) => (
                  <tr
                    key={wh.id}
                    className="border-b border-azure-border dark:border-matrix-primary/30 hover:bg-azure-surface/50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-azure-text-primary dark:text-matrix-text font-medium">
                        {wh.name}
                      </span>
                    </td>

                    {/* API Key + Copy curl */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-azure-text-secondary dark:text-matrix-dim truncate max-w-[140px]">
                          {wh.api_key.slice(0, 16)}…
                        </code>
                        <button
                          onClick={() => copyToClipboard(getCurlExample(wh), `curl-${wh.id}`)}
                          className="p-1 rounded hover:bg-azure-border dark:hover:bg-matrix-primary/30 text-azure-text-secondary dark:text-matrix-dim"
                          title="Copy curl example"
                        >
                          {copiedId === `curl-${wh.id}` ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Terminal className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(wh.api_key, `key-${wh.id}`)}
                          className="p-1 rounded hover:bg-azure-border dark:hover:bg-matrix-primary/30 text-azure-text-secondary dark:text-matrix-dim"
                          title="Copy API key"
                        >
                          {copiedId === `key-${wh.id}` ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Channels */}
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {wh.notification_channels.map((ch) => (
                          <span
                            key={ch}
                            className="px-2 py-0.5 text-xs rounded bg-azure-border dark:bg-matrix-primary/20 text-azure-text-secondary dark:text-matrix-dim capitalize"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Trigger count */}
                    <td className="px-4 py-3 text-azure-text-primary dark:text-matrix-text">
                      {wh.trigger_count}
                    </td>

                    {/* Enabled toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(wh)}
                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${
                          wh.enabled
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {wh.enabled ? (
                          <><ToggleRight className="w-3.5 h-3.5" /> Enabled</>
                        ) : (
                          <><ToggleLeft className="w-3.5 h-3.5" /> Disabled</>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(wh)}
                          title="Edit"
                          className="p-1.5 rounded hover:bg-azure-border dark:hover:bg-matrix-primary/30 text-azure-text-secondary dark:text-matrix-dim hover:text-azure-primary dark:hover:text-matrix-highlight transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(wh)}
                          title="Delete"
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-azure-text-secondary dark:text-matrix-dim hover:text-red-600 dark:hover:text-red-400 transition-colors"
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
        </div>
      </motion.div>

      {/* Create / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-azure-text-primary dark:text-matrix-highlight">
            {editTarget ? 'Edit Webhook' : 'New Webhook'}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-azure-text-secondary dark:text-matrix-dim mb-1">
              Name <span className="text-azure-text-muted dark:text-matrix-dim/60 font-normal">(slug — used in URL)</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s+/g, '-') });
                setFormError(null);
              }}
              placeholder="e.g. deploy-done, github-issue-opened"
              disabled={!!editTarget}
              className="w-full px-3 py-2 rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-zinc-800 text-azure-text-primary dark:text-matrix-text text-sm focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {form.name && (
              <p className="mt-1 text-xs text-azure-text-secondary dark:text-matrix-dim">
                Trigger URL:{' '}
                <code className="font-mono text-azure-primary dark:text-matrix-highlight">
                  POST /api/webhooks/trigger/{form.name}
                </code>
              </p>
            )}
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-azure-text-secondary dark:text-matrix-dim mb-1">
              Agent Prompt
            </label>
            <textarea
              rows={5}
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              placeholder="Describe what Apoc should do when this webhook fires. The received payload will be appended automatically."
              className="w-full px-3 py-2 rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-zinc-800 text-azure-text-primary dark:text-matrix-text text-sm focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight resize-none"
            />
          </div>

          {/* Channels */}
          <div>
            <label className="block text-sm font-medium text-azure-text-secondary dark:text-matrix-dim mb-2">
              Notification Channels
            </label>
            <div className="flex gap-4">
              {CHANNELS.map((ch) => (
                <label key={ch} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.notification_channels.includes(ch)}
                    onChange={() => toggleChannel(ch)}
                    className="rounded border-azure-border dark:border-matrix-primary accent-azure-primary dark:accent-matrix-highlight"
                  />
                  <span className="text-sm text-azure-text-primary dark:text-matrix-text capitalize">
                    {ch}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Error */}
          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2">
              {formError}
            </p>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-dim text-sm hover:bg-azure-surface dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.prompt.trim() || form.notification_channels.length === 0}
              className="px-4 py-2 rounded-lg bg-azure-primary dark:bg-matrix-primary text-white dark:text-matrix-highlight text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Saving…' : editTarget ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle className="text-azure-text-primary dark:text-matrix-highlight">
            Delete Webhook
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <p className="text-sm text-azure-text-primary dark:text-matrix-text">
            Delete{' '}
            <span className="font-semibold font-mono dark:text-matrix-highlight">
              {deleteTarget?.name}
            </span>
            ? This also removes all associated notifications and cannot be undone.
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
      </Dialog>
    </motion.div>
  );
};
