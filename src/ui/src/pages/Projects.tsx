import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { motion } from 'framer-motion';
import { FolderOpen, Plus, Pencil, Trash2, Terminal } from 'lucide-react';
import { projectsService, type Project, type CreateProjectInput } from '../services/projects';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/Dialog';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCommands(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function stringifyCommands(cmds: string[]): string {
  return cmds.join(', ');
}

const emptyForm = (): CreateProjectInput => ({
  name: '',
  path: '',
  description: '',
  git_remote: '',
  allowed_commands: [],
});

// ─── Projects Page ────────────────────────────────────────────────────────────

export function Projects() {
  const { data: projects = [], isLoading } = useSWR('/api/projects', () =>
    projectsService.list(),
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [form, setForm] = useState<CreateProjectInput>(emptyForm());
  const [commandsRaw, setCommandsRaw] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setCommandsRaw('');
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditTarget(project);
    setForm({
      name: project.name,
      path: project.path,
      description: project.description ?? '',
      git_remote: project.git_remote ?? '',
      allowed_commands: project.allowed_commands,
    });
    setCommandsRaw(stringifyCommands(project.allowed_commands));
    setError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.path.trim()) {
      setError('Name and path are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, allowed_commands: parseCommands(commandsRaw) };
      if (editTarget) {
        await projectsService.update(editTarget.id, payload);
        notify('success', 'Project updated.');
      } else {
        await projectsService.create(payload);
        notify('success', 'Project created.');
      }
      mutate('/api/projects');
      setDialogOpen(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save project.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await projectsService.delete(deleteTarget.id);
      mutate('/api/projects');
      setDeleteTarget(null);
      notify('success', 'Project removed.');
    } catch {
      notify('error', 'Failed to delete project.');
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-azure-primary dark:text-matrix-highlight" />
          <div>
            <h1 className="text-2xl font-bold text-azure-text-primary dark:text-matrix-highlight">
              Projects
            </h1>
            <p className="text-sm text-azure-text-secondary dark:text-matrix-dim mt-0.5">
              Register codebases for agents to work within.
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-azure-primary dark:bg-matrix-primary text-white dark:text-matrix-highlight text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Project
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
      <motion.div
        variants={item}
        className="rounded-lg border border-azure-border dark:border-matrix-primary overflow-hidden"
      >
        <table className="w-full text-sm">
          <thead className="bg-azure-surface dark:bg-zinc-900 border-b border-azure-border dark:border-matrix-primary">
            <tr>
              {['Name', 'Path', 'Commands', 'Actions'].map((h) => (
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
            {isLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-azure-text-secondary dark:text-matrix-dim"
                >
                  Loading projects...
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-azure-text-secondary dark:text-matrix-dim"
                >
                  No projects yet. Click "New Project" to register a codebase.
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-azure-border dark:border-matrix-primary/30 hover:bg-azure-surface/50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-azure-text-primary dark:text-matrix-highlight">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="text-xs text-azure-text-secondary dark:text-matrix-dim mt-0.5">
                        {project.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-azure-text-primary dark:text-matrix-text">
                    {project.path}
                  </td>
                  <td className="px-4 py-3">
                    {project.allowed_commands.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-azure-border dark:border-matrix-primary/50 text-azure-text-secondary dark:text-matrix-dim font-mono">
                        <Terminal className="w-3 h-3" />
                        {project.allowed_commands.join(', ')}
                      </span>
                    ) : (
                      <span className="text-xs text-azure-text-muted dark:text-matrix-secondary italic">
                        all blocked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(project)}
                        className="p-1.5 rounded hover:bg-azure-border dark:hover:bg-matrix-primary/30 text-azure-text-secondary dark:text-matrix-dim hover:text-azure-primary dark:hover:text-matrix-highlight transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(project)}
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Project' : 'New Project'}</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            {error && (
              <p className="px-3 py-2 rounded-lg text-sm border bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-400">
                {error}
              </p>
            )}

            {[
              { label: 'Name *', key: 'name' as const, placeholder: 'My Project' },
              { label: 'Path *', key: 'path' as const, placeholder: '/home/user/project' },
              { label: 'Description', key: 'description' as const, placeholder: 'What is this project about?' },
              { label: 'Git Remote', key: 'git_remote' as const, placeholder: 'https://github.com/...' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-azure-text-secondary dark:text-matrix-dim mb-1">
                  {label}
                </label>
                <input
                  type="text"
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-zinc-800 text-azure-text-primary dark:text-matrix-text text-sm focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight"
                />
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-azure-text-secondary dark:text-matrix-dim mb-1">
                Allowed Commands{' '}
                <span className="font-normal text-azure-text-muted dark:text-matrix-secondary">
                  (comma-separated — empty = block all)
                </span>
              </label>
              <input
                type="text"
                value={commandsRaw}
                onChange={(e) => setCommandsRaw(e.target.value)}
                placeholder="npm, git, python"
                className="w-full px-3 py-2 rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-zinc-800 text-azure-text-primary dark:text-matrix-text text-sm font-mono focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 rounded-lg border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-dim text-sm hover:bg-azure-surface dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-azure-primary dark:bg-matrix-primary text-white dark:text-matrix-highlight text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Project</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <p className="text-sm text-azure-text-primary dark:text-matrix-text">
              Remove{' '}
              <span className="font-mono font-semibold text-azure-primary dark:text-matrix-highlight">
                {deleteTarget?.name}
              </span>{' '}
              from the database? This does not delete any files on disk.
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
                Remove
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
