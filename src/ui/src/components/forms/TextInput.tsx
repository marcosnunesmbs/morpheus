import { type InputHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export function TextInput({ label, error, helperText, className, ...props }: TextInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-matrix-highlight/80">
        {label}
      </label>
      <input
        className={twMerge(
          "bg-matrix-base border border-matrix-primary text-matrix-highlight placeholder-matrix-secondary/50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-matrix-highlight focus:border-matrix-highlight transition-colors",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      />
      {helperText && !error && (
        <p className="text-xs text-matrix-secondary">{helperText}</p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
