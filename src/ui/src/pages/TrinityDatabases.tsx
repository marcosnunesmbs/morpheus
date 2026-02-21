import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { httpClient } from '../services/httpClient';
import { Database, Plus, RefreshCw, Trash2, Wifi, WifiOff, ChevronDown, ChevronRight, X, ShieldCheck } from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';

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
  allow_read: boolean;
  allow_insert: boolean;
  allow_update: boolean;
  allow_delete: boolean;
  allow_ddl: boolean;
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
  allow_read: boolean;
  allow_insert: boolean;
  allow_update: boolean;
  allow_delete: boolean;
  allow_ddl: boolean;
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
  allow_read: true,
  allow_insert: false,
  allow_update: false,
  allow_delete: false,
  allow_ddl: false,
};

const PERMISSION_LABELS: Record<string, { key: keyof DatabaseFormData; label: string; description: string }[]> = {
  postgresql: [
    { key: 'allow_read',   label: 'SELECT',  description: 'Permite consultas SELECT' },
    { key: 'allow_insert', label: 'INSERT',  description: 'Permite inserir registros' },
    { key: 'allow_update', label: 'UPDATE',  description: 'Permite atualizar registros' },
    { key: 'allow_delete', label: 'DELETE',  description: 'Permite excluir registros' },
    { key: 'allow_ddl',    label: 'DDL',     description: 'CREATE / ALTER / DROP TABLE' },
  ],
  mysql: [
    { key: 'allow_read',   label: 'SELECT',  description: 'Permite consultas SELECT' },
    { key: 'allow_insert', label: 'INSERT',  description: 'Permite inserir registros' },
    { key: 'allow_update', label: 'UPDATE',  description: 'Permite atualizar registros' },
    { key: 'allow_delete', label: 'DELETE',  description: 'Permite excluir registros' },
    { key: 'allow_ddl',    label: 'DDL',     description: 'CREATE / ALTER / DROP TABLE' },
  ],
  sqlite: [
    { key: 'allow_read',   label: 'SELECT',  description: 'Permite consultas SELECT' },
    { key: 'allow_insert', label: 'INSERT',  description: 'Permite inserir registros' },
    { key: 'allow_update', label: 'UPDATE',  description: 'Permite atualizar registros' },
    { key: 'allow_delete', label: 'DELETE',  description: 'Permite excluir registros' },
    { key: 'allow_ddl',    label: 'DDL',     description: 'CREATE / ALTER / DROP TABLE' },
  ],
  mongodb: [
    { key: 'allow_read',   label: 'find / aggregate',      description: 'Permite consultas e agregações' },
    { key: 'allow_insert', label: 'insertOne / insertMany', description: 'Permite inserir documentos' },
    { key: 'allow_update', label: 'updateOne / updateMany', description: 'Permite atualizar documentos' },
    { key: 'allow_delete', label: 'deleteOne / deleteMany', description: 'Permite excluir documentos' },
    { key: 'allow_ddl',    label: 'Schema changes',         description: 'createCollection / dropCollection / createIndex' },
  ],
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
  const [confirmDelete, setConfirmDelete] = useState<DatabaseRecord | null>(null);
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
      allow_read: db.allow_read,
      allow_insert: db.allow_insert,
      allow_update: db.allow_update,
      allow_delete: db.allow_delete,
      allow_ddl: db.allow_ddl,
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
        allow_read: form.allow_read,
        allow_insert: form.allow_insert,
        allow_update: form.allow_update,
        allow_delete: form.allow_delete,
        allow_ddl: form.allow_ddl,
      };

      if (useConnectionString) {
        // When editing, only send connection_string if user typed a new value
        if (!editingDb || form.connection_string) {
          payload.connection_string = form.connection_string || null;
        }
      } else {
        payload.host = form.host || null;
        payload.port = form.port ? parseInt(form.port) : null;
        payload.database_name = form.database_name || null;
        payload.username = form.username || null;
        // When editing, only send password if user typed a new value
        if (!editingDb || form.password) {
          payload.password = form.password || null;
        }
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

  const handleDelete = (db: DatabaseRecord) => {
    setConfirmDelete(db);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setDeletingId(id);
    try {
      await httpClient.delete(`/trinity/databases/${id}`);
      await mutate('/trinity/databases');
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
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
    if (type !== 'mongodb') setUseConnectionString(false);
    setForm((f) => ({
      ...f,
      type,
      port: DEFAULT_PORTS[type] ? String(DEFAULT_PORTS[type]) : '',
    }));
  };

  const togglePermission = (key: keyof DatabaseFormData) => {
    setForm((f) => ({ ...f, [key]: !f[key] }));
  };

  if (error) {
    return <div className="p-8 text-red-500">Failed to load databases: {error.message}</div>;
  }

  const inputClass =
    'w-full px-3 py-2 bg-azure-surface dark:bg-black border border-azure-border dark:border-matrix-primary rounded text-azure-text-primary dark:text-matrix-secondary font-mono text-sm focus:outline-none focus:border-azure-primary dark:focus:border-matrix-highlight';
  const labelClass = 'block text-xs font-medium text-azure-text-secondary dark:text-matrix-secondary mb-1';

  const permissionBadges = (db: DatabaseRecord) => {
    const map = [
      { key: 'allow_read' as const,   badge: 'R' },
      { key: 'allow_insert' as const, badge: 'I' },
      { key: 'allow_update' as const, badge: 'U' },
      { key: 'allow_delete' as const, badge: 'D' },
      { key: 'allow_ddl' as const,    badge: 'DDL' },
    ];
    return map.filter((m) => db[m.key]).map((m) => m.badge);
  };

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
        Register databases for Trinity to access. Configure permissions to control what operations Trinity can perform on each database.
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
            const isMultiDb = !!schema?.databases;
            const tableCount: number = isMultiDb
              ? schema.databases.reduce((acc: number, d: any) => acc + d.tables.length, 0)
              : (schema?.tables?.length ?? 0);
            const dbCount: number = isMultiDb ? schema.databases.length : 0;
            const tables: string[] = isMultiDb
              ? schema.databases.flatMap((d: any) => d.tables.map((t: any) => t.name))
              : (schema?.tables?.map((t: any) => t.name) ?? []);
            const entity = db.type === 'mongodb' ? 'collection' : 'table';
            const entities = db.type === 'mongodb' ? 'collections' : 'tables';
            const testResult = testResults[db.id];
            const isExpanded = expandedSchema[db.id];
            const badges = permissionBadges(db);

            return (
              <div
                key={db.id}
                className="border border-azure-border dark:border-matrix-primary rounded-lg overflow-hidden"
              >
                {/* Header */}
                <div className="bg-azure-surface dark:bg-black/50 px-4 py-3 flex items-center gap-3">
                  <Database className="w-5 h-5 text-azure-primary dark:text-matrix-highlight flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
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
                      {/* Permission badges */}
                      {badges.length > 0 && (
                        <div className="flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-azure-text-secondary dark:text-matrix-secondary opacity-60" />
                          {badges.map((b) => (
                            <span key={b} className="text-xs px-1.5 py-0.5 rounded bg-azure-primary/10 dark:bg-matrix-highlight/10 text-azure-primary dark:text-matrix-highlight font-mono">
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-azure-text-secondary dark:text-matrix-secondary truncate mt-0.5">
                      {db.host
                        ? `${db.host}:${db.port}${db.database_name ? `/${db.database_name}` : ''}`
                        : db.database_name || 'connection string configured'}
                      {isMultiDb && dbCount > 0 && (
                        <span className="ml-2 opacity-70">
                          · {dbCount} database{dbCount !== 1 ? 's' : ''} · {tableCount} {tableCount !== 1 ? entities : entity}
                        </span>
                      )}
                      {!isMultiDb && tableCount > 0 && (
                        <span className="ml-2 opacity-70">
                          · {tableCount} {tableCount !== 1 ? entities : entity}
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
                      onClick={() => handleDelete(db)}
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
                      {isMultiDb
                        ? `${dbCount} database${dbCount !== 1 ? 's' : ''} — ${tableCount} ${tableCount !== 1 ? entities : entity} total`
                        : `Schema — ${tableCount} ${tableCount !== 1 ? entities : entity}`}
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {isMultiDb ? (
                        schema.databases?.map((database: any) => (
                          <div key={database.name} className="text-xs">
                            {/* Database name */}
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="font-bold text-azure-primary dark:text-matrix-highlight">{database.name}</span>
                              <span className="opacity-40 text-azure-text-secondary dark:text-matrix-secondary">
                                ({database.tables.length} {database.tables.length !== 1 ? entities : entity})
                              </span>
                            </div>
                            {/* Tables within database */}
                            <div className="pl-3 space-y-1.5 border-l border-azure-border dark:border-matrix-primary/40 ml-1">
                              {database.tables.map((table: any) => (
                                <div key={table.name}>
                                  <div className="font-semibold text-azure-text-primary dark:text-matrix-secondary mb-0.5">
                                    {table.name}
                                  </div>
                                  <div className="pl-3 space-y-0.5">
                                    {table.columns?.map((col: any) => (
                                      <div key={col.name} className="text-azure-text-secondary dark:text-matrix-secondary font-mono">
                                        <span>{col.name}</span>
                                        <span className="opacity-50 ml-2">{col.type}</span>
                                        {col.nullable === false && (
                                          <span className="ml-1 opacity-40">NOT NULL</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              {database.tables.length === 0 && (
                                <div className="text-azure-text-secondary dark:text-matrix-secondary opacity-50 italic">no {entities}</div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        schema.tables?.map((table: any) => (
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
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete database"
        description={`Remove "${confirmDelete?.name}" from Trinity? The database itself won't be affected — only this registration will be deleted.`}
        confirmJson="Delete"
        variant="destructive"
      />

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

              {/* MongoDB: toggle between connection string and individual fields */}
              {form.type === 'mongodb' && (
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
              )}

              {form.type === 'mongodb' && useConnectionString ? (
                <div>
                  <label className={labelClass}>
                    Connection String {editingDb && <span className="opacity-60">(leave blank to keep existing)</span>}
                  </label>
                  <input
                    className={inputClass}
                    type="password"
                    value={form.connection_string}
                    onChange={(e) => setForm((f) => ({ ...f, connection_string: e.target.value }))}
                    placeholder={editingDb ? 'unchanged' : 'mongodb://user:pass@host:27017/dbname'}
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
                          placeholder={editingDb ? 'unchanged' : '••••••••'}
                        />
                        <p className="text-xs text-azure-text-secondary dark:text-matrix-secondary mt-1">
                          Stored encrypted with AES-256-GCM. Requires MORPHEUS_SECRET env var.
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Permissions section */}
              <div className="border-t border-azure-border dark:border-matrix-primary pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-azure-primary dark:text-matrix-highlight" />
                  <span className="text-sm font-medium text-azure-text-primary dark:text-matrix-highlight">
                    Permissões
                  </span>
                </div>
                <p className="text-xs text-azure-text-secondary dark:text-matrix-secondary mb-3">
                  Defina quais operações Trinity pode executar neste banco. Operações não permitidas retornarão erro de permissão.
                </p>
                <div className="space-y-2">
                  {PERMISSION_LABELS[form.type]?.map(({ key, label, description }) => (
                    <label key={key} className="flex items-start gap-3 cursor-pointer">
                      <div className="relative mt-0.5 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={!!form[key]}
                          onChange={() => togglePermission(key)}
                          className="sr-only"
                        />
                        <div
                          className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                            form[key]
                              ? 'bg-azure-primary dark:bg-matrix-highlight border-azure-primary dark:border-matrix-highlight'
                              : 'border-azure-border dark:border-matrix-primary bg-transparent'
                          }`}
                        >
                          {form[key] && (
                            <svg className="w-2.5 h-2.5 text-white dark:text-black" fill="none" viewBox="0 0 10 10">
                              <path d="M1.5 5l2.5 2.5L8.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-azure-text-primary dark:text-matrix-secondary font-mono">
                          {label}
                        </span>
                        <p className="text-xs text-azure-text-secondary dark:text-matrix-secondary opacity-70">
                          {description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

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
