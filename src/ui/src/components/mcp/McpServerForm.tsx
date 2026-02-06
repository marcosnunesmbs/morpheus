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
