import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { httpClient } from '../services/httpClient';
import { Database, Plus, RefreshCw, Trash2, Wifi, WifiOff, ChevronDown, ChevronRight, X } from 'lucide-react';

interface DatabaseRecord {
  id: number;
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';
  host: string | null;
  port: number | null;
  database_name: string | null;
  username: string | null;
  password: string | null;
  connection_string: string | null;
  schema_json: string | null;
  schema_updated_at: number | null;
  created_at: number;
  updated_at: number;
}

interface DatabaseFormData {
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';
  host: string;
  port: string;
  database_name: string;
  username: string;
  password: string;
  connection_string: string;
}

const DEFAULT_PORTS: Record<string, number> = {
  postgresql: 5432,
  mysql: 3306,
  mongodb: 27017,
  sqlite: 0,
};

const EMPTY_FORM: DatabaseFormData = {
  name: '',
  type: 'postgresql',
  host: '',
  port: '',
  database_name: '',
  username: '',
  password: '',
  connection_string: '',
};

async function fetchDatabases(): Promise<DatabaseRecord[]> {
  return httpClient.get<DatabaseRecord[]>('/trinity/databases');
}

export function TrinityDatabases() {
  const { data: databases, error } = useSWR('/trinity/databases', fetchDatabases, { refreshInterval: 30000 });
  const [showModal, setShowModal] = useState(false);
  const [editingDb, setEditingDb] = useState<DatabaseRecord | null>(null);
  const [form, setForm] = useState<DatabaseFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedSchema, setExpandedSchema] = useState<Record<number, boolean>>({});
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, boolean | null>>({});
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [useConnectionString, setUseConnectionString] = useState(false);

  const openCreate = () => {
    setEditingDb(null);
    setForm(EMPTY_FORM);
    setUseConnectionString(false);
    setSaveError(null);
    setShowModal(true);
  };

  const openEdit = (db: DatabaseRecord) => {
    setEditingDb(db);
    setForm({
      name: db.name,
      type: db.type,
      host: db.host || '',
      port: db.port ? String(db.port) : '',
      database_name: db.database_name || '',
      username: db.username || '',
      password: '',
      connection_string: '',
    });
    setUseConnectionString(!!db.connection_string);
    setSaveError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload: any = {
        name: form.name,
        type: form.type,
      };

      if (useConnectionString) {
        payload.connection_string = form.connection_string || null;
      } else {
        payload.host = form.host || null;
        payload.port = form.port ? parseInt(form.port) : null;
        payload.database_name = form.database_name || null;
        payload.username = form.username || null;
        payload.password = form.password || null;
      }

      if (editingDb) {
        await httpClient.put(`/trinity/databases/${editingDb.id}`, payload);
      } else {
        await httpClient.post('/trinity/databases', payload);
      }

      await mutate('/trinity/databases');
      setShowModal(false);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save database');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this database registration? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await httpClient.delete(`/trinity/databases/${id}`);
      await mutate('/trinity/databases');
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      const result = await httpClient.post<{ success: boolean }>(`/trinity/databases/${id}/test`, {});
      setTestResults((prev) => ({ ...prev, [id]: result.success }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: false }));
    } finally {
      setTestingId(null);
    }
  };

  const handleRefreshSchema = async (id: number) => {
    setRefreshingId(id);
    try {
      await httpClient.post(`/trinity/databases/${id}/refresh-schema`, {});
      await mutate('/trinity/databases');
    } catch (err: any) {
      alert(`Schema refresh failed: ${err.message}`);
    } finally {
      setRefreshingId(null);
    }
  };

  const toggleSchema = (id: number) => {
    setExpandedSchema((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleTypeChange = (type: DatabaseFormData['type']) => {
    setForm((f) => ({
      ...f,
      type,
      port: DEFAULT_PORTS[type] ? String(DEFAULT_PORTS[type]) : '',
    }));
  };

  if (error) {
    return <div className="p-8 text-red-500">Failed to load databases: {error.message}</div>;
  }

  const inputClass =
    'w-full px-3 py-2 bg-azure-surface dark:bg-black border border-azure-border dark:border-matrix-primary rounded text-azure-text-primary dark:text-matrix-secondary font-mono text-sm focus:outline-none focus:border-azure-primary dark:focus:border-matrix-highlight';
  const labelClass = 'block text-xs font-medium text-azure-text-secondary dark:text-matrix-secondary mb-1';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-azure-primary dark:text-matrix-highlight" />
          <h1 className="text-2xl font-bold text-azure-primary dark:text-matrix-highlight">
            Trinity Databases
          </h1>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-azure-primary text-white rounded hover:bg-azure-active dark:bg-matrix-highlight dark:text-black dark:hover:bg-matrix-highlight/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Register Database
        </button>
      </div>

      <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary">
        Register databases for Trinity to access. Trinity can interpret natural language queries and execute them against registered databases.
      </p>

      {/* Database list */}
      {!databases ? (
        <div className="text-azure-text-secondary dark:text-matrix-secondary">Loading...</div>
      ) : databases.length === 0 ? (
        <div className="border border-azure-border dark:border-matrix-primary rounded p-8 text-center text-azure-text-secondary dark:text-matrix-secondary">
          <Database className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No databases registered</p>
          <p className="text-sm mt-1 opacity-70">Click "Register Database" to add your first database.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {databases.map((db) => {
            const schema = db.schema_json ? JSON.parse(db.schema_json) : null;
            const tables: string[] = schema?.tables?.map((t: any) => t.name) ?? [];
            const testResult = testResults[db.id];
            const isExpanded = expandedSchema[db.id];

            return (
              <div
                key={db.id}
                className="border border-azure-border dark:border-matrix-primary rounded-lg overflow-hidden"
              >
                {/* Header */}
                <div className="bg-azure-surface dark:bg-black/50 px-4 py-3 flex items-center gap-3">
                  <Database className="w-5 h-5 text-azure-primary dark:text-matrix-highlight flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-azure-text-primary dark:text-matrix-highlight truncate">
                        {db.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-secondary uppercase flex-shrink-0">
                        {db.type}
                      </span>
                      {testResult === true && (
                        <span className="flex items-center gap-1 text-xs text-green-500">
                          <Wifi className="w-3 h-3" /> Connected
                        </span>
                      )}
                      {testResult === false && (
                        <span className="flex items-center gap-1 text-xs text-red-500">
                          <WifiOff className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-azure-text-secondary dark:text-matrix-secondary truncate mt-0.5">
                      {db.host ? `${db.host}:${db.port}/${db.database_name}` : db.database_name || 'connection string configured'}
                      {tables.length > 0 && (
                        <span className="ml-2 opacity-70">
                          · {tables.length} table{tables.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {db.schema_updated_at && (
                        <span className="ml-2 opacity-50">
                          · schema {new Date(db.schema_updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleTest(db.id)}
                      disabled={testingId === db.id}
                      title="Test connection"
                      className="p-1.5 rounded hover:bg-azure-hover dark:hover:bg-matrix-primary/30 text-azure-text-secondary dark:text-matrix-secondary transition-colors"
                    >
                      {testingId === db.id ? (
                        <Wifi className="w-4 h-4 animate-pulse" />
                      ) : (
                        <Wifi className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRefreshSchema(db.id)}
                      disabled={refreshingId === db.id}
                      title="Refresh schema"
                      className="p-1.5 rounded hover:bg-azure-hover dark:hover:bg-matrix-primary/30 text-azure-text-secondary dark:text-matrix-secondary transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshingId === db.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => openEdit(db)}
                      title="Edit"
                      className="p-1.5 rounded hover:bg-azure-hover dark:hover:bg-matrix-primary/30 text-azure-text-secondary dark:text-matrix-secondary transition-colors text-xs font-medium px-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(db.id)}
                      disabled={deletingId === db.id}
                      title="Delete"
                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {schema && (
                      <button
                        onClick={() => toggleSchema(db.id)}
                        title={isExpanded ? 'Hide schema' : 'Show schema'}
                        className="p-1.5 rounded hover:bg-azure-hover dark:hover:bg-matrix-primary/30 text-azure-text-secondary dark:text-matrix-secondary transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Schema viewer */}
                {isExpanded && schema && (
                  <div className="border-t border-azure-border dark:border-matrix-primary px-4 py-3 bg-azure-bg dark:bg-black/20">
                    <div className="text-xs font-medium text-azure-text-secondary dark:text-matrix-secondary mb-2">
                      Schema — {tables.length} table{tables.length !== 1 ? 's' : ''}
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {schema.tables?.map((table: any) => (
                        <div key={table.name} className="text-xs">
                          <div className="font-bold text-azure-primary dark:text-matrix-highlight mb-1">
                            {table.name}
                          </div>
                          <div className="pl-3 space-y-0.5">
                            {table.columns?.map((col: any) => (
                              <div key={col.name} className="text-azure-text-secondary dark:text-matrix-secondary font-mono">
                                <span className="text-azure-text-primary dark:text-matrix-secondary">{col.name}</span>
                                <span className="opacity-50 ml-2">{col.type}</span>
                                {col.nullable === false && (
                                  <span className="ml-1 opacity-40 text-xs">NOT NULL</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-azure-surface dark:bg-black border border-azure-border dark:border-matrix-primary rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-azure-border dark:border-matrix-primary">
              <h2 className="text-lg font-bold text-azure-text-primary dark:text-matrix-highlight">
                {editingDb ? 'Edit Database' : 'Register Database'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-azure-text-secondary dark:text-matrix-secondary hover:text-azure-text-primary dark:hover:text-matrix-highlight">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className={labelClass}>Name *</label>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="My Production DB"
                />
              </div>

              <div>
                <label className={labelClass}>Type *</label>
                <select
                  className={inputClass}
                  value={form.type}
                  onChange={(e) => handleTypeChange(e.target.value as any)}
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL / MariaDB</option>
                  <option value="sqlite">SQLite</option>
                  <option value="mongodb">MongoDB</option>
                </select>
              </div>

              {/* Connection method toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setUseConnectionString(false)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    !useConnectionString
                      ? 'border-azure-primary dark:border-matrix-highlight bg-azure-primary/10 dark:bg-matrix-highlight/10 text-azure-primary dark:text-matrix-highlight'
                      : 'border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-secondary'
                  }`}
                >
                  Individual fields
                </button>
                <button
                  type="button"
                  onClick={() => setUseConnectionString(true)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    useConnectionString
                      ? 'border-azure-primary dark:border-matrix-highlight bg-azure-primary/10 dark:bg-matrix-highlight/10 text-azure-primary dark:text-matrix-highlight'
                      : 'border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-secondary'
                  }`}
                >
                  Connection string
                </button>
              </div>

              {useConnectionString ? (
                <div>
                  <label className={labelClass}>Connection String</label>
                  <input
                    className={inputClass}
                    type="password"
                    value={form.connection_string}
                    onChange={(e) => setForm((f) => ({ ...f, connection_string: e.target.value }))}
                    placeholder={
                      form.type === 'postgresql'
                        ? 'postgresql://user:pass@host:5432/dbname'
                        : form.type === 'mysql'
                        ? 'mysql://user:pass@host:3306/dbname'
                        : form.type === 'mongodb'
                        ? 'mongodb://user:pass@host:27017/dbname'
                        : '/path/to/database.db'
                    }
                  />
                  <p className="text-xs text-azure-text-secondary dark:text-matrix-secondary mt-1">
                    Stored encrypted with AES-256-GCM. Requires MORPHEUS_SECRET env var.
                  </p>
                </div>
              ) : (
                <>
                  {form.type !== 'sqlite' && (
                    <>
                      <div>
                        <label className={labelClass}>Host</label>
                        <input
                          className={inputClass}
                          value={form.host}
                          onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                          placeholder="localhost"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Port</label>
                        <input
                          className={inputClass}
                          type="number"
                          value={form.port}
                          onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                          placeholder={String(DEFAULT_PORTS[form.type] || '')}
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className={labelClass}>
                      {form.type === 'sqlite' ? 'File Path' : 'Database Name'}
                    </label>
                    <input
                      className={inputClass}
                      value={form.database_name}
                      onChange={(e) => setForm((f) => ({ ...f, database_name: e.target.value }))}
                      placeholder={form.type === 'sqlite' ? '/path/to/database.db' : 'mydb'}
                    />
                  </div>
                  {form.type !== 'sqlite' && (
                    <>
                      <div>
                        <label className={labelClass}>Username</label>
                        <input
                          className={inputClass}
                          value={form.username}
                          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                          placeholder="postgres"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Password {editingDb && <span className="opacity-60">(leave blank to keep existing)</span>}
                        </label>
                        <input
                          className={inputClass}
                          type="password"
                          value={form.password}
                          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                          placeholder="••••••••"
                        />
                        <p className="text-xs text-azure-text-secondary dark:text-matrix-secondary mt-1">
                          Stored encrypted with AES-256-GCM. Requires MORPHEUS_SECRET env var.
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              {saveError && (
                <div className="text-sm text-red-500 border border-red-500/30 bg-red-500/10 rounded px-3 py-2">
                  {saveError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-azure-border dark:border-matrix-primary">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-azure-text-secondary dark:text-matrix-secondary border border-azure-border dark:border-matrix-primary rounded hover:bg-azure-hover dark:hover:bg-matrix-primary/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="px-4 py-2 text-sm font-medium bg-azure-primary text-white rounded hover:bg-azure-active dark:bg-matrix-highlight dark:text-black dark:hover:bg-matrix-highlight/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingDb ? 'Update' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
