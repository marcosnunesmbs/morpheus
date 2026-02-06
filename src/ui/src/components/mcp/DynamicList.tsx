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
