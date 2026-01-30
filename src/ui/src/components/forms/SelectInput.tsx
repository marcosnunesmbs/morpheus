import { type SelectHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { label: string; value: string | number }[];
  error?: string;
  helperText?: string;
}

export function SelectInput({ label, options, error, helperText, className, ...props }: SelectInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-matrix-highlight/80">
        {label}
      </label>
      <select
        className={twMerge(
          "bg-matrix-base border border-matrix-primary text-matrix-highlight rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-matrix-highlight focus:border-matrix-highlight transition-colors appearance-none",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-matrix-base">
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && !error && (
        <p className="text-xs text-matrix-secondary">{helperText}</p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
