import { twMerge } from 'tailwind-merge';

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helperText?: string;
  disabled?: boolean;
}

export function Switch({ label, checked, onChange, helperText, disabled }: SwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className={twMerge("text-sm font-medium text-azure-text-primary/80 dark:text-matrix-highlight/80", disabled && "opacity-50")}>{label}</span>
        {helperText && <span className="text-xs text-azure-text-secondary dark:text-matrix-secondary">{helperText}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={twMerge(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-azure-primary dark:focus:ring-matrix-highlight focus:ring-offset-2 focus:ring-offset-azure-bg dark:focus:ring-offset-black",
          checked ? "bg-azure-primary dark:bg-matrix-highlight" : "bg-slate-300 dark:bg-matrix-primary",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={twMerge(
            "inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
