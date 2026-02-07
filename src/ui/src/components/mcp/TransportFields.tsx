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
        <>
          <label className="block space-y-2 text-sm text-azure-text-primary dark:text-matrix-highlight">
            Command
            <input
              className="w-full rounded-md border border-azure-border bg-azure-surface px-3 py-2 text-sm text-azure-text-primary shadow-sm focus:border-azure-primary focus:outline-none dark:border-matrix-primary dark:bg-zinc-950 dark:text-matrix-highlight"
              value={command}
              onChange={(event) => onCommandChange(event.target.value)}
              placeholder="npx"
            />
          </label>
          <StringListInput label="Arguments" values={args} onChange={onArgsChange} placeholder="--flag" />
        </>
      )}

      {transport === 'http' && (
        <label className="block space-y-2 text-sm text-azure-text-primary dark:text-matrix-highlight">
          URL
          <input
            className="w-full rounded-md border border-azure-border bg-azure-surface px-3 py-2 text-sm text-azure-text-primary shadow-sm focus:border-azure-primary focus:outline-none dark:border-matrix-primary dark:bg-zinc-950 dark:text-matrix-highlight"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="https://example.com/mcp"
          />
        </label>
      )}
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
