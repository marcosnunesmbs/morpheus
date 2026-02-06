# MCP Management UI

## Goal
Implement a full MCP server management experience (CRUD + enable/disable) backed by `mcps.json`, with a React UI and protected API endpoints.

## Prerequisites
Make sure that the use is currently on the `feature/mcp-management-ui` branch before beginning implementation.
If not, move them to the correct branch. If the branch does not exist, create it from main.

### Step-by-Step Instructions

#### Step 1: Backend API - MCP CRUD Endpoints
- [x] Create `src/config/mcp-manager.ts` with the following content:

```ts
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { z } from 'zod';

import { MCPConfigFileSchema, MCPServerConfigSchema } from './schemas.js';
import { DEFAULT_MCP_TEMPLATE, type MCPConfigFile, type MCPServerConfig } from '../types/mcp.js';
import { getMorpheusDir } from './paths.js';

export type MCPServerRecord = {
  name: string;
  enabled: boolean;
  config: MCPServerConfig;
};

const MCP_FILE_NAME = 'mcps.json';
const RESERVED_KEYS = new Set(['$schema']);

const readConfigFile = async (): Promise<MCPConfigFile> => {
  const configPath = path.join(getMorpheusDir(), MCP_FILE_NAME);

  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as MCPConfigFile;
    return MCPConfigFileSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...DEFAULT_MCP_TEMPLATE };
    }

    throw error;
  }
};

const writeConfigFile = async (config: MCPConfigFile): Promise<void> => {
  const configPath = path.join(getMorpheusDir(), MCP_FILE_NAME);
  const serialized = JSON.stringify(config, null, 2) + '\n';
  await fs.writeFile(configPath, serialized, 'utf-8');
};

const isMetadataKey = (key: string): boolean => key.startsWith('_') || RESERVED_KEYS.has(key);

const normalizeName = (rawName: string): string => rawName.replace(/^\$/, '');

const findRawKey = (config: MCPConfigFile, name: string): string | null => {
  const direct = name in config ? name : null;
  if (direct) return direct;

  const prefixed = `$${name}`;
  if (prefixed in config) return prefixed;

  return null;
};

const ensureValidName = (name: string): void => {
  if (!name || name.trim().length === 0) {
    throw new Error('Name is required.');
  }

  if (name.startsWith('_') || name === '$schema') {
    throw new Error('Reserved names cannot be used for MCP servers.');
  }
};

export class MCPManager {
  static async listServers(): Promise<MCPServerRecord[]> {
    const config = await readConfigFile();
    const servers: MCPServerRecord[] = [];

    for (const [rawName, value] of Object.entries(config)) {
      if (isMetadataKey(rawName)) continue;
      if (rawName === '$schema') continue;
      if (!value || typeof value !== 'object') continue;

      try {
        const parsed = MCPServerConfigSchema.parse(value);
        const enabled = !rawName.startsWith('$');
        servers.push({
          name: normalizeName(rawName),
          enabled,
          config: parsed,
        });
      } catch {
        continue;
      }
    }

    return servers;
  }

  static async addServer(name: string, config: MCPServerConfig): Promise<void> {
    ensureValidName(name);
    const parsedConfig = MCPServerConfigSchema.parse(config);
    const file = await readConfigFile();

    const existing = findRawKey(file, name);
    if (existing) {
      throw new Error(`Server "${name}" already exists.`);
    }

    const next: MCPConfigFile = {};
    for (const [key, value] of Object.entries(file)) {
      next[key] = value;
    }

    next[name] = parsedConfig;
    await writeConfigFile(next);
  }

  static async updateServer(name: string, config: MCPServerConfig): Promise<void> {
    ensureValidName(name);
    const parsedConfig = MCPServerConfigSchema.parse(config);
    const file = await readConfigFile();

    const rawKey = findRawKey(file, name);
    if (!rawKey) {
      throw new Error(`Server "${name}" not found.`);
    }

    const next: MCPConfigFile = {};
    for (const [key, value] of Object.entries(file)) {
      if (key === rawKey) {
        next[key] = parsedConfig;
      } else {
        next[key] = value;
      }
    }

    await writeConfigFile(next);
  }

  static async deleteServer(name: string): Promise<void> {
    ensureValidName(name);
    const file = await readConfigFile();

    const rawKey = findRawKey(file, name);
    if (!rawKey) {
      throw new Error(`Server "${name}" not found.`);
    }

    const next: MCPConfigFile = {};
    for (const [key, value] of Object.entries(file)) {
      if (key === rawKey) continue;
      next[key] = value;
    }

    await writeConfigFile(next);
  }

  static async setServerEnabled(name: string, enabled: boolean): Promise<void> {
    ensureValidName(name);
    const file = await readConfigFile();

    const rawKey = findRawKey(file, name);
    if (!rawKey) {
      throw new Error(`Server "${name}" not found.`);
    }

    const targetKey = enabled ? normalizeName(rawKey) : `$${normalizeName(rawKey)}`;
    const next: MCPConfigFile = {};

    for (const [key, value] of Object.entries(file)) {
      if (key === rawKey) {
        next[targetKey] = value;
      } else {
        next[key] = value;
      }
    }

    await writeConfigFile(next);
  }
}
```

- [x] Add the following types at the end of `src/types/mcp.ts`:

```ts
export type MCPServerRecord = {
  name: string;
  enabled: boolean;
  config: MCPServerConfig;
};

export type MCPListResponse = {
  servers: MCPServerRecord[];
};
```

- [x] In `src/http/api.ts`, add these imports near existing imports:

```ts
import { z } from 'zod';
import { MCPManager } from '../config/mcp-manager.js';
import { MCPServerConfigSchema } from '../config/schemas.js';
```

- [x] In `src/http/api.ts`, add these route handlers inside the API router (near other config endpoints):

```ts
const MCPUpsertSchema = z.object({
  name: z.string().min(1),
  config: MCPServerConfigSchema,
});

const MCPToggleSchema = z.object({
  enabled: z.boolean(),
});

router.get('/mcp/servers', async (_req, res) => {
  try {
    const servers = await MCPManager.listServers();
    res.json({ servers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load MCP servers.', details: String(error) });
  }
});

router.post('/mcp/servers', async (req, res) => {
  try {
    const body = MCPUpsertSchema.parse(req.body);
    await MCPManager.addServer(body.name, body.config);
    res.status(201).json({ ok: true });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    res.status(status).json({ error: 'Failed to create MCP server.', details: error });
  }
});

router.put('/mcp/servers/:name', async (req, res) => {
  try {
    const body = MCPUpsertSchema.parse({ name: req.params.name, config: req.body?.config ?? req.body });
    await MCPManager.updateServer(body.name, body.config);
    res.json({ ok: true });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    res.status(status).json({ error: 'Failed to update MCP server.', details: error });
  }
});

router.delete('/mcp/servers/:name', async (req, res) => {
  try {
    await MCPManager.deleteServer(req.params.name);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete MCP server.', details: String(error) });
  }
});

router.patch('/mcp/servers/:name/toggle', async (req, res) => {
  try {
    const body = MCPToggleSchema.parse(req.body);
    await MCPManager.setServerEnabled(req.params.name, body.enabled);
    res.json({ ok: true });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    res.status(status).json({ error: 'Failed to toggle MCP server.', details: error });
  }
});
```

##### Step 1 Verification Checklist
- [x] Run `npm run build` and confirm no TypeScript errors.
- [x] Call `GET /api/mcp/servers` with `x-architect-pass` and see MCP list.
- [x] Create, update, delete, and toggle MCP server via API and confirm `mcps.json` updates.

#### Step 1 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 2: Frontend Service Layer
- [x] Create `src/ui/src/types/mcp.ts`:

```ts
export type MCPServerConfig =
  | {
      transport: 'stdio';
      command: string;
      args?: string[];
      env?: Record<string, string>;
      _comment?: string;
    }
  | {
      transport: 'http';
      url: string;
      headers?: Record<string, string>;
      args?: string[];
      env?: Record<string, string>;
      _comment?: string;
    };

export type MCPServerRecord = {
  name: string;
  enabled: boolean;
  config: MCPServerConfig;
};

export type MCPListResponse = {
  servers: MCPServerRecord[];
};
```

- [x] Create `src/ui/src/services/mcp.ts`:

```ts
import { HttpClient } from './httpClient';
import type { MCPListResponse, MCPServerConfig } from '../types/mcp';

const httpClient = HttpClient.getInstance();

export const mcpService = {
  fetchServers: async (): Promise<MCPListResponse> => httpClient.get<MCPListResponse>('/mcp/servers'),
  addServer: async (name: string, config: MCPServerConfig): Promise<void> =>
    httpClient.post('/mcp/servers', { name, config }),
  updateServer: async (name: string, config: MCPServerConfig): Promise<void> =>
    httpClient.put(`/mcp/servers/${encodeURIComponent(name)}`, { config }),
  deleteServer: async (name: string): Promise<void> =>
    httpClient.delete(`/mcp/servers/${encodeURIComponent(name)}`),
  toggleServer: async (name: string, enabled: boolean): Promise<void> =>
    httpClient.patch(`/mcp/servers/${encodeURIComponent(name)}/toggle`, { enabled }),
};
```

##### Step 2 Verification Checklist
- [x] Import `mcpService` in a scratch file and confirm no type errors.
- [x] Run `npm run build` (UI + backend) and confirm no errors.

#### Step 2 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 3: Frontend Components - Form & Cards
- [x] Create `src/ui/src/components/mcp/DynamicList.tsx`:

```tsx
import { useMemo } from 'react';

type StringListProps = {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

type KeyValue = { key: string; value: string };

type KeyValueListProps = {
  label: string;
  values: KeyValue[];
  onChange: (next: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
};

export const StringListInput = ({ label, values, onChange, placeholder }: StringListProps) => {
  const items = values.length > 0 ? values : [''];

  const updateItem = (index: number, nextValue: string) => {
    const next = [...items];
    next[index] = nextValue;
    onChange(next.filter((item) => item.trim().length > 0));
  };

  const addItem = () => onChange([...items, ''].filter((item) => item.trim().length > 0));
  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next.filter((item) => item.trim().length > 0));
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</div>
      {items.map((item, index) => (
        <div key={`${label}-${index}`} className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={item}
            placeholder={placeholder}
            onChange={(event) => updateItem(index, event.target.value)}
          />
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 text-sm text-slate-600 hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-300"
            onClick={() => removeItem(index)}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-semibold text-emerald-600 hover:text-emerald-500"
        onClick={addItem}
      >
        Add argument
      </button>
    </div>
  );
};

export const KeyValueListInput = ({
  label,
  values,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: KeyValueListProps) => {
  const items = useMemo(() => (values.length > 0 ? values : [{ key: '', value: '' }]), [values]);

  const updateItem = (index: number, field: 'key' | 'value', value: string) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next.filter((item) => item.key.trim().length > 0 || item.value.trim().length > 0));
  };

  const addItem = () => onChange([...items, { key: '', value: '' }].filter((item) => item.key || item.value));
  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next.filter((item) => item.key.trim().length > 0 || item.value.trim().length > 0));
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</div>
      {items.map((item, index) => (
        <div key={`${label}-${index}`} className="grid gap-2 md:grid-cols-[1fr,1fr,auto]">
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={item.key}
            placeholder={keyPlaceholder}
            onChange={(event) => updateItem(index, 'key', event.target.value)}
          />
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={item.value}
            placeholder={valuePlaceholder}
            onChange={(event) => updateItem(index, 'value', event.target.value)}
          />
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 text-sm text-slate-600 hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-300"
            onClick={() => removeItem(index)}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-semibold text-emerald-600 hover:text-emerald-500"
        onClick={addItem}
      >
        Add entry
      </button>
    </div>
  );
};
```

- [x] Create `src/ui/src/components/mcp/TransportFields.tsx`:

```tsx
import type { MCPServerConfig } from '../../types/mcp';
import { KeyValueListInput, StringListInput } from './DynamicList';

type TransportFieldsProps = {
  transport: MCPServerConfig['transport'];
  command: string;
  url: string;
  args: string[];
  env: { key: string; value: string }[];
  headers: { key: string; value: string }[];
  onCommandChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onArgsChange: (value: string[]) => void;
  onEnvChange: (value: { key: string; value: string }[]) => void;
  onHeadersChange: (value: { key: string; value: string }[]) => void;
};

export const TransportFields = ({
  transport,
  command,
  url,
  args,
  env,
  headers,
  onCommandChange,
  onUrlChange,
  onArgsChange,
  onEnvChange,
  onHeadersChange,
}: TransportFieldsProps) => {
  return (
    <div className="space-y-4">
      {transport === 'stdio' && (
        <label className="block space-y-2 text-sm text-slate-700 dark:text-slate-200">
          Command
          <input
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={command}
            onChange={(event) => onCommandChange(event.target.value)}
            placeholder="npx"
          />
        </label>
      )}

      {transport === 'http' && (
        <label className="block space-y-2 text-sm text-slate-700 dark:text-slate-200">
          URL
          <input
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="https://example.com/mcp"
          />
        </label>
      )}

      <StringListInput label="Arguments" values={args} onChange={onArgsChange} placeholder="--flag" />
      <KeyValueListInput
        label="Environment Variables"
        values={env}
        onChange={onEnvChange}
        keyPlaceholder="KEY"
        valuePlaceholder="value"
      />
      {transport === 'http' && (
        <KeyValueListInput
          label="Headers"
          values={headers}
          onChange={onHeadersChange}
          keyPlaceholder="Header"
          valuePlaceholder="value"
        />
      )}
    </div>
  );
};
```

- [x] Create `src/ui/src/components/mcp/MCPServerForm.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { z } from 'zod';
import type { MCPServerConfig, MCPServerRecord } from '../../types/mcp';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../Dialog';
import { TransportFields } from './TransportFields';

type KeyValue = { key: string; value: string };

type MCPServerFormProps = {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: MCPServerRecord;
  onClose: () => void;
  onSubmit: (name: string, config: MCPServerConfig) => Promise<void>;
};

const MCPFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  transport: z.union([z.literal('stdio'), z.literal('http')]),
  command: z.string().optional(),
  url: z.string().optional(),
});

const toKeyValue = (record?: Record<string, string>): KeyValue[] =>
  record ? Object.entries(record).map(([key, value]) => ({ key, value })) : [];

const toRecord = (items: KeyValue[]): Record<string, string> =>
  items.reduce<Record<string, string>>((acc, item) => {
    if (item.key.trim().length === 0) return acc;
    acc[item.key] = item.value;
    return acc;
  }, {});

export const MCPServerForm = ({ open, mode, initial, onClose, onSubmit }: MCPServerFormProps) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [transport, setTransport] = useState<MCPServerConfig['transport']>(initial?.config.transport ?? 'stdio');
  const [command, setCommand] = useState(
    initial?.config.transport === 'stdio' ? initial.config.command : ''
  );
  const [url, setUrl] = useState(initial?.config.transport === 'http' ? initial.config.url : '');
  const [args, setArgs] = useState<string[]>(initial?.config.args ?? []);
  const [env, setEnv] = useState<KeyValue[]>(toKeyValue(initial?.config.env));
  const [headers, setHeaders] = useState<KeyValue[]>(
    initial?.config.transport === 'http' ? toKeyValue(initial.config.headers) : []
  );
  const [error, setError] = useState<string | null>(null);

  const canEditName = mode === 'create';

  const handleSubmit = async () => {
    const form = MCPFormSchema.safeParse({ name, transport, command, url });
    if (!form.success) {
      setError(form.error.issues[0]?.message ?? 'Invalid form');
      return;
    }

    if (transport === 'stdio' && (!command || command.trim().length === 0)) {
      setError('Command is required for stdio transport.');
      return;
    }

    if (transport === 'http' && (!url || url.trim().length === 0)) {
      setError('URL is required for http transport.');
      return;
    }

    const config: MCPServerConfig =
      transport === 'stdio'
        ? {
            transport: 'stdio',
            command: command.trim(),
            args: args.length > 0 ? args : undefined,
            env: env.length > 0 ? toRecord(env) : undefined,
          }
        : {
            transport: 'http',
            url: url.trim(),
            headers: headers.length > 0 ? toRecord(headers) : undefined,
            args: args.length > 0 ? args : undefined,
            env: env.length > 0 ? toRecord(env) : undefined,
          };

    setError(null);
    await onSubmit(name.trim(), config);
  };

  const dialogTitle = useMemo(() => (mode === 'create' ? 'Add MCP Server' : 'Edit MCP Server'), [mode]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-2 text-sm text-slate-700 dark:text-slate-200">
            Name
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="coolify"
              disabled={!canEditName}
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-700 dark:text-slate-200">
            Transport
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={transport}
              onChange={(event) => setTransport(event.target.value as MCPServerConfig['transport'])}
            >
              <option value="stdio">stdio</option>
              <option value="http">http</option>
            </select>
          </label>

          <TransportFields
            transport={transport}
            command={command}
            url={url}
            args={args}
            env={env}
            headers={headers}
            onCommandChange={setCommand}
            onUrlChange={setUrl}
            onArgsChange={setArgs}
            onEnvChange={setEnv}
            onHeadersChange={setHeaders}
          />

          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-200"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-400"
              onClick={handleSubmit}
            >
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

- [x] Create `src/ui/src/components/mcp/MCPServerCard.tsx`:

```tsx
import type { MCPServerRecord } from '../../types/mcp';

type MCPServerCardProps = {
  server: MCPServerRecord;
  onEdit: (server: MCPServerRecord) => void;
  onDelete: (server: MCPServerRecord) => void;
  onToggle: (server: MCPServerRecord, enabled: boolean) => void;
};

export const MCPServerCard = ({ server, onEdit, onDelete, onToggle }: MCPServerCardProps) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{server.name}</div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{server.config.transport}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              server.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
            onClick={() => onToggle(server, !server.enabled)}
          >
            {server.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
        {server.config.transport === 'stdio' && (
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-200">Command:</span> {server.config.command}
          </div>
        )}
        {server.config.transport === 'http' && (
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-200">URL:</span> {server.config.url}
          </div>
        )}
        {server.config.args && server.config.args.length > 0 && (
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-200">Args:</span> {server.config.args.join(' ')}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-200"
          onClick={() => onEdit(server)}
        >
          Edit
        </button>
        <button
          type="button"
          className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:border-red-400 hover:text-red-500 dark:border-red-900 dark:text-red-300"
          onClick={() => onDelete(server)}
        >
          Delete
        </button>
      </div>
    </div>
  );
};
```

##### Step 3 Verification Checklist
- [x] Run `npm run build` and confirm no UI errors.
- [x] Open a scratch route and confirm components render.

#### Step 3 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 4: Frontend Page - MCP Manager
- [x] Create `src/ui/src/pages/MCPManager.tsx`:

```tsx
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { mcpService } from '../services/mcp';
import type { MCPServerConfig, MCPServerRecord } from '../types/mcp';
import { MCPServerForm } from '../components/mcp/MCPServerForm';
import { MCPServerCard } from '../components/mcp/MCPServerCard';

export const MCPManager = () => {
  const { data, error, mutate, isLoading } = useSWR('/api/mcp/servers', () => mcpService.fetchServers());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'stdio' | 'http'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MCPServerRecord | null>(null);

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
    if (editTarget) {
      await mcpService.updateServer(editTarget.name, config);
    } else {
      await mcpService.addServer(name, config);
    }

    setIsModalOpen(false);
    setEditTarget(null);
    await mutate();
  };

  const handleDelete = async (server: MCPServerRecord) => {
    await mcpService.deleteServer(server.name);
    await mutate();
  };

  const handleToggle = async (server: MCPServerRecord, enabled: boolean) => {
    await mcpService.toggleServer(server.name, enabled);
    await mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">MCP Servers</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Manage MCP servers stored in mcps.json.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-400"
          onClick={handleCreate}
        >
          Add Server
        </button>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name"
        />
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={filter}
          onChange={(event) => setFilter(event.target.value as 'all' | 'stdio' | 'http')}
        >
          <option value="all">All</option>
          <option value="stdio">stdio</option>
          <option value="http">http</option>
        </select>
      </div>

      {isLoading && <div className="text-sm text-slate-600 dark:text-slate-300">Loading MCP servers...</div>}
      {error && <div className="text-sm text-red-600">Failed to load MCP servers.</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          No MCP servers found. Add a server to get started.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((server) => (
          <MCPServerCard
            key={`${server.name}-${server.enabled ? 'on' : 'off'}`}
            server={server}
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
    </div>
  );
};
```

##### Step 4 Verification Checklist
- [x] Visit `/mcp-servers` and verify grid rendering.
- [x] Add, edit, delete, and toggle MCP servers via UI.

#### Step 4 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 5: Integration - Routing & Navigation
- [x] In `src/ui/src/App.tsx`, add a route import and route entry:

```tsx
import { MCPManager } from './pages/MCPManager';
```

```tsx
<Route path="/mcp-servers" element={<MCPManager />} />
```

- [x] In `src/ui/src/components/Layout.tsx`, add a nav item:

```tsx
import { Puzzle } from 'lucide-react';
```

```tsx
{ icon: Puzzle, label: 'MCP Servers', path: '/mcp-servers' },
```

##### Step 5 Verification Checklist
- [x] Sidebar shows "MCP Servers" after Configuration.
- [x] Clicking it navigates to the MCP page.

#### Step 5 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 6: Connection Testing
- [ ] Add the following function to `src/config/mcp-manager.ts`:

```ts
  static async testServer(name: string): Promise<{ ok: boolean; message?: string }> {
    const servers = await MCPManager.listServers();
    const target = servers.find((server) => server.name === name);

    if (!target) {
      return { ok: false, message: 'Server not found.' };
    }

    if (target.config.transport === 'http') {
      try {
        const response = await fetch(target.config.url, { method: 'POST' });
        return { ok: response.ok, message: response.ok ? undefined : `HTTP ${response.status}` };
      } catch (error) {
        return { ok: false, message: String(error) };
      }
    }

    return { ok: true };
  }
```

- [ ] In `src/http/api.ts`, add a test endpoint:

```ts
router.post('/mcp/servers/:name/test', async (req, res) => {
  try {
    const result = await MCPManager.testServer(req.params.name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to test MCP server.', details: String(error) });
  }
});
```

- [ ] In `src/ui/src/components/mcp/MCPServerCard.tsx`, add a test button:

```tsx
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle');

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await fetch(`/api/mcp/servers/${encodeURIComponent(server.name)}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      setTestResult(data.ok ? 'ok' : 'fail');
    } finally {
      setTesting(false);
    }
  };
```

```tsx
<button
  type="button"
  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-200"
  onClick={handleTest}
  disabled={testing}
>
  {testing ? 'Testing...' : testResult === 'ok' ? 'Connected' : testResult === 'fail' ? 'Failed' : 'Test'}
</button>
```

##### Step 6 Verification Checklist
- [ ] Click "Test" and verify results change to "Connected" or "Failed".
- [ ] Confirm API returns `{ ok: true }` for valid HTTP servers.

#### Step 6 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.
