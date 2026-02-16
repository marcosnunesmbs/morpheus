import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { mcpService } from '../services/mcp';
import type { MCPProbeResult, MCPServerConfig, MCPServerRecord } from '../types/mcp';
import { MCPServerForm } from '../components/mcp/MCPServerForm';
import { MCPServerCard } from '../components/mcp/MCPServerCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/Dialog';

export const MCPManager = () => {
  const { data, error, mutate, isLoading } = useSWR('/api/mcp/servers', () => mcpService.fetchServers());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'stdio' | 'http'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MCPServerRecord | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MCPServerRecord | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [probeResults, setProbeResults] = useState<Record<string, MCPProbeResult>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  const servers = data?.servers ?? [];

  const filtered = useMemo(() => {
    return servers.filter((server) => {
      const matchesQuery = server.name.toLowerCase().includes(query.toLowerCase());
      const matchesTransport = filter === 'all' || server.config.transport === filter;
      return matchesQuery && matchesTransport;
    });
  }, [servers, query, filter]);

  const handleCreate = () => {
    setEditTarget(null);
    setIsModalOpen(true);
  };

  const handleEdit = (server: MCPServerRecord) => {
    setEditTarget(server);
    setIsModalOpen(true);
  };

  const handleSubmit = async (name: string, config: MCPServerConfig) => {
    try {
      if (editTarget) {
        await mcpService.updateServer(editTarget.name, config);
      } else {
        await mcpService.addServer(name, config);
      }

      setIsModalOpen(false);
      setEditTarget(null);
      await mutate();
      setNotification({ type: 'success', message: 'MCPs saved successfully. Restart MCPs for changes to take effect.' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to save MCP server.' });
    }
  };

  const handleDelete = async (server: MCPServerRecord) => {
    setDeleteTarget(server);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      try {
        await mcpService.deleteServer(deleteTarget.name);
        await mutate();
        setIsDeleteModalOpen(false);
        setDeleteTarget(null);
        setNotification({ type: 'success', message: 'MCPs saved successfully. Restart MCPs for changes to take effect.' });
      } catch (err: any) {
        setNotification({ type: 'error', message: err.message || 'Failed to delete MCP server.' });
      }
    }
  };

  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      const result = await mcpService.fetchStatus();
      const map: Record<string, MCPProbeResult> = {};
      for (const r of result.servers) {
        map[r.name] = r;
      }
      setProbeResults(map);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to check MCP status.' });
    } finally {
      setIsChecking(false);
    }
  };

  const handleReload = async () => {
    setIsReloading(true);
    try {
      await mcpService.reloadTools();
      setNotification({ type: 'success', message: 'MCP tools reloaded successfully.' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to reload MCP tools.' });
    } finally {
      setIsReloading(false);
    }
  };

  const handleToggle = async (server: MCPServerRecord, enabled: boolean) => {
    try {
      await mcpService.toggleServer(server.name, enabled);
      await mutate();
      setNotification({ type: 'success', message: 'MCPs saved successfully. Restart MCPs for changes to take effect.' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to toggle MCP server.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-azure-primary dark:text-matrix-highlight">MCP Servers</h1>
          <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary">
            Manage MCP servers stored in mcps.json.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isChecking}
            className="rounded-md border border-azure-border px-4 py-2 text-sm font-semibold text-azure-text-primary shadow hover:border-azure-primary hover:text-azure-primary disabled:opacity-50 dark:border-matrix-primary dark:text-matrix-secondary hover:dark:border-matrix-highlight hover:dark:text-matrix-highlight"
            onClick={handleCheckStatus}
          >
            {isChecking ? 'Checking…' : 'Check Status'}
          </button>
          <button
            type="button"
            disabled={isReloading}
            className="rounded-md border border-azure-border px-4 py-2 text-sm font-semibold text-azure-text-primary shadow hover:border-azure-primary hover:text-azure-primary disabled:opacity-50 dark:border-matrix-primary dark:text-matrix-secondary hover:dark:border-matrix-highlight hover:dark:text-matrix-highlight"
            onClick={handleReload}
          >
            {isReloading ? 'Reloading…' : 'Reload MCPs'}
          </button>
          <button
            type="button"
            className="rounded-md bg-azure-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-azure-secondary dark:bg-matrix-highlight dark:text-matrix-bg hover:dark:bg-matrix-secondary"
            onClick={handleCreate}
          >
            Add Server
          </button>
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded border ${
          notification.type === 'success' ? 'border-azure-primary text-azure-primary bg-azure-primary/10 dark:border-matrix-highlight dark:text-matrix-highlight dark:bg-matrix-highlight/10' : 'border-red-500 text-red-500 bg-red-900/10'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <input
          className="w-full rounded-md border border-azure-border bg-azure-surface px-3 py-2 text-sm text-azure-text-primary shadow-sm focus:border-azure-primary focus:outline-none dark:border-matrix-primary dark:bg-zinc-950 dark:text-matrix-highlight"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name"
        />
        <select
          className="rounded-md border border-azure-border bg-azure-surface px-3 py-2 text-sm text-azure-text-primary shadow-sm focus:border-azure-primary focus:outline-none dark:border-matrix-primary dark:bg-zinc-950 dark:text-matrix-highlight"
          value={filter}
          onChange={(event) => setFilter(event.target.value as 'all' | 'stdio' | 'http')}
        >
          <option value="all">All</option>
          <option value="stdio">stdio</option>
          <option value="http">http</option>
        </select>
      </div>

      {isLoading && <div className="text-sm text-azure-text-secondary dark:text-matrix-secondary">Loading MCP servers...</div>}
      {error && <div className="text-sm text-red-600 dark:text-red-400">Failed to load MCP servers.</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-azure-border bg-azure-surface/60 p-6 text-center text-sm text-azure-text-secondary dark:border-matrix-primary dark:bg-zinc-950/60 dark:text-matrix-secondary">
          No MCP servers found. Add a server to get started.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((server) => (
          <MCPServerCard
            key={`${server.name}-${server.enabled ? 'on' : 'off'}`}
            server={server}
            probeResult={probeResults[server.name]}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggle={handleToggle}
          />
        ))}
      </div>

      <MCPServerForm
        open={isModalOpen}
        mode={editTarget ? 'edit' : 'create'}
        initial={editTarget ?? undefined}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary">
              Are you sure you want to delete the MCP server <span className="font-semibold text-azure-text-primary dark:text-matrix-highlight">"{deleteTarget?.name}"</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-azure-border px-4 py-2 text-sm text-azure-text-primary hover:border-azure-primary hover:text-azure-primary dark:border-matrix-primary dark:text-matrix-secondary hover:dark:border-matrix-highlight hover:dark:text-matrix-highlight"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-400 dark:bg-red-600 hover:dark:bg-red-500"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};