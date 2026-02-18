import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { FolderOpen, Plus, Pencil, Trash2, X, Check, Terminal } from 'lucide-react';
import { projectsService, type Project, type CreateProjectInput } from '../services/projects';

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

// ─── Empty form state ─────────────────────────────────────────────────────────

const emptyForm = (): CreateProjectInput => ({
  name: '',
  path: '',
  description: '',
  git_remote: '',
  allowed_commands: [],
});

// ─── ProjectDialog ────────────────────────────────────────────────────────────

interface ProjectDialogProps {
  initial?: Project;
  onSave: (data: CreateProjectInput) => Promise<void>;
  onClose: () => void;
}

function ProjectDialog({ initial, onSave, onClose }: ProjectDialogProps) {
  const [form, setForm] = useState<CreateProjectInput>(
    initial
      ? {
          name: initial.name,
          path: initial.path,
          description: initial.description ?? '',
          git_remote: initial.git_remote ?? '',
          allowed_commands: initial.allowed_commands,
        }
      : emptyForm(),
  );
  const [commandsRaw, setCommandsRaw] = useState(
    stringifyCommands(initial?.allowed_commands ?? []),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.path.trim()) {
      setError('Name and path are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, allowed_commands: parseCommands(commandsRaw) });
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-green-500/30 rounded-lg w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-green-400 font-mono">
            {initial ? 'Edit Project' : 'New Project'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-red-400 text-sm font-mono bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
              {error}
            </p>
          )}

          {[
            { label: 'Name *', key: 'name', placeholder: 'My Project' },
            { label: 'Path *', key: 'path', placeholder: '/home/user/project' },
            { label: 'Description', key: 'description', placeholder: 'What is this project about?' },
            { label: 'Git Remote', key: 'git_remote', placeholder: 'https://github.com/...' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-gray-400 font-mono mb-1">{label}</label>
              <input
                type="text"
                value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-black border border-green-500/30 rounded px-3 py-2 text-green-300 text-sm font-mono focus:outline-none focus:border-green-400"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs text-gray-400 font-mono mb-1">
              Allowed Commands{' '}
              <span className="text-gray-500">(comma-separated, empty = block all)</span>
            </label>
            <input
              type="text"
              value={commandsRaw}
              onChange={(e) => setCommandsRaw(e.target.value)}
              placeholder="npm, git, python"
              className="w-full bg-black border border-green-500/30 rounded px-3 py-2 text-green-300 text-sm font-mono focus:outline-none focus:border-green-400"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-black font-bold rounded text-sm font-mono transition-colors"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-600 hover:border-gray-400 text-gray-300 rounded text-sm font-mono transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Projects Page ────────────────────────────────────────────────────────────

export function Projects() {
  const { data: projects = [], isLoading } = useSWR('/api/projects', () =>
    projectsService.list(),
  );
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; project?: Project } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleCreate = async (data: CreateProjectInput) => {
    await projectsService.create(data);
    mutate('/api/projects');
  };

  const handleEdit = async (data: CreateProjectInput) => {
    if (!dialog?.project) return;
    await projectsService.update(dialog.project.id, data);
    mutate('/api/projects');
  };

  const handleDelete = async (id: string) => {
    await projectsService.delete(id);
    setDeleteConfirm(null);
    mutate('/api/projects');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-green-400" />
          <h1 className="text-2xl font-bold text-green-400 font-mono">Projects</h1>
        </div>
        <button
          onClick={() => setDialog({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-black font-bold rounded text-sm font-mono transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-gray-400 font-mono text-sm">Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="border border-green-500/20 rounded-lg p-8 text-center">
          <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-mono">No projects yet.</p>
          <p className="text-gray-600 font-mono text-sm mt-1">
            Create a project to start delegating tasks to Apoc.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="border border-green-500/20 rounded-lg p-4 bg-gray-900/50 hover:border-green-500/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-green-300 font-bold font-mono">{project.name}</h3>
                    {project.allowed_commands.length > 0 && (
                      <span className="text-xs bg-green-900/40 text-green-400 border border-green-500/30 rounded px-2 py-0.5 font-mono flex items-center gap-1">
                        <Terminal className="w-3 h-3" />
                        {project.allowed_commands.length} cmd
                        {project.allowed_commands.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm font-mono truncate">{project.path}</p>
                  {project.description && (
                    <p className="text-gray-500 text-xs font-mono mt-1">{project.description}</p>
                  )}
                  {project.allowed_commands.length > 0 && (
                    <p className="text-gray-600 text-xs font-mono mt-1">
                      Commands: {project.allowed_commands.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setDialog({ mode: 'edit', project })}
                    className="p-2 text-gray-400 hover:text-green-400 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {deleteConfirm === project.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded font-mono"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded font-mono"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(project.id)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      {dialog && (
        <ProjectDialog
          initial={dialog.mode === 'edit' ? dialog.project : undefined}
          onSave={dialog.mode === 'create' ? handleCreate : handleEdit}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
