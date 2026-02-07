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

  const addItem = () => onChange([...items, '']);
  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next.filter((item) => item.trim().length > 0));
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-azure-text-primary dark:text-matrix-highlight">{label}</div>
      {items.map((item, index) => (
        <div key={`${label}-${index}`} className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-azure-border bg-azure-surface px-3 py-2 text-sm text-azure-text-primary shadow-sm focus:border-azure-primary focus:outline-none dark:border-matrix-primary dark:bg-zinc-950 dark:text-matrix-highlight"
            value={item}
            placeholder={placeholder}
            onChange={(event) => updateItem(index, event.target.value)}
          />
          <button
            type="button"
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:border-red-400 hover:text-red-500 dark:border-red-900 dark:text-red-400"
            onClick={() => removeItem(index)}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-semibold text-azure-primary hover:text-azure-secondary dark:text-matrix-highlight hover:dark:text-matrix-secondary"
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

  const addItem = () => onChange([...items, { key: '', value: '' }]);
  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next.filter((item) => item.key.trim().length > 0 || item.value.trim().length > 0));
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-azure-text-primary dark:text-matrix-highlight">{label}</div>
      {items.map((item, index) => (
        <div key={`${label}-${index}`} className="grid gap-2 md:grid-cols-5">
          <input
            className="col-span-2 rounded-md border border-azure-border bg-azure-surface px-3 py-2 text-sm text-azure-text-primary shadow-sm focus:border-azure-primary focus:outline-none dark:border-matrix-primary dark:bg-zinc-950 dark:text-matrix-highlight"
            value={item.key}
            placeholder={keyPlaceholder}
            onChange={(event) => updateItem(index, 'key', event.target.value)}
          />
          <input
            className="col-span-2 rounded-md border border-azure-border bg-azure-surface px-3 py-2 text-sm text-azure-text-primary shadow-sm focus:border-azure-primary focus:outline-none dark:border-matrix-primary dark:bg-zinc-950 dark:text-matrix-highlight"
            value={item.value}
            placeholder={valuePlaceholder}
            onChange={(event) => updateItem(index, 'value', event.target.value)}
          />
          <button
            type="button"
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:border-red-400 hover:text-red-500 dark:border-red-900 dark:text-red-400"
            onClick={() => removeItem(index)}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-semibold text-azure-primary hover:text-azure-secondary dark:text-matrix-highlight hover:dark:text-matrix-secondary"
        onClick={addItem}
      >
        Add entry
      </button>
    </div>
  );
};
